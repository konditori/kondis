<script lang="ts">
  import { Activity, HeartPulse, Trophy } from "@lucide/svelte";
  import { page } from "$app/state";

  const items = [
    { href: "/", label: "Activities", icon: Activity, section: null },
    {
      href: "/best-efforts/run/5k",
      label: "Best efforts",
      icon: Trophy,
      section: "/best-efforts",
    },
  ];

  function goHome(event: MouseEvent) {
    // The activities search is local page state, so navigating to the current
    // route would otherwise leave the existing results rendered.
    if (page.url.pathname === "/") {
      event.preventDefault();
      window.dispatchEvent(new Event("kondis:clear-search"));
    }
  }
</script>

<aside class="sidebar">
  <a class="brand" href="/" onclick={goHome} aria-label="Kondis home">
    <span class="brand-mark"><HeartPulse size={22} strokeWidth={2.5} /></span>
    <span>kondis</span>
  </a>

  <nav aria-label="Primary navigation">
    {#each items as item}
      <a
        class:active={item.section
          ? page.url.pathname.startsWith(item.section)
          : page.url.pathname === item.href}
        href={item.href}
      >
        <item.icon size={19} />
        {item.label}
      </a>
    {/each}
  </nav>
</aside>

<nav class="mobile-nav" aria-label="Mobile navigation">
  <a class:active={page.url.pathname === "/"} href="/"
    ><Activity size={21} /><span>Activities</span></a
  >
  <a
    class:active={page.url.pathname.startsWith("/best-efforts")}
    href="/best-efforts/run/5k"><Trophy size={21} /><span>Best efforts</span></a
  >
</nav>
