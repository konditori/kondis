<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>{data.title} | Kondis developers</title>
</svelte:head>

<article class="page-shell narrow markdown-page">
  <div class="eyebrow">Developer guide</div>
  <div class="prose">{@html data.html}</div>
</article>
