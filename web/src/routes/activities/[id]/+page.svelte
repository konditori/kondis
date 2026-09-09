<script lang="ts">
  import ActivityDetailPage from "$lib/components/ActivityDetailPage.svelte";
  import { t } from "$lib/i18n";
  import LiveActivityView from "$lib/components/LiveActivityView.svelte";
  import type { LiveWorkout } from "$lib/types";

  let { data } = $props();
  const liveWorkout = $derived(data.liveWorkout as LiveWorkout | undefined);
</script>

<svelte:head><title>{t("activities")} · Kondis</title></svelte:head>

{#if liveWorkout}
  <div class="detail-page live-activity-page">
    <LiveActivityView
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
