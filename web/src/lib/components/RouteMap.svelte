<script lang="ts">
  import { onMount } from 'svelte';
  import { MapPinOff } from '@lucide/svelte';
  import { ActivityMapStyle } from '$lib/activity-types';

  let {
    coordinates,
    mode = ActivityMapStyle.Route,
    compact = false,
    showEndpoints = true,
    route = [],
    highlight = null,
  }: {
    coordinates: [number, number][] | null;
    mode?: ActivityMapStyle;
    compact?: boolean;
    showEndpoints?: boolean;
    route?: { time: number; coordinate: [number, number] }[];
    highlight?: { startTime: number; endTime: number; pointTime?: number } | null;
  } = $props();
  let container = $state<HTMLDivElement>();
  let map = $state<import('leaflet').Map>();
  let leaflet = $state<typeof import('leaflet')>();
  let highlightLine = $state<import('leaflet').Polyline>();
  let highlightStart = $state<import('leaflet').CircleMarker>();
  let highlightEnd = $state<import('leaflet').CircleMarker>();
  let highlightPoint = $state<import('leaflet').CircleMarker>();
  let routeLines = $state<{ line: import('leaflet').Polyline; opacity: number }[]>([]);

  $effect(() => {
    if (!map || !leaflet || !highlightLine || !highlightStart || !highlightEnd || !highlightPoint) return;
    const L = leaflet;
    const hasRange = highlight !== null && highlight.endTime > highlight.startTime;
    for (const { line, opacity } of routeLines) {
      line.setStyle({ opacity: hasRange ? opacity * 0.28 : opacity });
    }
    if (!highlight) {
      highlightLine.setLatLngs([]);
      highlightStart.setStyle({ opacity: 0, fillOpacity: 0 });
      highlightEnd.setStyle({ opacity: 0, fillOpacity: 0 });
      highlightPoint.setStyle({ opacity: 0, fillOpacity: 0 });
      return;
    }

    const selected = highlight.endTime > highlight.startTime
      ? route.filter((point) => point.time >= highlight.startTime && point.time <= highlight.endTime)
      : [];
    const points = selected.map(({ coordinate }) => L.latLng(coordinate[1], coordinate[0]));
    highlightLine.setLatLngs(points);
    if (points.length > 0) {
      highlightStart.setLatLng(points[0]!).setStyle({ opacity: 1, fillOpacity: 1 });
      highlightEnd.setLatLng(points.at(-1)!).setStyle({ opacity: 1, fillOpacity: 1 });
    } else {
      highlightStart.setStyle({ opacity: 0, fillOpacity: 0 });
      highlightEnd.setStyle({ opacity: 0, fillOpacity: 0 });
    }
    if (highlight.pointTime != null) {
      const point = route.reduce((closest, candidate) =>
        Math.abs(candidate.time - highlight.pointTime!) < Math.abs(closest.time - highlight.pointTime!) ? candidate : closest,
      );
      highlightPoint.setLatLng([point.coordinate[1], point.coordinate[0]]).setStyle({ opacity: 1, fillOpacity: 1 });
    } else {
      highlightPoint.setStyle({ opacity: 0, fillOpacity: 0 });
    }
  });

  onMount(() => {
    if (!container || !coordinates || coordinates.length < 2) return;

    const mapContainer = container;
    let disposed = false;
    let observer: ResizeObserver | undefined;

    void import('leaflet').then((L) => {
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
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      if (!compact) L.control.zoom({ position: 'bottomright' }).addTo(map);

      const points = coordinates.map(([longitude, latitude]) => L.latLng(latitude, longitude));
      const boundsLayer = L.polyline(points);

      if (mode === ActivityMapStyle.Heatmap) {
        const renderer = L.canvas({ padding: 0.5 });
        L.polyline(points, { color: '#f97316', weight: 4, opacity: 0.28, lineCap: 'round', renderer }).addTo(map);

        // Aggregate samples into a bounded grid before drawing. This preserves
        // dwell density without creating a Leaflet layer for every GPS record.
        const bounds = boundsLayer.getBounds();
        const cellSize =
          Math.max(bounds.getNorth() - bounds.getSouth(), bounds.getEast() - bounds.getWest()) / 80 || 0.00001;
        const cells = new Map<string, { point: (typeof points)[number]; count: number }>();
        for (const point of points) {
          const key = `${Math.floor(point.lat / cellSize)}:${Math.floor(point.lng / cellSize)}`;
          const cell = cells.get(key);
          if (cell) {
            cell.count++;
          } else {
            cells.set(key, { point, count: 1 });
          }
        }
        const maxDensity = Math.max(...Array.from(cells.values(), ({ count }) => count));
        for (const { point, count } of cells.values()) {
          const intensity = Math.sqrt(count / maxDensity);
          L.circleMarker(point, {
            renderer,
            radius: 5 + intensity * 16,
            stroke: false,
            fillColor: intensity > 0.65 ? '#fde047' : intensity > 0.3 ? '#fb923c' : '#f97316',
            fillOpacity: 0.06 + intensity * 0.46,
            interactive: false,
          }).addTo(map);
        }
      } else {
        const outline = L.polyline(points, { color: '#ffffff', weight: compact ? 7 : 9, opacity: 0.9, lineCap: 'round' }).addTo(map);
        const route = L.polyline(points, { color: '#166534', weight: compact ? 4 : 5, opacity: 1, lineCap: 'round' }).addTo(map);
        routeLines = [
          { line: outline, opacity: 0.9 },
          { line: route, opacity: 1 },
        ];
        if (showEndpoints) {
          L.circleMarker(points[0], {
            radius: 7,
            color: '#fff',
            weight: 3,
            fillColor: '#166534',
            fillOpacity: 1,
          }).addTo(map);
          L.circleMarker(points.at(-1)!, {
            radius: 7,
            color: '#fff',
            weight: 3,
            fillColor: '#d97706',
            fillOpacity: 1,
          }).addTo(map);
        }
      }

      // Keep these layers alive and only replace their coordinates on hover.
      // Recreating layers and moving the tiled map made rapid split selection visibly stall.
      highlightLine = L.polyline([], {
        color: '#f97316',
        weight: compact ? 6 : 7,
        opacity: 1,
        lineCap: 'round',
        interactive: false,
      }).addTo(map);
      highlightStart = L.circleMarker([0, 0], {
        radius: 6,
        color: '#fff',
        weight: 2,
        opacity: 0,
        fillColor: '#f97316',
        fillOpacity: 0,
        interactive: false,
      }).addTo(map);
      highlightEnd = L.circleMarker([0, 0], {
        radius: 6,
        color: '#fff',
        weight: 2,
        opacity: 0,
        fillColor: '#f97316',
        fillOpacity: 0,
        interactive: false,
      }).addTo(map);
      highlightPoint = L.circleMarker([0, 0], {
        radius: 8,
        color: '#fff',
        weight: 3,
        opacity: 0,
        fillColor: '#0ea5e9',
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
    };
  });
</script>

{#if coordinates && coordinates.length >= 2}
  <div class:route-map-compact={compact} class="route-map" bind:this={container} aria-label={mode === ActivityMapStyle.Heatmap ? 'Activity density map' : 'Activity route map'}></div>
{:else}
  <div class="map-empty"><MapPinOff size={27} /><strong>No GPS route</strong><span>This activity did not include location data.</span></div>
{/if}
