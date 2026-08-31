<script lang="ts">
  import { onMount } from "svelte";

  import { apiBasePath, exampleForSchema, type Endpoint } from "$lib/openapi";

  import CodeBlock from "./CodeBlock.svelte";

  let { endpoint }: { endpoint: Endpoint } = $props();

  let baseUrl = $state("http://localhost:2293");
  let token = $state("");
  let parameterValues = $state<Record<string, string>>({});
  let body = $state("");
  let result = $state("");
  let loading = $state(false);

  $effect(() => {
    body =
      endpoint.request?.contentType === "application/json"
        ? JSON.stringify(exampleForSchema(endpoint.request.schema), null, 2)
        : "";
  });

  const pathParameters = $derived(
    endpoint.parameters.filter((parameter) => parameter.in === "path"),
  );
  const queryParameters = $derived(
    endpoint.parameters.filter((parameter) => parameter.in === "query"),
  );
  const unsupportedBody = $derived(
    Boolean(
      endpoint.request && endpoint.request.contentType !== "application/json",
    ),
  );
  const missingRequiredParameter = $derived(
    endpoint.parameters.some(
      (parameter) =>
        parameter.required && !parameterValues[parameter.name]?.trim(),
    ),
  );
  const resolvedPath = $derived(
    endpoint.path.replace(/\{([^}]+)\}/g, (_, name: string) =>
      encodeURIComponent(parameterValues[name] || `{${name}}`),
    ),
  );
  const query = $derived(
    queryParameters
      .filter((parameter) => parameterValues[parameter.name])
      .map(
        (parameter) =>
          `${encodeURIComponent(parameter.name)}=${encodeURIComponent(parameterValues[parameter.name])}`,
      )
      .join("&"),
  );
  const requestUrl = $derived(
    `${baseUrl.replace(/\/$/, "")}${apiBasePath}${resolvedPath}${query ? `?${query}` : ""}`,
  );
  const curl = $derived.by(() => {
    const lines = [
      `curl --request ${endpoint.method.toUpperCase()} \\`,
      `  --url '${requestUrl}'`,
    ];
    if (token) lines.push(`  --header 'Authorization: Bearer ${token}'`);
    if (endpoint.request?.contentType === "application/json") {
      lines[lines.length - 1] += " \\";
      lines.push(
        `  --header 'Content-Type: application/json' \\`,
        `  --data '${body}'`,
      );
    }
    return lines.join("\n");
  });

  onMount(() => {
    baseUrl = localStorage.getItem("kondis-api-base-url") ?? baseUrl;
  });

  function updateParameter(name: string, value: string) {
    parameterValues = { ...parameterValues, [name]: value };
  }

  async function sendRequest() {
    loading = true;
    result = "";
    localStorage.setItem("kondis-api-base-url", baseUrl);

    try {
      const headers = new Headers();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      if (endpoint.request?.contentType === "application/json") {
        headers.set("Content-Type", "application/json");
      }

      const response = await fetch(requestUrl, {
        method: endpoint.method.toUpperCase(),
        headers,
        credentials: "include",
        body:
          endpoint.request?.contentType === "application/json"
            ? body
            : undefined,
      });
      const text = await response.text();
      let formatted = text;
      try {
        formatted = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        // Keep non-JSON responses as text.
      }
      result = `${response.status} ${response.statusText}\n\n${formatted}`;
    } catch (error) {
      result = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }
</script>

<CodeBlock code={curl} label="curl" />

<div class="request-builder">
  <div class="request-builder-header">
    <strong>Request lab</strong>
    <span class="content-type">browser fetch</span>
  </div>
  <div class="request-builder-body">
    <div class="field">
      <label for="base-url">Server origin</label>
      <input id="base-url" bind:value={baseUrl} spellcheck="false" />
    </div>
    {#each pathParameters as parameter}
      <div class="field">
        <label for="path-{parameter.name}">{parameter.name} / path</label>
        <input
          id="path-{parameter.name}"
          value={parameterValues[parameter.name] ?? ""}
          placeholder={parameter.required ? "required" : "optional"}
          oninput={(event) =>
            updateParameter(parameter.name, event.currentTarget.value)}
        />
      </div>
    {/each}
    {#each queryParameters as parameter}
      <div class="field">
        <label for="query-{parameter.name}">{parameter.name} / query</label>
        <input
          id="query-{parameter.name}"
          value={parameterValues[parameter.name] ?? ""}
          placeholder={parameter.required ? "required" : "optional"}
          oninput={(event) =>
            updateParameter(parameter.name, event.currentTarget.value)}
        />
      </div>
    {/each}
    <div class="field">
      <label for="token">Bearer token / optional</label>
      <input id="token" type="password" bind:value={token} autocomplete="off" />
    </div>
    {#if endpoint.request?.contentType === "application/json"}
      <div class="field">
        <label for="body">JSON body</label>
        <textarea id="body" bind:value={body} spellcheck="false"></textarea>
      </div>
    {:else if endpoint.request}
      <p class="request-note">
        Interactive multipart bodies are not assembled here. Use the generated
        curl command as a starting point.
      </p>
    {/if}
    <div class="request-actions">
      <button
        class="button"
        type="button"
        onclick={sendRequest}
        disabled={loading || unsupportedBody || missingRequiredParameter}
      >
        {loading
          ? "Sending..."
          : unsupportedBody
            ? "Multipart unavailable"
            : "Send request"}
      </button>
    </div>
    <p class="request-note">
      Requests go directly from your browser to the configured server.
      Credentials are never sent to this documentation site. The server must
      allow cross-origin requests from this site.
    </p>
    {#if result}
      <div class="request-result">{result}</div>
    {/if}
  </div>
</div>
