<script lang="ts">
  import UploadForm from "$lib/components/UploadForm.svelte";
  import { t } from "$lib/i18n";

  let { data } = $props();
</script>

<svelte:head><title>{t("upload_activity_file")} · Kondis</title></svelte:head>

<div class="page-shell upload-page">
  <UploadForm eventsUrl={data.eventsUrl} />
</div>
