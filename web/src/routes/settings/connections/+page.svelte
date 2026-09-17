<script lang="ts">
  import { onMount } from "svelte";
  import { t } from "$lib/i18n";

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
    { value: "profile:read", label: t("connection_scope_profile") },
    {
      value: "activities:read",
      label: t("connection_scope_activities"),
    },
    { value: "location:read", label: t("connection_scope_location") },
    { value: "activities:write", label: t("connection_scope_write") },
    { value: "activities:import", label: t("connection_scope_import") },
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
      throw new Error(body.message ?? t("could_not_update_connections"));
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
      error = e instanceof Error ? e.message : t("could_not_create_key");
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
      error = e instanceof Error ? e.message : t("could_not_revoke_connection");
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
      error = e instanceof Error ? e.message : t("could_not_save_preferences");
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>{t("connected_apps")} · Kondis</title></svelte:head>
<main class="page-shell connections-page">
  <a href="/settings">← {t("settings")}</a>
  <h1>{t("connected_apps")}</h1>
  <p>
    {t("connected_apps_description")}
  </p>
  {#if error}<p role="alert" class="error">{error}</p>{/if}
  {#if !loaded}<p>{t("loading_connections")}</p>{:else}
    <section>
      <h2>{t("connect_an_assistant")}</h2>
      {#if endpoint}<p>{t("mcp_server_url")}: <code>{endpoint}</code></p>
      {:else}<p>{t("mcp_disabled_description")}</p>{/if}
      <form
        onsubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <label
          >{t("connection_name")}
          <input
            bind:value={name}
            required
            maxlength="80"
            placeholder={t("connection_name_placeholder")}
          /></label
        >
        <fieldset>
          <legend>{t("permissions")}</legend>
          {#each scopes as scope}<label class="scope"
              ><input
                type="checkbox"
                bind:group={selected}
                value={scope.value}
              />{scope.label}</label
            >{/each}
        </fieldset>
        <label
          >{t("expires_after_days")}
          <input
            type="number"
            bind:value={expiresInDays}
            min="1"
            max="365"
            required
          /></label
        >
        <button disabled={busy || !endpoint || selected.length === 0}
          >{t("create_api_key")}</button
        >
      </form>
      {#if secret}<div role="status">
          <p>{t("copy_key_once")}</p>
          <input aria-label={t("new_api_key")} readonly value={secret} /><button
            type="button"
            onclick={() => {
              secret = "";
            }}>{t("dismiss_key")}</button
          >
        </div>{/if}
    </section>
    <section>
      <h2>{t("your_connections")}</h2>
      {#if connections.length === 0}<p>{t("no_connected_apps")}</p>{/if}
      {#each connections as connection}<article>
          <h3>{connection.name}</h3>
          <p>
            {connection.kind === "oauth" ? t("connected_app") : t("api_key")} · {connection.revokedAt
              ? t("revoked")
              : `${t("expires")} ${new Date(connection.expiresAt).toLocaleDateString()}`}
          </p>
          <p>
            {connection.scopes
              .map((s) => scopes.find((v) => v.value === s)?.label ?? s)
              .join(" · ")}
          </p>
          {#if connection.lastUsedAt}<p>
              {t("last_used")}
              {new Date(connection.lastUsedAt).toLocaleString()}
            </p>{/if}
          {#if !connection.revokedAt}<button
              type="button"
              disabled={busy}
              onclick={() => revoke(connection.id)}>{t("revoke_access")}</button
            >{/if}
        </article>{/each}
    </section>
    <section>
      <h2>{t("assistant_preferences")}</h2>
      <form
        onsubmit={(e) => {
          e.preventDefault();
          void savePreferences();
        }}
      >
        <label
          >{t("timezone")}
          <input
            bind:value={timezone}
            required
            placeholder={t("timezone_placeholder")}
          /></label
        >
        <label
          >{t("preferred_display_units")}
          <select bind:value={units}
            ><option value="metric">{t("metric")}</option><option
              value="imperial">{t("imperial")}</option
            ></select
          ></label
        >
        <button disabled={busy}>{t("save_preferences")}</button>{#if saved}<p
            role="status"
          >
            {t("preferences_saved")}
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
