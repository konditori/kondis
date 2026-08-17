<script lang="ts">
  let {
    name,
    src = null,
    size = 48,
  }: { name: string; src?: string | null; size?: number } = $props();
  let failed = $state(false);
  const initial = $derived(name.trim().slice(0, 1).toUpperCase() || "?");
</script>

<span class="user-avatar" style={`--avatar-size: ${size}px`} aria-label={name}>
  {#if src && !failed}
    <img {src} alt="" onerror={() => (failed = true)} />
  {:else}
    <span aria-hidden="true">{initial}</span>
  {/if}
</span>
