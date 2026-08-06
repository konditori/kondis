<script lang="ts">
  import { Activity, ChartNoAxesColumnIncreasing, CircleUserRound, HeartPulse, Settings, Upload } from '@lucide/svelte';
  import { page } from '$app/state';

  let { onUpload }: { onUpload: () => void } = $props();

  const items = [
    { href: '/', label: 'Activities', icon: Activity },
    { href: '/insights', label: 'Insights', icon: ChartNoAxesColumnIncreasing, disabled: true },
  ];
</script>

<aside class="sidebar">
  <a class="brand" href="/" aria-label="Kondis home">
    <span class="brand-mark"><HeartPulse size={22} strokeWidth={2.5} /></span>
    <span>kondis</span>
  </a>

  <button class="import-button" onclick={onUpload}>
    <Upload size={18} />
    Import activity
  </button>

  <nav aria-label="Primary navigation">
    {#each items as item}
      <a class:active={page.url.pathname === item.href} class:disabled={item.disabled} href={item.href} aria-disabled={item.disabled}>
        <item.icon size={19} />
        {item.label}
      </a>
    {/each}
  </nav>

  <div class="sidebar-bottom">
    <a href="/settings" aria-disabled="true" class="disabled"><Settings size={19} /> Settings</a>
    <div class="profile">
      <CircleUserRound size={32} />
      <span><strong>Local athlete</strong><small>Self-hosted</small></span>
    </div>
  </div>
</aside>

<nav class="mobile-nav" aria-label="Mobile navigation">
  <a class:active={page.url.pathname === '/'} href="/"><Activity size={21} /><span>Activities</span></a>
  <button onclick={onUpload}><span class="mobile-upload"><Upload size={21} /></span><span>Import</span></button>
  <a class="disabled" href="/insights"><ChartNoAxesColumnIncreasing size={21} /><span>Insights</span></a>
</nav>
