<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { ArrowLeft, Check, FileUp, LoaderCircle } from "@lucide/svelte";
  import {
    getSdkRequestOptions,
    uploadControllerUploadActivity,
  } from "$lib/api";
  import { subscribeToActivityEvents } from "$lib/realtime";
  import type { Activity } from "$lib/types";
  import { t } from "$lib/i18n";

  let { eventsUrl }: { eventsUrl: string } = $props();
  let input = $state<HTMLInputElement>();
  let file = $state<File>();
  let dragging = $state(false);
  let uploadState = $state<"idle" | "uploading" | "done" | "error">("idle");
  let message = $state("");

  function selectFile(selected?: File) {
    if (!selected) return;
    const accepted = [".fit", ".tcx", ".gpx"].some((extension) =>
      selected.name.toLowerCase().endsWith(extension),
    );
    if (!accepted) {
      file = undefined;
      uploadState = "error";
      message = t("choose_workout_file");
      return;
    }
    file = selected;
    uploadState = "idle";
    message = "";
  }

  function waitForActivityCreated(): Promise<Activity> {
    return new Promise((resolve, reject) => {
      let unsubscribe: (() => void) | undefined;
      const timeout = setTimeout(() => {
        unsubscribe?.();
        reject(new Error(t("processing_taking_long")));
      }, 60_000);
      unsubscribe = subscribeToActivityEvents(
        eventsUrl,
        (event) => {
          if (event.type !== "activity.created") return;
          clearTimeout(timeout);
          unsubscribe?.();
          resolve(event.activity);
        },
        () => {},
      );
    });
  }

  async function upload() {
    if (!file || uploadState === "uploading") return;
    uploadState = "uploading";
    message = "";
    const activityCreated = waitForActivityCreated();
    try {
      await uploadControllerUploadActivity(
        { body: { file } },
        getSdkRequestOptions(),
      );
      await invalidateAll();
      uploadState = "done";
      message = t("workout_uploaded");
      try {
        const activity = await activityCreated;
        await goto(`/activities/${activity.id}`);
      } catch {
        // Keep the completed upload visible if processing takes longer.
      }
    } catch (error) {
      void activityCreated.catch(() => {});
      uploadState = "error";
      message = error instanceof Error ? error.message : t("upload_failed");
    }
  }
</script>

<div class="upload-panel">
  <button class="upload-back" type="button" onclick={() => void goto("/upload")}
    ><ArrowLeft size={17} /> {t("upload_activity")}</button
  >
  <div class="upload-panel-heading">
    <span class="upload-choice-icon"><FileUp size={24} /></span>
    <div>
      <h2>{t("upload_workout_file")}</h2>
      <p>{t("upload_workout_description")}</p>
    </div>
  </div>

  <button
    class:dragging
    class="drop-zone"
    type="button"
    onclick={() => input?.click()}
    ondragover={(event) => {
      event.preventDefault();
      dragging = true;
    }}
    ondragleave={() => (dragging = false)}
    ondrop={(event) => {
      event.preventDefault();
      dragging = false;
      selectFile(event.dataTransfer?.files[0]);
    }}
  >
    <span class="upload-icon"><FileUp size={28} /></span>
    <strong>{t("drop_workout_file")}</strong>
    <span>{t("click_to_browse")}</span>
    <small>.fit, .tcx, or .gpx</small>
  </button>
  <input
    bind:this={input}
    class="sr-only"
    type="file"
    accept=".fit,.tcx,.gpx"
    onchange={(event) => selectFile(event.currentTarget.files?.[0])}
  />

  {#if file}
    <div class="upload-row">
      <span class="file-name"
        >{file.name}<small>{(file.size / 1024).toFixed(0)} KB</small></span
      >
      {#if uploadState === "uploading"}<LoaderCircle
          class="spin"
          size={19}
        />{/if}
      {#if uploadState === "done"}<span class="processing"
          ><Check class="success" size={16} /> Done</span
        >{/if}
    </div>
  {/if}
  {#if message}<p
      class:error={uploadState === "error"}
      class:upload-success={uploadState === "done"}
      class="upload-message"
    >
      {message}
    </p>{/if}
  <button
    class="upload-submit"
    type="button"
    disabled={!file || uploadState === "uploading"}
    onclick={() => void upload()}
  >
    {#if uploadState === "uploading"}<LoaderCircle class="spin" size={17} /> Uploading…{:else}Upload
      workout{/if}
  </button>
</div>
