<script lang="ts">
  import UploadForm from "$lib/components/UploadForm.svelte";

  let { data } = $props();
</script>

<svelte:head><title>Upload workout file · Kondis</title></svelte:head>

<div class="page-shell upload-page">
  <UploadForm eventsUrl={data.eventsUrl} />
</div>
