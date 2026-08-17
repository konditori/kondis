<script lang="ts">
  import { ArrowUpRight, Medal } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import {
    AverageMetric,
    activityTypeLabel,
    activityTypeSettings,
    sportIcon,
  } from "$lib/activity-types";
  import { bestEffortDistance, bestEffortLabel } from "$lib/best-efforts";
  import {
    achievementMedalLabel,
    achievementRank,
    distinctAchievementEfforts,
  } from "$lib/activity-achievements";
  import RouteMap from "$lib/components/RouteMap.svelte";
  import type { ActivityTypeSettingsOutput } from "$lib/api";
  import type { Activity } from "$lib/types";
  import type { UnitSystem } from "$lib/units";
  import {
    activityName,
    distance,
    duration,
    elevation,
    localDate,
    localTime,
    pace,
    speed,
  } from "$lib/format";

  let {
    activity,
    activityTypes,
    unitSystem,
  }: {
    activity: Activity;
    activityTypes: ActivityTypeSettingsOutput[];
    unitSystem: UnitSystem;
  } = $props();
  const Icon = $derived(sportIcon(activity.sport));
  const settings = $derived(
    activityTypeSettings(activityTypes, activity.sport),
  );
  const average = $derived(
    settings.averageMetric === AverageMetric.Speed
      ? {
          label: "Avg speed",
          value: speed(activity.metrics?.avgSpeed ?? null, unitSystem),
        }
      : settings.averageMetric === AverageMetric.None
        ? null
        : {
            label: "Pace",
            value: pace(
              activity.metrics?.avgSpeed ?? null,
              unitSystem,
              settings.averageMetric === AverageMetric.SwimPace,
            ),
          },
  );
  const stats = $derived([
    {
      label: "Distance",
      value: distance(activity.metrics?.distance ?? null, unitSystem),
    },
    ...(average ? [average] : []),
    {
      label: "Moving time",
      value: activity.metrics
        ? duration(activity.metrics.movingTime ?? activity.metrics.elapsedTime)
        : "—",
    },
    {
      label: "Elevation",
      value: elevation(activity.metrics?.elevationGain ?? null, unitSystem),
    },
  ]);
  const personalRecord = $derived(
    (() => {
      const records =
        activity.topBestEfforts
          ?.slice()
          .filter(({ overallRank }) => overallRank >= 1 && overallRank <= 3) ??
        [];
      const powerRecords = records.filter(({ type }) =>
        type.startsWith("power_"),
      );
      return (
        (powerRecords.length ? powerRecords : records).sort(
          (left, right) =>
            powerDuration(right.type) - powerDuration(left.type) ||
            bestEffortDistance(right.type) - bestEffortDistance(left.type) ||
            left.overallRank - right.overallRank,
        )[0] ?? null
      );
    })(),
  );

  function achievementText(
    effort: NonNullable<Activity["topBestEfforts"]>[number],
  ): string {
    const { type } = effort;
    const label = bestEffortLabel(type);
    const rank = personalRecord?.overallRank ?? 1;
    const ordinal = rank === 1 ? "" : rank === 2 ? "2nd " : "3rd ";
    if (type === "longest_ride") return `Your ${ordinal}longest ride!`;
    if (type === "biggest_climb") return `Your ${ordinal}biggest climb!`;
    if (type.startsWith("power_")) {
      return `Your ${ordinal}highest power output for ${powerDurationLabel(type)} ever!`;
    }
    return type.includes("power") || type === "elevation_gain"
      ? `Your ${ordinal}best ${label}!`
      : `Your ${ordinal}fastest ${label}!`;
  }

  function powerDuration(type: string): number {
    const match = /^power_(\d+)(s|m|h)$/.exec(type);
    if (!match) return 0;
    const [, amount, unit] = match;
    return Number(amount) * (unit === "h" ? 3600 : unit === "m" ? 60 : 1);
  }

  function powerDurationLabel(type: string): string {
    const match = /^power_(\d+)(s|m|h)$/.exec(type);
    if (!match) return bestEffortLabel(type).replace(" power", "");
    const [, amount, unit] = match;
    const label = unit === "h" ? "hour" : unit === "m" ? "minute" : "second";
    return `${amount} ${label}${amount === "1" ? "" : "s"}`;
  }

  function openActivity(event: MouseEvent) {
    if (
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault();
      void goto(`/activities/${activity.id}`, {
        state: { fromActivityList: true },
      });
    }
  }
</script>

<article class="activity-card">
  <a
    class="activity-card-summary"
    href={`/activities/${activity.id}`}
    onclick={openActivity}
  >
    <div class="sport-badge"><Icon size={24} strokeWidth={1.8} /></div>
    <div class="activity-primary">
      <div class="activity-title">
        <h3>{activityName(activity)}</h3>
        <ArrowUpRight size={17} />
      </div>
      <p>
        <span
          >{localDate(activity.startedAt)} · {localTime(activity.startedAt)} · {activityTypeLabel(
            activityTypes,
            activity.sport,
          )}</span
        >
      </p>
      {#if activity.topBestEfforts?.length}
        <div class="activity-achievements">
          {#each distinctAchievementEfforts(activity.topBestEfforts) as effort}
            <span
              class={`activity-achievement rank-${achievementRank(effort)}`}
              title={`${achievementMedalLabel(achievementRank(effort))}: ${bestEffortLabel(effort.type)}`}
              aria-label={`${achievementMedalLabel(achievementRank(effort))}: ${bestEffortLabel(effort.type)}`}
              ><Medal size={18} /></span
            >
          {/each}
          <span class="activity-achievement-count">
            {activity.achievementCount ?? activity.topBestEfforts.length}
          </span>
        </div>
      {/if}
    </div>
    <div class="activity-feed-stats">
      {#each stats as stat}
        <div class="activity-stat">
          <strong>{stat.value}</strong><small>{stat.label}</small>
        </div>
      {/each}
    </div>
  </a>
  {#if personalRecord}
    <div
      class="activity-pr-banner"
      aria-label={`Overall rank ${personalRecord.overallRank}: ${achievementText(personalRecord)}`}
    >
      <span
        class={`activity-pr-badge rank-${personalRecord.overallRank}`}
        aria-hidden="true"
        ><Medal size={25} /><small
          >{personalRecord.overallRank === 1
            ? "PR"
            : personalRecord.overallRank}</small
        ></span
      >
      <strong>{achievementText(personalRecord)}</strong>
    </div>
  {/if}
  {#if activity.track || activity.images?.length}
    <a
      class="activity-card-media-link"
      href={`/activities/${activity.id}`}
      onclick={openActivity}
    >
      <div
        class:activity-card-media-split={Boolean(
          activity.track && activity.images?.length === 1,
        )}
        class="activity-card-media"
      >
        {#if activity.track}
          <div class="activity-card-map">
            <RouteMap
              coordinates={activity.track.coordinates}
              compact
              showEndpoints={false}
            />
          </div>
        {/if}
        {#if activity.images?.length}
          <div
            class:activity-card-images-with-map={Boolean(activity.track)}
            class:activity-card-images-two={activity.images.length === 2}
            class="activity-card-images"
            aria-label={`${activity.images.length} activity ${activity.images.length === 1 ? "image" : "images"}`}
          >
            {#each activity.images.slice(0, 6) as image}
              {@const imageUrl =
                image.preview ?? image.original ?? image.thumbnail}
              {#if imageUrl}
                <span class="activity-card-image">
                  <img
                    src={imageUrl}
                    alt={image.caption ?? ""}
                    width={image.width ?? undefined}
                    height={image.height ?? undefined}
                    loading="lazy"
                  />
                </span>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    </a>
  {/if}
</article>
