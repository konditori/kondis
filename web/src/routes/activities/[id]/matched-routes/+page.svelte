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
  import { t } from "$lib/i18n";

  let { data } = $props();
  let activeActivityId = $state<string | null>(null);
  let selectedActivityId = $state<string | null>(null);
  const history = $derived(data.history);
  const activities = $derived(history.activities ?? []);
  const source = $derived(
    activities.find(({ id }) => id === history.sourceActivityId) ??
      activities[0],
  );
  const averageMetric = $derived(
    source
      ? activityTypeSettings(data.activityTypes, source.sport).averageMetric
      : AverageMetric.Pace,
  );
  const isSpeed = $derived(averageMetric === AverageMetric.Speed);
  const efforts = $derived(
    activities.map((activity) => ({
      ...activity,
      chartValue: isSpeed
        ? (activity.metrics?.avgSpeed ?? 0)
        : activity.metrics?.avgSpeed && activity.metrics.avgSpeed > 0
          ? 1000 / activity.metrics.avgSpeed
          : 0,
    })),
  );
  const validValues = $derived(
    efforts.map(({ chartValue }) => chartValue).filter((value) => value > 0),
  );
  const average = $derived(
    validValues.length > 0
      ? validValues.reduce((sum, value) => sum + value, 0) / validValues.length
      : 0,
  );
  const lower = $derived(validValues.length > 0 ? Math.min(...validValues) : 0);
  const upper = $derived(validValues.length > 0 ? Math.max(...validValues) : 1);
  const spread = $derived(Math.max(upper - lower, upper * 0.04, 1));
  const axisTicks = $derived(
    Array.from(
      { length: 5 },
      (_, index) => lower + ((upper - lower) * index) / 4,
    ),
  );

  function chartY(value: number): number {
    return isSpeed
      ? 250 - ((value - lower) / spread) * 190
      : 60 + ((value - lower) / spread) * 190;
  }

  const chartPoints = $derived(
    efforts.map((effort, index) => ({
      ...effort,
      x: efforts.length === 1 ? 500 : 64 + (index / (efforts.length - 1)) * 872,
      y: chartY(effort.chartValue),
    })),
  );
  const averageY = $derived(chartY(average));
  const linePoints = $derived(
    chartPoints.map(({ x, y }) => `${x},${y}`).join(" "),
  );
  const trendPoints = $derived(
    chartPoints.map((point, index) => {
      const radius = Math.min(2, Math.floor(chartPoints.length / 2));
      const nearby = efforts.slice(
        Math.max(0, index - radius),
        Math.min(efforts.length, index + radius + 1),
      );
      const value =
        nearby.reduce((sum, effort) => sum + effort.chartValue, 0) /
        nearby.length;
      return {
        x: point.x,
        y: chartY(value),
      };
    }),
  );
  const trendPath = $derived(smoothPath(trendPoints));
  const fastest = $derived(
    validValues.length > 0
      ? isSpeed
        ? Math.max(...validValues)
        : Math.min(...validValues)
      : 0,
  );
  const slowest = $derived(
    validValues.length > 0
      ? isSpeed
        ? Math.min(...validValues)
        : Math.max(...validValues)
      : 0,
  );
  const fastestY = $derived(chartY(fastest));
  const slowestY = $derived(chartY(slowest));
  const selectedPoint = $derived(
    chartPoints.find((point) => point.id === selectedActivityId) ?? null,
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

  function displayChartValue(value: number): string {
    return performance(isSpeed ? value : value > 0 ? 1000 / value : null);
  }

  function axisLabel(value: number): string {
    return performance(
      isSpeed ? value : value > 0 ? 1000 / value : null,
    ).replace(" min/", "/");
  }

  function smoothPath(points: { x: number; y: number }[]): string {
    if (!points.length) return "";
    if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
    let path = `M ${points[0].x},${points[0].y}`;
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const point = points[index];
      const midpointX = (previous.x + point.x) / 2;
      const midpointY = (previous.y + point.y) / 2;
      path += ` Q ${previous.x},${previous.y} ${midpointX},${midpointY}`;
      if (index === points.length - 1) {
        path += ` Q ${point.x},${point.y} ${point.x},${point.y}`;
      }
    }
    return path;
  }

  function tooltipX(x: number): number {
    return Math.min(Math.max(x - 95, 48), 760);
  }
</script>

<svelte:head><title>{t("matched_routes")} · Kondis</title></svelte:head>

<div class="page-shell matched-routes-page">
  <a class="back-link" href={`/activities/${history.sourceActivityId}`}>
    <ArrowLeft size={18} /> {t("back_to_activity")}
  </a>

  <header class="matched-routes-header">
    <span class="matched-routes-icon"><MapPinned size={27} /></span>
    <div>
      <span class="eyebrow">{t("repeated_route")}</span>
      <h1>{t("matched", { activities: isSpeed ? t("matched_rides") : t("matched_runs") })}</h1>
      <p>
        {t("compare_route_activities", { count: activities.length })}
      </p>
    </div>
  </header>

  {#if validValues.length > 0}
    <section
      class="matched-route-chart"
      aria-label={t("route_performance_over_time")}
    >
      <div class="matched-route-chart-heading">
        <div>
          <span class="eyebrow">{t("progress_over_time")}</span>
          <h2>{isSpeed ? t("speed") : t("pace")}</h2>
        </div>
      </div>
      <div class="matched-chart-wrap">
        <svg
          viewBox="0 0 1000 300"
          role="img"
          aria-label={`${isSpeed ? "Speed" : "Pace"} for each matched activity`}
        >
          <line class="chart-y-axis" x1="48" x2="48" y1="28" y2="270" />
          <text class="chart-axis-title" x="48" y="20"
            >{isSpeed ? t("speed") : t("pace")}</text
          >
          {#each axisTicks as tick}
            <line
              class="chart-grid"
              x1="48"
              x2="952"
              y1={chartY(tick)}
              y2={chartY(tick)}
            />
            <line
              class="chart-y-tick"
              x1="43"
              x2="48"
              y1={chartY(tick)}
              y2={chartY(tick)}
            />
            <text
              class="chart-axis-label"
              x="39"
              y={chartY(tick) + 4}
              text-anchor="end">{axisLabel(tick)}</text
            >
          {/each}
          <line
            class="chart-guide chart-fastest"
            x1="48"
            x2="952"
            y1={fastestY}
            y2={fastestY}
          />
          <line
            class="chart-average"
            x1="48"
            x2="952"
            y1={averageY}
            y2={averageY}
          />
          <line
            class="chart-guide chart-slowest"
            x1="48"
            x2="952"
            y1={slowestY}
            y2={slowestY}
          />
          <polyline class="chart-line" points={linePoints} />
          <path class="chart-trend" d={trendPath} />
          {#each chartPoints as point}
            <a
              class="chart-point"
              class:active={activeActivityId === point.id}
              class:fastest={point.chartValue === fastest}
              href={`/activities/${point.id}`}
              aria-label={`${activityName(point)}, ${performance(point.metrics?.avgSpeed ?? null)}`}
              onmouseenter={() => (activeActivityId = point.id)}
              onmouseleave={() => (activeActivityId = null)}
              onfocus={() => (activeActivityId = point.id)}
              onblur={() => (activeActivityId = null)}
              onclick={(event) => {
                event.preventDefault();
                selectedActivityId =
                  selectedActivityId === point.id ? null : point.id;
              }}
            >
              <circle
                class:current={point.id === history.sourceActivityId}
                cx={point.x}
                cy={point.y}
                r={point.id === history.sourceActivityId ||
                activeActivityId === point.id
                  ? 9
                  : 6}
              />
              <title
                >{activityName(point)} · {performance(
                  point.metrics?.avgSpeed ?? null,
                )}</title
              >
            </a>
          {/each}
          {#if selectedPoint}
            <line
              class="chart-selection-line"
              x1={selectedPoint.x}
              x2={selectedPoint.x}
              y1="28"
              y2="270"
            />
            <circle
              class="chart-selection-point"
              cx={selectedPoint.x}
              cy={selectedPoint.y}
              r="8"
            />
            <g
              class="chart-selection-tooltip"
              transform={`translate(${tooltipX(selectedPoint.x)} 18)`}
            >
              <rect width="190" height="58" rx="2" />
              <text x="12" y="22" class="chart-selection-name"
                >{activityName(selectedPoint)}</text
              >
              <text x="12" y="44" class="chart-selection-value"
                >{performance(selectedPoint.metrics?.avgSpeed ?? null)}</text
              >
              <text x="104" y="44" class="chart-selection-difference"
                >{difference(selectedPoint.chartValue)}</text
              >
            </g>
          {/if}
        </svg>
        <aside class="chart-stat-labels" aria-label={t("performance_summary")}>
          <span class="fastest"
            >{t("fastest")}<strong>{displayChartValue(fastest)}</strong></span
          >
          <span class="average"
            >{t("all_time_average")}<strong>{displayChartValue(average)}</strong></span
          >
          <span class="slowest"
            >{t("slowest")}<strong>{displayChartValue(slowest)}</strong></span
          >
        </aside>
      </div>
      <div class="matched-chart-range">
        <span>{localDate(efforts[0].startedAt)}</span><span
          >{localDate(efforts.at(-1)!.startedAt)}</span
        >
      </div>
      <div class="matched-chart-legend">
        ><strong>{t("activities_count", { count: activities.length })}</strong><span
          ><i class="trend-swatch"></i>{t("trending_average")}</span
        ><span><i class="effort-swatch"></i>{t("each_effort")}</span>
      </div>
    </section>
  {/if}

  <section class="matched-route-list">
    <div class="section-heading">
      <div>
        <span class="eyebrow">{t("every_effort")}</span>
        <h2>{t("activities_count", { count: activities.length })}</h2>
      </div>
    </div>
    <div
      class="matched-route-table"
      role="table"
      aria-label={t("matched_route_activities")}
    >
      <div class="matched-route-row matched-route-table-header" role="row">
        <span role="columnheader">{t("date")}</span><span role="columnheader"
          >{t("activity")}</span
        ><span role="columnheader">{isSpeed ? t("speed") : t("pace")}</span><span
          role="columnheader">{t("versus_average")}</span
        ><span role="columnheader">{t("moving_time")}</span><span></span>
      </div>
      {#each [...efforts].reverse() as effort}
        <a
          class:current={effort.id === history.sourceActivityId}
          class:fastest={effort.chartValue === fastest}
          class:active={activeActivityId === effort.id}
          class="matched-route-row"
          role="row"
          href={`/activities/${effort.id}`}
          onmouseenter={() => (activeActivityId = effort.id)}
          onmouseleave={() => (activeActivityId = null)}
          onfocus={() => (activeActivityId = effort.id)}
          onblur={() => (activeActivityId = null)}
        >
          <span role="cell">{localDate(effort.startedAt)}</span>
          <span role="cell"
            ><strong>{activityName(effort)}</strong
            >{#if effort.id === history.sourceActivityId}<small
                >{t("this_activity", { activity: isSpeed ? t("ride") : t("run") })}</small
              >{/if}</span
          >
          <span role="cell"
            >{performance(effort.metrics?.avgSpeed ?? null)}</span
          >
          <span
            class:better={isSpeed
              ? effort.chartValue > average
              : effort.chartValue < average}
            role="cell">{difference(effort.chartValue)}</span
          >
          <span class="matched-time" role="cell"
            ><Timer size={15} />{effort.metrics
              ? effortDuration(
                  effort.metrics.movingTime ?? effort.metrics.elapsedTime,
                )
              : "—"}</span
          >
          <ChevronRight size={17} />
        </a>
      {/each}
    </div>
  </section>
</div>
