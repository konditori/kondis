import type { Activity, ActivityDetail } from "$lib/types";

export type ActivityEvent =
  | {
      type: "activity.created" | "activity.updated";
      activity: Activity;
    }
  | {
      type: "activity.best-efforts.available";
      activity: Pick<ActivityDetail, "id" | "bestEfforts">;
    };

export type ActivityEventType = ActivityEvent["type"];

export function subscribeToActivityEvents(
  url: string,
  onActivity: (event: ActivityEvent) => void,
  onConnected: () => void,
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
      const socketUrl = new URL(url);
      socketUrl.searchParams.set("ticket", token);
      if (stopped) return;
      socket = new WebSocket(socketUrl);
    } catch {
      retry();
      return;
    }
    socket.onopen = () => {
      retryMs = 500;
      onConnected();
    };
    socket.onmessage = ({ data }) => {
      try {
        const event = JSON.parse(String(data)) as Partial<ActivityEvent>;
        if (
          (event.type === "activity.created" ||
            event.type === "activity.updated" ||
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
