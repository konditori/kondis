<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { onDestroy } from "svelte";
  import { Archive, ArrowLeft, Check, LoaderCircle } from "@lucide/svelte";
  import {
    getSdkRequestOptions,
    uploadControllerUploadStravaTakeout,
    uploadControllerGetStravaTakeoutStatus,
  } from "$lib/api";
  import { t } from "$lib/i18n";

  let input = $state<HTMLInputElement>();
  let file = $state<File>();
  let dragging = $state(false);
  let uploadState = $state<"idle" | "uploading" | "done" | "error">("idle");
  let message = $state("");
  let processed = $state(0);
  let total = $state<number | null>(null);
  let duplicates = $state(0);
  let progressTimer: ReturnType<typeof setInterval> | undefined;

  onDestroy(() => clearInterval(progressTimer));

  async function pollImport(importId: string) {
    const status = await uploadControllerGetStravaTakeoutStatus(
      { id: importId },
      getSdkRequestOptions(),
    );
    processed = status.processed;
    total = status.total;
    duplicates = status.duplicates;
    if (status.status === "completed") {
      clearInterval(progressTimer);
      uploadState = "done";
      const imported = processed - status.duplicates - status.failed;
      const parts =
        imported > 0
          ? [t("strava_imported_activities", { count: imported })]
          : [];
      if (status.duplicates > 0)
        parts.push(
          t("strava_duplicate_activities", { count: status.duplicates }),
        );
      if (status.failed > 0)
        parts.push(t("strava_failed_activities", { count: status.failed }));
      message = `${parts.join("; ")}.`;
      await invalidateAll();
    } else if (status.status === "failed") {
      clearInterval(progressTimer);
      uploadState = "error";
      message = Array.isArray(status.error)
        ? status.error.join("; ")
        : (status.error ?? t("strava_import_failed"));
    }
  }

  function selectFile(selected?: File) {
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith(".zip")) {
      file = undefined;
      uploadState = "error";
      message = t("strava_choose_zip");
      return;
    }
    file = selected;
    uploadState = "idle";
    message = "";
    processed = 0;
    total = null;
    duplicates = 0;
  }

  async function upload() {
    if (!file || uploadState === "uploading") return;
    uploadState = "uploading";
    message = "";
    try {
      const response = await uploadControllerUploadStravaTakeout(
        { body: { file } },
        getSdkRequestOptions(),
      );
      message = t("strava_takeout_uploaded");
      await pollImport(response.importId);
      if (uploadState === "uploading") {
        progressTimer = setInterval(
          () => void pollImport(response.importId),
          1000,
        );
      }
    } catch (error) {
      uploadState = "error";
      message =
        error instanceof Error ? error.message : t("strava_import_failed");
    }
  }
</script>

<div class="upload-panel">
  <button class="upload-back" type="button" onclick={() => void goto("/upload")}
    ><ArrowLeft size={17} /> {t("upload_activity")}</button
  >
  <div class="upload-panel-heading">
    <span class="upload-choice-icon"><Archive size={24} /></span>
    <div>
      <h2>{t("activity_import_strava")}</h2>
      <p>{t("activity_import_strava_description")}</p>
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
    <span class="upload-icon"><Archive size={28} /></span>
    <strong>{t("strava_drop_takeout")}</strong>
    <span>{t("strava_browse_device")}</span>
    <small>.zip</small>
  </button>
  <input
    bind:this={input}
    class="sr-only"
    type="file"
    accept=".zip,application/zip"
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
          ><Check class="success" size={16} /> {t("done")}</span
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
  {#if uploadState === "uploading" && total !== null}
    <div class="upload-progress" aria-live="polite">
      <div
        class="upload-progress-track"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax={total}
        aria-valuenow={processed}
      >
        <span style={`width: ${total === 0 ? 100 : (processed / total) * 100}%`}
        ></span>
      </div>
      <small>{t("strava_activities_processed", { processed, total })}</small>
    </div>
  {/if}
  <button
    class="upload-submit"
    type="button"
    disabled={!file || uploadState === "uploading"}
    onclick={() => void upload()}
  >
    {#if uploadState === "uploading"}<LoaderCircle class="spin" size={17} />
      {t("strava_importing")}{:else}{t("strava_import_takeout")}{/if}
  </button>
</div>
