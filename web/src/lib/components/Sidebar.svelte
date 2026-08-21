<script lang="ts">
  import { Activity, Trophy, Users } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { t } from "$lib/i18n";

  const items = [
    { href: "/", label: t("home"), icon: Activity, section: null },
    {
      href: "/best-efforts",
      label: t("best_efforts"),
      icon: Trophy,
      section: "/best-efforts",
    },
    { href: "/people", label: t("people"), icon: Users, section: "/people" },
  ];

  function goHome(event: MouseEvent) {
    event.preventDefault();
    window.dispatchEvent(new Event("kondis:clear-search"));
    if (page.url.pathname !== "/" || page.url.search)
      void goto("/", { replaceState: true });
  }
</script>

<aside class="sidebar">
  <a
    class="brand"
    href="/"
    data-sveltekit-preload-data="hover"
    onclick={goHome}
    aria-label={t("kondis_home")}
  >
    <span class="brand-mark" aria-hidden="true">😰</span>
    <span>{t("app_name")}</span>
  </a>

  <nav aria-label={t("primary_navigation")}>
    {#each items as item}
      <a
        class:active={item.section
          ? page.url.pathname.startsWith(item.section)
          : page.url.pathname === item.href}
        href={item.href}
        data-sveltekit-preload-data={item.href === "/" ? "hover" : undefined}
        onclick={item.href === "/" ? goHome : undefined}
      >
        <item.icon size={19} />
        {item.label}
      </a>
    {/each}
  </nav>
</aside>

<nav class="mobile-nav" aria-label={t("mobile_navigation")}>
  <a
    class:active={page.url.pathname === "/"}
    href="/"
    data-sveltekit-preload-data="hover"
    onclick={goHome}
    ><Activity size={21} /><span>{t("home")}</span></a
  >
  <a
    class:active={page.url.pathname.startsWith("/best-efforts")}
    href="/best-efforts"><Trophy size={21} /><span>{t("best_efforts")}</span></a
  >
  <a class:active={page.url.pathname.startsWith("/people")} href="/people"
    ><Users size={21} /><span>{t("people")}</span></a
  >
</nav>
