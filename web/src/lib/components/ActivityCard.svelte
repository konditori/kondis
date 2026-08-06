<script lang="ts">
  import { ArrowUpRight, Clock3, Gauge, Mountain } from '@lucide/svelte';
  import type { Activity } from '$lib/types';
  import { activityName, distance, duration, localTime, sportIcon } from '$lib/format';

  let { activity }: { activity: Activity } = $props();
  const Icon = $derived(sportIcon(activity.sport));
</script>

<a class="activity-card" href={`/activities/${activity.id}`}>
  <div class="sport-badge"><Icon size={24} strokeWidth={1.8} /></div>
  <div class="activity-primary">
    <div class="activity-title"><h3>{activityName(activity)}</h3><ArrowUpRight size={17} /></div>
    <p><span>{localTime(activity.startedAt)}</span>{activity.subSport ? ` · ${activity.subSport.replaceAll('_', ' ')}` : ''}</p>
  </div>
  <div class="activity-stat"><Gauge size={16} /><span><strong>{distance(activity.distance)}</strong><small>Distance</small></span></div>
  <div class="activity-stat"><Clock3 size={16} /><span><strong>{duration(activity.movingTime ?? activity.elapsedTime)}</strong><small>Moving time</small></span></div>
  <div class="activity-stat optional"><Mountain size={16} /><span><strong>{activity.elevationGain == null ? '—' : `${Math.round(activity.elevationGain)} m`}</strong><small>Elevation</small></span></div>
</a>
