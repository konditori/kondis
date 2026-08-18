<script lang="ts">
  import {
    Camera,
    Check,
    Gauge,
    Ruler,
    Trash2,
    UserRound,
  } from "@lucide/svelte";
  import { untrack } from "svelte";
  import type { UnitSystem } from "$lib/units";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import { userDisplayName } from "$lib/user-name";

  let { data, form } = $props();
  let selected = $state<UnitSystem>(untrack(() => data.unitSystem));
  let avatarUrl = $state<string | null>(
    untrack(
      () =>
        (data.user as { avatarUrl?: string | null } | undefined)?.avatarUrl ??
        null,
    ),
  );
  let avatarBusy = $state(false);
  let avatarError = $state("");
  let firstName = $state(untrack(() => data.user?.firstName ?? ""));
  let lastName = $state(untrack(() => data.user?.lastName ?? ""));
  let nameBusy = $state(false);
  let nameError = $state("");

  async function saveName() {
    nameBusy = true;
    nameError = "";
    try {
      const response = await fetch("/api/v1/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
      });
      if (!response.ok) throw new Error();
      const saved = (await response.json()) as { firstName: string; lastName: string };
      firstName = saved.firstName;
      lastName = saved.lastName;
      window.location.reload();
    } catch {
      nameError = "Could not save your name.";
    } finally {
      nameBusy = false;
    }
  }

  async function uploadAvatar(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    avatarBusy = true;
    avatarError = "";
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch("/api/v1/users/me/avatar", {
        method: "POST",
        body,
      });
      if (!response.ok) throw new Error();
      const result = (await response.json()) as { avatarUrl: string };
      avatarUrl = `${result.avatarUrl}?v=${Date.now()}`;
    } catch {
      avatarError = "Could not save that profile picture.";
    } finally {
      avatarBusy = false;
      input.value = "";
    }
  }

  async function removeAvatar() {
    avatarBusy = true;
    avatarError = "";
    try {
      const response = await fetch("/api/v1/users/me/avatar", {
        method: "DELETE",
      });
      if (!response.ok) throw new Error();
      avatarUrl = null;
    } catch {
      avatarError = "Could not remove the profile picture.";
    } finally {
      avatarBusy = false;
    }
  }
</script>

<svelte:head><title>Settings · Kondis</title></svelte:head>

<div class="page-shell settings-page">
  <header class="page-header">
    <div>
      <h1>Settings</h1>
      <p>Choose how Kondis displays your activity data.</p>
    </div>
  </header>

  <section class="settings-panel name-panel">
    <div class="settings-heading">
      <span class="settings-icon"><UserRound size={21} /></span>
      <div>
        <h2>Your name</h2>
        <p>This is the name shown on your activities and profile.</p>
      </div>
    </div>
    <div class="settings-name-fields">
      <label class="settings-field">
        <span>First name</span>
        <input bind:value={firstName} maxlength="80" autocomplete="given-name" />
      </label>
      <label class="settings-field">
        <span>Last name</span>
        <input bind:value={lastName} maxlength="80" autocomplete="family-name" />
      </label>
    </div>
    <div class="settings-actions">
      <button
        type="button"
        onclick={saveName}
        disabled={nameBusy || !firstName.trim() || !lastName.trim()}
      >
        <Check size={17} />
        {nameBusy ? "Saving…" : "Save name"}
      </button>
      {#if nameError}<span class="settings-error" role="alert">{nameError}</span
        >{/if}
    </div>
  </section>

  <section class="settings-panel profile-picture-panel">
    <div class="settings-heading">
      <UserAvatar
        name={data.user ? userDisplayName(data.user) : "You"}
        src={avatarUrl}
        size={72}
      />
      <div>
        <h2>Profile picture</h2>
        <p>Shown next to your name on activities and profiles.</p>
      </div>
    </div>
    <div class="settings-actions">
      <label class="metadata-save profile-picture-upload">
        <Camera size={17} />
        {avatarBusy ? "Saving…" : "Choose picture"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/avif"
          onchange={uploadAvatar}
          disabled={avatarBusy}
        />
      </label>
      {#if avatarUrl}<button
          class="metadata-cancel"
          type="button"
          onclick={removeAvatar}
          disabled={avatarBusy}><Trash2 size={17} /> Remove</button
        >{/if}
    </div>
    {#if avatarError}<p class="settings-error" role="alert">
        {avatarError}
      </p>{/if}
  </section>

  <form method="POST" class="settings-panel">
    <div class="settings-heading">
      <span class="settings-icon"><Ruler size={21} /></span>
      <div>
        <h2>Units of measurement</h2>
        <p>
          This preference is stored in this browser until user accounts are
          available.
        </p>
      </div>
    </div>

    <fieldset class="unit-options">
      <legend>Display units</legend>
      <label class:selected={selected === "metric"}>
        <input
          type="radio"
          name="unitSystem"
          value="metric"
          bind:group={selected}
        />
        <span
          ><strong>Metric</strong><small
            >Kilometers, meters, km/h, and min/km</small
          ></span
        >
        {#if selected === "metric"}<Check size={19} />{/if}
      </label>
      <label class:selected={selected === "imperial"}>
        <input
          type="radio"
          name="unitSystem"
          value="imperial"
          bind:group={selected}
        />
        <span
          ><strong>Imperial</strong><small>Miles, feet, mph, and min/mile</small
          ></span
        >
        {#if selected === "imperial"}<Check size={19} />{/if}
      </label>
    </fieldset>

    <div class="settings-actions">
      <button type="submit"><Gauge size={17} /> Save preference</button>
      {#if form?.saved}<span class="settings-saved" role="status"
          ><Check size={16} /> Saved</span
        >{/if}
      {#if form?.error}<span class="settings-error" role="alert"
          >{form.error}</span
        >{/if}
    </div>
  </form>
</div>
