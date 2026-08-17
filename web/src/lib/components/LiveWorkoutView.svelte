<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import {
    Activity,
    Clock3,
    Link,
    Pause,
    Radio,
    WifiOff,
  } from "@lucide/svelte";
  import LiveRouteMap from "$lib/components/LiveRouteMap.svelte";
  import { activityTypeLabel } from "$lib/activity-types";
  import type { ActivityTypeSettingsOutput } from "$lib/api";
  import type { LiveWorkout } from "$lib/types";
  import type { UnitSystem } from "$lib/units";
  import { distance, duration } from "$lib/format";

  let {
    workout = $bindable(),
    endpoint,
    activityTypes,
    unitSystem,
    allowSharing = false,
  }: {
    workout: LiveWorkout;
    endpoint: string;
    activityTypes: ActivityTypeSettingsOutput[];
    unitSystem: UnitSystem;
    allowSharing?: boolean;
  } = $props();
  let shareUrl = $state<string | null>(null);
  let shareError = $state<string | null>(null);
  let sharing = $state(false);
  let resolvingFinishedWorkout = $state(false);
  let now = $state(Date.now());
  const ageSeconds = $derived(
    workout.lastReceivedAt
      ? Math.max(
          0,
          Math.floor((now - Date.parse(workout.lastReceivedAt)) / 1000),
        )
      : null,
  );
  const connection = $derived(
    workout.status === "paused"
      ? "Paused"
      : workout.status === "ended"
        ? "Finished"
        : ageSeconds === null || ageSeconds > 120
          ? "Connection lost"
          : ageSeconds > 30
            ? "Catching up"
            : "Live",
  );

  onMount(() => {
    const resolveFinishedWorkout = async () => {
      if (
        !allowSharing ||
        workout.status !== "ended" ||
        resolvingFinishedWorkout
      )
        return;
      resolvingFinishedWorkout = true;
      try {
        const response = await fetch("/api/v1/activities?limit=50", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          activities?: Array<{ id: string; sport: string; startedAt: string }>;
        };
        const startedAt = Date.parse(workout.startedAt);
        const activity = payload.activities
          ?.filter((candidate) => candidate.sport === workout.sport)
          .map((candidate) => ({
            candidate,
            distance: Math.abs(Date.parse(candidate.startedAt) - startedAt),
          }))
          .filter(({ distance }) => distance <= 5 * 60 * 1000)
          .sort((a, b) => a.distance - b.distance)[0]?.candidate;
        if (activity)
          await goto(`/activities/${activity.id}`, { replaceState: true });
      } finally {
        resolvingFinishedWorkout = false;
      }
    };
    const refresh = async () => {
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        if (response.ok) {
          workout = (await response.json()) as LiveWorkout;
          void resolveFinishedWorkout();
        }
      } catch {
        // The visible timestamp communicates a stale connection without hiding the route.
      }
    };
    void resolveFinishedWorkout();
    const poll = window.setInterval(() => void refresh(), 10_000);
    const clock = window.setInterval(() => (now = Date.now()), 1_000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(clock);
    };
  });

  async function createShare() {
    sharing = true;
    shareError = null;
    try {
      const response = await fetch(
        `/api/v1/live-workouts/${workout.id}/share`,
        {
          method: "POST",
        },
      );
      if (!response.ok) throw new Error("Could not create a share link");
      const { token } = (await response.json()) as { token: string };
      shareUrl = `${window.location.origin}/live/${token}`;
      await navigator.clipboard?.writeText(shareUrl);
    } catch (error) {
      shareError =
        error instanceof Error
          ? error.message
          : "Could not create a share link";
    } finally {
      sharing = false;
    }
  }
</script>

<section class="live-workout-view">
  <div class="live-workout-heading">
    <div>
      <p class:live={connection === "Live"} class="live-status">
        {#if connection === "Live"}<Radio
            size={15}
          />{:else if connection === "Paused"}<Pause
            size={15}
          />{:else if connection === "Connection lost"}<WifiOff
            size={15}
          />{:else}<Clock3 size={15} />{/if}
        {connection}
      </p>
      <h1>
        {activityTypeLabel(activityTypes, workout.sport)}
        {workout.status === "ended" ? " finished" : " in progress"}
      </h1>
      <span
        >{ageSeconds === null
          ? "Waiting for GPS"
          : `Updated ${ageSeconds}s ago`}</span
      >
    </div>
    {#if allowSharing}
      <button
        class="live-share-button"
        onclick={createShare}
        disabled={sharing}
      >
        <Link size={17} />
        {sharing ? "Creating…" : shareUrl ? "New share link" : "Share live"}
      </button>
    {/if}
  </div>
  {#if shareUrl}
    <div class="live-share-link">
      <strong>Beacon link copied</strong><span>{shareUrl}</span>
    </div>
  {:else if shareError}
    <p class="form-error">{shareError}</p>
  {/if}
  <div class="live-stats">
    <div>
      <strong>{distance(workout.distanceMeters, unitSystem)}</strong><span
        >Distance</span
      >
    </div>
    <div>
      <strong>{duration(workout.elapsedSeconds)}</strong><span>Elapsed</span>
    </div>
    <div><strong>{workout.route.length}</strong><span>GPS points</span></div>
  </div>
  <LiveRouteMap coordinates={workout.route} follow={connection === "Live"} />
  {#if workout.route.length === 0}
    <div class="live-waiting">
      <Activity size={22} /> Waiting for the first GPS position…
    </div>
  {/if}
</section>
