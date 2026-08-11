<script lang="ts">
  import { Check, Gauge, Ruler } from '@lucide/svelte';
  import { untrack } from 'svelte';
  import type { UnitSystem } from '$lib/units';

  let { data, form } = $props();
  let selected = $state<UnitSystem>(untrack(() => data.unitSystem));
</script>

<svelte:head><title>Settings · Kondis</title></svelte:head>

<div class="page-shell settings-page">
  <header class="page-header">
    <div><span class="eyebrow">Local athlete</span><h1>Settings</h1><p>Choose how Kondis displays your activity data.</p></div>
  </header>

  <form method="POST" class="settings-panel">
    <div class="settings-heading">
      <span class="settings-icon"><Ruler size={21} /></span>
      <div><h2>Units of measurement</h2><p>This preference is stored in this browser until user accounts are available.</p></div>
    </div>

    <fieldset class="unit-options">
      <legend>Display units</legend>
      <label class:selected={selected === 'metric'}>
        <input type="radio" name="unitSystem" value="metric" bind:group={selected} />
        <span><strong>Metric</strong><small>Kilometers, meters, km/h, and min/km</small></span>
        {#if selected === 'metric'}<Check size={19} />{/if}
      </label>
      <label class:selected={selected === 'imperial'}>
        <input type="radio" name="unitSystem" value="imperial" bind:group={selected} />
        <span><strong>Imperial</strong><small>Miles, feet, mph, and min/mile</small></span>
        {#if selected === 'imperial'}<Check size={19} />{/if}
      </label>
    </fieldset>

    <div class="settings-actions">
      <button type="submit"><Gauge size={17} /> Save preference</button>
      {#if form?.saved}<span class="settings-saved" role="status"><Check size={16} /> Saved</span>{/if}
      {#if form?.error}<span class="settings-error" role="alert">{form.error}</span>{/if}
    </div>
  </form>
</div>
