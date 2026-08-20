<script lang="ts">
  import { ArrowRight, Trophy } from "@lucide/svelte";
  import { bestEffortLabel } from "$lib/best-efforts";
  import { bestEffortValue } from "$lib/format";
  import { t } from "$lib/i18n";

  let { data } = $props();
  const sports = [
    { key: "run", label: t("run") },
    { key: "ride", label: t("ride") },
  ] as const;

  function effortsFor(sport: "run" | "ride") {
    return data.efforts.filter((effort) => effort.sport === sport);
  }
</script>

<svelte:head><title>Best efforts · Kondis</title></svelte:head>

<div class="page-shell best-efforts-index-page">
  <header class="page-header">
    <div>
      <h1>{t("best_efforts")}</h1>
      <p>{t("effort_progress_description")}</p>
    </div>
  </header>

  {#if data.unavailable}
    <div class="notice">
      <Trophy size={20} /><span
        ><strong>{t("server_unavailable")}</strong>
        {t("could_not_load_best_efforts")}</span
      >
    </div>
  {:else}
    <div class="best-efforts-index-list">
      {#each sports as sport}
        {@const efforts = effortsFor(sport.key)}
        {#if efforts.length}
          <section class="best-efforts-index-section">
            <h2>{sport.label}</h2>
            <div class="best-efforts-index-table">
              {#each efforts as effort}
                <a
                  class="best-efforts-index-row"
                  href={`/best-efforts/${sport.key}/${effort.type}`}
                >
                  <strong>{bestEffortLabel(effort.type)}</strong>
                  {#if effort.best}
                    <span class="best-efforts-index-value"
                      >{bestEffortValue(
                        effort.best.value,
                        effort.valueKind,
                        data.unitSystem,
                      )}</span
                    >
                    <time datetime={effort.best.startedAt}
                      >{new Date(effort.best.startedAt).toLocaleDateString(
                        undefined,
                        { day: "numeric", month: "short", year: "numeric" },
                      )}</time
                    >
                  {:else}
                    <span class="best-efforts-index-value">—</span>
                    <span class="best-efforts-index-empty"
                      >{t("no_result_yet")}</span
                    >
                  {/if}
                  <ArrowRight size={18} />
                </a>
              {/each}
            </div>
          </section>
        {/if}
      {/each}
    </div>
  {/if}
</div>
