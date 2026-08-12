<script lang="ts">
  import { ArrowUpRight, Clock3, Gauge, Medal, Mountain } from '@lucide/svelte';
  import { goto } from '$app/navigation';
  import { activityTypeLabel, sportIcon } from '$lib/activity-types';
  import { bestEffortLabel } from '$lib/best-efforts';
  import type { ActivityTypeSettingsOutput } from '$lib/api';
  import type { Activity } from '$lib/types';
  import type { UnitSystem } from '$lib/units';
  import { activityName, distance, duration, elevation, localTime } from '$lib/format';

  let { activity, activityTypes, unitSystem }: { activity: Activity; activityTypes: ActivityTypeSettingsOutput[]; unitSystem: UnitSystem } = $props();
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
    <p><span>{localTime(activity.startedAt)} · {activityTypeLabel(activityTypes, activity.sport)}</span></p>
    {#if activity.topBestEfforts?.length}
      <div class="activity-achievements">
        {#each activity.topBestEfforts as effort}
          <span class={`activity-achievement rank-${effort.yearRank}`} title={`${bestEffortLabel(effort.type)}: ${effort.yearRank === 1 ? 'personal record for the year' : `#${effort.yearRank} for the year`}`} aria-label={`${bestEffortLabel(effort.type)}: ${effort.yearRank === 1 ? 'personal record for the year' : `number ${effort.yearRank} for the year`}`}><Medal size={15} /></span>
        {/each}
      </div>
    {/if}
  </div>
  <div class="activity-stat"><Gauge size={16} /><span><strong>{distance(activity.metrics?.distance ?? null, unitSystem)}</strong><small>Distance</small></span></div>
  <div class="activity-stat"><Clock3 size={16} /><span><strong>{activity.metrics ? duration(activity.metrics.movingTime ?? activity.metrics.elapsedTime) : '—'}</strong><small>Moving time</small></span></div>
  {#if activity.metrics?.elevationGain != null || activity.metrics?.elevationLoss != null}
    <div class="activity-stat optional"><Mountain size={16} /><span><strong>{elevation(activity.metrics?.elevationGain ?? null, unitSystem)}</strong><small>Elevation</small></span></div>
  {/if}
</a>
