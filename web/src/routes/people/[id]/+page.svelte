<script lang="ts">
  import { page } from "$app/state";
  import { Flag, UserMinus, UserPlus } from "@lucide/svelte";
  import ActivityCard from "$lib/components/ActivityCard.svelte";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import {
    getSdkRequestOptions,
    socialControllerActivities,
    socialControllerBlock,
    socialControllerCancel,
    socialControllerPerson,
    socialControllerSend,
    socialControllerUnblock,
    socialControllerUnfollow,
  } from "$lib/api";
  import type { Activity, ActivityPage } from "$lib/types";
  import { userDisplayName } from "$lib/user-name";

  let { data } = $props();
  type Person = Awaited<ReturnType<typeof socialControllerPerson>>;
  let profile = $state<Person | null>(null);
  let activities = $state<Activity[]>([]);
  let loading = $state(true);
  let error = $state("");
  let updating = $state(false);
  const isOwnProfile = $derived(
    profile !== null && data.user?.id === profile.user.id,
  );

  async function load() {
    loading = true;
    error = "";
    try {
      const id = page.params.id;
      if (!id) throw new Error("Profile id was missing");
      const [person, activityPage] = await Promise.all([
        socialControllerPerson({ id }, getSdkRequestOptions()),
        socialControllerActivities({ id }, getSdkRequestOptions()),
      ]);
      profile = person;
      activities = (activityPage as ActivityPage).activities;
    } catch {
      profile = null;
      activities = [];
      error = "This profile is unavailable.";
    } finally {
      loading = false;
    }
  }

  async function follow() {
    if (!profile || updating) return;
    updating = true;
    try {
      const { id } = profile.user;
      if (profile.relation.following) {
        await socialControllerUnfollow({ id }, getSdkRequestOptions());
        profile.relation = { ...profile.relation, following: false };
      } else if (profile.relation.outgoingRequest) {
        await socialControllerCancel({ id }, getSdkRequestOptions());
        profile.relation = { ...profile.relation, outgoingRequest: false };
      } else {
        await socialControllerSend({ id }, getSdkRequestOptions());
        profile.relation = { ...profile.relation, outgoingRequest: true };
      }
    } catch {
      error = "Could not update this follow request.";
    } finally {
      updating = false;
    }
  }

  async function toggleBlock() {
    if (!profile || updating) return;
    updating = true;
    try {
      const { id } = profile.user;
      if (profile.relation.blockedByViewer) {
        await socialControllerUnblock({ id }, getSdkRequestOptions());
        profile.relation = { ...profile.relation, blockedByViewer: false };
      } else {
        await socialControllerBlock({ id }, getSdkRequestOptions());
        profile.relation = {
          ...profile.relation,
          following: false,
          outgoingRequest: false,
          blockedByViewer: true,
        };
        activities = [];
      }
    } catch {
      error = "Could not update the block.";
    } finally {
      updating = false;
    }
  }

  $effect(() => {
    void load();
  });
</script>

<svelte:head
  ><title
    >{profile ? `${userDisplayName(profile.user)} · Kondis` : "Profile · Kondis"}</title
  ></svelte:head
>

<div class="page-shell">
  {#if loading}
    <p class="muted-copy">Loading profile…</p>
  {:else if !profile}
    <div class="empty-state">
      <h1>Profile unavailable</h1>
      <p>{error || "This person could not be found."}</p>
    </div>
  {:else}
    <header class="page-header">
      <div>
        <UserAvatar
          name={userDisplayName(profile.user)}
          src={profile.user.avatarUrl}
          size={72}
        />
        <span class="eyebrow">{isOwnProfile ? "Your profile" : "Athlete"}</span>
        <h1>{userDisplayName(profile.user)}</h1>
      </div>
      {#if !isOwnProfile}<div class="profile-actions">
          <button
            class="metadata-save"
            type="button"
            disabled={updating || profile.relation.blockedViewer}
            onclick={follow}
          >
            {#if profile.relation.following}<UserMinus size={16} /> Unfollow
            {:else if profile.relation.outgoingRequest}Cancel request
            {:else}<UserPlus size={16} /> Follow{/if}
          </button>
          <button
            class="metadata-cancel"
            type="button"
            disabled={updating}
            onclick={toggleBlock}
          >
            <Flag size={16} />
            {profile.relation.blockedByViewer ? "Unblock" : "Block"}
          </button>
        </div>{/if}
    </header>
    {#if error}<p class="form-error">{error}</p>{/if}
    {#if isOwnProfile}
      {#if activities.length === 0}
        <div class="empty-state">
          <h2>No activities yet</h2>
          <p>Your recorded and uploaded activities will appear here.</p>
        </div>
      {:else}
        <section class="activity-list" aria-label="Your activities">
          {#each activities as activity (activity.id)}
            <ActivityCard
              {activity}
              activityTypes={data.activityTypes}
              unitSystem={data.unitSystem}
              viewerId={data.user?.id}
            />
          {/each}
        </section>
      {/if}
    {:else if profile.relation.blockedByViewer}
      <div class="empty-state">
        <h2>You blocked this person</h2>
        <p>Unblock them to see their activity history.</p>
      </div>
    {:else if !profile.relation.following}
      <div class="empty-state">
        <h2>Follow to see activities</h2>
        <p>
          When they accept your request, their activities and live sessions will
          appear here and in Home.
        </p>
      </div>
    {:else if activities.length === 0}
      <div class="empty-state">
        <h2>No activities yet</h2>
        <p>This athlete has not shared an activity yet.</p>
      </div>
    {:else}
      <section
        class="activity-list"
        aria-label={`${userDisplayName(profile.user)}'s activities`}
      >
        {#each activities as activity (activity.id)}
          <ActivityCard
            {activity}
            activityTypes={data.activityTypes}
            unitSystem={data.unitSystem}
            viewerId={data.user?.id}
          />
        {/each}
      </section>
    {/if}
  {/if}
</div>
