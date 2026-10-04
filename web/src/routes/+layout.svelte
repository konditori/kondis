<script lang="ts">
  import "../app.css";
  import { goto } from "$app/navigation";
  import Sidebar from "$lib/components/Sidebar.svelte";
  import Topbar from "$lib/components/Topbar.svelte";
  import { t } from "$lib/i18n";
  import { setContext } from "svelte";
  import { localeContext } from "$lib/locale";

  let { children, data } = $props();
  setContext(localeContext, () => data.locale);
</script>

<svelte:head
  ><title>{t("app_name")}</title><meta
    name="description"
    content={t("app_description")}
  /></svelte:head
>

{#if !data.authenticated}
  {@render children()}
{:else}
  <Sidebar user={data.user} />
  <Topbar
    user={data.user}
    eventsUrl={data.eventsUrl}
    onUpload={() => void goto("/upload")}
  />
  <main class="app-main">{@render children()}</main>
{/if}
