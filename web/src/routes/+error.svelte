<script lang="ts">
  import { page } from "$app/state";
  import { ArrowLeft, RouteOff } from "@lucide/svelte";
</script>

<div class="empty-state error-page">
  <span class="empty-icon"><RouteOff size={28} /></span>
  <span class="eyebrow">Error {page.status}</span>
  <h1>{page.error?.message ?? "Something went wrong"}</h1>
  <a class="back-link" href="/"><ArrowLeft size={18} /> Return to activities</a>
</div>
