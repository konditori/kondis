<script lang="ts">
  import {
    Archive,
    ChevronLeft,
    ChevronRight,
    CircleAlert,
    Clock3,
    Database,
    FileChartColumnIncreasing,
    HardDrive,
    Image,
    ListChecks,
  } from "@lucide/svelte";
  import { replaceState } from "$app/navigation";
  import { onMount, untrack } from "svelte";
  import {
    getSdkRequestOptions,
    jobControllerGetAllJobStatus,
    jobControllerGetJobHistory,
    JobQueueName,
    type AllJobStatusResponseDtoOutput,
    type JobHistoryResponseDtoOutput,
  } from "$lib/api";
  import { relativeOrDateTime } from "$lib/format";
  import { t } from "$lib/i18n";
  import { subscribeToJobEvents } from "$lib/realtime";

  const HISTORY_PAGE_SIZE = 75;
  const EVENT_REFRESH_INTERVAL_MS = 1_000;
  const GRAPH_BUCKET_MS = 15_000;
  const GRAPH_BUCKETS = 20;
  const GRAPH_WIDTH = 500;
  const GRAPH_BASELINE = 144;
  const GRAPH_HEIGHT = 62;
  let { data } = $props();
  let queues = $state<AllJobStatusResponseDtoOutput>(
    untrack(() => data.queues),
  );
  let history = $state<JobHistoryResponseDtoOutput["jobs"]>(
    untrack(() => data.history.jobs),
  );
  let totalHistory = $state(untrack(() => data.history.total));
  let historyOffset = $state(untrack(() => data.historyOffset));
  let pageInput = $state(
    untrack(() => Math.floor(data.historyOffset / HISTORY_PAGE_SIZE) + 1),
  );
  let historyLoading = $state(false);
  let currentTime = $state(new Date());
  let refreshInFlight = false;
  let refreshPending = false;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let lastRefreshStartedAt = 0;
  let disposed = false;
  let error = $state("");
  let totalPages = $derived(
    Math.max(1, Math.ceil(totalHistory / HISTORY_PAGE_SIZE)),
  );
  let currentPage = $derived(Math.floor(historyOffset / HISTORY_PAGE_SIZE) + 1);
  let canLoadMore = $derived(
    historyOffset === 0 && history.length < totalHistory,
  );

  function updateHistoryUrl({
    page,
    count,
  }: {
    page?: number;
    count?: number;
  }) {
    const url = new URL(window.location.href);
    url.searchParams.delete("jobsPage");
    url.searchParams.delete("jobsCount");
    if (page && page > 1) url.searchParams.set("jobsPage", String(page));
    if (count && count > HISTORY_PAGE_SIZE) {
      url.searchParams.set("jobsCount", String(count));
    }
    replaceState(url, {});
  }

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

  async function refresh() {
    if (refreshInFlight) {
      refreshPending = true;
      return;
    }
    refreshInFlight = true;
    lastRefreshStartedAt = Date.now();
    try {
      const options = getSdkRequestOptions();
      const historyLimit =
        historyOffset === 0
          ? Math.min(Math.max(history.length, HISTORY_PAGE_SIZE), 200)
          : HISTORY_PAGE_SIZE;
      const [nextQueues, nextHistory] = await Promise.all([
        jobControllerGetAllJobStatus(options),
        jobControllerGetJobHistory(
          { limit: historyLimit, offset: historyOffset },
          options,
        ),
      ]);
      queues = nextQueues;
      history = nextHistory.jobs;
      totalHistory = nextHistory.total;
      currentTime = new Date();
      error = "";
    } catch {
      // A later job event will retry. Keep the last usable dashboard state.
    } finally {
      refreshInFlight = false;
      if (refreshPending) {
        refreshPending = false;
        scheduleRefresh();
      }
    }
  }

  function scheduleRefresh() {
    if (disposed || refreshTimer) return;
    const delay = Math.max(
      0,
      EVENT_REFRESH_INTERVAL_MS - (Date.now() - lastRefreshStartedAt),
    );
    refreshTimer = setTimeout(() => {
      refreshTimer = undefined;
      void refresh();
    }, delay);
  }

  function jobLabel(name: string) {
    const key = jobTranslationKeys[name as keyof typeof jobTranslationKeys];
    return key ? t(key) : name;
  }

  function queueLabel(queue: string) {
    return queueDefinitions.find(({ key }) => key === queue)?.label ?? queue;
  }

  function queueGraph(queue: string, now: Date) {
    const buckets = Array.from({ length: GRAPH_BUCKETS }, () => 0);
    const windowEnd =
      Math.floor(now.getTime() / GRAPH_BUCKET_MS) * GRAPH_BUCKET_MS +
      GRAPH_BUCKET_MS;
    const windowStart = windowEnd - GRAPH_BUCKETS * GRAPH_BUCKET_MS;

    for (const job of history) {
      if (job.queue !== queue) continue;
      const timestamp = Date.parse(job.startedAt ?? job.createdAt);
      if (
        !Number.isFinite(timestamp) ||
        timestamp < windowStart ||
        timestamp >= windowEnd
      ) {
        continue;
      }
      const bucket = Math.floor((timestamp - windowStart) / GRAPH_BUCKET_MS);
      buckets[bucket] += 1;
    }

    const maximum = Math.max(...buckets, 1);
    const points = buckets.map((count, index) => {
      const x = (index / (GRAPH_BUCKETS - 1)) * GRAPH_WIDTH;
      const y = GRAPH_BASELINE - (count / maximum) * GRAPH_HEIGHT;
      return `${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    const line = `M${points.join(" L")}`;
    return {
      line,
      area: `${line} L${GRAPH_WIDTH} 150 L0 150 Z`,
    };
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

  async function loadHistoryPage(page: number, append = false) {
    if (historyLoading) return;
    historyLoading = true;
    error = "";
    const offset = append ? history.length : (page - 1) * HISTORY_PAGE_SIZE;
    try {
      const nextHistory = await jobControllerGetJobHistory(
        { limit: HISTORY_PAGE_SIZE, offset },
        getSdkRequestOptions(),
      );
      history = append ? [...history, ...nextHistory.jobs] : nextHistory.jobs;
      totalHistory = nextHistory.total;
      historyOffset = append ? 0 : offset;
      pageInput = append ? 1 : page;
      updateHistoryUrl(append ? { count: history.length } : { page });
    } catch {
      error = t("job_dashboard_load_error");
    } finally {
      historyLoading = false;
    }
  }

  function goToPage() {
    const page = Math.min(Math.max(1, pageInput), totalPages);
    pageInput = page;
    if (page !== currentPage || historyOffset === 0) {
      void loadHistoryPage(page);
    }
  }

  onMount(() => {
    const unsubscribe = subscribeToJobEvents(data.eventsUrl, scheduleRefresh);
    const clock = setInterval(() => {
      currentTime = new Date();
    }, GRAPH_BUCKET_MS);

    return () => {
      disposed = true;
      unsubscribe();
      clearInterval(clock);
      clearTimeout(refreshTimer);
    };
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
  </header>

  {#if error}<p class="job-dashboard-error" role="alert">
      <CircleAlert size={17} />
      {error}
    </p>{/if}

  <section class="job-queue-grid" aria-label={t("job_queue_status")}>
    {#each queueDefinitions as definition}
      {@const report = queues[definition.key]}
      {@const graph = queueGraph(definition.key, currentTime)}
      <article class="job-queue-card">
        <svg
          class="job-queue-graph"
          viewBox="0 0 500 150"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path class="job-queue-graph-area" d={graph.area} />
          <path class="job-queue-graph-line" d={graph.line} />
        </svg>
        <div class="job-queue-content">
          <div class="job-queue-heading">
            <span class="job-queue-icon"><definition.icon size={21} /></span>
            <div>
              <h2>{definition.label}</h2>
              <p>{definition.description}</p>
            </div>
          </div>
          <div class="job-counts">
            <div>
              <span>{t("active")}</span><strong
                >{report.jobCounts.active}</strong
              >
            </div>
            <div>
              <span>{t("waiting")}</span><strong
                >{report.jobCounts.queued}</strong
              >
            </div>
            <div class:has-failures={report.jobCounts.failed > 0}>
              <span>{t("failed")}</span><strong
                >{report.jobCounts.failed}</strong
              >
            </div>
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
                <a href={`/activities/${job.activityId}`}
                  ><strong>{jobLabel(job.name)}</strong></a
                >
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
                >{relativeOrDateTime(
                  job.startedAt ?? job.createdAt,
                  currentTime,
                )}</time
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
      <div class="job-history-pagination">
        <span class="job-history-count">
          {t("jobs_shown", { shown: history.length, total: totalHistory })}
        </span>
        <div class="job-history-actions">
          {#if canLoadMore}
            <button
              class="job-page-button"
              type="button"
              onclick={() => void loadHistoryPage(2, true)}
              disabled={historyLoading}
            >
              {t("load_more")}
            </button>
          {/if}
          {#if totalPages > 1}
            <button
              class="job-icon-button"
              type="button"
              aria-label={t("previous_page")}
              onclick={() => {
                pageInput = currentPage - 1;
                void loadHistoryPage(currentPage - 1);
              }}
              disabled={historyLoading || currentPage <= 1}
            >
              <ChevronLeft size={16} />
            </button>
            <label class="job-page-input">
              <span>{t("page")}</span>
              <input
                type="number"
                min="1"
                max={totalPages}
                bind:value={pageInput}
                onkeydown={(event) => {
                  if (event.key === "Enter") goToPage();
                }}
                aria-label={t("go_to_page")}
              />
              <span>{t("of_pages", { total: totalPages })}</span>
            </label>
            <button
              class="job-icon-button"
              type="button"
              aria-label={t("next_page")}
              onclick={() => {
                pageInput = currentPage + 1;
                void loadHistoryPage(currentPage + 1);
              }}
              disabled={historyLoading || currentPage >= totalPages}
            >
              <ChevronRight size={16} />
            </button>
          {/if}
        </div>
      </div>
    {/if}
  </section>
</div>
