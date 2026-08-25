<script lang="ts">
  import type { Endpoint } from "$lib/openapi";

  import MethodBadge from "./MethodBadge.svelte";

  let { endpoints }: { endpoints: Endpoint[] } = $props();
</script>

<div class="endpoint-list">
  {#each endpoints as endpoint}
    <a class="endpoint-row" href={endpoint.href}>
      <MethodBadge method={endpoint.method} />
      <span class="endpoint-path">{endpoint.path}</span>
      <span class="endpoint-title">{endpoint.title}</span>
      <span class="endpoint-arrow" aria-hidden="true">-&gt;</span>
    </a>
  {/each}
</div>
