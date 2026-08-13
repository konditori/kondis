<script lang="ts">
  import { Award, CalendarCheck, ChevronRight, CloudOff, Medal, Timer, Trophy } from "@lucide/svelte";
  import { goto, invalidateAll } from "$app/navigation";
  import { bestEffortLabel } from "$lib/best-efforts";
  import BestEffortChart from "$lib/components/BestEffortChart.svelte";
  import { activityName, bestEffortValue, duration, pace } from "$lib/format";
  import { subscribeToActivityEvents } from "$lib/realtime";

  let { data } = $props();
  $effect(() => {
    if (!data.eventsUrl) return;
    return subscribeToActivityEvents(data.eventsUrl, (_activity, type) => {
      if (type === "activity.updated") void invalidateAll();
    }, () => {});
  });
  const history = $derived(data.history);
  const label = $derived(history ? bestEffortLabel(history.type) : "");
  const podium = $derived(
    history
      ? history.efforts
          .filter((effort) => effort.overallRank <= 3)
          .toSorted((a, b) => a.overallRank - b.overallRank)
      : [],
  );
  const recentEfforts = $derived(history ? [...history.efforts].reverse() : []);
  const medalNames = ["Gold", "Silver", "Bronze"];
  const sportName = $derived(history?.sport === "ride" ? "Cycling" : "Running");
  const activityNoun = $derived(history?.sport === "ride" ? "rides" : "runs");
  const optionGroups = $derived(
    history
      ? Object.entries(Object.groupBy(history.options, ({ valueKind }) => valueKind))
      : [],
  );
  const optionGroupLabels = {
    distance: "Longest ride",
    elevation: "Elevation",
    duration: "Distance",
    power: "Power",
  };

  function selectEffort(type: string) {
    if (history) void goto(`/best-efforts/${history.sport}/${type}`);
  }

  function secondaryValue(effort: NonNullable<typeof history>["efforts"][number]): string {
    if (!history) return "";
    if (history.valueKind === "duration" && history.distance) {
      return pace(history.distance / effort.value, data.unitSystem);
    }
    if (history.valueKind === "distance") return duration(effort.elapsedTime);
    return "";
  }
</script>

<svelte:head><title>Best efforts · Kondis</title></svelte:head>

<div class="page-shell best-efforts-page">
  <header class="page-header best-efforts-header">
    <div>
      <span class="eyebrow">{sportName} performance</span><h1>Best efforts</h1>
      <p>See how your best {activityNoun} have progressed over time.</p>
      <nav class="effort-sport-tabs" aria-label="Best effort sport">
        <a class:active={history?.sport === "run"} href="/best-efforts/run/5k">Run</a>
        <a class:active={history?.sport === "ride"} href="/best-efforts/ride/10k">Ride</a>
      </nav>
    </div>
    {#if history}
      <div class="distance-picker">
        <label for="effort-distance">Effort</label>
        <select id="effort-distance" value={history.type} onchange={(event) => selectEffort(event.currentTarget.value)}>
          {#each optionGroups as [kind, options]}
            <optgroup label={optionGroupLabels[kind as keyof typeof optionGroupLabels]}>
              {#each options ?? [] as option}<option value={option.type}>{bestEffortLabel(option.type)}</option>{/each}
            </optgroup>
          {/each}
        </select>
      </div>
    {/if}
  </header>

  {#if data.unavailable}
    <div class="notice"><CloudOff size={20} /><span><strong>Server unavailable</strong> Could not load your best efforts.</span></div>
  {:else if history && history.efforts.length > 0}
    <section class="effort-overview">
      <div class="section-heading effort-section-heading"><div><span class="eyebrow">Progress over time</span><h2>{label} performance</h2></div><span class="chart-hint">{history.higherIsBetter ? "Higher is better" : "Higher is faster"}</span></div>
      <BestEffortChart efforts={history.efforts} {label} valueKind={history.valueKind} higherIsBetter={history.higherIsBetter} unitSystem={data.unitSystem} />
    </section>

    <section class="podium-section">
      <div class="section-heading"><div><span class="eyebrow">All-time ranking</span><h2>Your fastest {label} efforts</h2></div></div>
      <div class="podium-grid">
        {#each podium as effort, index}
          <a class:gold={index === 0} class:silver={index === 1} class:bronze={index === 2} class="podium-card" href={`/activities/${effort.activityId}`}>
            <span class="medal"><Medal size={22} /><small>{medalNames[index]}</small></span>
            <div><strong>{bestEffortValue(effort.value, history.valueKind, data.unitSystem)}</strong><span>{activityName({ name: effort.activityName, sport: effort.sport })}</span><small>{new Date(effort.startedAt).toLocaleDateString()}</small></div>
            <ChevronRight size={18} />
          </a>
        {/each}
      </div>
    </section>

    <section class="effort-history-section">
      <div class="section-heading"><div><span class="eyebrow">Every result</span><h2>Effort history</h2></div></div>
      <div class="effort-history-list">
        {#each recentEfforts as effort}
          <a class="effort-history-row" href={`/activities/${effort.activityId}`}>
            <span class="history-rank" class:ranked={effort.overallRank <= 3}>{effort.overallRank <= 3 ? `#${effort.overallRank}` : "—"}</span>
            <span class="history-date"><strong>{new Date(effort.startedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</strong><small>{activityName({ name: effort.activityName, sport: effort.sport })}</small></span>
            <span class="history-time"><Timer size={16} /><strong>{bestEffortValue(effort.value, history.valueKind, data.unitSystem)}</strong>{#if secondaryValue(effort)}<small>{secondaryValue(effort)}</small>{/if}</span>
            <span class="history-badges">
              {#if effort.overallRank <= 3}<span class={`badge rank-${effort.overallRank}`}><Medal size={31} /> All time</span>{/if}
              {#if effort.yearRank <= 3}<span class={`badge rank-${effort.yearRank}`}><Medal size={31} /> {effort.year}</span>{/if}
            </span>
            <ChevronRight class="history-chevron" size={18} />
          </a>
        {/each}
      </div>
    </section>
  {:else if history}
    <div class="empty-state best-efforts-empty">
      <span class="empty-icon"><Award size={28} /></span>
      <h2>No {label} efforts yet</h2>
      <p>Import more {activityNoun} with the required data to start tracking this effort.</p>
    </div>
  {/if}
</div>
