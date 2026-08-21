<script lang="ts">
  import LiveWorkoutView from "$lib/components/LiveWorkoutView.svelte";
  import { createTranslator } from "$lib/i18n";
  const t = createTranslator();
  let { data } = $props();
</script>

<svelte:head><title>{t("live_workout")} · Kondis</title></svelte:head>

<div class="page-shell">
  <LiveWorkoutView
    workout={data.workout}
    endpoint={`/api/v1/live-workouts/${data.workout.id}`}
    activityTypes={data.activityTypes}
    unitSystem={data.unitSystem}
    allowSharing={data.workout.canShare}
  />
</div>
