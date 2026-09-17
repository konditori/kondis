<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { onDestroy } from "svelte";
  import { Archive, ArrowLeft, Check, LoaderCircle } from "@lucide/svelte";
  import {
    capabilitiesControllerGet,
    Status2,
    type TakeoutImportStatusDtoOutput,
  } from "@kondis/sdk";
  import { API_BASE, getSdkRequestOptions } from "$lib/api";
  import { t } from "$lib/i18n";

  // Svelte's TypeScript transform elides enums used by template expressions.
  // Runtime value objects keep these names available to both the script and markup.
  const ImportPhase = {
    Idle: "idle",
    Scanning: "scanning",
    Uploading: "uploading",
    Processing: "processing",
    Done: "done",
    Error: "error",
    Cancelled: "cancelled",
  } as const;
  type ImportPhase = (typeof ImportPhase)[keyof typeof ImportPhase];

  const WorkerEventType = {
    Phase: "phase",
    Scanned: "scanned",
    Uploaded: "uploaded",
    Complete: "complete",
    Error: "error",
  } as const;
  type WorkerEventType = (typeof WorkerEventType)[keyof typeof WorkerEventType];

  type WorkerEvent = {
    type: WorkerEventType;
    phase?:
      | (typeof ImportPhase)["Scanning"]
      | (typeof ImportPhase)["Uploading"]
      | (typeof ImportPhase)["Processing"];
    total?: number;
    uploaded?: number;
    extractionErrors?: number;
    skipped?: { videos: number };
    message?: string;
  };

  let input = $state<HTMLInputElement>();
  let file = $state<File>();
  let dragging = $state(false);
  let importId = $state<string>();
  let phase = $state<ImportPhase>(ImportPhase.Idle);
  let message = $state("");
  let mediaMessage = $state("");
  let processed = $state(0);
  let uploaded = $state(0);
  let total = $state<number | null>(null);
  let duplicates = $state(0);
  let worker: Worker | undefined;
  let progressTimer: ReturnType<typeof setTimeout> | undefined;
  let pollInFlight = false;
  let pollDelay = 1_000;

  onDestroy(() => {
    worker?.terminate();
    clearTimeout(progressTimer);
  });

  const importKey = (selected: File) =>
    `kondis:strava-import:${selected.name}:${selected.size}:${selected.lastModified}`;

  async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "same-origin",
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(body || `Request failed (${response.status})`);
    }
    return (response.status === 204 ? undefined : await response.json()) as T;
  }

  async function pollImport(id: string): Promise<boolean> {
    if (pollInFlight) return phase === ImportPhase.Processing;
    pollInFlight = true;
    try {
      const status = await api<TakeoutImportStatusDtoOutput>(
        `/upload/strava/imports/${id}`,
      );
      processed = status.processed;
      uploaded = status.uploaded;
      total = status.total;
      duplicates = status.duplicates;
      if (status.status === Status2.Completed) {
        clearTimeout(progressTimer);
        phase = ImportPhase.Done;
        if (file) localStorage.removeItem(importKey(file));
        const imported = processed - status.duplicates - status.failed;
        const parts =
          imported > 0 || status.total === 0
            ? [t("strava_imported_activities", { count: imported })]
            : [];
        if (status.duplicates > 0)
          parts.push(
            t("strava_duplicate_activities", { count: status.duplicates }),
          );
        if (status.failed > 0)
          parts.push(t("strava_failed_activities", { count: status.failed }));
        message = [parts.length ? `${parts.join("; ")}.` : "", status.error]
          .filter(Boolean)
          .join(" ");
        await invalidateAll();
        return false;
      } else if (
        status.status === Status2.Failed ||
        status.status === Status2.Cancelled
      ) {
        clearTimeout(progressTimer);
        phase =
          status.status === Status2.Cancelled
            ? ImportPhase.Cancelled
            : ImportPhase.Error;
        message = status.error ?? t("strava_import_failed");
      } else if (status.status === Status2.Processing) {
        phase = ImportPhase.Processing;
      }
      return phase === ImportPhase.Processing;
    } finally {
      pollInFlight = false;
    }
  }

  function schedulePoll(id: string) {
    clearTimeout(progressTimer);
    progressTimer = setTimeout(() => {
      void pollImport(id)
        .then((keepPolling) => {
          if (keepPolling && phase === ImportPhase.Processing) {
            pollDelay = Math.min(5_000, pollDelay + 500);
            schedulePoll(id);
          }
        })
        .catch((error) => {
          phase = ImportPhase.Error;
          message = error instanceof Error ? error.message : String(error);
        });
    }, pollDelay);
  }

  function selectFile(selected?: File) {
    if (!selected) return;
    worker?.terminate();
    clearTimeout(progressTimer);
    if (!selected.name.toLowerCase().endsWith(".zip")) {
      file = undefined;
      phase = ImportPhase.Error;
      message = t("strava_choose_zip");
      return;
    }
    file = selected;
    importId = undefined;
    phase = ImportPhase.Idle;
    message = "";
    mediaMessage = "";
    processed = 0;
    uploaded = 0;
    total = null;
    duplicates = 0;
  }

  async function start() {
    if (
      !file ||
      phase === ImportPhase.Scanning ||
      phase === ImportPhase.Uploading ||
      phase === ImportPhase.Processing
    )
      return;
    message = "";
    phase = ImportPhase.Scanning;
    worker?.terminate();
    importId = undefined;
    try {
      const saved = localStorage.getItem(importKey(file));
      try {
        if (saved) {
          const status = await api<TakeoutImportStatusDtoOutput>(
            `/upload/strava/imports/${saved}`,
          );
          if (
            status.status !== Status2.Completed &&
            status.status !== Status2.Cancelled
          )
            importId = saved;
        }
      } catch {
        localStorage.removeItem(importKey(file));
      }
      if (!importId) {
        const created = await api<{ importId: string }>(
          "/upload/strava/imports",
          { method: "POST" },
        );
        importId = created.importId;
        localStorage.setItem(importKey(file), importId);
      }
      phase = ImportPhase.Scanning;
      const capabilities = await capabilitiesControllerGet(
        getSdkRequestOptions(),
      );
      worker = new Worker(
        new URL("../workers/strava-takeout.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.onmessage = (event: MessageEvent<WorkerEvent>) =>
        void handleWorkerEvent(event.data).catch(showError);
      worker.onerror = () => showError(new Error(t("strava_import_failed")));
      worker.postMessage({
        type: "start",
        file,
        importId,
        apiBase: API_BASE,
        capabilities,
      });
    } catch (error) {
      showError(error);
    }
  }

  function showError(error: unknown) {
    phase = ImportPhase.Error;
    message = error instanceof Error ? error.message : String(error);
  }

  async function handleWorkerEvent(event: WorkerEvent) {
    if (event.type === WorkerEventType.Phase && event.phase) {
      phase = event.phase;
      return;
    }
    if (event.type === WorkerEventType.Scanned) {
      total = event.total ?? null;
      if (event.skipped) {
        mediaMessage = t("strava_skipped_videos", {
          videos: event.skipped.videos,
        });
      }
      return;
    }
    if (event.type === WorkerEventType.Uploaded) {
      uploaded = event.uploaded ?? uploaded;
      return;
    }
    if (event.type === WorkerEventType.Complete && importId) {
      phase = ImportPhase.Processing;
      await pollImport(importId);
      if (phase === ImportPhase.Processing) {
        pollDelay = 1_000;
        schedulePoll(importId);
      }
      return;
    }
    if (event.type === WorkerEventType.Error) {
      phase = ImportPhase.Error;
      message = event.message ?? t("strava_import_failed");
    }
  }

  async function cancel() {
    worker?.postMessage({ type: "cancel" });
    worker?.terminate();
    worker = undefined;
    clearTimeout(progressTimer);
    if (importId)
      await api(`/upload/strava/imports/${importId}/cancel`, {
        method: "POST",
      });
    if (file) localStorage.removeItem(importKey(file));
    importId = undefined;
    phase = ImportPhase.Cancelled;
  }

  const busy = () =>
    phase === ImportPhase.Scanning ||
    phase === ImportPhase.Uploading ||
    phase === ImportPhase.Processing;
  const phaseText = () => {
    if (phase === ImportPhase.Scanning) return t("strava_scanning");
    if (phase === ImportPhase.Uploading) return t("strava_uploading");
    if (phase === ImportPhase.Processing) return t("strava_server_processing");
    return "";
  };
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
    disabled={busy()}
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
    aria-label={t("strava_takeout")}
    onchange={(event) => selectFile(event.currentTarget.files?.[0])}
  />

  {#if file}
    <div class="upload-row">
      <span class="file-name"
        >{file.name}<small>{(file.size / 1024 / 1024).toFixed(1)} MB</small
        ></span
      >
      {#if busy()}<LoaderCircle class="spin" size={19} />{/if}
      {#if phase === ImportPhase.Done}<span class="processing"
          ><Check class="success" size={16} /> {t("done")}</span
        >{/if}
    </div>
  {/if}
  {#if busy()}
    <p class="upload-message">{phaseText()}</p>
  {:else if message}
    <p
      class:error={phase === ImportPhase.Error}
      class:upload-success={phase === ImportPhase.Done}
      class="upload-message"
      role="status"
    >
      {message}
    </p>
  {/if}
  {#if mediaMessage}
    <p class="upload-message" role="note">{mediaMessage}</p>
  {/if}
  {#if busy() && total !== null}
    <div class="upload-progress" aria-live="polite">
      <div
        class="upload-progress-track"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax={total}
        aria-valuenow={phase === ImportPhase.Processing ? processed : uploaded}
      >
        <span
          style={`width: ${total === 0 ? 100 : ((phase === ImportPhase.Processing ? processed : uploaded) / total) * 100}%`}
        ></span>
      </div>
      <small
        >{t("strava_activities_processed", {
          processed: phase === ImportPhase.Processing ? processed : uploaded,
          total,
        })}</small
      >
    </div>
  {/if}
  {#if busy()}
    <button class="upload-submit" type="button" onclick={() => void cancel()}
      >{t("strava_cancel")}</button
    >
  {:else}
    <button
      class="upload-submit"
      type="button"
      disabled={!file}
      onclick={() => void start()}>{t("strava_import_takeout")}</button
    >
  {/if}
</div>
