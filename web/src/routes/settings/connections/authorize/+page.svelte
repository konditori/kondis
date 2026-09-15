<script lang="ts">
  import { onMount } from "svelte";
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
            "This authorization request is invalid or has expired.",
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
      if (!response.ok) throw new Error("Could not authorize this app.");
      window.location.assign((await response.json()).redirect);
    } catch (e) {
      error = e instanceof Error ? e.message : "Could not authorize this app.";
      busy = false;
    }
  }
  const labels: Record<string, string> = {
    "profile:read": "Read your profile and preferences",
    "activities:read": "Read your activities and training summaries",
    "location:read": "Read your GPS coordinates",
    "activities:write": "Create and edit your activities",
    "activities:import": "Import activity files",
  };
</script>

<svelte:head
  ><title>Authorize an app · Kondis</title><meta
    name="referrer"
    content="no-referrer"
  /></svelte:head
>
<main class="page-shell">
  <h1>Connect {clientName || "an app"}</h1>
  {#if error}<p role="alert">{error}</p>{/if}
  {#if clientName}<p>This app is requesting permission to:</p>
    <ul>
      {#each scopes as scope}<li>{labels[scope] ?? scope}</li>{/each}
    </ul>
    <p>You can revoke this access in Connected apps at any time.</p>
    <button disabled={busy} onclick={() => decide(true)}>Allow access</button>
    <button disabled={busy} onclick={() => decide(false)}>Cancel</button>
  {:else if !error}<p>Loading request…</p>{/if}
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
