<script lang="ts">
  import { onMount } from "svelte";
  import { t } from "$lib/i18n";

  let {
    coordinates,
    follow = true,
  }: { coordinates: [number, number][]; follow?: boolean } = $props();
  let container = $state<HTMLDivElement>();
  let map = $state<import("leaflet").Map>();
  let line = $state<import("leaflet").Polyline>();
  let marker = $state<import("leaflet").CircleMarker>();
  let leaflet = $state<typeof import("leaflet")>();
  let didFit = false;

  $effect(() => {
    if (!map || !line || !marker || !leaflet || coordinates.length === 0)
      return;
    const points = coordinates.map(([longitude, latitude]) =>
      leaflet!.latLng(latitude, longitude),
    );
    line.setLatLngs(points);
    marker.setLatLng(points.at(-1)!);
    if (!didFit && points.length >= 2) {
      map.fitBounds(line.getBounds(), { padding: [36, 36] });
      didFit = true;
    } else if (follow) {
      map.panTo(points.at(-1)!, { animate: true, duration: 0.35 });
    }
  });

  onMount(() => {
    if (!container) return;
    let disposed = false;
    let observer: ResizeObserver | undefined;
    void import("leaflet").then((L) => {
      if (disposed || !container) return;
      leaflet = L;
      map = L.map(container, {
        zoomControl: false,
        attributionControl: true,
        preferCanvas: true,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: t("map_attribution"),
      }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      line = L.polyline([], {
        color: "#166534",
        weight: 5,
        lineCap: "round",
      }).addTo(map);
      marker = L.circleMarker([0, 0], {
        radius: 9,
        color: "#fff",
        weight: 3,
        fillColor: "#f97316",
        fillOpacity: 1,
      }).addTo(map);
      map.setView([59.3293, 18.0686], 12);
      observer = new ResizeObserver(() => map?.invalidateSize());
      observer.observe(container);
    });
    return () => {
      disposed = true;
      observer?.disconnect();
      map?.remove();
    };
  });
</script>

<div
  class="live-route-map"
  bind:this={container}
  aria-label={t("live_workout_route")}
></div>
