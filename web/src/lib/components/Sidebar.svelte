<script lang="ts">
  import { Activity, Trophy } from "@lucide/svelte";
  import { goto } from "$app/navigation";
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
    event.preventDefault();
    window.dispatchEvent(new Event("kondis:clear-search"));
    if (page.url.pathname !== "/" || page.url.search)
      void goto("/", { replaceState: true });
  }
</script>

<aside class="sidebar">
  <a class="brand" href="/" onclick={goHome} aria-label="Kondis home">
    <span class="brand-mark" aria-hidden="true">😰</span>
    <span>kondis</span>
  </a>

  <nav aria-label="Primary navigation">
    {#each items as item}
      <a
        class:active={item.section
          ? page.url.pathname.startsWith(item.section)
          : page.url.pathname === item.href}
        href={item.href}
        onclick={item.href === "/" ? goHome : undefined}
      >
        <item.icon size={19} />
        {item.label}
      </a>
    {/each}
  </nav>
</aside>

<nav class="mobile-nav" aria-label="Mobile navigation">
  <a class:active={page.url.pathname === "/"} href="/" onclick={goHome}
    ><Activity size={21} /><span>Activities</span></a
  >
  <a
    class:active={page.url.pathname.startsWith("/best-efforts")}
    href="/best-efforts/run/5k"><Trophy size={21} /><span>Best efforts</span></a
  >
</nav>
