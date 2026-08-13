<script lang="ts">
  import { onMount } from 'svelte';
  import { MapPinOff } from '@lucide/svelte';
  import { ActivityMapStyle } from '$lib/activity-types';

  let {
    coordinates,
    mode = ActivityMapStyle.Route,
    compact = false,
    showEndpoints = true,
  }: {
    coordinates: [number, number][] | null;
    mode?: ActivityMapStyle;
    compact?: boolean;
    showEndpoints?: boolean;
  } = $props();
  let container = $state<HTMLDivElement>();

  onMount(() => {
    if (!container || !coordinates || coordinates.length < 2) return;

    const mapContainer = container;
    let disposed = false;
    let map: import('leaflet').Map | undefined;
    let observer: ResizeObserver | undefined;

    void import('leaflet').then((L) => {
      if (disposed) return;
      map = L.map(mapContainer, {
        zoomControl: false,
        attributionControl: true,
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
        L.polyline(points, { color: '#ffffff', weight: compact ? 7 : 9, opacity: 0.9, lineCap: 'round' }).addTo(map);
        L.polyline(points, { color: '#166534', weight: compact ? 4 : 5, opacity: 1, lineCap: 'round' }).addTo(map);
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

      map.fitBounds(boundsLayer.getBounds(), { padding: [36, 36] });

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
  <div class:route-map-compact={compact} class="route-map" bind:this={container} aria-label={mode === ActivityMapStyle.Heatmap ? 'Activity density map' : 'Activity route map'}></div>
{:else}
  <div class="map-empty"><MapPinOff size={27} /><strong>No GPS route</strong><span>This activity did not include location data.</span></div>
{/if}
