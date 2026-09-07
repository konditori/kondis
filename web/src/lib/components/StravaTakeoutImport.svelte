<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { onDestroy } from "svelte";
  import { Archive, ArrowLeft, Check, LoaderCircle } from "@lucide/svelte";
  import { t } from "$lib/i18n";

  type ImportStatus = {
    importId: string;
    status:
      | "scanning"
      | "uploading"
      | "processing"
      | "completed"
      | "failed"
      | "cancelled";
    total: number | null;
    uploaded: number;
    processed: number;
    failed: number;
    duplicates: number;
    error: string | null;
  };
  type WorkerEvent = {
    type: "phase" | "scanned" | "uploaded" | "complete" | "error";
    phase?: "scanning" | "uploading" | "processing";
    total?: number;
    uploaded?: number;
    extractionErrors?: number;
    skipped?: { photos: number; videos: number; profileImages: number };
    message?: string;
  };

  const apiBase = "/api/v1";
  let input = $state<HTMLInputElement>();
  let file = $state<File>();
  let dragging = $state(false);
  let importId = $state<string>();
  let phase = $state<
    | "idle"
    | "scanning"
    | "uploading"
    | "processing"
    | "done"
    | "error"
    | "cancelled"
  >("idle");
  let message = $state("");
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
    const response = await fetch(`${apiBase}${path}`, {
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
    if (pollInFlight) return phase === "processing";
    pollInFlight = true;
    try {
      const status = await api<ImportStatus>(`/upload/strava/imports/${id}`);
      processed = status.processed;
      uploaded = status.uploaded;
      total = status.total;
      duplicates = status.duplicates;
      if (status.status === "completed") {
        clearTimeout(progressTimer);
        phase = "done";
        if (file) localStorage.removeItem(importKey(file));
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
        return false;
      } else if (status.status === "failed" || status.status === "cancelled") {
        clearTimeout(progressTimer);
        phase = status.status === "cancelled" ? "cancelled" : "error";
        message = status.error ?? t("strava_import_failed");
      } else if (status.status === "processing") {
        phase = "processing";
      }
      return phase === "processing";
    } finally {
      pollInFlight = false;
    }
  }

  function schedulePoll(id: string) {
    clearTimeout(progressTimer);
    progressTimer = setTimeout(() => {
      void pollImport(id)
        .then((keepPolling) => {
          if (keepPolling && phase === "processing") {
            pollDelay = Math.min(5_000, pollDelay + 500);
            schedulePoll(id);
          }
        })
        .catch((error) => {
          phase = "error";
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
      phase = "error";
      message = t("strava_choose_zip");
      return;
    }
    file = selected;
    importId = undefined;
    phase = "idle";
    message = "";
    processed = 0;
    uploaded = 0;
    total = null;
    duplicates = 0;
  }

  async function start() {
    if (
      !file ||
      phase === "scanning" ||
      phase === "uploading" ||
      phase === "processing"
    )
      return;
    message = "";
    const saved = localStorage.getItem(importKey(file));
    try {
      if (saved) {
        const status = await api<ImportStatus>(
          `/upload/strava/imports/${saved}`,
        );
        if (status.status !== "completed" && status.status !== "cancelled")
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
    phase = "scanning";
    worker = new Worker(
      new URL("../workers/strava-takeout.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event: MessageEvent<WorkerEvent>) =>
      void handleWorkerEvent(event.data);
    worker.postMessage({ type: "start", file, importId, apiBase });
  }

  async function handleWorkerEvent(event: WorkerEvent) {
    if (event.type === "phase" && event.phase) {
      phase = event.phase;
      return;
    }
    if (event.type === "scanned") {
      total = event.total ?? null;
      if (event.skipped) {
        message = t("strava_skipped_media", {
          photos: event.skipped.photos,
          videos: event.skipped.videos,
          profiles: event.skipped.profileImages,
        });
      }
      return;
    }
    if (event.type === "uploaded") {
      uploaded = event.uploaded ?? uploaded;
      return;
    }
    if (event.type === "complete" && importId) {
      phase = "processing";
      await pollImport(importId);
      if (phase === "processing") {
        pollDelay = 1_000;
        schedulePoll(importId);
      }
      return;
    }
    if (event.type === "error") {
      phase = "error";
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
    phase = "cancelled";
  }

  const busy = () =>
    phase === "scanning" || phase === "uploading" || phase === "processing";
  const phaseText = () => {
    if (phase === "scanning") return t("strava_scanning");
    if (phase === "uploading") return t("strava_uploading");
    if (phase === "processing") return t("strava_server_processing");
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
    onchange={(event) => selectFile(event.currentTarget.files?.[0])}
  />

  {#if file}
    <div class="upload-row">
      <span class="file-name"
        >{file.name}<small>{(file.size / 1024 / 1024).toFixed(1)} MB</small
        ></span
      >
      {#if busy()}<LoaderCircle class="spin" size={19} />{/if}
      {#if phase === "done"}<span class="processing"
          ><Check class="success" size={16} /> {t("done")}</span
        >{/if}
    </div>
  {/if}
  {#if busy()}
    <p class="upload-message">{phaseText()}</p>
  {:else if message}
    <p
      class:error={phase === "error"}
      class:upload-success={phase === "done"}
      class="upload-message"
    >
      {message}
    </p>
  {/if}
  {#if busy() && total !== null}
    <div class="upload-progress" aria-live="polite">
      <div
        class="upload-progress-track"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax={total}
        aria-valuenow={phase === "processing" ? processed : uploaded}
      >
        <span
          style={`width: ${total === 0 ? 100 : ((phase === "processing" ? processed : uploaded) / total) * 100}%`}
        ></span>
      </div>
      <small
        >{t("strava_activities_processed", {
          processed: phase === "processing" ? processed : uploaded,
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
