import type { Activity, ActivityDetail } from "$lib/types";

export type ActivityEvent =
  | {
      type: "activity.created" | "activity.updated";
      activity: Activity;
    }
  | {
      type: "activity.upload.skipped";
      activity: Pick<Activity, "id" | "name" | "sport">;
      uploadFileName: string;
    }
  | {
      type: "activity.comment.created" | "activity.comment.updated";
      activity: Pick<Activity, "id">;
      comment: {
        id: string;
        body: string;
        createdAt: string;
        updatedAt: string;
        user: NonNullable<Activity["athlete"]>;
      };
    }
  | {
      type: "activity.comment.deleted";
      activity: Pick<Activity, "id">;
      commentId: string;
    }
  | {
      type: "activity.like.updated";
      activity: Pick<Activity, "id" | "likeCount">;
    }
  | {
      type: "activity.best-efforts.available";
      activity: Pick<ActivityDetail, "id" | "bestEfforts">;
    };

export type NotificationEvent =
  | {
      type: "notification.created";
      notification: {
        id: string;
        type: "activity_like" | "activity_comment" | "follow_request";
        createdAt: string;
        activityId: string | null;
      };
    }
  | { type: "notifications.read"; readAt: string };

export type ActivityEventType = ActivityEvent["type"];

type ActivityEventSubscriptionOptions = {
  onNotification?: (event: NotificationEvent) => void;
  activityId?: string;
};

export function parseNotificationEvent(data: string): NotificationEvent | null {
  try {
    const event = JSON.parse(data) as {
      type?: string;
      notification?: { id?: string };
      readAt?: string;
    };
    if (event.type === "notification.created" && event.notification?.id) {
      return event as NotificationEvent;
    }
    if (event.type === "notifications.read" && event.readAt) {
      return event as NotificationEvent;
    }
  } catch {
    // Ignore malformed and forward-incompatible messages.
  }
  return null;
}

export function subscribeToActivityEvents(
  url: string,
  onActivity: (event: ActivityEvent) => void,
  onConnected: () => void,
  options: ActivityEventSubscriptionOptions = {},
): () => void {
  const { activityId, onNotification } = options;
  let socket: WebSocket | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let retryMs = 500;

  const retry = () => {
    if (stopped || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      void connect();
    }, retryMs);
    retryMs = Math.min(retryMs * 2, 10_000);
  };

  const connect = async () => {
    try {
      const ticketResponse = await fetch(
        "/api/v1/auth/activity-events-ticket",
        {
          method: "POST",
        },
      );
      if (!ticketResponse.ok)
        throw new Error("Unable to authenticate activity events");
      const { token } = (await ticketResponse.json()) as { token?: string };
      if (!token) throw new Error("Activity event ticket was missing");
      const socketUrl = new URL(url, window.location.href);
      if (
        window.location.protocol === "https:" &&
        socketUrl.protocol === "ws:"
      ) {
        socketUrl.protocol = "wss:";
        if (socketUrl.hostname === window.location.hostname)
          socketUrl.port = "";
      }
      socketUrl.searchParams.set("ticket", token);
      if (stopped) return;
      socket = new WebSocket(socketUrl);
    } catch {
      retry();
      return;
    }
    socket.onopen = () => {
      retryMs = 500;
      if (activityId)
        socket?.send(
          JSON.stringify({ type: "activity.subscribe", activityId }),
        );
      onConnected();
    };
    socket.onmessage = ({ data }) => {
      const notificationEvent = parseNotificationEvent(String(data));
      if (notificationEvent) {
        onNotification?.(notificationEvent);
        return;
      }
      try {
        const event = JSON.parse(String(data)) as {
          type?: string;
          activity?: { id?: string };
        };
        if (
          (event.type === "activity.created" ||
            event.type === "activity.upload.skipped" ||
            event.type === "activity.updated" ||
            event.type === "activity.comment.created" ||
            event.type === "activity.comment.updated" ||
            event.type === "activity.comment.deleted" ||
            event.type === "activity.like.updated" ||
            event.type === "activity.best-efforts.available") &&
          event.activity?.id
        ) {
          onActivity(event as ActivityEvent);
        }
      } catch {
        // Ignore malformed or forward-incompatible events.
      }
    };
    socket.onclose = () => {
      retry();
    };
  };

  void connect();
  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    socket?.close();
  };
}

export function subscribeToJobEvents(url: string, onUpdate: () => void): () => void {
  let socket: WebSocket | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let retryMs = 500;

  const retry = () => {
    if (stopped || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      void connect();
    }, retryMs);
    retryMs = Math.min(retryMs * 2, 10_000);
  };

  const connect = async () => {
    try {
      const ticketResponse = await fetch("/api/v1/auth/job-events-ticket", { method: "POST" });
      if (!ticketResponse.ok) throw new Error("Unable to authenticate job events");
      const { token } = (await ticketResponse.json()) as { token?: string };
      if (!token) throw new Error("Job event ticket was missing");
      const socketUrl = new URL(url, window.location.href);
      if (window.location.protocol === "https:" && socketUrl.protocol === "ws:") socketUrl.protocol = "wss:";
      socketUrl.searchParams.set("ticket", token);
      if (stopped) return;
      socket = new WebSocket(socketUrl);
    } catch {
      retry();
      return;
    }
    socket.onopen = () => {
      retryMs = 500;
    };
    socket.onmessage = ({ data }) => {
      try {
        if ((JSON.parse(String(data)) as { type?: string }).type === "job.updated") onUpdate();
      } catch {
        // Ignore malformed and forward-incompatible messages.
      }
    };
    socket.onclose = retry;
  };

  void connect();
  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    socket?.close();
  };
}
