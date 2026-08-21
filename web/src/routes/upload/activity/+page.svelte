<script lang="ts">
  import UploadForm from "$lib/components/UploadForm.svelte";
  import { createTranslator } from "$lib/i18n";
  const t = createTranslator();

  let { data } = $props();
</script>

<svelte:head><title>{t("upload_activity_file")} · Kondis</title></svelte:head>

<div class="page-shell upload-page">
  <UploadForm eventsUrl={data.eventsUrl} />
</div>
