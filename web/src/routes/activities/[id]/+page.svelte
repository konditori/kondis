<script lang="ts">
  import { ArrowLeft, CalendarDays, Check, Clock3, Flame, Gauge, HeartPulse, Mountain, Pencil, Timer, Trophy, X, Zap } from '@lucide/svelte';
  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import { activityControllerUpdateById, getSdkRequestOptions } from '$lib/api';
  import { ACTIVITY_TYPE_OPTIONS, ActivityMapStyle, AverageMetric, activityTypeLabel, activityTypeSettings, sportIcon } from '$lib/activity-types';
  import RouteMap from '$lib/components/RouteMap.svelte';
  import { activityName, distance, duration, effortDuration, effortPace, elevation, localDate, localTime, pace, speed } from '$lib/format';
  import type { Activity, ActivityDetail } from '$lib/types';

  let { data } = $props();
  let updatedActivity = $state<Activity | null>(null);
  const activity = $derived<ActivityDetail>({ ...data.activity, ...(updatedActivity ?? {}) });
  let editing = $state(false);
  let saving = $state(false);
  let editError = $state('');
  let draftName = $state('');
  let draftDescription = $state('');
  let draftSport = $state<Activity['sport']>(ACTIVITY_TYPE_OPTIONS.at(-1)!.value);
  const Icon = $derived(sportIcon(activity.sport));
  const activitySettings = $derived(activityTypeSettings(activity.sport));
  const averageMetric = $derived(activitySettings.averageMetric);
  const mapStyle = $derived(activitySettings.mapStyle);
  const averageMetricStats = $derived(
    averageMetric === AverageMetric.None
      ? []
      : averageMetric === AverageMetric.Speed
        ? [{ label: 'Average speed', value: speed(activity.avgSpeed, data.unitSystem), icon: Gauge }]
        : [{ label: 'Average pace', value: pace(activity.avgSpeed, data.unitSystem, averageMetric === AverageMetric.SwimPace), icon: Gauge }],
  );
  const stats = $derived([
    { label: 'Distance', value: distance(activity.distance, data.unitSystem), icon: Gauge },
    { label: 'Moving time', value: duration(activity.movingTime ?? activity.elapsedTime), icon: Timer },
    { label: 'Elapsed time', value: duration(activity.elapsedTime), icon: Clock3 },
    { label: 'Elevation gain', value: elevation(activity.elevationGain, data.unitSystem), icon: Mountain },
    ...averageMetricStats,
    { label: 'Average heart rate', value: activity.avgHr == null ? '—' : `${activity.avgHr} bpm`, icon: HeartPulse },
    ...(activitySettings.showAveragePower
      ? [{ label: 'Average power', value: activity.avgPower == null ? '—' : `${activity.avgPower} W`, icon: Zap }]
      : []),
    { label: 'Energy', value: activity.calories == null ? '—' : `${activity.calories} kcal`, icon: Flame },
  ]);

  function backToActivities(event: MouseEvent) {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && page.state.fromActivityList) {
      event.preventDefault();
      history.back();
    }
  }

  function startEditing() {
    draftName = activity.name ?? '';
    draftDescription = activity.description ?? '';
    draftSport = activity.sport;
    editError = '';
    editing = true;
  }

  function cancelEditing() {
    editing = false;
    editError = '';
  }

  async function saveMetadata(event: SubmitEvent) {
    event.preventDefault();
    saving = true;
    editError = '';
    try {
      const updated = (await activityControllerUpdateById(
        {
          id: activity.id,
          activityUpdateDto: {
            name: draftName.trim() || null,
            description: draftDescription.trim() || null,
            sport: draftSport,
          },
        },
        getSdkRequestOptions(),
      )) as Activity;
      updatedActivity = updated;
      editing = false;
      void invalidateAll();
    } catch {
      editError = 'Could not save the activity. Please try again.';
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head><title>{activityName(activity)} · Kondis</title></svelte:head>

<div class="detail-page">
  <header class="detail-header">
    <a class="back-link" href="/" onclick={backToActivities}><ArrowLeft size={18} /> All activities</a>
    <div class="detail-heading">
      <span class="detail-sport"><Icon size={27} /></span>
      <div class="detail-title"><span class="eyebrow">{activityTypeLabel(activity.sport)}</span><h1>{activityName(activity)}</h1></div>
      <button class="edit-metadata-button" type="button" onclick={startEditing} aria-label="Edit activity metadata"><Pencil size={16} /> Edit</button>
    </div>
    {#if editing}
      <form class="metadata-editor" onsubmit={saveMetadata}>
        <label><span>Name</span><input bind:value={draftName} maxlength="200" placeholder="Activity name" /></label>
        <label><span>Activity type</span><select bind:value={draftSport}>{#each ACTIVITY_TYPE_OPTIONS as option}<option value={option.value}>{option.label}</option>{/each}</select></label>
        <label class="metadata-description"><span>Description</span><textarea bind:value={draftDescription} maxlength="10000" placeholder="Activity description"></textarea></label>
        <div class="metadata-actions">
          <button type="button" class="metadata-cancel" onclick={cancelEditing} disabled={saving}><X size={16} /> Cancel</button>
          <button type="submit" class="metadata-save" disabled={saving}><Check size={16} /> {saving ? 'Saving…' : 'Save'}</button>
        </div>
        {#if editError}<p class="metadata-error" role="alert">{editError}</p>{/if}
      </form>
    {/if}
    <div class="detail-date"><span><CalendarDays size={17} />{localDate(activity.startedAt)}</span><span><Clock3 size={17} />{localTime(activity.startedAt)}</span></div>
    {#if activity.description}<p class="activity-description">{activity.description}</p>{/if}
  </header>

  <section class="map-panel">
    {#key mapStyle}
      <RouteMap coordinates={activity.track?.coordinates ?? null} mode={mapStyle} />
    {/key}
    {#if activity.track && mapStyle === ActivityMapStyle.Route}
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

  {#if activity.bestEfforts.length > 0}
    <section class="best-efforts-section">
      <div class="section-heading"><div><span class="eyebrow">Running performance</span><h2>Best efforts</h2></div></div>
      <div class="best-effort-list">
        {#each activity.bestEfforts as effort}
          <article class="best-effort">
            <span class="effort-icon"><Trophy size={18} /></span>
            <strong>{effort.label}</strong>
            <span>{effortDuration(effort.elapsedTime)}</span>
            <small>{effortPace(effort.elapsedTime, effort.distance, data.unitSystem)}</small>
          </article>
        {/each}
      </div>
    </section>
  {/if}
</div>
