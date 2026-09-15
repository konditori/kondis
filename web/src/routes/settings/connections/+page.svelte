<script lang="ts">
  import { onMount } from "svelte";

  type Connection = {
    id: string;
    name: string;
    kind: string;
    scopes: string[];
    expiresAt: string;
    lastUsedAt: string | null;
    revokedAt: string | null;
  };
  const scopes = [
    { value: "profile:read", label: "Read profile and preferences" },
    {
      value: "activities:read",
      label: "Read activities and training summaries",
    },
    { value: "location:read", label: "Read GPS coordinates" },
    { value: "activities:write", label: "Create and edit activities" },
    { value: "activities:import", label: "Import activity files" },
  ];
  let connections = $state<Connection[]>([]);
  let endpoint = $state<string | null>(null);
  let name = $state("");
  let selected = $state(["profile:read", "activities:read"]);
  let expiresInDays = $state(90);
  let secret = $state("");
  let error = $state("");
  let busy = $state(false);
  let loaded = $state(false);
  let timezone = $state(Intl.DateTimeFormat().resolvedOptions().timeZone);
  let units = $state("metric");
  let saved = $state(false);

  async function request(path: string, init?: RequestInit) {
    const response = await fetch(`/api/v1/connections${path}`, init);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message ?? "Could not update connections.");
    }
    return response.status === 204 ? null : response.json();
  }
  async function refresh() {
    const result = await request("");
    connections = result.connections;
    endpoint = result.endpoint;
  }
  onMount(() => {
    void Promise.all([
      refresh(),
      request("/preferences").then((p) => {
        timezone = p.timezone;
        units = p.units;
      }),
    ])
      .catch((e) => {
        error = e.message;
      })
      .finally(() => {
        loaded = true;
      });
  });
  async function create() {
    busy = true;
    error = "";
    secret = "";
    try {
      const result = await request("", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, scopes: selected, expiresInDays }),
      });
      secret = result.secret;
      name = "";
      await refresh();
    } catch (e) {
      error = e instanceof Error ? e.message : "Could not create key.";
    } finally {
      busy = false;
    }
  }
  async function revoke(id: string) {
    busy = true;
    error = "";
    try {
      await request(`/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      await refresh();
    } catch (e) {
      error = e instanceof Error ? e.message : "Could not revoke connection.";
    } finally {
      busy = false;
    }
  }
  async function savePreferences() {
    busy = true;
    error = "";
    saved = false;
    try {
      await request("/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone, units }),
      });
      saved = true;
    } catch (e) {
      error = e instanceof Error ? e.message : "Could not save preferences.";
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Connected apps · Kondis</title></svelte:head>
<main class="page-shell connections-page">
  <a href="/settings">← Settings</a>
  <h1>Connected apps</h1>
  <p>
    Give an assistant access to your training history. Choose what each
    connection can read or change.
  </p>
  {#if error}<p role="alert" class="error">{error}</p>{/if}
  {#if !loaded}<p>Loading connections…</p>{:else}
    <section>
      <h2>Connect an assistant</h2>
      {#if endpoint}<p>MCP server URL: <code>{endpoint}</code></p>
      {:else}<p>
          Your server administrator needs to enable MCP before an assistant can
          connect.
        </p>{/if}
      <form
        onsubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <label
          >Connection name <input
            bind:value={name}
            required
            maxlength="80"
            placeholder="My training assistant"
          /></label
        >
        <fieldset>
          <legend>Permissions</legend>
          {#each scopes as scope}<label class="scope"
              ><input
                type="checkbox"
                bind:group={selected}
                value={scope.value}
              />{scope.label}</label
            >{/each}
        </fieldset>
        <label
          >Expires after (days) <input
            type="number"
            bind:value={expiresInDays}
            min="1"
            max="365"
            required
          /></label
        >
        <button disabled={busy || !endpoint || selected.length === 0}
          >Create API key</button
        >
      </form>
      {#if secret}<div role="status">
          <p>Copy this key now. It will only be shown once.</p>
          <input aria-label="New API key" readonly value={secret} /><button
            type="button"
            onclick={() => {
              secret = "";
            }}>Dismiss key</button
          >
        </div>{/if}
    </section>
    <section>
      <h2>Your connections</h2>
      {#if connections.length === 0}<p>No connected apps yet.</p>{/if}
      {#each connections as connection}<article>
          <h3>{connection.name}</h3>
          <p>
            {connection.kind === "oauth" ? "Connected app" : "API key"} · {connection.revokedAt
              ? "Revoked"
              : `Expires ${new Date(connection.expiresAt).toLocaleDateString()}`}
          </p>
          <p>
            {connection.scopes
              .map((s) => scopes.find((v) => v.value === s)?.label ?? s)
              .join(" · ")}
          </p>
          {#if connection.lastUsedAt}<p>
              Last used {new Date(connection.lastUsedAt).toLocaleString()}
            </p>{/if}
          {#if !connection.revokedAt}<button
              type="button"
              disabled={busy}
              onclick={() => revoke(connection.id)}>Revoke access</button
            >{/if}
        </article>{/each}
    </section>
    <section>
      <h2>Assistant preferences</h2>
      <form
        onsubmit={(e) => {
          e.preventDefault();
          void savePreferences();
        }}
      >
        <label
          >Timezone <input
            bind:value={timezone}
            required
            placeholder="Europe/Lisbon"
          /></label
        >
        <label
          >Preferred display units <select bind:value={units}
            ><option value="metric">Metric</option><option value="imperial"
              >Imperial</option
            ></select
          ></label
        >
        <button disabled={busy}>Save preferences</button>{#if saved}<p
            role="status"
          >
            Preferences saved.
          </p>{/if}
      </form>
    </section>
  {/if}
</main>

<style>
  .connections-page {
    max-width: 850px;
    margin: auto;
    padding: 2rem 1rem;
  }
  section {
    padding: 1.5rem;
    margin-block: 1.5rem;
    border: 1px solid var(--border-color, #ddd);
    border-radius: 12px;
  }
  form {
    display: grid;
    gap: 1rem;
  }
  label {
    display: grid;
    gap: 0.4rem;
  }
  .scope {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-block: 0.5rem;
  }
  input:not([type="checkbox"]),
  select {
    padding: 0.6rem;
    width: 100%;
    box-sizing: border-box;
  }
  button {
    padding: 0.6rem 1rem;
    cursor: pointer;
    width: fit-content;
  }
  button:disabled {
    cursor: default;
    opacity: 0.5;
  }
  article {
    border-top: 1px solid var(--border-color, #ddd);
    padding-block: 1rem;
  }
  code {
    overflow-wrap: anywhere;
  }
  .error {
    color: #b42318;
  }
</style>
