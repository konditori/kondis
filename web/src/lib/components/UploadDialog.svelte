<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { Check, FileUp, LoaderCircle, X } from '@lucide/svelte';
  import { getSdkRequestOptions, uploadControllerUploadActivity, uploadControllerUploadStravaTakeout } from '$lib/api';
  import { subscribeToActivityEvents } from '$lib/realtime';
  import type { Activity } from '$lib/types';

  let { open = $bindable(false), eventsUrl }: { open: boolean; eventsUrl: string } = $props();
  let input = $state<HTMLInputElement>();
  let dragging = $state(false);
  let uploads = $state<
    { file: File; state: 'waiting' | 'uploading' | 'done' | 'error'; message?: string }[]
  >([]);

  function close() {
    if (!uploads.some((item) => item.state === 'uploading')) open = false;
  }

  function waitForActivityCreated(): Promise<Activity> {
    return new Promise((resolve, reject) => {
      let unsubscribe: (() => void) | undefined;
      const timeout = setTimeout(() => {
        unsubscribe?.();
        reject(new Error('Activity processing is taking longer than expected'));
      }, 60_000);
      unsubscribe = subscribeToActivityEvents(eventsUrl, (activity, type) => {
        if (type !== 'activity.created') return;
        clearTimeout(timeout);
        unsubscribe?.();
        resolve(activity);
      }, () => {});
    });
  }

  async function addFiles(files: FileList | File[]) {
    const acceptedExtensions = ['.fit', '.tcx', '.gpx', '.zip'];
    const accepted = [...files].filter((file) => acceptedExtensions.some((extension) => file.name.toLowerCase().endsWith(extension)));
    uploads = accepted.map((file) => ({ file, state: 'waiting' }));

    const navigateToActivity = accepted.length === 1 && !accepted[0]?.name.toLowerCase().endsWith('.zip');
    const activityCreated = navigateToActivity ? waitForActivityCreated() : undefined;

    for (const item of uploads) {
      item.state = 'uploading';
      try {
        const takeout = item.file.name.toLowerCase().endsWith('.zip');
        await (takeout
          ? uploadControllerUploadStravaTakeout({ body: { file: item.file } }, getSdkRequestOptions())
          : uploadControllerUploadActivity({ body: { file: item.file } }, getSdkRequestOptions()));
        item.message = 'Queued';
        item.state = 'done';
      } catch (error) {
        item.state = 'error';
        item.message = error instanceof Error ? error.message : 'Upload failed';
      }
    }

    await invalidateAll();
    if (activityCreated && uploads.length === 1 && uploads[0]?.state === 'done') {
      try {
        const activity = await activityCreated;
        open = false;
        uploads = [];
        await goto(`/activities/${activity.id}`);
        return;
      } catch {
        // Keep the completed upload visible if processing does not finish promptly.
      }
    } else {
      void activityCreated?.catch(() => {});
    }
    if (uploads.every((item) => item.state === 'done')) {
      open = false;
      uploads = [];
    }
  }
</script>

{#if open}
  <div class="dialog-backdrop" role="presentation" onclick={(event) => event.target === event.currentTarget && close()}>
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="upload-title">
      <header>
        <div><span class="eyebrow">New import</span><h2 id="upload-title">Add activities</h2></div>
        <button class="icon-button" onclick={close} aria-label="Close"><X size={20} /></button>
      </header>

      <button
        class:dragging
        class="drop-zone"
        onclick={() => input?.click()}
        ondragover={(event) => { event.preventDefault(); dragging = true; }}
        ondragleave={() => (dragging = false)}
        ondrop={(event) => { event.preventDefault(); dragging = false; void addFiles(event.dataTransfer?.files ?? []); }}
      >
        <span class="upload-icon"><FileUp size={28} /></span>
        <strong>Drop activity files or an archive here</strong>
        <span>or click to browse your device</span>
        <small>.fit, .tcx, .gpx, or a Strava takeout .zip</small>
      </button>
      <input bind:this={input} class="sr-only" type="file" accept=".fit,.tcx,.gpx,.zip,application/zip,application/octet-stream,application/gpx+xml" multiple onchange={(event) => void addFiles(event.currentTarget.files ?? [])} />

      {#if uploads.length}
        <div class="upload-list">
          {#each uploads as item}
            <div class="upload-row">
              <span class="file-name">{item.file.name}<small>{(item.file.size / 1024).toFixed(0)} KB</small></span>
              {#if item.state === 'uploading'}<LoaderCircle class="spin" size={19} />
              {:else if item.state === 'done'}<span class="processing"><Check class="success" size={16} /> {item.message ?? 'Done'}</span>
              {:else if item.state === 'error'}<span class="error" title={item.message}>{item.message ?? 'Failed'}</span>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
