<script lang="ts">
  import { ArrowLeft, CalendarDays, Clock3, Flame, Gauge, HeartPulse, Mountain, Timer, Zap } from '@lucide/svelte';
  import { page } from '$app/state';
  import RouteMap from '$lib/components/RouteMap.svelte';
  import { activityName, distance, duration, localDate, localTime, speed, sportIcon } from '$lib/format';

  let { data } = $props();
  const activity = $derived(data.activity);
  const Icon = $derived(sportIcon(activity.sport));
  const stats = $derived([
    { label: 'Distance', value: distance(activity.distance), icon: Gauge },
    { label: 'Moving time', value: duration(activity.movingTime ?? activity.elapsedTime), icon: Timer },
    { label: 'Elapsed time', value: duration(activity.elapsedTime), icon: Clock3 },
    { label: 'Elevation gain', value: activity.elevationGain == null ? '—' : `${Math.round(activity.elevationGain)} m`, icon: Mountain },
    { label: 'Average speed', value: speed(activity.avgSpeed), icon: Gauge },
    { label: 'Average heart rate', value: activity.avgHr == null ? '—' : `${activity.avgHr} bpm`, icon: HeartPulse },
    { label: 'Average power', value: activity.avgPower == null ? '—' : `${activity.avgPower} W`, icon: Zap },
    { label: 'Energy', value: activity.calories == null ? '—' : `${activity.calories} kcal`, icon: Flame },
  ]);

  function backToActivities(event: MouseEvent) {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && page.state.fromActivityList) {
      event.preventDefault();
      history.back();
    }
  }
</script>

<svelte:head><title>{activityName(activity)} · Kondis</title></svelte:head>

<div class="detail-page">
  <header class="detail-header">
    <a class="back-link" href="/" onclick={backToActivities}><ArrowLeft size={18} /> All activities</a>
    <div class="detail-heading">
      <span class="detail-sport"><Icon size={27} /></span>
      <div><span class="eyebrow">{activity.sport.replaceAll('_', ' ')}{activity.subSport ? ` · ${activity.subSport.replaceAll('_', ' ')}` : ''}</span><h1>{activityName(activity)}</h1></div>
    </div>
    <div class="detail-date"><span><CalendarDays size={17} />{localDate(activity.startedAt)}</span><span><Clock3 size={17} />{localTime(activity.startedAt)}</span></div>
  </header>

  <section class="map-panel">
    <RouteMap coordinates={activity.track?.coordinates ?? null} />
    {#if activity.track}
      <div class="map-key"><span><i class="start-dot"></i> Start</span><span><i class="finish-dot"></i> Finish</span></div>
    {/if}
  </section>

  <section class="metrics-section">
    <div class="section-heading"><div><span class="eyebrow">Workout summary</span><h2>At a glance</h2></div></div>
    <div class="metric-grid">
      {#each stats as stat}
        <article class="metric"><span><stat.icon size={19} /></span><div><small>{stat.label}</small><strong>{stat.value}</strong></div></article>
      {/each}
    </div>
  </section>
</div>
