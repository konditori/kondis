<script lang="ts">
  import { bestEffortValue } from "$lib/format";
  import type { BestEffortHistory } from "$lib/types";
  import type { UnitSystem } from "$lib/units";

  let {
    efforts,
    label,
    valueKind,
    higherIsBetter,
    unitSystem,
  }: {
    efforts: BestEffortHistory["efforts"];
    label: string;
    valueKind: BestEffortHistory["valueKind"];
    higherIsBetter: boolean;
    unitSystem: UnitSystem;
  } = $props();

  const width = 900;
  const height = 300;
  const padding = { top: 24, right: 24, bottom: 42, left: 58 };
  const tooltipWidth = 162;
  const tooltipHeight = 52;
  let hoveredIndex = $state<number | null>(null);
  const dates = $derived(
    efforts.map((effort) => new Date(effort.startedAt).getTime()),
  );
  const values = $derived(efforts.map((effort) => effort.value));
  const minDate = $derived(Math.min(...dates));
  const maxDate = $derived(Math.max(...dates));
  const logarithmicValues = $derived(values.map((value) => Math.log(value)));
  const logarithmicMinimum = $derived(Math.min(...logarithmicValues));
  const logarithmicMaximum = $derived(Math.max(...logarithmicValues));
  const logarithmicPadding = $derived(
    Math.max((logarithmicMaximum - logarithmicMinimum) * 0.12, 0.04),
  );
  const yMin = $derived(logarithmicMinimum - logarithmicPadding);
  const yMax = $derived(logarithmicMaximum + logarithmicPadding);

  function x(index: number): number {
    if (minDate === maxDate) return width / 2;
    return (
      padding.left +
      ((dates[index] - minDate) / (maxDate - minDate)) *
        (width - padding.left - padding.right)
    );
  }

  function y(value: number): number {
    const ratio = (Math.log(value) - yMin) / (yMax - yMin);
    return (
      padding.top +
      (higherIsBetter ? 1 - ratio : ratio) *
        (height - padding.top - padding.bottom)
    );
  }

  function tooltipX(index: number): number {
    return Math.min(
      Math.max(x(index) - tooltipWidth / 2, padding.left),
      width - padding.right - tooltipWidth,
    );
  }

  function tooltipY(index: number): number {
    const above = y(efforts[index].value) - tooltipHeight - 12;
    return above >= 4 ? above : y(efforts[index].value) + 12;
  }

  const points = $derived(
    efforts.map((effort, index) => `${x(index)},${y(effort.value)}`).join(" "),
  );
  const yTicks = $derived(
    [yMin, (yMin + yMax) / 2, yMax].map((value) => Math.exp(value)),
  );
  const firstYear = $derived(new Date(minDate).getFullYear());
  const lastYear = $derived(new Date(maxDate).getFullYear());
</script>

<div class="effort-chart-wrap">
  <svg
    class="effort-chart"
    viewBox={`0 0 ${width} ${height}`}
    role="img"
    aria-label={`${label} best efforts over time`}
  >
    {#each yTicks as tick}
      <line
        x1={padding.left}
        x2={width - padding.right}
        y1={y(tick)}
        y2={y(tick)}
        class="chart-grid"
      />
      <text
        x={padding.left - 11}
        y={y(tick) + 4}
        text-anchor="end"
        class="chart-label">{bestEffortValue(tick, valueKind, unitSystem)}</text
      >
    {/each}
    {#if efforts.length > 1}
      <polyline {points} class="chart-line" />
    {/if}
    {#each efforts as effort, index}
      <a
        href={`/activities/${effort.activityId}`}
        aria-label={`${bestEffortValue(effort.value, valueKind, unitSystem)} on ${new Date(effort.startedAt).toLocaleDateString()}`}
        onmouseenter={() => (hoveredIndex = index)}
        onmouseleave={() => (hoveredIndex = null)}
        onfocus={() => (hoveredIndex = index)}
        onblur={() => (hoveredIndex = null)}
      >
        <circle
          class="chart-hit-area"
          cx={x(index)}
          cy={y(effort.value)}
          r="12"
        />
        <circle
          class="chart-point"
          cx={x(index)}
          cy={y(effort.value)}
          r={effort.overallRank <= 3 ? 6 : effort.yearRank === 1 ? 5 : 4}
          class:gold-point={effort.overallRank === 1}
          class:silver-point={effort.overallRank === 2}
          class:bronze-point={effort.overallRank === 3}
          class:year-point={effort.yearRank === 1 && effort.overallRank > 3}
        />
      </a>
    {/each}
    {#if hoveredIndex !== null}
      {@const effort = efforts[hoveredIndex]}
      <g
        class="chart-tooltip"
        transform={`translate(${tooltipX(hoveredIndex)} ${tooltipY(hoveredIndex)})`}
      >
        <rect width={tooltipWidth} height={tooltipHeight} rx="8" />
        <text x="12" y="22" class="chart-tooltip-time"
          >{bestEffortValue(effort.value, valueKind, unitSystem)}</text
        >
        <text x="12" y="40" class="chart-tooltip-date">
          {new Date(effort.startedAt).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </text>
      </g>
    {/if}
    <text x={padding.left} y={height - 10} class="chart-label">{firstYear}</text
    >
    {#if lastYear !== firstYear}<text
        x={width - padding.right}
        y={height - 10}
        text-anchor="end"
        class="chart-label">{lastYear}</text
      >{/if}
  </svg>
</div>
