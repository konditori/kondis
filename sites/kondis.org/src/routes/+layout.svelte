<script lang="ts">
  import ThemePicker from "../../../../packages/theme/ThemePicker.svelte";
  import "../app.css";

  const github = "https://github.com/konditori/kondis";
  const docs = "https://docs.kondis.org";
  let { children } = $props();
</script>

<header class="site-header">
  <a class="brand" href="/" aria-label="Kondis home">
    <span class="brand-mark" role="img" aria-label="sweating face">😰</span>
    <span>Kondis</span>
  </a>

  <nav aria-label="Main navigation">
    <a href={docs}>Docs <span aria-hidden="true">↗</span></a>
    <a href={github}>GitHub <span aria-hidden="true">↗</span></a>
  </nav>

  <div class="header-actions">
    <ThemePicker />
    <a class="button button-small" href="/#get-started">Get started</a>
  </div>
</header>

{@render children()}

<footer>
  <a class="brand" href="/" aria-label="Kondis home"
    ><span class="brand-mark" role="img" aria-label="sweating face">😰</span
    >
    <span>Kondis</span></a
  >
  <p>Open-source, self-hosted fitness tracking.</p>
  <div>
    <a href={docs}>Docs</a><a href="/cursed-knowledge">Cursed knowledge</a><a
      href="https://api.kondis.org">API</a
    ><a href={github}>GitHub</a>
  </div>
</footer>
