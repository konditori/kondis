<script lang="ts">
  import { page } from "$app/state";
</script>

<svelte:head><title>{page.status} | Kondis API</title></svelte:head>

<div class="page-shell narrow">
  <div class="eyebrow">Error {page.status}</div>
  <h1>That route left the course.</h1>
  <p class="lede">
    {page.error?.message ?? "The requested API reference page was not found."}
  </p>
  <div class="hero-actions">
    <a class="button" href="/endpoints">Browse endpoints</a>
    <a class="button secondary" href="/">Return home</a>
  </div>
</div>
