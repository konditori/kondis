import { error } from "@sveltejs/kit";

import { endpointGroups, getGroup } from "$lib/openapi";

export function entries() {
  return endpointGroups.map((group) => ({ tag: group.slug }));
}

export function load({ params }) {
  const group = getGroup(params.tag);
  if (!group) error(404, "Endpoint group not found");
  return { group };
}
