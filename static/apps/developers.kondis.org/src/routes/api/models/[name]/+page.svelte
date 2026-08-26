<script lang="ts">
  import CodeBlock from "$lib/components/CodeBlock.svelte";
  import SchemaView from "$lib/components/SchemaView.svelte";
  import { exampleForSchema, schemaType } from "$lib/openapi";

  let { data } = $props();
  const example = $derived(
    JSON.stringify(exampleForSchema(data.model.schema), null, 2),
  );
</script>

<svelte:head>
  <title>{data.model.name} | Kondis API</title>
</svelte:head>

<article class="page-shell">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/api/models">Models</a><span>/</span><span>{data.model.name}</span>
  </nav>
  <header class="model-hero">
    <div class="eyebrow">{schemaType(data.model.schema)}</div>
    <h1 class="model-title">{data.model.name}</h1>
    {#if data.model.schema.description}
      <p class="lede">{data.model.schema.description}</p>
    {/if}
  </header>

  <div class="detail-grid">
    <section class="detail-section">
      <h2>Definition</h2>
      <SchemaView schema={data.model.schema} title={data.model.name} />
    </section>
    <aside class="detail-rail">
      <CodeBlock code={example} label="example json" />
    </aside>
  </div>
</article>
