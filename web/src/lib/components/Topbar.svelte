<script lang="ts">
  import {
    ClipboardPenLine,
    Bell,
    FileUp,
    LogOut,
    Plus,
    Search,
    Settings,
    X,
  } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import {
    getSdkRequestOptions,
    socialControllerMarkNotificationsRead,
    socialControllerNotifications,
  } from "$lib/api";
  import { relativeTime } from "$lib/format";
  import {
    notificationBadgeLabel,
    notificationSummary,
  } from "$lib/notifications";
  import { userDisplayName } from "$lib/user-name";
  import { subscribeToActivityEvents } from "$lib/realtime";

  let {
    user,
    eventsUrl,
    onUpload,
  }: {
    user?: {
      firstName: string;
      lastName: string;
      email: string;
      avatarUrl?: string | null;
    };
    eventsUrl: string;
    onUpload: () => void;
  } = $props();
  let search = $state("");
  let searchOpen = $state(false);
  let searchInput = $state<HTMLInputElement>();
  let searchForm = $state<HTMLFormElement>();
  let menu: HTMLDetailsElement;
  let plusMenu: HTMLDetailsElement;
  let notificationMenu: HTMLDetailsElement;
  let menuOpen = $state(false);
  let plusMenuOpen = $state(false);
  let notificationsOpen = $state(false);
  let notificationsLoading = $state(false);
  let notificationCount = $state(0);
  let notifications = $state<
    | {
        id: string;
        type: "activity_like" | "activity_comment" | "follow_request";
        createdAt: string;
        activityId: string | null;
        activityName: string | null;
        readAt: string | null;
        actor: {
          id: string;
          firstName: string;
          lastName: string;
          avatarUrl: string | null;
        };
      }[]
    | null
  >(null);
  const accountName = $derived.by(() => {
    const name = user ? userDisplayName(user) : "";
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

  function closeNotifications() {
    notificationsOpen = false;
  }

  async function markNotificationsRead() {
    if (notificationCount === 0) return;
    notificationCount = 0;
    await socialControllerMarkNotificationsRead(getSdkRequestOptions());
  }

  async function loadNotifications(markRead = false) {
    if (notificationsLoading) return;
    notificationsLoading = true;
    try {
      const result = await socialControllerNotifications(
        { limit: "21" },
        getSdkRequestOptions(),
      );
      notifications = result.notifications.slice(0, 5);
      notificationCount =
        typeof result.unreadCount === "number" &&
        Number.isFinite(result.unreadCount) &&
        result.unreadCount > 0
          ? result.unreadCount
          : 0;
      if (markRead) await markNotificationsRead();
    } finally {
      notificationsLoading = false;
    }
  }

  function handleNotificationsToggle() {
    if (notificationsOpen) void loadNotifications(true);
  }

  onMount(() => {
    void loadNotifications();
    return subscribeToActivityEvents(
      eventsUrl,
      () => {},
      () => {},
      () => void loadNotifications(),
    );
  });

  function handleWindowClick(event: MouseEvent) {
    const target = event.target as Element;
    if (
      searchOpen &&
      searchForm &&
      !searchForm.contains(target) &&
      !target.closest(".search-toggle")
    )
      searchOpen = false;
    if (menuOpen && !menu.contains(event.target as Node)) closeMenu();
    if (plusMenuOpen && !plusMenu.contains(event.target as Node))
      closePlusMenu();
    if (notificationsOpen && !notificationMenu.contains(event.target as Node))
      closeNotifications();
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
    if (notificationsOpen) {
      closeNotifications();
      notificationMenu.querySelector("summary")?.focus();
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

  <details
    bind:this={notificationMenu}
    bind:open={notificationsOpen}
    class="notification-menu"
    ontoggle={handleNotificationsToggle}
  >
    <summary aria-label="Open notifications">
      <Bell size={20} />
      {#if notificationBadgeLabel(notificationCount)}
        <span class="notification-badge"
          >{notificationBadgeLabel(notificationCount)}</span
        >
      {/if}
    </summary>
    <div class="notification-popover">
      <div class="notification-popover-heading">
        <strong>Notifications</strong>
        <a href="/notifications" onclick={closeNotifications}>View all</a>
      </div>
      {#if notificationsLoading}
        <p class="notification-empty">Loading\u2026</p>
      {:else if notifications?.length}
        <div class="notification-list">
          {#each notifications as notification}
            <a
              href={notification.activityId
                ? `/activities/${notification.activityId}`
                : notification.type === "follow_request"
                  ? "/people"
                  : "/notifications"}
              onclick={closeNotifications}
            >
              <UserAvatar
                name={userDisplayName(notification.actor)}
                src={notification.actor.avatarUrl}
                size={30}
              />
              <span>
                <strong>{notificationSummary(notification)}</strong>
                <small>{relativeTime(notification.createdAt)}</small>
              </span>
            </a>
          {/each}
        </div>
      {:else}
        <p class="notification-empty">No notifications yet.</p>
      {/if}
    </div>
  </details>

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
      <UserAvatar name={accountName} src={user?.avatarUrl} size={42} />
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
