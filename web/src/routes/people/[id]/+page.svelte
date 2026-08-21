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
  import { createTranslator } from "$lib/i18n";
  const t = createTranslator();

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
      error = t("profile_unavailable");
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
      error = t("could_not_update_follow_request");
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
      error = t("could_not_update_block");
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
    >{profile
      ? `${userDisplayName(profile.user)} · Kondis`
      : `${t("profile")} · Kondis`}</title
  ></svelte:head
>

<div class="page-shell">
  {#if loading}
    <p class="muted-copy">{t("loading_profile")}</p>
  {:else if !profile}
    <div class="empty-state">
      <h1>{t("profile_unavailable")}</h1>
      <p>{error || t("person_not_found")}</p>
    </div>
  {:else}
    <header class="page-header">
      <div>
        <UserAvatar
          name={userDisplayName(profile.user)}
          src={profile.user.avatarUrl}
          size={72}
        />
        <span class="eyebrow"
          >{isOwnProfile ? t("your_profile") : t("athlete")}</span
        >
        <h1>{userDisplayName(profile.user)}</h1>
      </div>
      {#if !isOwnProfile}<div class="profile-actions">
          <button
            class="metadata-save"
            type="button"
            disabled={updating || profile.relation.blockedViewer}
            onclick={follow}
          >
            {#if profile.relation.following}<UserMinus size={16} />
              {t("unfollow")}
            {:else if profile.relation.outgoingRequest}{t("cancel_request")}
            {:else}<UserPlus size={16} /> {t("follow")}{/if}
          </button>
          <button
            class="metadata-cancel"
            type="button"
            disabled={updating}
            onclick={toggleBlock}
          >
            <Flag size={16} />
            {profile.relation.blockedByViewer ? t("unblock") : t("block")}
          </button>
        </div>{/if}
    </header>
    {#if error}<p class="form-error">{error}</p>{/if}
    {#if isOwnProfile}
      {#if activities.length === 0}
        <div class="empty-state">
          <h2>{t("no_activities")}</h2>
          <p>{t("your_activities_description")}</p>
        </div>
      {:else}
        <section class="activity-list" aria-label={t("your_activities")}>
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
        <h2>{t("you_blocked_this_person")}</h2>
        <p>{t("unblock_to_see_activities")}</p>
      </div>
    {:else if !profile.relation.following}
      <div class="empty-state">
        <h2>{t("follow_to_see_activities")}</h2>
        <p>
          {t("follow_to_see_activities_description")}
        </p>
      </div>
    {:else if activities.length === 0}
      <div class="empty-state">
        <h2>{t("no_activities")}</h2>
        <p>{t("athlete_no_activity")}</p>
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
