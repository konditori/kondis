<script lang="ts">
  import {
    Clock3,
    Flame,
    Gauge,
    HeartPulse,
    Mountain,
    Timer,
    Zap,
  } from "@lucide/svelte";
  import {
    AverageMetric,
    type ActivityTypeSettings,
  } from "$lib/activity-types";
  import { distance, duration, elevation, pace, speed } from "$lib/format";
  import { t } from "$lib/i18n";
  import type { ActivityDetail } from "$lib/types";
  import type { UnitSystem } from "$lib/units";
  let {
    activity,
    settings: activitySettings,
    unitSystem,
  }: {
    activity: ActivityDetail;
    settings: ActivityTypeSettings;
    unitSystem: UnitSystem;
  } = $props();
  const averageMetric = $derived(activitySettings.averageMetric);
  const hasHeartRate = $derived(activity.metrics?.avgHr != null);
  const hasElevation = $derived(
    activity.metrics?.elevationGain != null ||
      activity.metrics?.elevationLoss != null,
  );
  const averageMetricStats = $derived(
    averageMetric === AverageMetric.None
      ? []
      : averageMetric === AverageMetric.Speed
        ? [
            {
              label: t("average_speed"),
              value: speed(activity.metrics?.avgSpeed ?? null, unitSystem),
              icon: Gauge,
            },
          ]
        : [
            {
              label: t("pace"),
              value: pace(
                activity.metrics?.avgSpeed ??
                  (activity.metrics?.distance != null
                    ? activity.metrics.distance /
                      (activity.metrics.movingTime ??
                        activity.metrics.elapsedTime)
                    : null),
                unitSystem,
                averageMetric === AverageMetric.SwimPace,
              ),
              icon: Gauge,
            },
          ],
  );
  const stats = $derived([
    {
      label: t("distance"),
      value: distance(activity.metrics?.distance ?? null, unitSystem),
      icon: Gauge,
    },
    {
      label: t("moving_time"),
      value: activity.metrics
        ? duration(activity.metrics.movingTime ?? activity.metrics.elapsedTime)
        : "—",
      icon: Timer,
    },
    {
      label: t("elapsed_time"),
      value: activity.metrics ? duration(activity.metrics.elapsedTime) : "—",
      icon: Clock3,
    },
    ...(hasElevation
      ? [
          {
            label: t("elevation_gain"),
            value: elevation(
              activity.metrics?.elevationGain ?? null,
              unitSystem,
            ),
            icon: Mountain,
          },
        ]
      : []),
    ...averageMetricStats,
    ...(hasHeartRate
      ? [
          {
            label: t("average_heart_rate"),
            value: `${activity.metrics?.avgHr} bpm`,
            icon: HeartPulse,
          },
        ]
      : []),
    ...(activitySettings.showAveragePower
      ? [
          {
            label: t("average_power"),
            value:
              activity.metrics?.avgPower == null
                ? "—"
                : `${activity.metrics.avgPower} W`,
            icon: Zap,
          },
        ]
      : []),
    {
      label: t("energy"),
      value:
        activity.metrics?.calories == null
          ? "—"
          : `${activity.metrics.calories} kcal`,
      icon: Flame,
    },
  ]);
</script>

<section class="metrics-section">
  <div class="metric-grid">
    {#each stats as stat}
      <article class="metric">
        <span><stat.icon size={19} /></span>
        <div><small>{stat.label}</small><strong>{stat.value}</strong></div>
      </article>
    {/each}
  </div>
</section>
