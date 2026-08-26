<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { tick } from "svelte";

  import "../app.css";
  import {
    endpointGroups,
    endpoints,
    models,
    type Endpoint,
  } from "$lib/openapi";

  let { children } = $props();

  let searchOpen = $state(false);
  let mobileOpen = $state(false);
  let query = $state("");
  let searchInput = $state<HTMLInputElement>();
  let darkMode = $state(false);

  onMount(() => {
    darkMode = localStorage.getItem("kondis-theme") === "dark";
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
  });

  function toggleTheme() {
    darkMode = !darkMode;
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    localStorage.setItem("kondis-theme", darkMode ? "dark" : "light");
  }

  const searchResults = $derived.by(() => {
    const normalized = query.trim().toLowerCase();
    const endpointResults = endpoints
      .filter((endpoint) =>
        [endpoint.title, endpoint.path, endpoint.operationId, endpoint.tag]
          .join(" ")
          .toLowerCase()
          .includes(normalized),
      )
      .slice(0, normalized ? 10 : 6)
      .map((endpoint) => ({
        href: endpoint.href,
        title: endpoint.title,
        detail: `${endpoint.method.toUpperCase()} ${endpoint.path}`,
        endpoint,
        kind: "Endpoint",
      }));
    const modelResults = models
      .filter((model) => model.name.toLowerCase().includes(normalized))
      .slice(0, normalized ? 6 : 3)
      .map((model) => ({
        href: model.href,
        title: model.name,
        detail: "OpenAPI schema",
        endpoint: undefined as Endpoint | undefined,
        kind: "Model",
      }));
    return [...endpointResults, ...modelResults].slice(0, 12);
  });

  async function openSearch() {
    searchOpen = true;
    await tick();
    searchInput?.focus();
  }

  function closeSearch() {
    searchOpen = false;
    query = "";
  }

  function handleKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    const typing = target.matches("input, textarea, [contenteditable='true']");
    if (
      (event.key === "/" && !typing) ||
      ((event.metaKey || event.ctrlKey) && event.key === "k")
    ) {
      event.preventDefault();
      openSearch();
    }
    if (event.key === "Escape") closeSearch();
  }

  function pathActive(href: string) {
    return page.url.pathname === href || page.url.pathname === `${href}/`;
  }

  $effect(() => {
    page.url.pathname;
    mobileOpen = false;
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<header class="site-header">
  <button
    class="menu-button"
    type="button"
    aria-label="Toggle navigation"
    onclick={() => (mobileOpen = !mobileOpen)}>Menu</button
  >
  <a class="wordmark" href="/">
    <img class="wordmark-mark" src="/img/logo.svg" alt="" />
    <span class="wordmark-text">Kondis <span>Developers</span></span>
  </a>
  <button class="header-search" type="button" onclick={openSearch}>
    <span aria-hidden="true">/</span>
    <span class="header-search-label">Search endpoints and models</span>
    <kbd>CMD K</kbd>
  </button>
  <nav class="header-links" aria-label="External links">
    <a href="https://docs.kondis.org">User docs <span class="external-icon" aria-hidden="true">↗</span></a>
    <a href="https://github.com/konditori/kondis">GitHub <span class="external-icon" aria-hidden="true">↗</span></a>
    <button class="theme-toggle" type="button" aria-label="Toggle dark mode" onclick={toggleTheme}>☼</button>
  </nav>
</header>

<aside
  class="app-sidebar"
  class:mobile-open={mobileOpen}
  aria-label={page.url.pathname.startsWith("/api")
    ? "API reference navigation"
    : "Developer documentation navigation"}
>
  <div class="sidebar-section">
    {#if page.url.pathname.startsWith("/api")}
    <p class="sidebar-label">Start</p>
    <a class="sidebar-link active" href="/api/">API reference</a>
    <a class="sidebar-link" href="/api/introduction">Introduction</a>
    <a class="sidebar-link" href="/api/sdk">SDK</a>
    <a class="sidebar-link" href="/api/models">
      Models <span class="count">{models.length}</span>
    </a>
    {:else}
    <a class="sidebar-link" href="/guides/overview">Overview</a>
    <a class="sidebar-link" href="/guides/local-development">Local development</a>
    <a class="sidebar-link" href="/guides/architecture">Architecture</a>
    <a class="sidebar-link" href="/guides/contributing">Contributing</a>
    <a class="sidebar-link" href="/guides/cursed-knowledge">Cursed knowledge</a>
    <a class="sidebar-link" href="/guides/api">API guide</a>
    <a class="sidebar-link external-link" href="/api/">
      API reference
      <svg class="external-link-icon" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M6.5 3.5H3.75A1.25 1.25 0 0 0 2.5 4.75v7.5a1.25 1.25 0 0 0 1.25 1.25h7.5a1.25 1.25 0 0 0 1.25-1.25V9.5" />
        <path d="M9 2.5h4.5V7M13.25 2.75 7.5 8.5" />
      </svg>
    </a>
    {/if}
  </div>

  {#if page.url.pathname.startsWith("/api")}
  <div class="sidebar-section">
    <p class="sidebar-label">Endpoints</p>
    <a
      class:active={pathActive("/api/endpoints")}
      class="sidebar-link"
      href="/api/endpoints"
    >
      All endpoints <span class="count">{endpoints.length}</span>
    </a>
    {#each endpointGroups as group}
      <details
        class="sidebar-group"
        open={page.url.pathname.startsWith(`${group.href}/`)}
      >
        <summary class="sidebar-group-summary">
          <span>{group.name}</span>
          <span class="count">{group.endpoints.length}</span>
        </summary>
        <div class="sidebar-children">
          <a
            class:active={pathActive(group.href)}
            class="sidebar-link"
            href={group.href}
          >
            Overview
          </a>
          {#each group.endpoints as endpoint}
            <a
              class:active={pathActive(endpoint.href)}
              class="sidebar-link"
              href={endpoint.href}
              title={endpoint.title}>{endpoint.title}</a
            >
          {/each}
        </div>
      </details>
    {/each}
  </div>
  {/if}
</aside>

<main
  class="site-main with-sidebar"
>
  {@render children()}
</main>

{#if searchOpen}
  <div class="search-overlay">
    <button
      class="search-dismiss"
      type="button"
      aria-label="Close search"
      onclick={closeSearch}
    ></button>
    <div
      class="search-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Search API reference"
      tabindex="-1"
    >
      <input
        bind:this={searchInput}
        bind:value={query}
        aria-label="Search"
        placeholder="Type an endpoint, route, or model..."
      />
      <div class="search-results">
        {#if searchResults.length}
          {#each searchResults as result}
            <a class="search-result" href={result.href} onclick={closeSearch}>
              {#if result.endpoint}
                <span class="method-badge method-{result.endpoint.method}">
                  {result.endpoint.method}
                </span>
              {:else}
                <span class="type-label">MODEL</span>
              {/if}
              <span>
                <strong>{result.title}</strong>
                <span>{result.detail}</span>
              </span>
              <span>{result.kind}</span>
            </a>
          {/each}
        {:else}
          <div class="search-empty">No matching endpoints or models.</div>
        {/if}
      </div>
    </div>
  </div>
{/if}
