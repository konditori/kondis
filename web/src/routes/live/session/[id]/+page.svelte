<script lang="ts">
  import LiveWorkoutView from "$lib/components/LiveWorkoutView.svelte";
  let { data } = $props();
</script>

<svelte:head><title>Live workout · Kondis</title></svelte:head>

<div class="page-shell">
  <LiveWorkoutView
    workout={data.workout}
    endpoint={`/api/v1/live-workouts/${data.workout.id}`}
    activityTypes={data.activityTypes}
    unitSystem={data.unitSystem}
    allowSharing={true}
  />
</div>
