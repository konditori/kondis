import { error } from "@sveltejs/kit";

import { endpoints, getEndpoint } from "$lib/openapi";

export function entries() {
  return endpoints.map((endpoint) => ({
    tag: endpoint.tagSlug,
    operation: endpoint.slug,
  }));
}

export function load({ params }) {
  const endpoint = getEndpoint(params.tag, params.operation);
  if (!endpoint) error(404, "Endpoint not found");
  return { endpoint };
}
