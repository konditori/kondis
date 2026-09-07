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

type ActivityEventListener = {
  onActivity: (event: ActivityEvent) => void;
  onConnected: () => void;
  onNotification?: (event: NotificationEvent) => void;
  activityId?: string;
};

type ActivityEventConnection = {
  url: string;
  socket?: WebSocket;
  retryTimer?: ReturnType<typeof setTimeout>;
  connecting?: Promise<void>;
  stopped: boolean;
  retryMs: number;
  listeners: Set<ActivityEventListener>;
  activitySubscriptions: Map<string, number>;
};

type RetryableRealtimeError = Error & { retryAfterMs?: number };

const activityConnections = new Map<string, ActivityEventConnection>();

const retryAfterMs = (response: Response): number | undefined => {
  if (response.status !== 429) return undefined;
  const value = response.headers.get("Retry-After");
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? Math.max(0, timestamp - Date.now())
    : undefined;
};

const sendActivitySubscription = (
  connection: ActivityEventConnection,
  type: "activity.subscribe" | "activity.unsubscribe",
  activityId: string,
) => {
  if (connection.socket?.readyState !== 1) return;
  try {
    connection.socket.send(JSON.stringify({ type, activityId }));
  } catch {
    connection.socket.close();
  }
};

const scheduleActivityRetry = (
  connection: ActivityEventConnection,
  serverDelayMs?: number,
) => {
  if (connection.stopped || connection.retryTimer) return;
  const delay = Math.max(connection.retryMs, serverDelayMs ?? 0);
  connection.retryTimer = setTimeout(() => {
    connection.retryTimer = undefined;
    void connectActivityConnection(connection);
  }, delay);
  connection.retryMs =
    serverDelayMs === undefined ? Math.min(delay * 2, 10_000) : delay;
};

const connectActivityConnection = (
  connection: ActivityEventConnection,
): Promise<void> => {
  if (connection.stopped || connection.socket || connection.connecting) {
    return connection.connecting ?? Promise.resolve();
  }

  const attempt = (async () => {
    try {
      const ticketResponse = await fetch(
        "/api/v1/auth/activity-events-ticket",
        {
          method: "POST",
        },
      );
      if (!ticketResponse.ok) {
        const error = new Error(
          "Unable to authenticate activity events",
        ) as RetryableRealtimeError;
        error.retryAfterMs = retryAfterMs(ticketResponse);
        throw error;
      }
      const { token } = (await ticketResponse.json()) as { token?: string };
      if (!token) throw new Error("Activity event ticket was missing");
      const socketUrl = new URL(connection.url, window.location.href);
      if (
        window.location.protocol === "https:" &&
        socketUrl.protocol === "ws:"
      ) {
        socketUrl.protocol = "wss:";
        if (socketUrl.hostname === window.location.hostname)
          socketUrl.port = "";
      }
      socketUrl.searchParams.set("ticket", token);
      if (connection.stopped) return;
      const socket = new WebSocket(socketUrl);
      connection.socket = socket;
      socket.onopen = () => {
        connection.retryMs = 500;
        for (const activityId of connection.activitySubscriptions.keys()) {
          sendActivitySubscription(
            connection,
            "activity.subscribe",
            activityId,
          );
        }
        for (const listener of connection.listeners) listener.onConnected();
      };
      socket.onmessage = ({ data }) => {
        const notificationEvent = parseNotificationEvent(String(data));
        if (notificationEvent) {
          for (const listener of connection.listeners)
            listener.onNotification?.(notificationEvent);
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
            for (const listener of connection.listeners)
              listener.onActivity(event as ActivityEvent);
          }
        } catch {
          // Ignore malformed or forward-incompatible events.
        }
      };
      socket.onclose = () => {
        if (connection.socket === socket) connection.socket = undefined;
        scheduleActivityRetry(connection);
      };
    } catch (error) {
      scheduleActivityRetry(
        connection,
        (error as RetryableRealtimeError).retryAfterMs,
      );
    }
  })();

  connection.connecting = attempt;
  void attempt.finally(() => {
    if (connection.connecting === attempt) connection.connecting = undefined;
  });
  return attempt;
};

export function subscribeToActivityEvents(
  url: string,
  onActivity: (event: ActivityEvent) => void,
  onConnected: () => void,
  options: ActivityEventSubscriptionOptions = {},
): () => void {
  let connection = activityConnections.get(url);
  if (!connection) {
    connection = {
      url,
      stopped: false,
      retryMs: 500,
      listeners: new Set(),
      activitySubscriptions: new Map(),
    };
    activityConnections.set(url, connection);
  }
  const listener: ActivityEventListener = {
    onActivity,
    onConnected,
    ...options,
  };
  connection.listeners.add(listener);
  if (listener.activityId) {
    const count =
      connection.activitySubscriptions.get(listener.activityId) ?? 0;
    connection.activitySubscriptions.set(listener.activityId, count + 1);
    if (count === 0)
      sendActivitySubscription(
        connection,
        "activity.subscribe",
        listener.activityId,
      );
  }
  void connectActivityConnection(connection);

  return () => {
    if (!connection?.listeners.delete(listener)) return;
    if (listener.activityId) {
      const count =
        connection.activitySubscriptions.get(listener.activityId) ?? 0;
      if (count <= 1) {
        connection.activitySubscriptions.delete(listener.activityId);
        sendActivitySubscription(
          connection,
          "activity.unsubscribe",
          listener.activityId,
        );
      } else {
        connection.activitySubscriptions.set(listener.activityId, count - 1);
      }
    }
    if (connection.listeners.size > 0) return;
    connection.stopped = true;
    clearTimeout(connection.retryTimer);
    connection.socket?.close();
    if (activityConnections.get(url) === connection)
      activityConnections.delete(url);
  };
}

export function subscribeToJobEvents(
  url: string,
  onUpdate: () => void,
): () => void {
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
      const ticketResponse = await fetch("/api/v1/auth/job-events-ticket", {
        method: "POST",
      });
      if (!ticketResponse.ok)
        throw new Error("Unable to authenticate job events");
      const { token } = (await ticketResponse.json()) as { token?: string };
      if (!token) throw new Error("Job event ticket was missing");
      const socketUrl = new URL(url, window.location.href);
      if (window.location.protocol === "https:" && socketUrl.protocol === "ws:")
        socketUrl.protocol = "wss:";
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
        if (
          (JSON.parse(String(data)) as { type?: string }).type === "job.updated"
        )
          onUpdate();
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
