<script lang="ts">
  import ActivityDetailPage from "$lib/components/ActivityDetailPage.svelte";
  import { t } from "$lib/i18n";
  import LiveActivityView from "$lib/components/LiveActivityView.svelte";
  import type { LiveActivity } from "$lib/types";

  let { data } = $props();
  const liveActivity = $derived(data.liveActivity as LiveActivity | undefined);
</script>

<svelte:head><title>{t("activities")} · Kondis</title></svelte:head>

{#if liveActivity}
  <div class="detail-page live-activity-page">
    <LiveActivityView
      activity={liveActivity}
      endpoint={`/api/v1/live-activities/${liveActivity.id}`}
      activityTypes={data.activityTypes}
      unitSystem={data.unitSystem}
      allowSharing={liveActivity.canShare}
    />
  </div>
{:else}
  <ActivityDetailPage {data} />
{/if}
