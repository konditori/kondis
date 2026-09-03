<script lang="ts">
  import {
    Archive,
    CircleAlert,
    Clock3,
    Database,
    FileChartColumnIncreasing,
    HardDrive,
    Image,
    ListChecks,
    RefreshCw,
  } from "@lucide/svelte";
  import { onMount, untrack } from "svelte";
  import {
    getSdkRequestOptions,
    jobControllerGetAllJobStatus,
    jobControllerGetJobHistory,
    JobQueueName,
    type AllJobStatusResponseDtoOutput,
    type JobHistoryResponseDtoOutput,
  } from "$lib/api";
  import { t } from "$lib/i18n";
  import { subscribeToJobEvents } from "$lib/realtime";

  let { data } = $props();
  let queues = $state<AllJobStatusResponseDtoOutput>(
    untrack(() => data.queues),
  );
  let history = $state<JobHistoryResponseDtoOutput["jobs"]>(
    untrack(() => data.history.jobs),
  );
  let refreshing = $state(false);
  let refreshQueued = false;
  let error = $state("");

  const queueDefinitions = [
    {
      key: JobQueueName.ActivityParsing,
      label: t("activity_processing"),
      description: t("activity_processing_description"),
      icon: FileChartColumnIncreasing,
    },
    {
      key: JobQueueName.BackgroundTask,
      label: t("imports_and_tasks"),
      description: t("imports_and_tasks_description"),
      icon: Archive,
    },
    {
      key: JobQueueName.ImageProcessing,
      label: t("image_processing"),
      description: t("image_processing_description"),
      icon: Image,
    },
    {
      key: JobQueueName.Storage,
      label: t("storage_tasks"),
      description: t("storage_tasks_description"),
      icon: HardDrive,
    },
  ] as const;

  const jobTranslationKeys = {
    ActivityUpload: "job_name_activity_upload",
    ActivityMetricCompute: "job_name_activity_metric_compute",
    ActivityBestEffortCompute: "job_name_activity_best_effort_compute",
    ActivityBestEffortRank: "job_name_activity_best_effort_rank",
    ActivityRouteMatchCompute: "job_name_activity_route_match_compute",
    ActivityParse: "job_name_activity_parse",
    ActivityManualCreate: "job_name_activity_manual_create",
    ActivityParseQueueAll: "job_name_activity_parse_queue_all",
    ActivityDelete: "job_name_activity_delete",
    ActivityImageIngest: "job_name_activity_image_ingest",
    ActivityImageAttach: "job_name_activity_image_attach",
    ActivityImageGenerateThumbnails:
      "job_name_activity_image_generate_thumbnails",
    ActivityImageGenerateQueueAll: "job_name_activity_image_generate_queue_all",
    LagomTakeoutImport: "job_name_lagom_takeout_import",
    UserAvatarUpload: "job_name_user_avatar_upload",
    FileDelete: "job_name_file_delete",
    TemporaryFileCleanup: "job_name_temporary_file_cleanup",
  } as const;

  async function refresh(silent = false) {
    if (refreshing) {
      refreshQueued = true;
      return;
    }
    refreshing = true;
    if (!silent) error = "";
    try {
      const [nextQueues, nextHistory] = await Promise.all([
        jobControllerGetAllJobStatus(getSdkRequestOptions()),
        jobControllerGetJobHistory({ limit: 75 }, getSdkRequestOptions()),
      ]);
      queues = nextQueues;
      history = nextHistory.jobs;
      error = "";
    } catch {
      if (!silent) error = t("job_dashboard_load_error");
    } finally {
      refreshing = false;
      if (refreshQueued) {
        refreshQueued = false;
        void refresh(true);
      }
    }
  }

  function jobLabel(name: string) {
    const key = jobTranslationKeys[name as keyof typeof jobTranslationKeys];
    return key ? t(key) : name;
  }

  function queueLabel(queue: string) {
    return queueDefinitions.find(({ key }) => key === queue)?.label ?? queue;
  }

  function statusLabel(
    status: JobHistoryResponseDtoOutput["jobs"][number]["status"],
  ) {
    switch (status) {
      case "queued":
        return t("job_status_queued");
      case "running":
        return t("job_status_running");
      case "succeeded":
        return t("job_status_succeeded");
      case "failed":
        return t("job_status_failed");
      case "skipped":
        return t("job_status_skipped");
    }
  }

  function duration(milliseconds: number | null) {
    if (milliseconds == null) return "—";
    if (milliseconds < 1000) return `${milliseconds} ms`;
    const seconds = milliseconds / 1000;
    return seconds < 60
      ? `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`
      : `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  }

  function timestamp(value: string) {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(new Date(value));
  }

  onMount(() => {
    return subscribeToJobEvents(data.eventsUrl, () => void refresh(true));
  });
</script>

<svelte:head><title>{t("job_queues")} · Kondis</title></svelte:head>

<div class="page-shell job-dashboard">
  <header class="page-header job-dashboard-header">
    <div>
      <span class="eyebrow">{t("administration")}</span>
      <h1>{t("job_queues")}</h1>
      <p>{t("job_queues_description")}</p>
    </div>
    <button
      class="job-refresh"
      type="button"
      onclick={() => refresh()}
      disabled={refreshing}
    >
      <RefreshCw size={17} class={refreshing ? "spinning" : undefined} />
      {t("refresh")}
    </button>
  </header>

  {#if error}<p class="job-dashboard-error" role="alert">
      <CircleAlert size={17} />
      {error}
    </p>{/if}

  <section class="job-queue-grid" aria-label={t("job_queue_status")}>
    {#each queueDefinitions as definition}
      {@const report = queues[definition.key]}
      <article class="job-queue-card">
        <div class="job-queue-heading">
          <span class="job-queue-icon"><definition.icon size={21} /></span>
          <div>
            <h2>{definition.label}</h2>
            <p>{definition.description}</p>
          </div>
        </div>
        <div class="job-counts">
          <div>
            <span>{t("active")}</span><strong>{report.jobCounts.active}</strong>
          </div>
          <div>
            <span>{t("waiting")}</span><strong>{report.jobCounts.queued}</strong
            >
          </div>
          <div class:has-failures={report.jobCounts.failed > 0}>
            <span>{t("failed")}</span><strong>{report.jobCounts.failed}</strong>
          </div>
        </div>
      </article>
    {/each}
  </section>

  <section class="job-history-section">
    <div class="job-history-heading">
      <div>
        <h2><ListChecks size={20} /> {t("recent_jobs")}</h2>
        <p>{t("recent_jobs_description")}</p>
      </div>
    </div>

    {#if history.length === 0}
      <div class="job-history-empty">
        <Database size={28} />
        <strong>{t("no_job_history")}</strong>
        <p>{t("no_job_history_description")}</p>
      </div>
    {:else}
      <div class="job-history-table" role="table">
        <div class="job-history-row job-history-columns" role="row">
          <span role="columnheader">{t("job")}</span>
          <span role="columnheader">{t("queue")}</span>
          <span role="columnheader">{t("status")}</span>
          <span role="columnheader">{t("started")}</span>
          <span role="columnheader">{t("duration")}</span>
        </div>
        {#each history as job (job.id)}
          <div class="job-history-row" role="row">
            <span class="job-history-name" role="cell">
              {#if job.activityId}
                <a href={`/activities/${job.activityId}`}><strong
                    >{jobLabel(job.name)}</strong
                  ></a>
              {:else}
                <strong>{jobLabel(job.name)}</strong>
              {/if}
              {#if job.attempt > 1}<small
                  >{t("attempt_number", { number: job.attempt })}</small
                >{/if}
            </span>
            <span role="cell">{queueLabel(job.queue)}</span>
            <span role="cell"
              ><span class="job-status status-{job.status}"
                >{statusLabel(job.status)}</span
              ></span
            >
            <span role="cell"
              ><time datetime={job.startedAt ?? job.createdAt}
                >{timestamp(job.startedAt ?? job.createdAt)}</time
              ></span
            >
            <span role="cell">{duration(job.durationMs)}</span>
            {#if job.error}
              <details class="job-error-detail">
                <summary>{t("view_error")}</summary>
                <p>{job.error}</p>
              </details>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </section>
</div>
