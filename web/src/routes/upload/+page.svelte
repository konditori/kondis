<script lang="ts">
  import { Archive, ArrowRight, FileUp } from "@lucide/svelte";
  import { t } from "$lib/i18n";

  const choices = [
    {
      href: "/upload/activity",
      title: t("individual_activity_file"),
      description: t("upload_one_file"),
      icon: FileUp,
    },
    {
      href: "/upload/strava",
      title: t("strava_takeout"),
      description: t("activity_import_strava_description"),
      icon: Archive,
    },
  ];
</script>

<svelte:head><title>Upload activity · Kondis</title></svelte:head>

<div class="page-shell upload-page">
  <header class="page-header">
    <div>
      <span class="eyebrow">{t("new_import")}</span>
      <h1>Upload activity</h1>
      <p>Choose how you want to add workouts to your archive.</p>
    </div>
  </header>

  <div class="upload-choices">
    {#each choices as choice}
      <a class="upload-choice" href={choice.href}>
        <span class="upload-choice-icon"><choice.icon size={24} /></span>
        <span class="upload-choice-copy">
          <strong>{choice.title}</strong>
          <small>{choice.description}</small>
        </span>
        <ArrowRight class="upload-choice-arrow" size={20} />
      </a>
    {/each}
  </div>
</div>
