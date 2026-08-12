<script lang="ts">
  import { ArrowLeft, ChevronRight, MapPinned, Timer } from "@lucide/svelte";
  import { AverageMetric } from "$lib/api";
  import { activityTypeSettings } from "$lib/activity-types";
  import {
    activityName,
    effortDuration,
    localDate,
    pace,
    speed,
  } from "$lib/format";

  let { data } = $props();
  const history = $derived(data.history);
  const source = $derived(
    history.activities.find(({ id }) => id === history.sourceActivityId) ??
      history.activities[0],
  );
  const averageMetric = $derived(
    source
      ? activityTypeSettings(data.activityTypes, source.sport).averageMetric
      : AverageMetric.Pace,
  );
  const isSpeed = $derived(averageMetric === AverageMetric.Speed);
  const efforts = $derived(
    history.activities.map((activity) => ({
      ...activity,
      chartValue: isSpeed
        ? (activity.avgSpeed ?? 0)
        : activity.avgSpeed && activity.avgSpeed > 0
          ? 1000 / activity.avgSpeed
          : 0,
    })),
  );
  const validValues = $derived(
    efforts.map(({ chartValue }) => chartValue).filter((value) => value > 0),
  );
  const average = $derived(
    validValues.length > 0
      ? validValues.reduce((sum, value) => sum + value, 0) /
        validValues.length
      : 0,
  );
  const lower = $derived(validValues.length > 0 ? Math.min(...validValues) : 0);
  const upper = $derived(validValues.length > 0 ? Math.max(...validValues) : 1);
  const spread = $derived(Math.max(upper - lower, upper * 0.04, 1));
  const chartPoints = $derived(
    efforts.map((effort, index) => ({
      ...effort,
      x:
        efforts.length === 1
          ? 500
          : 64 + (index / (efforts.length - 1)) * 872,
      y: isSpeed
        ? 250 - ((effort.chartValue - lower) / spread) * 190
        : 60 + ((effort.chartValue - lower) / spread) * 190,
    })),
  );
  const averageY = $derived(
    isSpeed
      ? 250 - ((average - lower) / spread) * 190
      : 60 + ((average - lower) / spread) * 190,
  );
  const linePoints = $derived(
    chartPoints.map(({ x, y }) => `${x},${y}`).join(" "),
  );

  function performance(value: number | null): string {
    return isSpeed
      ? speed(value, data.unitSystem)
      : pace(value, data.unitSystem);
  }

  function difference(value: number): string {
    if (!value || !average) return "—";
    if (isSpeed) {
      const differenceValue = value - average;
      const factor = data.unitSystem === "metric" ? 3.6 : 2.236936;
      const unit = data.unitSystem === "metric" ? "km/h" : "mph";
      return `${differenceValue >= 0 ? "+" : ""}${(differenceValue * factor).toFixed(1)} ${unit}`;
    }
    const differenceValue = Math.round(
      (value - average) * (data.unitSystem === "metric" ? 1 : 1.609344),
    );
    const unit = data.unitSystem === "metric" ? "km" : "mi";
    return `${differenceValue > 0 ? "+" : ""}${differenceValue}s/${unit}`;
  }
</script>

<svelte:head><title>Matched routes · Kondis</title></svelte:head>

<div class="page-shell matched-routes-page">
  <a class="back-link" href={`/activities/${history.sourceActivityId}`}>
    <ArrowLeft size={18} /> Back to activity
  </a>

  <header class="matched-routes-header">
    <span class="matched-routes-icon"><MapPinned size={27} /></span>
    <div>
      <span class="eyebrow">Repeated route</span>
      <h1>Matched {isSpeed ? "rides" : "runs"}</h1>
      <p>
        Compare your performance across {history.activities.length} activities
        on the same route.
      </p>
    </div>
  </header>

  {#if validValues.length > 0}
    <section class="matched-route-chart" aria-label="Route performance over time">
      <div class="matched-route-chart-heading">
        <div><span class="eyebrow">Progress over time</span><h2>{isSpeed ? "Speed" : "Pace"}</h2></div>
        <span>Average {performance(isSpeed ? average : average > 0 ? 1000 / average : null)}</span>
      </div>
      <svg viewBox="0 0 1000 300" role="img" aria-label={`${isSpeed ? "Speed" : "Pace"} for each matched activity`}>
        <line class="chart-average" x1="48" x2="952" y1={averageY} y2={averageY} />
        <polyline class="chart-line" points={linePoints} />
        {#each chartPoints as point}
          <a href={`/activities/${point.id}`} aria-label={`${activityName(point)}, ${performance(point.avgSpeed)}`}>
            <circle class:current={point.id === history.sourceActivityId} cx={point.x} cy={point.y} r={point.id === history.sourceActivityId ? 9 : 6} />
          </a>
        {/each}
      </svg>
      <div class="matched-chart-range"><span>{localDate(efforts[0].startedAt)}</span><span>{localDate(efforts.at(-1)!.startedAt)}</span></div>
    </section>
  {/if}

  <section class="matched-route-list">
    <div class="section-heading"><div><span class="eyebrow">Every effort</span><h2>{history.activities.length} activities</h2></div></div>
    <div class="matched-route-table" role="table" aria-label="Matched route activities">
      <div class="matched-route-row matched-route-table-header" role="row">
        <span role="columnheader">Date</span><span role="columnheader">Activity</span><span role="columnheader">{isSpeed ? "Speed" : "Pace"}</span><span role="columnheader">vs average</span><span role="columnheader">Moving time</span><span></span>
      </div>
      {#each [...efforts].reverse() as effort}
        <a class:current={effort.id === history.sourceActivityId} class="matched-route-row" role="row" href={`/activities/${effort.id}`}>
          <span role="cell">{localDate(effort.startedAt)}</span>
          <span role="cell"><strong>{activityName(effort)}</strong>{#if effort.id === history.sourceActivityId}<small>This activity</small>{/if}</span>
          <span role="cell">{performance(effort.avgSpeed)}</span>
          <span class:better={isSpeed ? effort.chartValue > average : effort.chartValue < average} role="cell">{difference(effort.chartValue)}</span>
          <span class="matched-time" role="cell"><Timer size={15} />{effortDuration(effort.movingTime ?? effort.elapsedTime)}</span>
          <ChevronRight size={17} />
        </a>
      {/each}
    </div>
  </section>
</div>
