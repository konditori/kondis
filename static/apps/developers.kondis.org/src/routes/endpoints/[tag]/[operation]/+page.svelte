<script lang="ts">
  import CodeBlock from "$lib/components/CodeBlock.svelte";
  import MethodBadge from "$lib/components/MethodBadge.svelte";
  import RequestBuilder from "$lib/components/RequestBuilder.svelte";
  import SchemaView from "$lib/components/SchemaView.svelte";
  import { schemaType } from "$lib/openapi";

  let { data } = $props();
  const endpoint = $derived(data.endpoint);

  const sdkArguments = $derived(
    endpoint.parameters.length || endpoint.request
      ? "{ /* typed input */ }"
      : "",
  );
  const sdkExample =
    $derived(`import { ${endpoint.sdkName} } from "@kondis/sdk";

const result = await ${endpoint.sdkName}(${sdkArguments});`);
</script>

<svelte:head>
  <title>{endpoint.title} | Kondis API</title>
</svelte:head>

<article class="page-shell">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/endpoints">Endpoints</a><span>/</span>
    <a href="/endpoints/{endpoint.tagSlug}">{endpoint.tag}</a><span>/</span>
    <span>{endpoint.title}</span>
  </nav>

  <header class="endpoint-hero">
    <div class="eyebrow">{endpoint.tag}</div>
    <h1>{endpoint.title}</h1>
    {#if endpoint.description}<p class="lede">{endpoint.description}</p>{/if}
    <div class="route-line">
      <MethodBadge method={endpoint.method} />
      <code>{endpoint.path}</code>
    </div>
    <div class="operation-id">operationId: {endpoint.operationId}</div>
  </header>

  <div class="detail-grid">
    <div>
      {#if endpoint.parameters.length}
        <section class="detail-section" id="parameters">
          <h2>Parameters</h2>
          <div class="parameter-table">
            {#each endpoint.parameters as parameter}
              <div class="parameter-row">
                <div>
                  <span class="parameter-name">{parameter.name}</span>
                  {#if parameter.required}<span class="required-mark">*</span
                    >{/if}
                  <p class="parameter-description">{parameter.in}</p>
                </div>
                <div>
                  <span class="type-label">{schemaType(parameter.schema)}</span>
                  {#if parameter.description}
                    <p class="parameter-description">{parameter.description}</p>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      {#if endpoint.request}
        <section class="detail-section" id="request-body">
          <h2>Request body</h2>
          <SchemaView
            schema={endpoint.request.schema}
            title={`${endpoint.request.contentType}${endpoint.request.required ? " / required" : ""}`}
          />
        </section>
      {/if}

      <section class="detail-section" id="responses">
        <h2>Responses</h2>
        <div class="response-stack">
          {#each endpoint.responses as response}
            <div class="response-card">
              <div class="response-card-header">
                <span class="status-code">{response.status}</span>
                <span class="content-type"
                  >{response.contentType ?? "no body"}</span
                >
              </div>
              <div class="response-card-body">
                <p class="prose">{response.description}</p>
                {#if response.schema}
                  <SchemaView
                    schema={response.schema}
                    title="Response schema"
                  />
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </section>
    </div>

    <aside class="detail-rail" aria-label="Request examples">
      <CodeBlock code={sdkExample} label="typescript sdk" />
      <RequestBuilder {endpoint} />
    </aside>
  </div>
</article>
