<script lang="ts">
  import { endpointGroups, endpoints, models } from "$lib/openapi";
</script>

<svelte:head><title>Kondis developers</title></svelte:head>

<div class="page-shell">
  <section class="hero">
    <div class="eyebrow">Kondis developers</div>
    <h1>Build on every <span>move.</span></h1>
    <p class="lede">
      Explore the Kondis developer documentation, API reference, and typed SDK.
    </p>
    <div class="hero-actions">
      <a class="button" href="/guides/overview">Read the guides</a>
      <a class="button secondary" href="/api/">Explore the API</a>
    </div>
  </section>

  <div class="stat-strip">
    <div class="stat"><strong>{endpoints.length}</strong><span>API operations</span></div>
    <div class="stat"><strong>{models.length}</strong><span>typed models</span></div>
    <div class="stat"><strong>{endpointGroups.length}</strong><span>endpoint groups</span></div>
  </div>

  <div class="next-grid">
    <a class="next-card" href="/guides/overview">
      <small>Developer guides</small>
      <strong>Learn how Kondis is built and operated</strong>
    </a>
    <a class="next-card" href="/api/">
      <small>API reference</small>
      <strong>Browse endpoints, models, and the SDK</strong>
    </a>
  </div>
</div>
