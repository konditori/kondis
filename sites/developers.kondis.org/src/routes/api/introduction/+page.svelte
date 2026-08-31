<script lang="ts">
  import CodeBlock from "$lib/components/CodeBlock.svelte";
  import { apiBasePath, apiInfo } from "$lib/openapi";

  const healthCheck = `curl --request GET \\
  --url 'http://localhost:2293${apiBasePath}/ping'`;
</script>

<svelte:head>
  <title>Introduction | Kondis API</title>
</svelte:head>

<article class="page-shell narrow">
  <div class="eyebrow">Introduction</div>
  <h1>An API shaped for motion.</h1>
  <p class="lede">
    {apiInfo.description} The reference is rebuilt from the checked-in OpenAPI document,
    so routes, parameters, and models stay aligned with the server.
  </p>

  <div class="section-heading">
    <h2>Make a first call</h2>
    <span>{apiBasePath}</span>
  </div>
  <div class="prose">
    <p>
      Kondis is self-hosted. Replace the origin below with your server address.
      Every documented path is relative to <code>{apiBasePath}</code>.
    </p>
  </div>
  <CodeBlock code={healthCheck} label="terminal" />

  <div class="section-heading">
    <h2>Conventions</h2>
    <span>OpenAPI {apiInfo.version}</span>
  </div>
  <div class="steps">
    <div class="step">
      <h3>JSON by default</h3>
      <p>
        Request and response bodies use JSON unless an endpoint explicitly
        accepts multipart data.
      </p>
    </div>
    <div class="step">
      <h3>Session authentication</h3>
      <p>
        Browser clients authenticate through the session endpoints. The request
        lab includes cookies and also accepts an optional bearer token for
        compatible deployments.
      </p>
    </div>
    <div class="step">
      <h3>Generated contracts</h3>
      <p>
        Endpoint definitions and TypeScript client functions are generated from
        the same OpenAPI file during CI. A drift check fails when generated
        artifacts are stale.
      </p>
    </div>
  </div>

  <div class="next-grid">
    <a class="next-card" href="/api/endpoints">
      <small>Next</small>
      <strong>Browse all endpoints</strong>
    </a>
    <a class="next-card" href="/api/sdk">
      <small>Typed client</small>
      <strong>Use the generated SDK</strong>
    </a>
  </div>
</article>
