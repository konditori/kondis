<script lang="ts">
  import LiveActivityView from "$lib/components/LiveActivityView.svelte";
  import { t } from "$lib/i18n";
  let { data } = $props();
</script>

<svelte:head><title>{t("live_tracking")} · Kondis</title></svelte:head>

<main class="public-live-page">
  <a class="public-live-brand" href="/">⚡ Kondis</a>
  <LiveActivityView
    workout={data.workout}
    endpoint={`/api/v1/live-workouts/shared/${data.token}`}
    activityTypes={data.activityTypes}
    unitSystem={data.unitSystem}
  />
</main>
