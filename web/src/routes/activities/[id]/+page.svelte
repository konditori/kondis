<script lang="ts">
  import {
    ArrowLeft,
    CalendarDays,
    Check,
    ChevronLeft,
    ChevronRight,
    Clock3,
    Flame,
    Gauge,
    HeartPulse,
    MapPinned,
    Medal,
    Mountain,
    Pencil,
    Timer,
    Trash2,
    X,
    Zap,
  } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import {
    activityControllerDeleteById,
    activityControllerUpdateById,
    ActivityUpdateSport,
    getSdkRequestOptions,
    Sport,
  } from "$lib/api";
  import {
    ActivityMapStyle,
    AverageMetric,
    activityTypeLabel,
    activityTypeOptions,
    activityTypeSettings,
    sportIcon,
  } from "$lib/activity-types";
  import { bestEffortLabel, bestEffortRecordName } from "$lib/best-efforts";
  import ActivityProfile from "$lib/components/ActivityProfile.svelte";
  import ImageLightbox from "$lib/components/ImageLightbox.svelte";
  import RouteMap from "$lib/components/RouteMap.svelte";
  import { subscribeToActivityEvents } from "$lib/realtime";
  import {
    activityName,
    distance,
    duration,
    effortDuration,
    elevation,
    localDate,
    localTime,
    pace,
    speed,
  } from "$lib/format";
  import type { Activity, ActivityDetail } from "$lib/types";

  let { data } = $props();
  let updatedActivity = $state<Activity | null>(null);
  let updatedBestEfforts = $state<ActivityDetail["bestEfforts"] | undefined>(
    undefined,
  );
  const activity = $derived<ActivityDetail>({
    ...data.activity,
    ...(updatedActivity ?? {}),
    ...(updatedBestEfforts === undefined
      ? {}
      : { bestEfforts: updatedBestEfforts }),
  });
  let editing = $state(false);
  let saving = $state(false);
  let deleting = $state(false);
  let editError = $state("");
  let draftName = $state("");
  let draftDescription = $state("");
  let draftExcludeFromRankings = $state(false);
  let draftTags = $state<Activity["tags"]>([]);
  const tagLabels: Record<Activity["tags"][number], string> = {
    race: "Race",
    long_run: "Long Run",
    commute: "Commute",
    workout: "Workout",
    competition: "Competition",
    recovery: "Recovery",
    with_pet: "With Pet",
    with_kid: "With Kid",
    for_a_cause: "For a Cause",
  };
  const availableTags = $derived(
    (Object.keys(tagLabels) as Activity["tags"][number][]).filter(
      (tag) =>
        tag !== "long_run" ||
        ["run", "trail_run", "virtual_run"].includes(draftSport),
    ),
  );
  const activityTypeOptionsList = $derived(
    activityTypeOptions(data.activityTypes),
  );
  let draftSport = $state<Activity["sport"]>(Sport.Other);
  const Icon = $derived(sportIcon(activity.sport));
  const excludedFromRankings = $derived(activity.excludeFromRankings);
  const activitySettings = $derived(
    activityTypeSettings(data.activityTypes, activity.sport),
  );
  const averageMetric = $derived(activitySettings.averageMetric);
  const mapStyle = $derived(activitySettings.mapStyle);
  const isCyclingEffort = $derived(
    [
      "ride",
      "gravel_ride",
      "mountain_bike_ride",
      "virtual_ride",
      "e_bike_ride",
      "e_mountain_bike_ride",
    ].includes(activity.sport),
  );
  const hasBestEffortAchievements = $derived(
    !excludedFromRankings &&
      (activity.bestEfforts?.some(
        (effort) => bestEffortAchievement(effort) !== null,
      ) ??
        false),
  );
  const hasHeartRate = $derived(activity.metrics?.avgHr != null);
  const hasElevation = $derived(
    activity.metrics?.elevationGain != null ||
      activity.metrics?.elevationLoss != null,
  );
  const hasGpsRoute = $derived((activity.track?.coordinates.length ?? 0) > 0);
  const hasBestEffortHeartRate = $derived(
    activity.bestEfforts?.some((effort) => effort.avgHr != null) ?? false,
  );
  const distanceBestEfforts = $derived(
    activity.bestEfforts?.filter(
      (effort) => !effort.type.startsWith("power_"),
    ) ?? [],
  );
  const powerBestEfforts = $derived(
    activity.bestEfforts?.filter((effort) =>
      effort.type.startsWith("power_"),
    ) ?? [],
  );
  const mapMedals = $derived(
    excludedFromRankings
      ? []
      : (activity.bestEfforts ?? [])
          .filter(
            (effort) => effort.overallRank >= 1 && effort.overallRank <= 3,
          )
          .flatMap((effort) => {
            const achievement = bestEffortAchievement(effort);
            return achievement && achievement.rank === effort.overallRank
              ? [
                  {
                    type: effort.type,
                    rank: effort.overallRank,
                    endTime: effort.endTime,
                    distance: effort.distance,
                    isPower: effort.type.startsWith("power_"),
                    label:
                      effort.type === "biggest_climb" ||
                      effort.type === "elevation_gain" ||
                      effort.type === "longest_ride"
                        ? bestEffortLabel(effort.type)
                        : effort.type.startsWith("power_")
                          ? `Best power - ${bestEffortLabel(effort.type).replace(" power", "")}`
                          : `${
                              effort.overallRank === 1
                                ? "Fastest"
                                : effort.overallRank === 2
                                  ? "2nd fastest"
                                  : "3rd fastest"
                            } ${bestEffortLabel(effort.type)}`,
                  },
                ]
              : [];
          }),
  );
  const hasActivityAnalysis = $derived(activity.analysis !== null);
  const hasSplitHeartRate = $derived(
    activity.analysis?.splits.some((split) => split.avgHr != null) ?? false,
  );
  type HighlightRange = {
    startTime: number;
    endTime: number;
    label: string;
    pointTime?: number;
  };
  let highlightedRange = $state<HighlightRange | null>(null);
  let graphPointTime = $state<number | null>(null);
  let imageCarousel = $state<HTMLDivElement>();
  let imagePage = $state(0);
  const viewableImages = $derived(
    activity.images.filter(
      (image) => image.preview || image.original || image.thumbnail,
    ),
  );
  let selectedImageIndex = $state<number | null>(null);
  const imagePageCount = $derived(viewableImages.length);
  $effect(() => {
    if (imagePage >= imagePageCount) {
      imagePage = Math.max(0, imagePageCount - 1);
    }
  });
  const averageMetricStats = $derived(
    averageMetric === AverageMetric.None
      ? []
      : averageMetric === AverageMetric.Speed
        ? [
            {
              label: "Average speed",
              value: speed(activity.metrics?.avgSpeed ?? null, data.unitSystem),
              icon: Gauge,
            },
          ]
        : [
            {
              label: "Pace",
              value: pace(
                activity.metrics?.avgSpeed ??
                  (activity.metrics?.distance != null
                    ? activity.metrics.distance /
                      (activity.metrics.movingTime ??
                        activity.metrics.elapsedTime)
                    : null),
                data.unitSystem,
                averageMetric === AverageMetric.SwimPace,
              ),
              icon: Gauge,
            },
          ],
  );
  const stats = $derived([
    {
      label: "Distance",
      value: distance(activity.metrics?.distance ?? null, data.unitSystem),
      icon: Gauge,
    },
    {
      label: "Moving time",
      value: activity.metrics
        ? duration(activity.metrics.movingTime ?? activity.metrics.elapsedTime)
        : "—",
      icon: Timer,
    },
    {
      label: "Elapsed time",
      value: activity.metrics ? duration(activity.metrics.elapsedTime) : "—",
      icon: Clock3,
    },
    ...(hasElevation
      ? [
          {
            label: "Elevation gain",
            value: elevation(
              activity.metrics?.elevationGain ?? null,
              data.unitSystem,
            ),
            icon: Mountain,
          },
        ]
      : []),
    ...averageMetricStats,
    ...(hasHeartRate
      ? [
          {
            label: "Average heart rate",
            value: `${activity.metrics?.avgHr} bpm`,
            icon: HeartPulse,
          },
        ]
      : []),
    ...(activitySettings.showAveragePower
      ? [
          {
            label: "Average power",
            value:
              activity.metrics?.avgPower == null
                ? "—"
                : `${activity.metrics.avgPower} W`,
            icon: Zap,
          },
        ]
      : []),
    {
      label: "Energy",
      value:
        activity.metrics?.calories == null
          ? "—"
          : `${activity.metrics.calories} kcal`,
      icon: Flame,
    },
  ]);

  $effect(() => {
    const unsubscribe = subscribeToActivityEvents(
      data.eventsUrl,
      (event) => {
        if (event.activity.id !== activity.id) {
          return;
        }
        if (event.type === "activity.best-efforts.available") {
          updatedBestEfforts = event.activity.bestEfforts;
        } else if (event.type === "activity.updated") {
          updatedActivity = { ...(updatedActivity ?? {}), ...event.activity };
        }
      },
      () => {},
    );
    return unsubscribe;
  });

  function backToActivities(event: MouseEvent) {
    if (
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey &&
      page.state.fromActivityList
    ) {
      event.preventDefault();
      history.back();
    }
  }

  function startEditing() {
    draftName = activity.name ?? "";
    draftDescription = activity.description ?? "";
    draftSport = activity.sport;
    draftExcludeFromRankings = activity.excludeFromRankings;
    draftTags = [...(activity.tags ?? [])];
    editError = "";
    editing = true;
  }

  function rankOrdinal(rank: number): string {
    return rank === 2 ? "2nd" : "3rd";
  }

  function bestEffortAchievement(
    effort: NonNullable<ActivityDetail["bestEfforts"]>[number],
  ): { rank: number; text: string } | null {
    const name = bestEffortRecordName(effort.type);
    if (effort.overallRank === 1) {
      return { rank: 1, text: `New best of all time` };
    }
    if (effort.overallRank <= 3) {
      return {
        rank: effort.overallRank,
        text: `New ${rankOrdinal(effort.overallRank)} best of all time`,
      };
    }
    if (effort.yearRank === 1) {
      return { rank: 1, text: `New best of ${effort.year}` };
    }
    if (effort.yearRank <= 3) {
      return {
        rank: effort.yearRank,
        text: `New ${rankOrdinal(effort.yearRank)} best of ${effort.year}`,
      };
    }
    return null;
  }

  function cancelEditing() {
    editing = false;
    editError = "";
  }

  function highlight(
    startTime: number,
    endTime: number,
    label: string,
    pointTime?: number,
  ) {
    if (
      highlightedRange?.startTime === startTime &&
      highlightedRange.endTime === endTime &&
      highlightedRange.pointTime === pointTime
    ) {
      return;
    }
    highlightedRange = { startTime, endTime, label, pointTime };
    graphPointTime = pointTime ?? null;
  }

  function highlightGraphPoint(point: { time: number } | null) {
    if (!point) {
      graphPointTime = null;
      return;
    }
    graphPointTime = point.time;
  }

  function clearHighlight() {
    highlightedRange = null;
    graphPointTime = null;
  }

  function splitRate(distanceMeters: number, elapsedTime: number): string {
    return isCyclingEffort
      ? speed(distanceMeters / elapsedTime, data.unitSystem)
      : pace(distanceMeters / elapsedTime, data.unitSystem).replace(
          " min/",
          " /",
        );
  }

  const mapHighlight = $derived(
    highlightedRange || graphPointTime !== null
      ? {
          ...(highlightedRange ?? { startTime: 0, endTime: 0, label: "" }),
          pointTime: graphPointTime ?? highlightedRange?.pointTime,
        }
      : null,
  );

  async function saveMetadata(event: SubmitEvent) {
    event.preventDefault();
    saving = true;
    editError = "";
    try {
      const updated = (await activityControllerUpdateById(
        {
          id: activity.id,
          activityUpdateDto: {
            name: draftName.trim() || null,
            description: draftDescription.trim() || null,
            sport: draftSport as unknown as ActivityUpdateSport,
            excludeFromRankings: draftExcludeFromRankings,
            tags: draftTags,
          } as never,
        },
        getSdkRequestOptions(),
      )) as Activity;
      updatedActivity = updated;
      editing = false;
    } catch {
      editError = "Could not save the activity. Please try again.";
    } finally {
      saving = false;
    }
  }

  async function deleteActivity() {
    if (!window.confirm("Delete this activity? This cannot be undone.")) {
      return;
    }

    deleting = true;
    editError = "";
    try {
      await activityControllerDeleteById(
        { id: activity.id },
        getSdkRequestOptions(),
      );
      await goto("/");
    } catch {
      editError = "Could not delete the activity. Please try again.";
      deleting = false;
    }
  }

  function updateImagePage() {
    if (!imageCarousel) return;
    const slides = [...imageCarousel.children] as HTMLElement[];
    const nearest = slides.reduce(
      (best, slide, index) =>
        Math.abs(slide.offsetLeft - imageCarousel!.scrollLeft) <
        Math.abs(slides[best]!.offsetLeft - imageCarousel!.scrollLeft)
          ? index
          : best,
      0,
    );
    imagePage = nearest;
  }

  function scrollImages(direction: -1 | 1) {
    if (!imageCarousel) return;
    const slides = [...imageCarousel.children] as HTMLElement[];
    const next = Math.max(
      0,
      Math.min(imagePage + direction, slides.length - 1),
    );
    const slide = slides[next];
    if (!slide) return;
    imageCarousel.scrollTo({ left: slide.offsetLeft, behavior: "smooth" });
    imagePage = next;
  }
</script>

<svelte:head><title>{activityName(activity)} · Kondis</title></svelte:head>

<div class="detail-page">
  <header class="detail-header">
    <a class="back-link" href="/" onclick={backToActivities}
      ><ArrowLeft size={18} /> All activities</a
    >
    <div class="detail-heading">
      <span class="detail-sport"><Icon size={27} /></span>
      <div class="detail-title">
        <span class="eyebrow"
          >{activityTypeLabel(data.activityTypes, activity.sport)}</span
        >
        <h1>{activityName(activity)}</h1>
      </div>
      <button
        class="edit-metadata-button"
        type="button"
        onclick={startEditing}
        aria-label="Edit activity metadata"><Pencil size={16} /> Edit</button
      >
    </div>
    {#if editing}
      <form class="metadata-editor" onsubmit={saveMetadata}>
        <label
          ><span>Name</span><input
            bind:value={draftName}
            maxlength="200"
            placeholder="Activity name"
          /></label
        >
        <label
          ><span>Activity type</span><select
            bind:value={draftSport}
            onchange={() => {
              if (!["run", "trail_run", "virtual_run"].includes(draftSport))
                draftTags = draftTags.filter((tag) => tag !== "long_run");
            }}
            >{#each activityTypeOptionsList as option}<option
                value={option.value}>{option.label}</option
              >{/each}</select
          ></label
        >
        <label class="metadata-description"
          ><span>Description</span><textarea
            bind:value={draftDescription}
            maxlength="10000"
            placeholder="Activity description"></textarea></label
        >
        <label class="metadata-checkbox"
          ><input
            type="checkbox"
            bind:checked={draftExcludeFromRankings}
          /><span>Exclude from rankings</span></label
        >
        <fieldset class="metadata-tags">
          <legend>Tags</legend>
          <div class="tag-options">
            {#each availableTags as tag}
              <label
                class:tag-selected={draftTags.includes(tag)}
                class="tag-option"
              >
                <input
                  type="checkbox"
                  checked={draftTags.includes(tag)}
                  onchange={(event) =>
                    (draftTags = (event.currentTarget as HTMLInputElement)
                      .checked
                      ? [...draftTags, tag]
                      : draftTags.filter((value) => value !== tag))}
                />
                <span>{tagLabels[tag]}</span>
              </label>
            {/each}
          </div>
        </fieldset>
        <div class="metadata-actions">
          <button
            type="button"
            class="metadata-delete"
            onclick={deleteActivity}
            disabled={saving || deleting}
            ><Trash2 size={16} /> {deleting ? "Deleting…" : "Delete"}</button
          >
          <button
            type="button"
            class="metadata-cancel"
            onclick={cancelEditing}
            disabled={saving || deleting}><X size={16} /> Cancel</button
          >
          <button
            type="submit"
            class="metadata-save"
            disabled={saving || deleting}
            ><Check size={16} /> {saving ? "Saving…" : "Save"}</button
          >
        </div>
        {#if editError}<p class="metadata-error" role="alert">
            {editError}
          </p>{/if}
      </form>
    {/if}
    <div class="detail-date">
      <span><CalendarDays size={17} />{localDate(activity.startedAt)}</span
      ><span><Clock3 size={17} />{localTime(activity.startedAt)}</span>
    </div>
    {#if activity.tags?.length}<div
        class="activity-tags"
        aria-label="Activity tags"
      >
        {#each activity.tags as tag}<span class="activity-tag"
            >{tagLabels[tag]}</span
          >{/each}
      </div>{/if}
    {#if activity.description}<p class="activity-description">
        {activity.description}
      </p>{/if}
  </header>

  {#if viewableImages.length > 0}
    <section
      class="activity-image-carousel"
      class:activity-image-carousel-locked={selectedImageIndex !== null}
      inert={selectedImageIndex !== null}
      aria-label="Activity photos"
    >
      <div
        class="activity-visual-carousel-track"
        role="region"
        aria-label="Swipeable activity photos"
        bind:this={imageCarousel}
        onscroll={updateImagePage}
      >
        {#each viewableImages as image, imageIndex (image.id)}
          <div class="activity-visual-slide activity-photo-slide">
            <figure>
              <button
                type="button"
                class="activity-photo-open"
                aria-label={image.caption ?? "Open activity photo"}
                onclick={() => (selectedImageIndex = imageIndex)}
              >
                <img
                  src={image.preview ?? image.thumbnail ?? image.original}
                  alt={image.caption ?? "Activity photo"}
                />
              </button>
              {#if image.caption}<figcaption>{image.caption}</figcaption>{/if}
            </figure>
          </div>
        {/each}
      </div>
      {#if imagePageCount > 1}
        <div
          class="activity-visual-controls"
          aria-label="Photo carousel controls"
        >
          <button
            type="button"
            aria-label="Previous photo"
            onclick={() => scrollImages(-1)}
            disabled={imagePage === 0}><ChevronLeft size={17} /></button
          >
          <span aria-live="polite">{imagePage + 1} / {imagePageCount}</span>
          <button
            type="button"
            aria-label="Next photo"
            onclick={() => scrollImages(1)}
            disabled={imagePage === imagePageCount - 1}
            ><ChevronRight size={17} /></button
          >
        </div>
      {/if}
    </section>
  {/if}

  {#if hasGpsRoute}
    <div
      class:activity-visuals={!isCyclingEffort &&
        hasActivityAnalysis &&
        (activity.analysis?.splits.length ?? 0) > 0}
    >
      {#if !isCyclingEffort && hasActivityAnalysis && activity.analysis && activity.analysis.splits.length > 0}
        <section class="splits-section splits-section-visual">
          <div class="split-table-wrap">
            <div
              class="split-table"
              role="table"
              aria-label="Activity kilometre splits"
            >
              <div
                class="split-header"
                class:no-heart-rate={!hasSplitHeartRate}
                role="row"
              >
                <div role="columnheader"><strong>KM</strong></div>
                <div role="columnheader">
                  <strong>{isCyclingEffort ? "Speed" : "Pace"}</strong>
                </div>
                {#if hasSplitHeartRate}<div role="columnheader">
                    <strong>HR</strong>
                  </div>{/if}
                <div role="columnheader"><strong>Elev</strong></div>
              </div>
              {#each activity.analysis.splits as split, index}
                {@const splitLabel =
                  index === activity.analysis.splits.length - 1 &&
                  split.distance < 995
                    ? (split.distance / 1000).toFixed(2)
                    : `${index + 1}`}
                <div
                  class="split-row"
                  class:no-heart-rate={!hasSplitHeartRate}
                  class:highlighted={highlightedRange?.startTime ===
                    split.startTime &&
                    highlightedRange?.endTime === split.endTime}
                  role="row"
                  tabindex="0"
                  onpointerenter={() =>
                    highlight(
                      split.startTime,
                      split.endTime,
                      `KM ${splitLabel}`,
                    )}
                  onpointerleave={clearHighlight}
                  onfocus={() =>
                    highlight(
                      split.startTime,
                      split.endTime,
                      `KM ${splitLabel}`,
                    )}
                  onblur={clearHighlight}
                >
                  <div role="cell"><strong>{splitLabel}</strong></div>
                  <div role="cell">
                    {splitRate(split.distance, split.elapsedTime)}
                  </div>
                  {#if hasSplitHeartRate}<div role="cell">
                      {split.avgHr == null ? "—" : `${split.avgHr}`}
                    </div>{/if}
                  <div role="cell">
                    {elevation(split.elevationChange, data.unitSystem)}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </section>
      {/if}
      <section class="activity-map-section" aria-label="Activity route">
        <section class="map-panel">
          {#key mapStyle}
            <RouteMap
              coordinates={activity.track?.coordinates ?? null}
              mode={mapStyle}
              route={activity.analysis?.route ?? []}
              medals={mapMedals}
              highlight={mapHighlight}
              onPointHover={highlightGraphPoint}
            />
          {/key}
          {#if activity.track && mapStyle === ActivityMapStyle.Route}
            <div class="map-key">
              <span><i class="start-dot"></i> Start</span><span
                ><i class="finish-dot"></i> Finish</span
              >
            </div>
          {/if}
        </section>
      </section>
      {#if hasGpsRoute && hasActivityAnalysis}
        <ActivityProfile
          points={activity.analysis?.profile ?? []}
          selection={highlightedRange}
          pointTime={graphPointTime}
          onPointHover={highlightGraphPoint}
        />
      {/if}
    </div>
  {/if}

  {#if !isCyclingEffort && !hasGpsRoute && hasActivityAnalysis && activity.analysis && activity.analysis.splits.length > 0}
    <section class="splits-section">
      <div class="split-table-wrap">
        <div
          class="split-table"
          role="table"
          aria-label="Activity kilometre splits"
        >
          <div
            class="split-header"
            class:no-heart-rate={!hasSplitHeartRate}
            role="row"
          >
            <div role="columnheader"><strong>KM</strong></div>
            <div role="columnheader">
              <strong>{isCyclingEffort ? "Speed" : "Pace"}</strong>
            </div>
            {#if hasSplitHeartRate}<div role="columnheader">
                <strong>Heart rate</strong>
              </div>{/if}
            <div role="columnheader"><strong>Elev</strong></div>
          </div>
          {#each activity.analysis.splits as split, index}
            {@const splitLabel =
              index === activity.analysis.splits.length - 1 &&
              split.distance < 995
                ? (split.distance / 1000).toFixed(2)
                : `${index + 1}`}
            <div
              class="split-row"
              class:no-heart-rate={!hasSplitHeartRate}
              class:highlighted={highlightedRange?.startTime ===
                split.startTime && highlightedRange?.endTime === split.endTime}
              role="row"
              tabindex="0"
              onpointerenter={() =>
                highlight(split.startTime, split.endTime, `KM ${splitLabel}`)}
              onpointerleave={clearHighlight}
              onfocus={() =>
                highlight(split.startTime, split.endTime, `KM ${splitLabel}`)}
              onblur={clearHighlight}
            >
              <div role="cell"><strong>{splitLabel}</strong></div>
              <div role="cell">
                {splitRate(split.distance, split.elapsedTime)}
              </div>
              {#if hasSplitHeartRate}<div role="cell">
                  {split.avgHr == null ? "—" : `${split.avgHr} bpm`}
                </div>{/if}
              <div role="cell">
                {elevation(split.elevationChange, data.unitSystem)}
              </div>
            </div>
          {/each}
        </div>
      </div>
    </section>
  {/if}

  {#if activity.matchedRouteCount !== null && activity.matchedRouteCount > 1}
    <section class="route-match-summary">
      <div class="route-match-summary-icon"><MapPinned size={23} /></div>
      <div>
        <span class="eyebrow">Repeated route</span>
        <h2>
          {activity.matchedRouteCount}
          {activity.matchedRouteCount === 1 ? "activity" : "activities"} on this route
        </h2>
        <p>Compare your performance across every matched effort.</p>
      </div>
      <a href={`/activities/${activity.id}/matched-routes`}
        >View matched {isCyclingEffort ? "rides" : "runs"}
        <ChevronRight size={17} /></a
      >
    </section>
  {/if}

  <section class="metrics-section">
    <div class="section-heading">
      <div>
        <span class="eyebrow">Workout summary</span>
        <h2>At a glance</h2>
      </div>
    </div>
    <div class="metric-grid">
      {#each stats as stat}
        <article class="metric">
          <span><stat.icon size={19} /></span>
          <div><small>{stat.label}</small><strong>{stat.value}</strong></div>
        </article>
      {/each}
    </div>
  </section>

  {#if activity.bestEfforts && activity.bestEfforts.length > 0}
    <section class="best-efforts-section">
      <div class="section-heading">
        <div>
          <span class="eyebrow"
            >{isCyclingEffort ? "Cycling" : "Running"} performance</span
          >
          <h2>Best efforts</h2>
          {#if excludedFromRankings}<p class="best-efforts-excluded-note">
              Shown for this activity only; excluded from rankings.
            </p>{/if}
        </div>
      </div>
      {#if distanceBestEfforts.length > 0}<div class="best-effort-table-wrap">
          <div
            class="best-effort-table"
            role="table"
            aria-label="Distance best efforts"
          >
            <div
              class="best-effort-header"
              class:no-heart-rate={!hasBestEffortHeartRate}
              role="row"
            >
              <div role="columnheader"><strong>Distance</strong></div>
              <div role="columnheader"><strong>Time</strong></div>
              <div role="columnheader">
                <strong>{isCyclingEffort ? "Speed" : "Pace"}</strong>
              </div>
              {#if hasBestEffortHeartRate}<div role="columnheader">
                  <strong>Heart Rate</strong>
                </div>{/if}
              <div role="columnheader"><strong>Elev</strong></div>
            </div>
            {#each distanceBestEfforts as effort}
              {@const achievement = excludedFromRankings
                ? null
                : bestEffortAchievement(effort)}
              <a
                class="best-effort-row"
                class:no-heart-rate={!hasBestEffortHeartRate}
                class:highlighted={highlightedRange?.startTime ===
                  effort.startTime &&
                  highlightedRange?.endTime === effort.endTime}
                role="row"
                href={`/best-efforts/${isCyclingEffort ? "ride" : "run"}/${effort.type}`}
                aria-label={`${bestEffortLabel(effort.type)}${achievement ? `. ${achievement.text}` : ""}. View best effort history`}
                onpointerenter={() =>
                  highlight(
                    effort.startTime,
                    effort.endTime,
                    bestEffortLabel(effort.type),
                  )}
                onpointerleave={clearHighlight}
                onfocus={() =>
                  highlight(
                    effort.startTime,
                    effort.endTime,
                    bestEffortLabel(effort.type),
                  )}
                onblur={clearHighlight}
              >
                <div class="effort-distance" role="cell">
                  {#if achievement}
                    <span
                      class={`effort-medal achievement-rank-${achievement.rank}`}
                      aria-hidden="true"
                    >
                      <Medal size={31} />
                      <small
                        >{achievement.rank === 1
                          ? "PR"
                          : achievement.rank}</small
                      >
                    </span>
                  {:else if hasBestEffortAchievements}
                    <span class="effort-medal-placeholder" aria-hidden="true"
                    ></span>
                  {/if}
                  <span class="effort-distance-copy">
                    <strong>{bestEffortLabel(effort.type)}</strong>
                    {#if achievement}<small>{achievement.text}</small>{/if}
                  </span>
                </div>
                <div role="cell">{effortDuration(effort.elapsedTime)}</div>
                <div role="cell">
                  {isCyclingEffort
                    ? speed(
                        effort.distance / effort.elapsedTime,
                        data.unitSystem,
                      )
                    : pace(
                        effort.distance / effort.elapsedTime,
                        data.unitSystem,
                      )}
                </div>
                {#if hasBestEffortHeartRate}<div role="cell">
                    {effort.avgHr == null ? "—" : `${effort.avgHr} bpm`}
                  </div>{/if}
                <div role="cell">
                  {elevation(effort.elevationChange, data.unitSystem)}
                </div>
              </a>
            {/each}
          </div>
        </div>{/if}
      {#if powerBestEfforts.length > 0}
        <div class="best-effort-table-wrap">
          <div
            class="best-effort-table power-best-effort-table"
            role="table"
            aria-label="Power best efforts"
          >
            <div class="best-effort-header" role="row">
              <div role="columnheader"></div>
              <div role="columnheader"><strong>Time</strong></div>
              <div role="columnheader"><strong>Power</strong></div>
              <div role="columnheader"><strong>Elev</strong></div>
            </div>
            {#each powerBestEfforts as effort}
              {@const achievement = excludedFromRankings
                ? null
                : bestEffortAchievement(effort)}
              <a
                class="best-effort-row"
                role="row"
                href={`/best-efforts/ride/${effort.type}`}
                aria-label={`${bestEffortLabel(effort.type)}${achievement ? `. ${achievement.text}` : ""}. View best effort history`}
              >
                <div class="effort-distance" role="cell">
                  {#if achievement}<span
                      class={`effort-medal achievement-rank-${achievement.rank}`}
                      aria-hidden="true"
                      ><Medal size={31} /><small
                        >{achievement.rank === 1
                          ? "PR"
                          : achievement.rank}</small
                      ></span
                    >{/if}
                </div>
                <div role="cell">
                  {bestEffortLabel(effort.type).replace(" power", "")}
                </div>
                <div role="cell">{Math.round(effort.value)} W</div>
                <div role="cell">
                  {elevation(effort.elevationChange, data.unitSystem)}
                </div>
              </a>
            {/each}
          </div>
        </div>
      {/if}
    </section>
  {/if}
</div>
{#if selectedImageIndex !== null}
  <ImageLightbox
    images={viewableImages}
    initialIndex={selectedImageIndex}
    onClose={() => (selectedImageIndex = null)}
  />
{/if}
