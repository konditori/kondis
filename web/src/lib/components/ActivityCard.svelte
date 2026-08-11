<script lang="ts">
  import { ArrowUpRight, Clock3, Gauge, Medal, Mountain } from '@lucide/svelte';
  import { goto } from '$app/navigation';
  import { activityTypeLabel, sportIcon } from '$lib/activity-types';
  import type { Activity } from '$lib/types';
  import type { UnitSystem } from '$lib/units';
  import { activityName, distance, duration, elevation, localTime } from '$lib/format';

  let { activity, unitSystem }: { activity: Activity; unitSystem: UnitSystem } = $props();
  const Icon = $derived(sportIcon(activity.sport));

  function openActivity(event: MouseEvent) {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      void goto(`/activities/${activity.id}`, { state: { fromActivityList: true } });
    }
  }
</script>

<a class="activity-card" href={`/activities/${activity.id}`} onclick={openActivity}>
  <div class="sport-badge"><Icon size={24} strokeWidth={1.8} /></div>
  <div class="activity-primary">
    <div class="activity-title"><h3>{activityName(activity)}</h3><ArrowUpRight size={17} /></div>
    <p><span>{localTime(activity.startedAt)} · {activityTypeLabel(activity.sport)}</span></p>
    {#if activity.topBestEfforts?.length}
      <div class="activity-achievements">
        {#each activity.topBestEfforts as effort}
          <span class={`activity-achievement rank-${effort.yearRank}`} title={`${effort.label}: ${effort.yearRank === 1 ? 'personal record for the year' : `#${effort.yearRank} for the year`}`} aria-label={`${effort.label}: ${effort.yearRank === 1 ? 'personal record for the year' : `number ${effort.yearRank} for the year`}`}><Medal size={15} /></span>
        {/each}
      </div>
    {/if}
  </div>
  <div class="activity-stat"><Gauge size={16} /><span><strong>{distance(activity.distance, unitSystem)}</strong><small>Distance</small></span></div>
  <div class="activity-stat"><Clock3 size={16} /><span><strong>{duration(activity.movingTime ?? activity.elapsedTime)}</strong><small>Moving time</small></span></div>
  <div class="activity-stat optional"><Mountain size={16} /><span><strong>{elevation(activity.elevationGain, unitSystem)}</strong><small>Elevation</small></span></div>
</a>
