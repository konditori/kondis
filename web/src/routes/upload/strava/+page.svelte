<script lang="ts">
  import StravaTakeoutImport from "$lib/components/StravaTakeoutImport.svelte";
  import { createTranslator } from "$lib/i18n";
  const t = createTranslator();

  let { data } = $props();
</script>

<svelte:head><title>{t("strava_takeout")} · Kondis</title></svelte:head>

<div class="page-shell upload-page">
  <StravaTakeoutImport />
</div>
