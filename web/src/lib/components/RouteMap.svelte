<script lang="ts">
  import { onMount } from "svelte";
  import { MapPinOff } from "@lucide/svelte";
  import { ActivityMapStyle } from "$lib/activity-types";
  import { t } from "$lib/i18n";

  let {
    coordinates,
    mode = ActivityMapStyle.Route,
    compact = false,
    showEndpoints = true,
    route = [],
    medals = [],
    highlight = null,
    onPointHover,
  }: {
    coordinates: [number, number][] | null;
    mode?: ActivityMapStyle;
    compact?: boolean;
    showEndpoints?: boolean;
    route?: { time: number; coordinate: [number, number] }[];
    medals?: {
      type: string;
      rank: number;
      endTime: number;
      distance: number;
      isPower: boolean;
      label: string;
    }[];
    highlight?: {
      startTime: number;
      endTime: number;
      pointTime?: number;
    } | null;
    onPointHover?: (point: { time: number } | null) => void;
  } = $props();
  let container = $state<HTMLDivElement>();
  let map = $state<import("leaflet").Map>();
  let leaflet = $state<typeof import("leaflet")>();
  let highlightLine = $state<import("leaflet").Polyline>();
  let highlightStart = $state<import("leaflet").CircleMarker>();
  let highlightEnd = $state<import("leaflet").CircleMarker>();
  let highlightPoint = $state<import("leaflet").CircleMarker>();
  let routeLines = $state<
    { line: import("leaflet").Polyline; opacity: number }[]
  >([]);
  let medalMarkers: import("leaflet").Marker[] = [];

  function medalCoordinate(endTime: number): [number, number] | null {
    if (route.length === 0) return null;
    const exact = route.find((point) => point.time === endTime);
    if (exact) return exact.coordinate;
    for (let index = 1; index < route.length; index++) {
      const before = route[index - 1]!;
      const after = route[index]!;
      if (endTime < before.time || endTime > after.time) continue;
      if (after.time === before.time) return after.coordinate;
      const ratio = (endTime - before.time) / (after.time - before.time);
      return [
        before.coordinate[0] +
          ratio * (after.coordinate[0] - before.coordinate[0]),
        before.coordinate[1] +
          ratio * (after.coordinate[1] - before.coordinate[1]),
      ];
    }
    return route.reduce((closest, point) =>
      Math.abs(point.time - endTime) < Math.abs(closest.time - endTime)
        ? point
        : closest,
    ).coordinate;
  }

  function escapeHtml(value: string): string {
    return value.replace(
      /[&<>\"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character]!,
    );
  }

  function medalIcon(L: typeof import("leaflet"), rank: number, label: string) {
    const color = rank === 1 ? "#efaa00" : rank === 2 ? "#7b8583" : "#be6739";
    return L.divIcon({
      className: "route-medal-marker",
      html: `<span style="--medal-color:${color}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.21 15 2.66 7.14A2 2 0 0 1 4.3 4h15.4a2 2 0 0 1 1.64 3.14L16.79 15"/><path d="M11 12 5.12 2.2"/><path d="m13 12 5.88-9.8"/><circle cx="12" cy="16" r="6"/><path d="M12 18v-4"/><path d="m9.5 16 2.5-2 2.5 2"/></svg><strong>${escapeHtml(label)}</strong><em>${t("lifetime")}</em></span>`,
      iconSize: [190, 38],
      iconAnchor: [16, 36],
    });
  }

  $effect(() => {
    if (!map || !leaflet) return;
    const renderMedals = () => {
      for (const marker of medalMarkers) marker.remove();
      const placed: import("leaflet").Point[] = [];
      medalMarkers = medals
        .slice()
        .sort((left, right) => {
          if (
            !left.isPower &&
            !right.isPower &&
            left.distance !== right.distance
          ) {
            return right.distance - left.distance;
          }
          return left.rank - right.rank;
        })
        .flatMap((medal) => {
          const coordinate = medalCoordinate(medal.endTime);
          if (!coordinate) return [];
          const point = map!.latLngToLayerPoint([coordinate[1], coordinate[0]]);
          if (placed.some((other) => point.distanceTo(other) < 44)) return [];
          placed.push(point);
          return leaflet!
            .marker([coordinate[1], coordinate[0]], {
              icon: medalIcon(leaflet!, medal.rank, medal.label),
              title: t("medal_title", { label: medal.label }),
              interactive: false,
              zIndexOffset: 500,
            })
            .addTo(map!);
        });
    };
    renderMedals();
    map.on("zoomend", renderMedals);
    return () => {
      map?.off("zoomend", renderMedals);
    };
  });

  $effect(() => {
    if (
      !map ||
      !leaflet ||
      !highlightLine ||
      !highlightStart ||
      !highlightEnd ||
      !highlightPoint
    )
      return;
    const L = leaflet;
    for (const { line, opacity } of routeLines) {
      line.setStyle({ opacity });
    }
    if (!highlight) {
      highlightLine.setLatLngs([]);
      highlightStart.setStyle({ opacity: 0, fillOpacity: 0 });
      highlightEnd.setStyle({ opacity: 0, fillOpacity: 0 });
      highlightPoint.setStyle({ opacity: 0, fillOpacity: 0 });
      return;
    }

    const selected =
      highlight.endTime > highlight.startTime
        ? route.filter(
            (point) =>
              point.time >= highlight.startTime &&
              point.time <= highlight.endTime,
          )
        : [];
    const points = selected.map(({ coordinate }) =>
      L.latLng(coordinate[1], coordinate[0]),
    );
    highlightLine.setLatLngs(points);
    if (points.length > 0) {
      highlightStart
        .setLatLng(points[0]!)
        .setStyle({ opacity: 1, fillOpacity: 1 });
      highlightEnd
        .setLatLng(points.at(-1)!)
        .setStyle({ opacity: 1, fillOpacity: 1 });
    } else {
      highlightStart.setStyle({ opacity: 0, fillOpacity: 0 });
      highlightEnd.setStyle({ opacity: 0, fillOpacity: 0 });
    }
    if (highlight.pointTime != null) {
      const point = route.reduce((closest, candidate) =>
        Math.abs(candidate.time - highlight.pointTime!) <
        Math.abs(closest.time - highlight.pointTime!)
          ? candidate
          : closest,
      );
      highlightPoint
        .setLatLng([point.coordinate[1], point.coordinate[0]])
        .setStyle({ opacity: 1, fillOpacity: 1 });
    } else {
      highlightPoint.setStyle({ opacity: 0, fillOpacity: 0 });
    }
  });

  onMount(() => {
    if (!container || !coordinates || coordinates.length < 2) return;

    const mapContainer = container;
    let disposed = false;
    let observer: ResizeObserver | undefined;

    void import("leaflet").then((L) => {
      if (disposed) return;
      leaflet = L;
      map = L.map(mapContainer, {
        zoomControl: false,
        attributionControl: true,
        preferCanvas: true,
        dragging: !compact,
        scrollWheelZoom: !compact,
        doubleClickZoom: !compact,
        touchZoom: !compact,
        keyboard: !compact,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: t("map_attribution"),
      }).addTo(map);
      if (!compact) L.control.zoom({ position: "bottomright" }).addTo(map);

      const points = coordinates.map(([longitude, latitude]) =>
        L.latLng(latitude, longitude),
      );
      const boundsLayer = L.polyline(points);

      if (mode === ActivityMapStyle.Heatmap) {
        const renderer = L.canvas({ padding: 0.5 });
        L.polyline(points, {
          color: "#f97316",
          weight: 4,
          opacity: 0.28,
          lineCap: "round",
          renderer,
        }).addTo(map);

        // Aggregate samples into a bounded grid before drawing. This preserves
        // dwell density without creating a Leaflet layer for every GPS record.
        const bounds = boundsLayer.getBounds();
        const cellSize =
          Math.max(
            bounds.getNorth() - bounds.getSouth(),
            bounds.getEast() - bounds.getWest(),
          ) / 80 || 0.00001;
        const cells = new Map<
          string,
          { point: (typeof points)[number]; count: number }
        >();
        for (const point of points) {
          const key = `${Math.floor(point.lat / cellSize)}:${Math.floor(point.lng / cellSize)}`;
          const cell = cells.get(key);
          if (cell) {
            cell.count++;
          } else {
            cells.set(key, { point, count: 1 });
          }
        }
        const maxDensity = Math.max(
          ...Array.from(cells.values(), ({ count }) => count),
        );
        for (const { point, count } of cells.values()) {
          const intensity = Math.sqrt(count / maxDensity);
          L.circleMarker(point, {
            renderer,
            radius: 5 + intensity * 16,
            stroke: false,
            fillColor:
              intensity > 0.65
                ? "#fde047"
                : intensity > 0.3
                  ? "#fb923c"
                  : "#f97316",
            fillOpacity: 0.06 + intensity * 0.46,
            interactive: false,
          }).addTo(map);
        }
      } else {
        const outline = L.polyline(points, {
          color: "#ffffff",
          weight: compact ? 7 : 9,
          opacity: 0.9,
          lineCap: "round",
        }).addTo(map);
        const routeLine = L.polyline(points, {
          color: "#166534",
          weight: compact ? 4 : 5,
          opacity: 1,
          lineCap: "round",
        }).addTo(map);
        routeLines = [
          { line: outline, opacity: 0.9 },
          { line: routeLine, opacity: 1 },
        ];
        const hitArea = L.polyline(points, {
          color: "#000",
          weight: 24,
          opacity: 0,
          interactive: true,
        }).addTo(map);
        const updatePoint = (event: import("leaflet").LeafletMouseEvent) => {
          const nearest = route.reduce(
            (closest, candidate) => {
              const candidatePoint = L.latLng(
                candidate.coordinate[1],
                candidate.coordinate[0],
              );
              const candidateDistance = candidatePoint.distanceTo(event.latlng);
              return candidateDistance < closest.distance
                ? { point: candidate, distance: candidateDistance }
                : closest;
            },
            { point: route[0], distance: Number.POSITIVE_INFINITY } as {
              point: (typeof route)[number];
              distance: number;
            },
          );
          onPointHover?.(nearest.point);
        };
        hitArea.on("mousemove mouseover", (event) =>
          updatePoint(event as import("leaflet").LeafletMouseEvent),
        );
        hitArea.on("mouseout", () => onPointHover?.(null));
        if (showEndpoints) {
          L.circleMarker(points[0], {
            radius: 7,
            color: "#fff",
            weight: 3,
            fillColor: "#166534",
            fillOpacity: 1,
            interactive: false,
          }).addTo(map);
          L.circleMarker(points.at(-1)!, {
            radius: 7,
            color: "#fff",
            weight: 3,
            fillColor: "#d97706",
            fillOpacity: 1,
            interactive: false,
          }).addTo(map);
        }
      }

      // Keep these layers alive and only replace their coordinates on hover.
      // Recreating layers and moving the tiled map made rapid split selection visibly stall.
      highlightLine = L.polyline([], {
        color: "#f97316",
        weight: compact ? 6 : 7,
        opacity: 1,
        lineCap: "round",
        interactive: false,
      }).addTo(map);
      highlightStart = L.circleMarker([0, 0], {
        radius: 6,
        color: "#fff",
        weight: 2,
        opacity: 0,
        fillColor: "#f97316",
        fillOpacity: 0,
        interactive: false,
      }).addTo(map);
      highlightEnd = L.circleMarker([0, 0], {
        radius: 6,
        color: "#fff",
        weight: 2,
        opacity: 0,
        fillColor: "#f97316",
        fillOpacity: 0,
        interactive: false,
      }).addTo(map);
      highlightPoint = L.circleMarker([0, 0], {
        radius: 8,
        color: "#fff",
        weight: 3,
        opacity: 0,
        fillColor: "#0ea5e9",
        fillOpacity: 0,
        interactive: false,
      }).addTo(map);

      map.fitBounds(boundsLayer.getBounds(), { padding: [36, 36] });

      observer = new ResizeObserver(() => map?.invalidateSize());
      observer.observe(mapContainer);
    });

    return () => {
      disposed = true;
      observer?.disconnect();
      map?.remove();
      map = undefined;
      leaflet = undefined;
      highlightLine = undefined;
      highlightStart = undefined;
      highlightEnd = undefined;
      highlightPoint = undefined;
      routeLines = [];
      medalMarkers = [];
    };
  });
</script>

{#if coordinates && coordinates.length >= 2}
  <div
    class:route-map-compact={compact}
    class="route-map"
    bind:this={container}
    aria-label={mode === ActivityMapStyle.Heatmap
      ? t("activity_density_map")
      : t("activity_route_map")}
  ></div>
{:else}
  <div class="map-empty">
    <MapPinOff size={27} /><strong>{t("no_gps_route")}</strong><span
      >{t("no_location_data")}</span
    >
  </div>
{/if}
