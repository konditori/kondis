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

  const connect = () => {
    socket = new WebSocket(url);
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
      if (stopped) return;
      retryTimer = setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, 10_000);
    };
  };

  connect();
  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    socket?.close();
  };
}
