<script lang="ts">
  import EndpointList from "$lib/components/EndpointList.svelte";
  import { endpointGroups, endpoints } from "$lib/openapi";
</script>

<svelte:head>
  <title>Endpoints | Kondis API</title>
</svelte:head>

<div class="page-shell">
  <div class="eyebrow">Endpoint index</div>
  <h1>Every route, in the open.</h1>
  <p class="lede">
    {endpoints.length} operations grouped by domain. Select a route for parameters,
    schemas, generated request examples, and a live request lab.
  </p>

  {#each endpointGroups as group}
    <section class="detail-section">
      <div class="section-heading">
        <h2><a href={group.href}>{group.name}</a></h2>
        <span>{group.endpoints.length} operations</span>
      </div>
      <EndpointList endpoints={group.endpoints} />
    </section>
  {/each}
</div>
