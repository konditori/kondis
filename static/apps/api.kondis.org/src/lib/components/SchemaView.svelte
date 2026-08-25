<script lang="ts">
  import {
    modelHref,
    referenceName,
    schemaType,
    type Schema,
  } from "$lib/openapi";

  let {
    schema,
    title = "Schema",
  }: {
    schema?: Schema;
    title?: string;
  } = $props();

  const reference = $derived(schema ? referenceName(schema) : undefined);
  const href = $derived(schema ? modelHref(schema) : undefined);
  const properties = $derived(Object.entries(schema?.properties ?? {}));
</script>

<div class="schema-card">
  <div class="schema-card-header">
    <strong>{title}</strong>
    <span class="type-label">{schemaType(schema)}</span>
  </div>
  <div class="schema-card-body">
    {#if reference && href}
      <p class="prose">
        See model <a class="text-link mono" {href}>{reference}</a>.
      </p>
    {:else if schema?.items}
      <p class="prose">
        Array items use
        {#if modelHref(schema.items)}
          <a class="text-link mono" href={modelHref(schema.items)}>
            {schemaType(schema.items)}
          </a>
        {:else}
          <span class="type-label">{schemaType(schema.items)}</span>
        {/if}
        .
      </p>
    {:else if schema?.enum}
      <p class="prose">Allowed values:</p>
      <div class="type-label">{schema.enum.map(String).join(" | ")}</div>
    {:else if properties.length}
      <div class="property-table">
        {#each properties as [name, property]}
          <div class="property-row">
            <div>
              <span class="property-name">{name}</span>
              {#if schema?.required?.includes(name)}
                <span class="required-mark" title="Required">*</span>
              {/if}
            </div>
            <div>
              {#if modelHref(property)}
                <a class="type-label" href={modelHref(property)}
                  >{schemaType(property)}</a
                >
              {:else if property.items && modelHref(property.items)}
                <a class="type-label" href={modelHref(property.items)}>
                  {schemaType(property)}
                </a>
              {:else}
                <span class="type-label">{schemaType(property)}</span>
              {/if}
              {#if property.description}
                <p class="property-description">{property.description}</p>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <p class="prose">
        {schema?.description ?? "No additional schema detail."}
      </p>
    {/if}
  </div>
</div>
