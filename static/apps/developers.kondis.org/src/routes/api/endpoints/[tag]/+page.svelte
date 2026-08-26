<script lang="ts">
  import EndpointList from "$lib/components/EndpointList.svelte";

  let { data } = $props();
</script>

<svelte:head>
  <title>{data.group.name} endpoints | Kondis API</title>
</svelte:head>

<div class="page-shell">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/endpoints">Endpoints</a><span>/</span><span
      >{data.group.name}</span
    >
  </nav>
  <div class="eyebrow">Endpoint group</div>
  <h1>{data.group.name}</h1>
  <p class="lede">{data.group.description}</p>

  <div class="section-heading">
    <h2>Operations</h2>
    <span>{data.group.endpoints.length} total</span>
  </div>
  <EndpointList endpoints={data.group.endpoints} />
</div>
