<script lang="ts">
  import { endpointGroups, endpoints, models } from "$lib/openapi";
</script>

<svelte:head>
  <title>Kondis API reference</title>
</svelte:head>

<div class="page-shell">
  <section class="hero">
    <div class="eyebrow">Generated from source</div>
    <h1>Build on every <span>move.</span></h1>
    <p class="lede">
      A field guide to the Kondis API. Inspect every endpoint, trace every
      model, and make live requests without leaving the reference.
    </p>
    <div class="hero-actions">
      <a class="button" href="/endpoints">Explore endpoints</a>
      <a class="button secondary" href="/sdk">Use the TypeScript SDK</a>
    </div>
  </section>

  <div class="stat-strip">
    <div class="stat">
      <strong>{endpoints.length}</strong><span>operations</span>
    </div>
    <div class="stat">
      <strong>{models.length}</strong><span>typed models</span>
    </div>
    <div class="stat">
      <strong>{endpointGroups.length}</strong><span>functional groups</span>
    </div>
  </div>

  <div class="section-heading">
    <h2>API surface</h2>
    <span>{endpoints.length} generated routes</span>
  </div>
  <div class="group-grid">
    {#each endpointGroups as group}
      <a class="group-card" href={group.href}>
        <div class="group-card-header">
          <h3>{group.name}</h3>
          <span class="number-chip">{group.endpoints.length}</span>
        </div>
        <p>{group.description}</p>
      </a>
    {/each}
  </div>

  <div class="next-grid">
    <a class="next-card" href="/introduction">
      <small>Start here</small>
      <strong>Understand the API conventions</strong>
    </a>
    <a class="next-card" href="/models">
      <small>Schema index</small>
      <strong>Browse {models.length} data models</strong>
    </a>
  </div>
</div>
