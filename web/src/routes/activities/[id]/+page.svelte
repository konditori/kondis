<script lang="ts">
  import ActivityDetailPage from "$lib/components/ActivityDetailPage.svelte";
  import LiveWorkoutView from "$lib/components/LiveWorkoutView.svelte";
  import type { LiveWorkout } from "$lib/types";

  let { data } = $props();
  const liveWorkout = $derived(data.liveWorkout as LiveWorkout | undefined);
</script>

<svelte:head><title>Kondis</title></svelte:head>

{#if liveWorkout}
  <div class="detail-page live-activity-page">
    <LiveWorkoutView
      workout={liveWorkout}
      endpoint={`/api/v1/live-workouts/${liveWorkout.id}`}
      activityTypes={data.activityTypes}
      unitSystem={data.unitSystem}
      allowSharing={liveWorkout.canShare}
    />
  </div>
{:else}
  <ActivityDetailPage {data} />
{/if}
