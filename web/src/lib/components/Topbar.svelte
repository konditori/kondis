<script lang="ts">
  import {
    ClipboardPenLine,
    FileUp,
    LogOut,
    Plus,
    Search,
    Settings,
    X,
  } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  let {
    user,
    onUpload,
  }: { user?: { name: string; email: string }; onUpload: () => void } =
    $props();
  let search = $state("");
  let searchOpen = $state(false);
  let searchInput = $state<HTMLInputElement>();
  let searchForm = $state<HTMLFormElement>();
  let menu = $state<HTMLDetailsElement>();
  let plusMenu = $state<HTMLDetailsElement>();
  let menuOpen = $state(false);
  let plusMenuOpen = $state(false);
  const accountName = $derived.by(() => {
    const name = user?.name?.trim();
    const email = user?.email?.trim();
    if (name && (!email || name.toLowerCase() !== email.toLowerCase()))
      return name;
    const localPart = email?.split("@", 1)[0];
    if (localPart)
      return localPart
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
    return "Account";
  });
  const initial = $derived(accountName.slice(0, 1).toUpperCase());

  $effect(() => {
    const initialSearch = page.url.searchParams.get("search") ?? "";
    search = initialSearch;
    if (initialSearch.length > 0) searchOpen = true;
  });

  $effect(() => {
    const clear = () => {
      search = "";
      searchOpen = false;
    };
    window.addEventListener("kondis:clear-search", clear);
    return () => window.removeEventListener("kondis:clear-search", clear);
  });

  function closeMenu() {
    menuOpen = false;
  }

  function closePlusMenu() {
    plusMenuOpen = false;
  }

  function handleWindowClick(event: MouseEvent) {
    // SAFETY: Window click events have an Element target when they reach this document-level handler.
    const target = event.target as Element;
    if (
      searchOpen &&
      searchForm &&
      !searchForm.contains(target) &&
      !target.closest(".search-toggle")
    )
      searchOpen = false;
    // SAFETY: EventTarget is a Node for events dispatched by the document.
    if (menuOpen && menu && !menu.contains(event.target as Node)) closeMenu();
    // SAFETY: EventTarget is a Node for events dispatched by the document.
    if (plusMenuOpen && plusMenu && !plusMenu.contains(event.target as Node))
      closePlusMenu();
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    if (menuOpen) {
      closeMenu();
      menu?.querySelector("summary")?.focus();
    }
    if (plusMenuOpen) {
      closePlusMenu();
      plusMenu?.querySelector("summary")?.focus();
    }
  }

  function openSearch() {
    searchOpen = true;
    requestAnimationFrame(() => searchInput?.focus());
  }

  function updateSearch() {
    window.dispatchEvent(new CustomEvent("kondis:search", { detail: search }));
  }

  function clearSearch() {
    search = "";
    window.dispatchEvent(new CustomEvent("kondis:search", { detail: "" }));
    if (page.url.search) {
      void goto("/", { replaceState: true }).then(() => {
        searchOpen = true;
        requestAnimationFrame(() => searchInput?.focus());
      });
    } else {
      requestAnimationFrame(() => searchInput?.focus());
    }
  }
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<header class="topbar">
  {#if searchOpen}
    <form
      bind:this={searchForm}
      class="top-search"
      action="/"
      method="GET"
      role="search"
      onsubmit={(event) => {
        event.preventDefault();
        updateSearch();
      }}
    >
      <Search size={18} />
      <input
        bind:this={searchInput}
        bind:value={search}
        name="search"
        placeholder="Search activities"
        aria-label="Search activities"
        oninput={updateSearch}
      />
      {#if search}
        <button
          class="top-search-clear"
          type="button"
          aria-label="Clear search"
          title="Clear search"
          onclick={clearSearch}
        >
          <X size={17} />
        </button>
      {/if}
    </form>
  {:else}
    <button
      class="search-toggle"
      type="button"
      aria-label="Search activities"
      onclick={openSearch}
    >
      <Search size={21} />
    </button>
  {/if}

  <details bind:this={plusMenu} bind:open={plusMenuOpen} class="plus-menu">
    <summary aria-label="Add activity"><Plus size={20} /></summary>
    <div class="plus-menu-popover">
      <button
        type="button"
        onclick={() => {
          closePlusMenu();
          onUpload();
        }}
      >
        <FileUp size={19} /> Upload activity
      </button>
      <button type="button" onclick={closePlusMenu}>
        <ClipboardPenLine size={19} /> Add manual entry
      </button>
    </div>
  </details>

  <details bind:this={menu} bind:open={menuOpen} class="user-menu">
    <summary aria-label="Open account menu">
      <span class="user-initial" aria-hidden="true">{initial}</span>
    </summary>
    <div class="user-menu-popover">
      <div class="user-menu-identity">
        <strong>{accountName}</strong>
        <small>{user?.email}</small>
      </div>
      <a href="/settings" onclick={closeMenu}><Settings size={17} /> Settings</a
      >
      <form method="POST" action="/logout">
        <button type="submit"><LogOut size={17} /> Log out</button>
      </form>
    </div>
  </details>
</header>
