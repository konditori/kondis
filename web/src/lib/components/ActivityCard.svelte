<script lang="ts">
  import { ArrowUpRight, Heart, Medal, MessageCircle } from "@lucide/svelte";
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
    shouldShowAchievementCount,
  } from "$lib/activity-achievements";
  import RouteMap from "$lib/components/RouteMap.svelte";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import { userDisplayName, userPossessiveName } from "$lib/user-name";
  import type { ActivityTypeSettingsOutput } from "$lib/api";
  import type { Activity } from "$lib/types";
  import {
    getSdkRequestOptions,
    socialControllerLike,
    socialControllerUnlike,
  } from "$lib/api";
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
    viewerId,
  }: {
    activity: Activity;
    activityTypes: ActivityTypeSettingsOutput[];
    unitSystem: UnitSystem;
    viewerId?: string;
  } = $props();
  let liked = $state(false);
  let likeCount = $state(0);
  let likeBusy = $state(false);
  $effect(() => {
    liked = activity.viewerLiked ?? false;
    likeCount = activity.likeCount ?? 0;
  });
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
  const achievementCount = $derived(
    activity.achievementCount ?? activity.topBestEfforts?.length ?? 0,
  );
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
  const activityOwner = $derived(
    viewerId && (activity.userId === viewerId || activity.athlete?.id === viewerId)
      ? "Your"
      : activity.athlete
        ? userPossessiveName(activity.athlete)
        : "This athlete's",
  );

  function achievementText(
    effort: NonNullable<Activity["topBestEfforts"]>[number],
  ): string {
    const { type } = effort;
    const label = bestEffortLabel(type);
    const rank = personalRecord?.overallRank ?? 1;
    const ordinal = rank === 1 ? "" : rank === 2 ? "2nd " : "3rd ";
    if (type === "longest_ride") return `${activityOwner} ${ordinal}longest ride!`;
    if (type === "biggest_climb") return `${activityOwner} ${ordinal}biggest climb!`;
    if (type.startsWith("power_")) {
      return `${activityOwner} ${ordinal}highest power output for ${powerDurationLabel(type)} ever!`;
    }
    return type.includes("power") || type === "elevation_gain"
      ? `${activityOwner} ${ordinal}best ${label}!`
      : `${activityOwner} ${ordinal}fastest ${label}!`;
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

  async function toggleLike(event: MouseEvent) {
    event.stopPropagation();
    if (likeBusy) return;
    likeBusy = true;
    const next = !liked;
    liked = next;
    likeCount += next ? 1 : -1;
    try {
      const result = next
        ? await socialControllerLike(
            { id: activity.id },
            getSdkRequestOptions(),
          )
        : await socialControllerUnlike(
            { id: activity.id },
            getSdkRequestOptions(),
          );
      liked = result.liked;
      likeCount = result.likeCount;
    } catch {
      liked = !next;
      likeCount += next ? -1 : 1;
    } finally {
      likeBusy = false;
    }
  }
</script>

<article class="activity-card">
  <a
    class="activity-card-summary"
    class:has-description={Boolean(activity.description)}
    href={`/activities/${activity.id}`}
    onclick={openActivity}
  >
    <div class="activity-card-identity">
      <UserAvatar
        name={activity.athlete ? userDisplayName(activity.athlete) : "You"}
        src={activity.athlete?.avatarUrl}
        size={54}
      />
    </div>
    <div class="activity-primary">
      <div class="activity-title activity-name-title">
        <h3>{activityName(activity)}</h3>
        <ArrowUpRight size={17} />
      </div>
      <p>
        <span
          >{localDate(activity.startedAt)} · {localTime(
            activity.startedAt,
          )}</span
        ><span
          class="activity-sport-inline"
          class:running-sport={["run", "trail_run", "virtual_run"].includes(
            activity.sport,
          )}
          aria-label={activityTypeLabel(activityTypes, activity.sport)}
          ><Icon size={16} strokeWidth={1.8} /></span
        >
      </p>
      {#if activity.tags?.length}<div
          class="activity-tags"
          aria-label="Activity tags"
        >
          {#each activity.tags as tag}<span class="activity-tag"
              >{tag.replaceAll("_", " ")}</span
            >{/each}
        </div>{/if}
    </div>
    {#if activity.description}
      <p class="activity-card-description">{activity.description}</p>
    {/if}
    <div class="activity-feed-stats">
      <div
        class="activity-stat activity-medal-stat"
        aria-label={`${achievementCount} medals`}
      >
        <div class="activity-medal-value">
          {#if shouldShowAchievementCount(achievementCount, activity.topBestEfforts ?? [])}<strong
              >{achievementCount}</strong
            >{/if}
          {#each distinctAchievementEfforts(activity.topBestEfforts ?? []) as effort}
            <span
              class={`activity-achievement rank-${achievementRank(effort)}`}
              title={`${achievementMedalLabel(achievementRank(effort))}: ${bestEffortLabel(effort.type)}`}
              aria-label={`${achievementMedalLabel(achievementRank(effort))}: ${bestEffortLabel(effort.type)}`}
              ><Medal size={20} /></span
            >
          {/each}
        </div>
      </div>
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
  {#if likeCount > 0 || activity.commentCount !== undefined}
    <div class="activity-social-row">
      <button
        class:liked
        type="button"
        class="activity-social-button"
        onclick={toggleLike}
        disabled={likeBusy}
        aria-label={liked ? "Unlike activity" : "Like activity"}
        ><Heart size={17} fill={liked ? "currentColor" : "none"} />
        {likeCount}</button
      >
      <a
        class="activity-social-button"
        href={`/activities/${activity.id}#comments`}
        onclick={openActivity}
        ><MessageCircle size={17} /> {activity.commentCount ?? 0}</a
      >
    </div>
  {/if}
</article>
