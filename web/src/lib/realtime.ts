import type { Activity } from "$lib/types";

type ActivityEvent = {
  type: "activity.created" | "activity.updated";
  activity: Activity;
};

export function subscribeToActivityEvents(
  url: string,
  onActivity: (activity: Activity) => void,
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
            event.type === "activity.updated") &&
          event.activity?.id
        )
          onActivity(event.activity);
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
