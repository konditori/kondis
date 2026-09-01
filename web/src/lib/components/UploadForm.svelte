<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import {
    ArrowLeft,
    ArrowUpRight,
    Check,
    CircleAlert,
    Clock3,
    FileUp,
    LoaderCircle,
  } from "@lucide/svelte";
  import {
    activityControllerGetById,
    getSdkRequestOptions,
    uploadControllerUploadActivity,
  } from "$lib/api";
  import {
    selectActivityFiles,
    uploadActivityFiles,
    type ActivityUploadItem,
  } from "$lib/activity-upload-queue";
  import { activityName } from "$lib/format";
  import { subscribeToActivityEvents } from "$lib/realtime";
  import type { Activity } from "$lib/types";
  import { t } from "$lib/i18n";

  let { eventsUrl }: { eventsUrl: string } = $props();
  let input = $state<HTMLInputElement>();
  let files = $state<ActivityUploadItem[]>([]);
  let dragging = $state(false);
  let uploadState = $state<"idle" | "uploading" | "done" | "error">("idle");
  let message = $state("");
  let uploadedCount = $state(0);

  function selectFiles(selected: File[]) {
    if (!selected.length || uploadState === "uploading") return;
    const selection = selectActivityFiles(selected);
    files = selection.files;
    if (selection.hasRejectedFiles) {
      uploadState = "error";
      message = t("choose_activity_file");
      return;
    }
    uploadState = "idle";
    message = "";
    uploadedCount = 0;
    void upload();
  }

  type UploadedActivity = Pick<Activity, "id" | "name" | "sport"> & {
    uploadFileName: string;
    skipped: boolean;
  };

  function waitForActivitiesCreated(
    fileNames: string[],
  ): Promise<UploadedActivity[]> {
    return new Promise((resolve, reject) => {
      const remaining = [...fileNames];
      const activities: UploadedActivity[] = [];
      let unsubscribe: (() => void) | undefined;
      const timeout = setTimeout(() => {
        unsubscribe?.();
        reject(new Error(t("processing_taking_long")));
      }, 60_000);
      unsubscribe = subscribeToActivityEvents(
        eventsUrl,
        (event) => {
          if (
            event.type !== "activity.created" &&
            event.type !== "activity.upload.skipped"
          )
            return;
          const fileName =
            event.type === "activity.upload.skipped"
              ? event.uploadFileName
              : event.activity.uploadFileName;
          if (!fileName) return;
          const matchingFileIndex = remaining.indexOf(fileName);
          if (matchingFileIndex === -1) return;
          remaining.splice(matchingFileIndex, 1);
          const activity = {
            ...event.activity,
            uploadFileName: fileName,
            skipped: event.type === "activity.upload.skipped",
          };
          activities.push(activity);
          const item = files.find(
            (candidate) => candidate.file.name === fileName,
          );
          if (item) {
            item.activity = activity;
            if (activity.skipped) item.status = "skipped";
            void refreshActivityTitle(activity);
          }
          if (remaining.length > 0) return;
          clearTimeout(timeout);
          unsubscribe?.();
          resolve(activities);
        },
        () => {},
      );
    });
  }

  async function refreshActivityTitle(activity: UploadedActivity) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        const detail = (await activityControllerGetById(
          { id: activity.id },
          getSdkRequestOptions(),
        )) as unknown as Activity;
        if (detail.name) {
          const item = files.find(
            (candidate) => candidate.file.name === activity.uploadFileName,
          );
          if (item)
            item.activity = {
              id: detail.id,
              name: detail.name,
              sport: detail.sport,
            };
          return;
        }
      } catch {
        // Keep retrying while the asynchronous activity processing settles.
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  async function upload() {
    if (!files.length || uploadState === "uploading" || uploadState === "done")
      return;
    uploadState = "uploading";
    message = "";
    uploadedCount = 0;
    const pendingFiles = files.filter((item) => item.status !== "done");
    const activityCreated = waitForActivitiesCreated(
      pendingFiles.map((item) => item.file.name),
    );
    try {
      const result = await uploadActivityFiles(files, async (file) => {
        await uploadControllerUploadActivity(
          { body: { file } },
          getSdkRequestOptions(),
        );
        uploadedCount += 1;
      });
      await invalidateAll();
      uploadState = result.failedCount ? "error" : "done";
      message = result.failedCount
        ? t("activities_upload_failed", {
            uploaded: result.completedCount,
            failed: result.failedCount,
          })
        : result.completedCount === 1
          ? t("activity_uploaded")
          : t("activities_uploaded", { count: result.completedCount });
      if (pendingFiles.length === 1) {
        try {
          const [activity] = await activityCreated;
          await goto(`/activities/${activity.id}`);
        } catch {
          // Keep the completed upload visible if processing takes longer.
        }
      } else {
        void activityCreated.catch(() => {});
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
      <h2>{t("upload_activity_file")}</h2>
      <p>{t("upload_activity_description")}</p>
    </div>
  </div>

  <button
    class:dragging
    class="drop-zone"
    type="button"
    disabled={uploadState === "uploading"}
    onclick={() => input?.click()}
    ondragover={(event) => {
      event.preventDefault();
      dragging = true;
    }}
    ondragleave={() => (dragging = false)}
    ondrop={(event) => {
      event.preventDefault();
      dragging = false;
      selectFiles(Array.from(event.dataTransfer?.files ?? []));
    }}
  >
    <span class="upload-icon"><FileUp size={28} /></span>
    <strong>{t("drop_activity_files")}</strong>
    <span>{t("click_to_browse")}</span>
    <small>.fit, .tcx, or .gpx</small>
  </button>
  <input
    bind:this={input}
    class="sr-only"
    type="file"
    accept=".fit,.tcx,.gpx"
    multiple
    disabled={uploadState === "uploading"}
    onchange={(event) =>
      selectFiles(Array.from(event.currentTarget.files ?? []))}
  />

  {#if files.length}
    <div class="upload-list">
      {#each files as item}
        <div class="upload-row">
          <span class="file-name"
            >{item.file.name}<small
              >{(item.file.size / 1024).toFixed(0)} KB</small
            >{#if item.activity}<a
                class="activity-title"
                href={`/activities/${item.activity.id}`}
                >{activityName(item.activity)} <ArrowUpRight size={16} /></a
              >{/if}</span
          >
          {#if item.status === "queued"}<span class="upload-file-status pending"
              ><Clock3 size={16} /> {t("upload_queued")}</span
            >{:else if item.status === "uploading"}<span
              class="upload-file-status"
              ><LoaderCircle class="spin" size={16} />
              {t("uploading_activity")}</span
            >{:else if item.status === "done"}<span class="upload-file-status"
              ><Check class="success" size={16} /> {t("done")}</span
            >{:else if item.status === "skipped"}<span
              class="upload-file-status pending"
              ><CircleAlert size={16} /> {t("upload_skipped")}</span
            >{:else}<span class="upload-file-status error"
              ><CircleAlert size={16} /> {t("upload_failed")}</span
            >{/if}
        </div>
      {/each}
    </div>
    {#if uploadState === "uploading"}<p class="upload-message">
        {t("activities_upload_progress", {
          uploaded: uploadedCount,
          total: files.length,
        })}
      </p>{/if}
  {/if}
  {#if message}<p
      class:error={uploadState === "error"}
      class:upload-success={uploadState === "done"}
      class="upload-message"
    >
      {message}
    </p>{/if}
</div>
