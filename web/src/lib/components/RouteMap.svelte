<script lang="ts">
  import { onMount } from 'svelte';
  import { MapPinOff } from '@lucide/svelte';

  let { coordinates }: { coordinates: [number, number][] | null } = $props();
  let container = $state<HTMLDivElement>();

  onMount(() => {
    if (!container || !coordinates || coordinates.length < 2) return;

    const mapContainer = container;
    let disposed = false;
    let map: import('leaflet').Map | undefined;
    let observer: ResizeObserver | undefined;

    void import('leaflet').then((L) => {
      if (disposed) return;
      map = L.map(mapContainer, { zoomControl: false, attributionControl: true });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const points = coordinates.map(([longitude, latitude]) => L.latLng(latitude, longitude));
      const outline = L.polyline(points, { color: '#ffffff', weight: 9, opacity: 0.9, lineCap: 'round' }).addTo(map);
      L.polyline(points, { color: '#166534', weight: 5, opacity: 1, lineCap: 'round' }).addTo(map);
      L.circleMarker(points[0], { radius: 7, color: '#fff', weight: 3, fillColor: '#166534', fillOpacity: 1 }).addTo(map);
      L.circleMarker(points.at(-1)!, { radius: 7, color: '#fff', weight: 3, fillColor: '#d97706', fillOpacity: 1 }).addTo(map);
      map.fitBounds(outline.getBounds(), { padding: [36, 36] });

      observer = new ResizeObserver(() => map?.invalidateSize());
      observer.observe(mapContainer);
    });

    return () => {
      disposed = true;
      observer?.disconnect();
      map?.remove();
    };
  });
</script>

{#if coordinates && coordinates.length >= 2}
  <div class="route-map" bind:this={container} aria-label="Activity route map"></div>
{:else}
  <div class="map-empty"><MapPinOff size={27} /><strong>No GPS route</strong><span>This activity did not include location data.</span></div>
{/if}
