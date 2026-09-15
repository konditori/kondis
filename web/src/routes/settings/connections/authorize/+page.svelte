<script lang="ts">
  import { onMount } from "svelte";
  import { t } from "$lib/i18n";
  let clientName = $state("");
  let scopes = $state<string[]>([]);
  let request = $state<Record<string, string>>({});
  let error = $state("");
  let busy = $state(false);
  onMount(() => {
    void fetch(`/api/v1/connections/authorize${window.location.search}`)
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            t("authorization_request_invalid"),
          );
        const data = await response.json();
        clientName = data.clientName;
        scopes = data.scopes;
        request = data.request;
      })
      .catch((e) => {
        error = e.message;
      });
  });
  async function decide(allow: boolean) {
    busy = true;
    error = "";
    try {
      const response = await fetch("/api/v1/connections/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request, allow }),
      });
      if (!response.ok) throw new Error(t("could_not_authorize_app"));
      window.location.assign((await response.json()).redirect);
    } catch (e) {
      error = e instanceof Error ? e.message : t("could_not_authorize_app");
      busy = false;
    }
  }
  const labels: Record<string, string> = {
    "profile:read": t("authorization_scope_profile"),
    "activities:read": t("authorization_scope_activities"),
    "location:read": t("authorization_scope_location"),
    "activities:write": t("authorization_scope_write"),
    "activities:import": t("authorization_scope_import"),
  };
</script>

<svelte:head
  ><title>{t("authorize_an_app")} · Kondis</title><meta
    name="referrer"
    content="no-referrer"
  /></svelte:head
>
<main class="page-shell">
  <h1>{t("connect_app", { app: clientName || t("an_app") })}</h1>
  {#if error}<p role="alert">{error}</p>{/if}
  {#if clientName}<p>{t("app_requesting_permission")}</p>
    <ul>
      {#each scopes as scope}<li>{labels[scope] ?? scope}</li>{/each}
    </ul>
    <p>{t("revoke_access_anytime")}</p>
    <button disabled={busy} onclick={() => decide(true)}>{t("allow_access")}</button>
    <button disabled={busy} onclick={() => decide(false)}>{t("common_cancel")}</button>
  {:else if !error}<p>{t("loading_request")}</p>{/if}
</main>

<style>
  main {
    max-width: 650px;
    margin: 3rem auto;
    padding: 2rem;
  }
  button {
    padding: 0.7rem 1rem;
    margin: 0.5rem;
  }
</style>
