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
  import { t } from "$lib/i18n";

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
      error = t("error_generic");
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
      { onNotification: () => void loadNotifications() },
    );
  });
</script>

<svelte:head><title>{t("notifications")} · Kondis</title></svelte:head>

<div class="page-shell notifications-page">
  <header class="page-header">
    <div>
      <h1>{t("notifications")}</h1>
      <p>{t("see_latest_reactions")}</p>
    </div>
  </header>

  {#if loading}
    <p class="muted-copy">{t("loading")}</p>
  {:else if error}
    <p class="form-error">{error}</p>
  {:else if notifications.length === 0}
    <div class="empty-state">
      <Bell size={24} />
      <h2>{t("no_notifications_yet")}</h2>
      <p>{t("no_notifications_description")}</p>
    </div>
  {:else}
    <section class="notifications-panel" aria-label={t("notifications")}>
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
