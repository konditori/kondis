<script lang="ts">
  import { Activity, ListChecks, Trophy, Users } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { t } from "$lib/i18n";
  import { buildInfo } from "$lib/build-info";

  let { user }: { user?: { role: "admin" | "user" } } = $props();

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

  const adminItem = {
    href: "/admin/jobs",
    label: t("job_queues"),
    icon: ListChecks,
    section: "/admin/jobs",
  };

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
    {#if user?.role === "admin"}
      <a
        class:active={page.url.pathname.startsWith(adminItem.section)}
        href={adminItem.href}
      >
        <adminItem.icon size={19} />
        {adminItem.label}
      </a>
    {/if}
  </nav>

  <div
    class="build-notice"
    title={buildInfo.revision
      ? `${buildInfo.version} · ${buildInfo.revision}`
      : buildInfo.version}
  >
    <span class="build-version">v. {buildInfo.version}</span>
    {#if buildInfo.branch}
      <span class="build-revision">{buildInfo.branch}</span>
    {/if}
    {#if buildInfo.commit}
      <span class="build-revision">{buildInfo.commit}</span>
    {:else if buildInfo.buildType === "development"}
      <span class="build-revision">Development build</span>
    {/if}
  </div>
</aside>

<nav class="mobile-nav" aria-label={t("mobile_navigation")}>
  <a
    class:active={page.url.pathname === "/"}
    href="/"
    data-sveltekit-preload-data="hover"
    onclick={goHome}><Activity size={21} /><span>{t("home")}</span></a
  >
  <a
    class:active={page.url.pathname.startsWith("/best-efforts")}
    href="/best-efforts"><Trophy size={21} /><span>{t("best_efforts")}</span></a
  >
  <a class:active={page.url.pathname.startsWith("/people")} href="/people"
    ><Users size={21} /><span>{t("people")}</span></a
  >
  {#if user?.role === "admin"}
    <a
      class:active={page.url.pathname.startsWith("/admin/jobs")}
      href="/admin/jobs"><ListChecks size={21} /><span>{t("jobs")}</span></a
    >
  {/if}
</nav>
