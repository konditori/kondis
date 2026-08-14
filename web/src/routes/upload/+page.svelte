<script lang="ts">
  import { Archive, ArrowRight, FileUp } from "@lucide/svelte";

  const choices = [
    {
      href: "/upload/activity",
      title: "Individual workout file",
      description: "Upload one .fit, .tcx, or .gpx file.",
      icon: FileUp,
    },
    {
      href: "/upload/strava",
      title: "Strava takeout",
      description: "Import your activities from a Strava .zip export.",
      icon: Archive,
    },
  ];
</script>

<svelte:head><title>Upload activity · Kondis</title></svelte:head>

<div class="page-shell upload-page">
  <header class="page-header">
    <div>
      <span class="eyebrow">New import</span>
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
