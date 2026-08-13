<script lang="ts">
  import { Activity as ActivityIcon, CloudOff, LoaderCircle, Search } from '@lucide/svelte';
  import { tick } from 'svelte';
  import type { Snapshot } from '@sveltejs/kit';
  import ActivityCard from '$lib/components/ActivityCard.svelte';
  import { activityControllerListRecent, getSdkRequestOptions } from '$lib/api';
  import { subscribeToActivityEvents } from '$lib/realtime';
  import type { Activity, ActivityPage } from '$lib/types';

  let { data } = $props();
  let query = $state('');
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
    const byUpload = new Map(data.activities.map((activity) => [activity.uploadId, activity]));
    for (const activity of appendedActivities) byUpload.set(activity.uploadId, activity);
    return [...byUpload.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.id.localeCompare(a.id));
  });
  const nextCursor = $derived(cursorOverride === undefined ? data.nextCursor : cursorOverride);
  const total = $derived(totalOverride ?? data.total);
  const hasSearch = $derived(query.trim().length > 0);
  const displayedActivities = $derived(
    hasSearch
      ? [...(searchPage?.activities ?? []), ...searchAppendedActivities]
      : activities,
  );
  const displayedNextCursor = $derived(hasSearch ? searchCursor : nextCursor);
  const displayedTotal = $derived(hasSearch ? (searchTotal ?? 0) : total);

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
      return;
    }

    searchLoading = true;
    void activityControllerListRecent({ search }, getSdkRequestOptions())
      .then((page) => {
        if (generation !== searchGeneration) return;
        searchPage = page as ActivityPage;
        searchCursor = searchPage.nextCursor;
        searchTotal = searchPage.total;
      })
      .catch(() => {
        if (generation === searchGeneration) searchError = true;
      })
      .finally(() => {
        if (generation === searchGeneration) searchLoading = false;
      });
  });

  $effect(() => subscribeToActivityEvents(data.eventsUrl, (activity) => {
    appendedActivities = [...appendedActivities.filter(({ uploadId }) => uploadId !== activity.uploadId), activity];
    void refreshRecent();
  }, () => void refreshRecent()));

  async function refreshRecent() {
    try {
      const page = (await activityControllerListRecent({}, getSdkRequestOptions())) as ActivityPage;
      const refreshedUploads = new Set(page.activities.map(({ uploadId }) => uploadId));
      appendedActivities = [
        ...appendedActivities.filter(({ uploadId }) => !refreshedUploads.has(uploadId)),
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
      const page = (await activityControllerListRecent(
        hasSearch ? { cursor: searchCursor!, search: query.trim() } : { cursor: nextCursor! },
        getSdkRequestOptions(),
      )) as ActivityPage;
      if (hasSearch) {
        const existing = new Set(displayedActivities.map(({ id }) => id));
        searchAppendedActivities = [...searchAppendedActivities, ...page.activities.filter(({ id }) => !existing.has(id))];
        searchCursor = page.nextCursor;
        searchTotal = page.total;
      } else {
        const existing = new Set(activities.map(({ id }) => id));
        appendedActivities = [...appendedActivities, ...page.activities.filter(({ id }) => !existing.has(id))];
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
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(({ isIntersecting }) => isIntersecting)) void loadMore();
    }, { rootMargin: '500px 0px' });
    observer.observe(node);
    return { destroy: () => observer.disconnect() };
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
      void tick().then(() => requestAnimationFrame(() => window.scrollTo({ top: value.scrollY })));
    },
  };
</script>

<svelte:head><title>Activities · Kondis</title></svelte:head>

<div class="page-shell">
  <header class="page-header">
    <div><span class="eyebrow">Your archive</span><h1>Activities</h1><p>{displayedTotal} workouts, all in one place.</p></div>
    <label class="search"><Search size={18} /><input bind:value={query} placeholder="Search activities" aria-label="Search activities" /></label>
  </header>

  {#if data.unavailable}
    <div class="notice"><CloudOff size={20} /><span><strong>Server unavailable</strong> Start the Kondis API to load your activities.</span></div>
  {/if}

  {#if displayedActivities.length}
      <div class="activity-list">
      {#each displayedActivities as activity (activity.id)}
        <ActivityCard {activity} activityTypes={data.activityTypes} unitSystem={data.unitSystem} />
      {/each}
    </div>
    {#if displayedNextCursor}
      <div class="load-more" use:infiniteScroll aria-live="polite">
        {#if loading}<LoaderCircle class="spin" size={18} /> Loading more activities…
        {:else if loadError}<button onclick={() => void loadMore()}>Could not load more. Try again</button>
        {/if}
      </div>
    {/if}
  {:else if !data.unavailable && !searchLoading}
    <div class="empty-state">
      <span class="empty-icon"><ActivityIcon size={28} /></span>
      <h2>{query ? 'No matching activities' : 'Your first activity starts here'}</h2>
      <p>{query ? 'Try a different sport or activity name.' : 'Import a file to build your private training archive.'}</p>
    </div>
  {/if}
</div>
