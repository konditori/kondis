<script lang="ts">
  import { Activity as ActivityIcon, CloudOff, Search } from '@lucide/svelte';
  import ActivityCard from '$lib/components/ActivityCard.svelte';
  import { localDate } from '$lib/format';

  let { data } = $props();
  let query = $state('');
  const filtered = $derived(data.activities.filter((activity) => `${activity.name ?? ''} ${activity.sport} ${activity.subSport ?? ''}`.toLowerCase().includes(query.toLowerCase())));
  const groups = $derived(Object.entries(Object.groupBy(filtered, (activity) => localDate(activity.startedAt))));
</script>

<svelte:head><title>Activities · Kondis</title></svelte:head>

<div class="page-shell">
  <header class="page-header">
    <div><span class="eyebrow">Your archive</span><h1>Activities</h1><p>{data.activities.length} workouts, all in one place.</p></div>
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
            {#each activities ?? [] as activity}<ActivityCard {activity} />{/each}
          </div>
        </section>
      {/each}
    </div>
  {:else if !data.unavailable}
    <div class="empty-state">
      <span class="empty-icon"><ActivityIcon size={28} /></span>
      <h2>{query ? 'No matching activities' : 'Your first activity starts here'}</h2>
      <p>{query ? 'Try a different sport or activity name.' : 'Import a FIT file to build your private training archive.'}</p>
    </div>
  {/if}
</div>
