<script lang="ts">
  import { onMount } from "svelte";
  import "../app.css";

  const github = "https://github.com/konditori/kondis";
  const docs = "https://docs.kondis.org";
  type Theme = "dark" | "light";

  let theme = $state<Theme>("dark");

  function applyTheme(nextTheme: Theme, persist = true) {
    theme = nextTheme;
    document.documentElement.dataset.theme = nextTheme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", nextTheme === "dark" ? "#09101d" : "#ffffff");
    if (persist) localStorage.setItem("kondis-theme", nextTheme);
  }

  function toggleTheme() {
    applyTheme(theme === "dark" ? "light" : "dark");
  }

  onMount(() => {
    const savedTheme = localStorage.getItem("kondis-theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      applyTheme(savedTheme);
      return;
    }

    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const syncWithSystemTheme = () =>
      applyTheme(colorScheme.matches ? "dark" : "light", false);
    syncWithSystemTheme();
    colorScheme.addEventListener("change", syncWithSystemTheme);

    return () => colorScheme.removeEventListener("change", syncWithSystemTheme);
  });

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
    <button
      class="theme-toggle"
      type="button"
      onclick={toggleTheme}
      aria-label={theme === "dark"
        ? "Switch to light mode"
        : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {#if theme === "dark"}
        <svg viewBox="0 0 24 24" aria-hidden="true"
          ><circle cx="12" cy="12" r="4" /><path
            d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          /></svg
        >
      {:else}
        <svg viewBox="0 0 24 24" aria-hidden="true"
          ><path
            d="M20.4 15.1A8.5 8.5 0 0 1 8.9 3.6a8.5 8.5 0 1 0 11.5 11.5Z"
          /></svg
        >
      {/if}
    </button>
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
