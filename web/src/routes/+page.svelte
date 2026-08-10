<script lang="ts">
  import { Activity as ActivityIcon, CloudOff, LoaderCircle, Search } from '@lucide/svelte';
  import ActivityCard from '$lib/components/ActivityCard.svelte';
  import { localDate } from '$lib/format';
  import type { Activity, ActivityPage } from '$lib/types';

  let { data } = $props();
  let query = $state('');
  let appendedActivities = $state<Activity[]>([]);
  let cursorOverride = $state<string | null>();
  let totalOverride = $state<number>();
  let loading = $state(false);
  let loadError = $state(false);
  const activities = $derived.by(() => {
    const initialIds = new Set(data.activities.map(({ id }) => id));
    return [...data.activities, ...appendedActivities.filter(({ id }) => !initialIds.has(id))];
  });
  const nextCursor = $derived(cursorOverride === undefined ? data.nextCursor : cursorOverride);
  const total = $derived(totalOverride ?? data.total);
  const filtered = $derived(activities.filter((activity) => `${activity.name ?? ''} ${activity.sport} ${activity.subSport ?? ''}`.toLowerCase().includes(query.toLowerCase())));
  const groups = $derived(Object.entries(Object.groupBy(filtered, (activity) => localDate(activity.startedAt))));

  $effect(() => {
    if (data.activities) {
      appendedActivities = [];
      cursorOverride = undefined;
      totalOverride = undefined;
    }
  });

  async function loadMore() {
    if (!nextCursor || loading) return;

    loading = true;
    loadError = false;
    try {
      const response = await fetch(`/api/activities?cursor=${encodeURIComponent(nextCursor)}`);
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const page = (await response.json()) as ActivityPage;
      const existing = new Set(activities.map(({ id }) => id));
      appendedActivities = [...appendedActivities, ...page.activities.filter(({ id }) => !existing.has(id))];
      cursorOverride = page.nextCursor;
      totalOverride = page.total;
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
</script>

<svelte:head><title>Activities · Kondis</title></svelte:head>

<div class="page-shell">
  <header class="page-header">
    <div><span class="eyebrow">Your archive</span><h1>Activities</h1><p>{total} workouts, all in one place.</p></div>
    <label class="search"><Search size={18} /><input bind:value={query} placeholder="Search activities" aria-label="Search activities" /></label>
  </header>

  {#if data.unavailable}
    <div class="notice"><CloudOff size={20} /><span><strong>Server unavailable</strong> Start the Kondis API to load your activities.</span></div>
  {/if}

  {#if groups.length}
    <div class="timeline">
      {#each groups as [date, activities]}
        <section class="day-group">
          <div class="date-rail"><span></span><h2>{date}</h2><small>{activities?.length}</small></div>
          <div class="activity-list">
            {#each activities ?? [] as activity (activity.id)}<ActivityCard {activity} />{/each}
          </div>
        </section>
      {/each}
    </div>
    {#if nextCursor}
      <div class="load-more" use:infiniteScroll aria-live="polite">
        {#if loading}<LoaderCircle class="spin" size={18} /> Loading more activities…
        {:else if loadError}<button onclick={() => void loadMore()}>Could not load more. Try again</button>
        {/if}
      </div>
    {/if}
  {:else if !data.unavailable}
    <div class="empty-state">
      <span class="empty-icon"><ActivityIcon size={28} /></span>
      <h2>{query ? 'No matching activities' : 'Your first activity starts here'}</h2>
      <p>{query ? 'Try a different sport or activity name.' : 'Import a FIT file to build your private training archive.'}</p>
    </div>
  {/if}
</div>
