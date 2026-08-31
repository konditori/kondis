<script lang="ts">
  import type { HttpMethod } from "$lib/openapi";

  let { method }: { method: HttpMethod } = $props();
</script>

<span class="method-badge method-{method}">{method}</span>
