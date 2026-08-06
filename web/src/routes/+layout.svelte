<script lang="ts">
  import '../app.css';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import UploadDialog from '$lib/components/UploadDialog.svelte';

  let { children } = $props();
  let uploadOpen = $state(false);
</script>

<svelte:head><title>Kondis</title><meta name="description" content="Your self-hosted activity archive" /></svelte:head>

<Sidebar onUpload={() => (uploadOpen = true)} />
<main class="app-main">{@render children()}</main>
<UploadDialog bind:open={uploadOpen} />
