<script lang="ts">
  import {
    Activity as ActivityIcon,
    CloudOff,
    LoaderCircle,
  } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import { tick } from "svelte";
  import { page } from "$app/state";
  import type { Snapshot } from "@sveltejs/kit";
  import ActivityCard from "$lib/components/ActivityCard.svelte";
  import RouteMap from "$lib/components/RouteMap.svelte";
  import { socialControllerFeed, getSdkRequestOptions } from "$lib/api";
  import { subscribeToActivityEvents } from "$lib/realtime";
  import type { Activity, ActivityPage } from "$lib/types";
  import { activityTypeLabel, sportIcon } from "$lib/activity-types";
  import {
    distance,
    duration,
    elevation,
    localDate,
    localTime,
    pace,
  } from "$lib/format";

  let { data } = $props();
  let query = $state(page.url.searchParams.get("search") ?? "");
  let appendedActivities = $state<Activity[]>([]);
  let cursorOverride = $state<string | null>();
  let totalOverride = $state<number>();
  let searchPage = $state<ActivityPage | null>(null);
  let searchAppendedActivities = $state<Activity[]>([]);
  let searchCursor = $state<string | null>(null);
  let searchTotal = $state<number>();
  let searchLoading = $state(false);
  let searchError = $state(false);
  let searchGeneration = 0;
  let loading = $state(false);
  let loadError = $state(false);
  const activities = $derived.by(() => {
    const byUpload = new Map(
      data.activities.map((activity) => [activity.uploadId, activity]),
    );
    for (const activity of appendedActivities)
      byUpload.set(activity.uploadId, activity);
    return [...byUpload.values()].sort(
      (a, b) =>
        b.startedAt.localeCompare(a.startedAt) || b.id.localeCompare(a.id),
    );
  });
  const nextCursor = $derived(
    cursorOverride === undefined ? data.nextCursor : cursorOverride,
  );
  const total = $derived(totalOverride ?? data.total);
  const hasSearch = $derived(query.trim().length > 0);
  const displayedActivities = $derived(
    hasSearch
      ? [...(searchPage?.activities ?? []), ...searchAppendedActivities]
      : activities,
  );
  const displayedNextCursor = $derived(hasSearch ? searchCursor : nextCursor);
  const displayedTotal = $derived(hasSearch ? (searchTotal ?? 0) : total);
  const heading = $derived(
    hasSearch ? `Search results for “${query.trim()}”` : "Home",
  );
  const resultSummary = $derived(
    `${displayedTotal} ${displayedTotal === 1 ? "activity" : "activities"} found`,
  );

  $effect(() => {
    if (data.activities) {
      appendedActivities = [];
      cursorOverride = undefined;
      totalOverride = undefined;
    }
  });

  $effect(() => {
    const search = query.trim();
    const generation = ++searchGeneration;
    searchError = false;
    searchAppendedActivities = [];
    searchCursor = null;
    searchTotal = undefined;
    if (!search) {
      searchPage = null;
      searchLoading = false;
      const url = new URL(page.url);
      if (url.searchParams.has("search")) {
        url.searchParams.delete("search");
        void goto(url, { replaceState: true, keepFocus: true, noScroll: true });
      }
      return;
    }

    searchLoading = true;
    const timer = setTimeout(() => {
      const url = new URL(page.url);
      url.searchParams.set("search", search);
      if (url.href !== page.url.href) {
        void goto(url, { replaceState: true, keepFocus: true, noScroll: true });
      }

      void socialControllerFeed({ search }, getSdkRequestOptions())
        .then((page) => {
          if (generation !== searchGeneration) return;
          const nextPage = page as ActivityPage;
          const sameActivities =
            searchPage &&
            searchPage.total === nextPage.total &&
            searchPage.activities.length === nextPage.activities.length &&
            searchPage.activities.every(
              (activity, index) =>
                activity.id === nextPage.activities[index]?.id,
            );
          if (!sameActivities) searchPage = nextPage;
          searchCursor = nextPage.nextCursor;
          searchTotal = nextPage.total;
        })
        .catch(() => {
          if (generation === searchGeneration) searchError = true;
        })
        .finally(() => {
          if (generation === searchGeneration) searchLoading = false;
        });
    }, 50);

    return () => clearTimeout(timer);
  });

  $effect(() =>
    subscribeToActivityEvents(
      data.eventsUrl,
      (event) => {
        if (event.type === "activity.best-efforts.available") return;
        const { activity } = event;
        appendedActivities = [
          ...appendedActivities.filter(
            ({ uploadId }) => uploadId !== activity.uploadId,
          ),
          activity,
        ];
        void refreshRecent();
      },
      () => void refreshRecent(),
    ),
  );

  $effect(() => {
    const handleClearSearch = () => clearSearch();
    const handleSearch = (event: Event) => {
      query = String((event as CustomEvent<string>).detail ?? "");
    };
    window.addEventListener("kondis:clear-search", handleClearSearch);
    window.addEventListener("kondis:search", handleSearch);
    return () => {
      window.removeEventListener("kondis:clear-search", handleClearSearch);
      window.removeEventListener("kondis:search", handleSearch);
    };
  });

  async function refreshRecent() {
    try {
      const page = (await socialControllerFeed(
        {},
        getSdkRequestOptions(),
      )) as ActivityPage;
      const refreshedUploads = new Set(
        page.activities.map(({ uploadId }) => uploadId),
      );
      appendedActivities = [
        ...appendedActivities.filter(
          ({ uploadId }) => !refreshedUploads.has(uploadId),
        ),
        ...page.activities,
      ];
      totalOverride = page.total;
    } catch {
      // The socket will retry and reconcile again after reconnecting.
    }
  }

  async function loadMore() {
    if (!(hasSearch ? searchCursor : nextCursor) || loading) return;

    loading = true;
    loadError = false;
    try {
      const page = (await socialControllerFeed(
        hasSearch
          ? { cursor: searchCursor!, search: query.trim() }
          : { cursor: nextCursor! },
        getSdkRequestOptions(),
      )) as ActivityPage;
      if (hasSearch) {
        const existing = new Set(displayedActivities.map(({ id }) => id));
        searchAppendedActivities = [
          ...searchAppendedActivities,
          ...page.activities.filter(({ id }) => !existing.has(id)),
        ];
        searchCursor = page.nextCursor;
        searchTotal = page.total;
      } else {
        const existing = new Set(activities.map(({ id }) => id));
        appendedActivities = [
          ...appendedActivities,
          ...page.activities.filter(({ id }) => !existing.has(id)),
        ];
        cursorOverride = page.nextCursor;
        totalOverride = page.total;
      }
    } catch {
      loadError = true;
    } finally {
      loading = false;
    }
  }

  function infiniteScroll(node: HTMLElement) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some(({ isIntersecting }) => isIntersecting))
          void loadMore();
      },
      { rootMargin: "500px 0px" },
    );
    observer.observe(node);
    return { destroy: () => observer.disconnect() };
  }

  function clearSearch() {
    query = "";
  }

  type ActivityListSnapshot = {
    appendedActivities: Activity[];
    cursorOverride?: string | null;
    totalOverride?: number;
    query: string;
    scrollY: number;
  };

  export const snapshot: Snapshot<ActivityListSnapshot> = {
    capture: () => ({
      appendedActivities,
      cursorOverride,
      totalOverride,
      query,
      scrollY: window.scrollY,
    }),
    restore: (value) => {
      appendedActivities = value.appendedActivities;
      cursorOverride = value.cursorOverride;
      totalOverride = value.totalOverride;
      query = value.query;

      // SvelteKit restores its scroll position before snapshots. Wait until the
      // restored activities have rebuilt the page height, then restore it again.
      void tick().then(() =>
        requestAnimationFrame(() => window.scrollTo({ top: value.scrollY })),
      );
    },
  };
</script>

<svelte:head><title>Activities · Kondis</title></svelte:head>

<div class="page-shell">
  <header class="page-header">
    <div>
      <h1>{heading}</h1>
      {#if hasSearch}<p>{resultSummary}</p>{/if}
    </div>
  </header>

  {#if data.unavailable}
    <div class="notice">
      <CloudOff size={20} /><span
        ><strong>Server unavailable</strong> Start the Kondis API to load your activities.</span
      >
    </div>
  {/if}

  {#if data.liveWorkouts.length}
    <section class="live-workout-list" aria-label="Live workouts">
      {#each data.liveWorkouts as workout (workout.id)}
        {@const Icon = sportIcon(workout.sport)}
        {@const averageSpeed =
          workout.elapsedSeconds > 0
            ? workout.distanceMeters / workout.elapsedSeconds
            : null}
        <article class="activity-card live-activity-card">
          <a class="activity-card-summary" href={`/live/session/${workout.id}`}>
            <div class="sport-badge">
              <Icon size={24} strokeWidth={1.8} />
              <span
                class:paused={workout.status === "paused"}
                class="live-beacon"
                aria-label="Live recording"
              ></span>
            </div>
            <div class="activity-primary">
              <div class="activity-title">
                <h3>{activityTypeLabel(data.activityTypes, workout.sport)}</h3>
              </div>
              <p>
                {localDate(workout.startedAt)} · {localTime(workout.startedAt)} ·
                {workout.status === "paused" ? "Paused" : "Live"}
              </p>
            </div>
            <div class="activity-feed-stats">
              <div class="activity-stat">
                <strong
                  >{distance(workout.distanceMeters, data.unitSystem)}</strong
                ><small>Distance</small>
              </div>
              <div class="activity-stat">
                <strong>{pace(averageSpeed, data.unitSystem)}</strong><small
                  >Pace</small
                >
              </div>
              <div class="activity-stat">
                <strong>{duration(workout.elapsedSeconds)}</strong><small
                  >Moving time</small
                >
              </div>
              <div class="activity-stat">
                <strong>{elevation(null, data.unitSystem)}</strong><small
                  >Elevation</small
                >
              </div>
            </div>
          </a>
          {#if workout.route.length >= 2}
            <a
              class="activity-card-media-link"
              href={`/live/session/${workout.id}`}
            >
              <div class="activity-card-media">
                <div class="activity-card-map live-list-map">
                  <RouteMap
                    coordinates={workout.route}
                    compact
                    showEndpoints={false}
                  />
                </div>
              </div>
            </a>
          {/if}
        </article>
      {/each}
    </section>
  {/if}

  {#if displayedActivities.length}
    <div class="activity-list">
      {#each displayedActivities as activity (activity.id)}
        <ActivityCard
          {activity}
          activityTypes={data.activityTypes}
          unitSystem={data.unitSystem}
        />
      {/each}
    </div>
    {#if displayedNextCursor}
      <div class="load-more" use:infiniteScroll aria-live="polite">
        {#if loading}<LoaderCircle class="spin" size={18} /> Loading more activities…
        {:else if loadError}<button onclick={() => void loadMore()}
            >Could not load more. Try again</button
          >
        {/if}
      </div>
    {/if}
  {:else if !data.unavailable && !searchLoading}
    <div class="empty-state">
      <span class="empty-icon"><ActivityIcon size={28} /></span>
      <h2>
        {query ? "No matching activities" : "Your first activity starts here"}
      </h2>
      <p>
        {query
          ? "Try a different sport or activity name."
          : "Import a file to build your private training archive."}
      </p>
    </div>
  {/if}
</div>
