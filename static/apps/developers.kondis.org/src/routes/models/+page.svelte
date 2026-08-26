<script lang="ts">
  import { models, schemaType } from "$lib/openapi";

  let query = $state("");
  const filteredModels = $derived(
    models.filter((model) =>
      model.name.toLowerCase().includes(query.trim().toLowerCase()),
    ),
  );
</script>

<svelte:head>
  <title>Models | Kondis API</title>
</svelte:head>

<div class="page-shell">
  <div class="eyebrow">Schema index</div>
  <h1>The shapes behind the routes.</h1>
  <p class="lede">
    Request objects, response objects, enumerations, and shared values generated
    from the server's runtime contracts.
  </p>

  <div class="section-heading">
    <h2>Models</h2>
    <span>{filteredModels.length} of {models.length}</span>
  </div>
  <input
    class="model-filter"
    bind:value={query}
    aria-label="Filter models"
    placeholder="Filter by model name..."
  />

  {#if filteredModels.length}
    <div class="model-grid">
      {#each filteredModels as model}
        <a class="model-card" href={model.href}>
          <h3>{model.name}</h3>
          <p>{model.schema.description ?? "Generated OpenAPI model"}</p>
          <div class="model-shape">{schemaType(model.schema)}</div>
        </a>
      {/each}
    </div>
  {:else}
    <div class="empty-state">No models match "{query}".</div>
  {/if}
</div>
