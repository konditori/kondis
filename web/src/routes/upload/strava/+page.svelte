<script lang="ts">
  import StravaTakeoutImport from "$lib/components/StravaTakeoutImport.svelte";

  let { data } = $props();
</script>

<svelte:head><title>Import Strava takeout · Kondis</title></svelte:head>

<div class="page-shell upload-page">
  <StravaTakeoutImport />
</div>
