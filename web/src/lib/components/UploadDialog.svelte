<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { Check, FileUp, LoaderCircle, X } from '@lucide/svelte';

  let { open = $bindable(false) }: { open: boolean } = $props();
  let input = $state<HTMLInputElement>();
  let dragging = $state(false);
  let uploads = $state<
    { file: File; uploadId?: string; state: 'waiting' | 'uploading' | 'processing' | 'done' | 'error'; message?: string }[]
  >([]);

  function close() {
    if (!uploads.some((item) => item.state === 'uploading')) open = false;
  }

  async function addFiles(files: FileList | File[]) {
    const acceptedExtensions = ['.fit', '.tcx', '.gpx', '.zip'];
    const accepted = [...files].filter((file) => acceptedExtensions.some((extension) => file.name.toLowerCase().endsWith(extension)));
    uploads = accepted.map((file) => ({ file, state: 'waiting' }));

    for (const item of uploads) {
      item.state = 'uploading';
      const form = new FormData();
      form.append('file', item.file);
      try {
        const takeout = item.file.name.toLowerCase().endsWith('.zip');
        const response = await fetch(takeout ? '/api/uploads/strava' : '/api/uploads/activity', { method: 'POST', body: form });
        if (!response.ok) throw new Error((await response.text()) || `Upload failed (${response.status})`);
        if (takeout) {
          const result = (await response.json()) as { imported: number; duplicates: number; skipped: number; failed: number };
          item.message = `${result.imported} queued, ${result.duplicates} duplicate, ${result.skipped} skipped${result.failed ? `, ${result.failed} failed` : ''}`;
          item.state = result.failed ? 'error' : 'done';
        } else {
          const result = (await response.json()) as { id: string };
          item.uploadId = result.id;
          item.state = 'processing';
        }
      } catch (error) {
        item.state = 'error';
        item.message = error instanceof Error ? error.message : 'Upload failed';
      }
    }

    const pending = uploads.filter((item) => item.state === 'processing');
    for (let attempt = 0; pending.length && attempt < 50; attempt++) {
      const response = await fetch('/api/activities');
      if (response.ok) {
        const body = (await response.json()) as { activities: { uploadId: string }[] };
        for (const item of pending) {
          if (body.activities.some((activity) => activity.uploadId === item.uploadId)) item.state = 'done';
        }
        if (pending.every((item) => item.state === 'done')) break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    await invalidateAll();
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
        <strong>Drop activity files or a Strava takeout here</strong>
        <span>or click to browse your device</span>
        <small>.fit, .tcx, .gpx, or Strava .zip</small>
      </button>
      <input bind:this={input} class="sr-only" type="file" accept=".fit,.tcx,.gpx,.zip,application/zip,application/octet-stream,application/gpx+xml" multiple onchange={(event) => void addFiles(event.currentTarget.files ?? [])} />

      {#if uploads.length}
        <div class="upload-list">
          {#each uploads as item}
            <div class="upload-row">
              <span class="file-name">{item.file.name}<small>{(item.file.size / 1024).toFixed(0)} KB</small></span>
              {#if item.state === 'uploading'}<LoaderCircle class="spin" size={19} />
              {:else if item.state === 'processing'}<span class="processing"><LoaderCircle class="spin" size={16} /> Processing</span>
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
