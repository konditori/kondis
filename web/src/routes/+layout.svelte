<script lang="ts">
  import "../app.css";
  import { goto } from "$app/navigation";
  import Sidebar from "$lib/components/Sidebar.svelte";
  import Topbar from "$lib/components/Topbar.svelte";

  let { children, data } = $props();
</script>

<svelte:head
  ><title>Kondis</title><meta
    name="description"
    content="Your self-hosted activity archive"
  /></svelte:head
>

{#if !data.authenticated}
  {@render children()}
{:else}
  <Sidebar />
  <Topbar user={data.user} onUpload={() => void goto("/upload")} />
  <main class="app-main">{@render children()}</main>
{/if}
