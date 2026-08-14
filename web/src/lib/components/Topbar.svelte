<script lang="ts">
  import {
    ClipboardPenLine,
    FileUp,
    LogOut,
    Plus,
    Search,
    Settings,
  } from "@lucide/svelte";
  import { page } from "$app/state";

  let {
    user,
    onUpload,
  }: { user?: { name: string; email: string }; onUpload: () => void } =
    $props();
  let search = $state(page.url.searchParams.get("search") ?? "");
  let menu: HTMLDetailsElement;
  let plusMenu: HTMLDetailsElement;
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
    const clear = () => (search = "");
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
    if (menuOpen && !menu.contains(event.target as Node)) closeMenu();
    if (plusMenuOpen && !plusMenu.contains(event.target as Node))
      closePlusMenu();
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    if (menuOpen) {
      closeMenu();
      menu.querySelector("summary")?.focus();
    }
    if (plusMenuOpen) {
      closePlusMenu();
      plusMenu.querySelector("summary")?.focus();
    }
  }
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<header class="topbar">
  <form
    class="top-search"
    action="/"
    method="GET"
    role="search"
    onsubmit={() =>
      window.dispatchEvent(
        new CustomEvent("kondis:search", { detail: search }),
      )}
  >
    <Search size={18} />
    <input
      bind:value={search}
      name="search"
      placeholder="Search activities"
      aria-label="Search activities"
    />
  </form>

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
