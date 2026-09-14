import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  parseLiveWorkoutEvent,
  parseNotificationEvent,
  subscribeToActivityEvents,
} from "$lib/realtime";

class TestWebSocket {
  static readonly OPEN = 1;
  static sockets: TestWebSocket[] = [];
  readonly send = vi.fn();
  readonly url: string;
  readyState = 0;
  onopen: (() => void) | undefined;
  onmessage: ((event: { data: string }) => void) | undefined;
  onclose: (() => void) | undefined;

  constructor(url: string | URL) {
    this.url = String(url);
    TestWebSocket.sockets.push(this);
  }

  open() {
    this.readyState = TestWebSocket.OPEN;
    this.onopen?.();
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }

  message(data: unknown) {
    this.onmessage?.({ data: String(data) });
  }
}

beforeEach(() => {
  TestWebSocket.sockets = [];
  vi.stubGlobal("WebSocket", TestWebSocket);
  vi.stubGlobal("window", {
    location: {
      href: "https://example.test/",
      protocol: "https:",
      hostname: "example.test",
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("parseNotificationEvent", () => {
  it("recognizes a like notification created event", () => {
    expect(
      parseNotificationEvent(
        JSON.stringify({
          type: "notification.created",
          notification: {
            recipientId: "recipient-id",
            id: "notification-id",
            type: "activity_like",
            createdAt: "2026-08-18T12:00:00.000Z",
            activityId: "activity-id",
          },
        }),
      ),
    ).toMatchObject({
      type: "notification.created",
      notification: {
        id: "notification-id",
        type: "activity_like",
      },
    });
  });

  it("ignores malformed notification messages", () => {
    expect(parseNotificationEvent("not json")).toBeNull();
    expect(
      parseNotificationEvent(
        JSON.stringify({ type: "notification.created", notification: {} }),
      ),
    ).toBeNull();
  });
});

describe("parseLiveWorkoutEvent", () => {
  it("recognizes a live workout updated event", () => {
    expect(
      parseLiveWorkoutEvent(
        JSON.stringify({
          type: "live-workout.updated",
          userId: "user-id",
          workout: {
            id: "workout-id",
            status: "recording",
            elapsedSeconds: 120,
            distanceMeters: 500,
            lastSequence: 12,
            recordedAt: "2026-09-08T12:00:00.000Z",
            position: [18.06, 59.33],
          },
        }),
      ),
    ).toMatchObject({
      type: "live-workout.updated",
      userId: "user-id",
      workout: { id: "workout-id", distanceMeters: 500 },
    });
  });

  it("ignores malformed live workout messages", () => {
    expect(parseLiveWorkoutEvent("not json")).toBeNull();
    expect(
      parseLiveWorkoutEvent(
        JSON.stringify({ type: "live-workout.updated", workout: {} }),
      ),
    ).toBeNull();
  });
});

describe("subscribeToActivityEvents", () => {
  it("shares one ticket and WebSocket between subscribers for the same URL", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ token: "a".repeat(64) }), {
          status: 201,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onFirstActivity = vi.fn();
    const onSecondActivity = vi.fn();

    const unsubscribeFirst = subscribeToActivityEvents(
      "wss://example.test/events",
      onFirstActivity,
      vi.fn(),
    );
    const unsubscribeSecond = subscribeToActivityEvents(
      "wss://example.test/events",
      onSecondActivity,
      vi.fn(),
    );

    await vi.waitFor(() => expect(TestWebSocket.sockets).toHaveLength(1));
    expect(fetchMock).toHaveBeenCalledOnce();
    TestWebSocket.sockets[0]!.open();
    TestWebSocket.sockets[0]!.message(
      JSON.stringify({
        type: "activity.updated",
        activity: { id: "activity-id" },
      }),
    );
    expect(onFirstActivity).toHaveBeenCalledOnce();
    expect(onSecondActivity).toHaveBeenCalledOnce();

    unsubscribeFirst();
    unsubscribeSecond();
    expect(TestWebSocket.sockets[0]!.readyState).toBe(3);
  });

  it("forwards live workout events to the onLiveWorkout listener", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ token: "c".repeat(64) }), {
          status: 201,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onLiveWorkout = vi.fn();

    const unsubscribe = subscribeToActivityEvents(
      "wss://example.test/events",
      vi.fn(),
      vi.fn(),
      { onLiveWorkout },
    );

    await vi.waitFor(() => expect(TestWebSocket.sockets).toHaveLength(1));
    TestWebSocket.sockets[0]!.open();
    TestWebSocket.sockets[0]!.message(
      JSON.stringify({
        type: "live-workout.updated",
        userId: "user-id",
        workout: { id: "workout-id" },
      }),
    );
    expect(onLiveWorkout).toHaveBeenCalledOnce();

    unsubscribe();
  });

  it("honors Retry-After when ticket issuance is rate limited", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 429, headers: { "Retry-After": "7" } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "b".repeat(64) }), {
          status: 201,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const unsubscribe = subscribeToActivityEvents(
      "wss://example.test/events",
      vi.fn(),
      vi.fn(),
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(6_999);
    expect(fetchMock).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(TestWebSocket.sockets).toHaveLength(1);

    unsubscribe();
  });
});
