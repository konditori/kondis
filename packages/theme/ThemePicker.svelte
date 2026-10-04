<script lang="ts">
  import { onMount } from "svelte";
  import { observeTheme, type ThemePreference } from "./preference";

  let {
    label = "Appearance",
    system = "System",
    light = "Light",
    dark = "Dark",
    class: className = "",
  }: {
    label?: string;
    system?: string;
    light?: string;
    dark?: string;
    class?: string;
  } = $props();
  let preference = $state<ThemePreference>("system");
  let controller: ReturnType<typeof observeTheme> | undefined;
  const current = $derived(
    preference === "system" ? system : preference === "light" ? light : dark,
  );

  onMount(() => {
    controller = observeTheme((next) => (preference = next));
    return () => controller?.destroy();
  });
</script>

<label class={`appearance-picker ${className}`}>
  <span class="appearance-label">{label}</span>
  <svg viewBox="0 0 24 24" aria-hidden="true">
    {#if preference === "system"}
      <rect x="3" y="3" width="18" height="13" rx="2" /><path
        d="M8 21h8m-4-5v5"
      />
    {:else if preference === "light"}
      <circle cx="12" cy="12" r="4" /><path
        d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"
      />
    {:else}
      <path d="M20.4 15.1A8.5 8.5 0 0 1 8.9 3.6a8.5 8.5 0 1 0 11.5 11.5Z" />
    {/if}
  </svg>
  <select
    aria-label={label}
    title={`${label}: ${current}`}
    value={preference}
    onchange={(event) =>
      controller?.set(event.currentTarget.value as ThemePreference)}
  >
    <option value="system">{system}</option>
    <option value="light">{light}</option>
    <option value="dark">{dark}</option>
  </select>
</label>

<style>
  .appearance-picker {
    display: inline-flex;
    align-items: center;
    position: relative;
    gap: 6px;
    min-height: 42px;
    color: var(--text-muted);
  }
  .appearance-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    pointer-events: none;
  }
  select {
    width: 82px;
    min-height: 42px;
    padding: 0 4px;
    font: inherit;
    font-size: 13px;
    color: var(--text);
    background: var(--shell);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
  }
  select:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  @media (max-width: 420px) {
    svg {
      display: none;
    }
    select {
      width: 76px;
    }
  }
</style>
