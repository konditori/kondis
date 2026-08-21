<script lang="ts">
  import LiveWorkoutView from "$lib/components/LiveWorkoutView.svelte";
  import { createTranslator } from "$lib/i18n";
  const t = createTranslator();
  let { data } = $props();
</script>

<svelte:head><title>{t("live_tracking")} · Kondis</title></svelte:head>

<main class="public-live-page">
  <a class="public-live-brand" href="/">⚡ Kondis</a>
  <LiveWorkoutView
    workout={data.workout}
    endpoint={`/api/v1/live-workouts/shared/${data.token}`}
    activityTypes={data.activityTypes}
    unitSystem={data.unitSystem}
  />
</main>
