<script lang="ts">
  import { Bell } from "@lucide/svelte";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import {
    getSdkRequestOptions,
    socialControllerMarkNotificationsRead,
    socialControllerNotifications,
  } from "$lib/api";
  import { relativeTime } from "$lib/format";
  import { notificationSummary } from "$lib/notifications";
  import { userDisplayName } from "$lib/user-name";
  import { onMount } from "svelte";
  import { subscribeToActivityEvents } from "$lib/realtime";

  let { data } = $props<{ data: { eventsUrl: string } }>();

  type Notification = Awaited<
    ReturnType<typeof socialControllerNotifications>
  >["notifications"][number];

  let notifications = $state<Notification[]>([]);
  let loading = $state(true);
  let error = $state("");

  async function loadNotifications() {
    loading = true;
    error = "";
    try {
      const result = await socialControllerNotifications(
        { limit: "50" },
        getSdkRequestOptions(),
      );
      notifications = result.notifications;
      if (result.unreadCount > 0) {
        await socialControllerMarkNotificationsRead(getSdkRequestOptions());
      }
    } catch {
      error = "Could not load notifications.";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadNotifications();
    return subscribeToActivityEvents(
      data.eventsUrl,
      () => {},
      () => {},
      () => void loadNotifications(),
    );
  });
</script>

<svelte:head><title>Notifications · Kondis</title></svelte:head>

<div class="page-shell notifications-page">
  <header class="page-header">
    <div>
      <h1>Notifications</h1>
      <p>See the latest reactions and comments on your activities.</p>
    </div>
  </header>

  {#if loading}
    <p class="muted-copy">Loading notifications…</p>
  {:else if error}
    <p class="form-error">{error}</p>
  {:else if notifications.length === 0}
    <div class="empty-state">
      <Bell size={24} />
      <h2>No notifications yet</h2>
      <p>Likes and comments on your activities will appear here.</p>
    </div>
  {:else}
    <section class="notifications-panel" aria-label="Notifications">
      {#each notifications as notification (notification.id)}
        <a
          class="notification-row"
          href={notification.activityId
            ? `/activities/${notification.activityId}`
            : notification.type === "follow_request"
              ? "/people"
              : "/notifications"}
        >
          <UserAvatar
            name={userDisplayName(notification.actor)}
            src={notification.actor.avatarUrl}
            size={42}
          />
          <span>
            <strong>{notificationSummary(notification)}</strong>
            <time datetime={notification.createdAt}
              >{relativeTime(notification.createdAt)}</time
            >
          </span>
        </a>
      {/each}
    </section>
  {/if}
</div>
