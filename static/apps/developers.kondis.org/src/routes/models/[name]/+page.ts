import { error } from "@sveltejs/kit";

import { getModel, models } from "$lib/openapi";

export function entries() {
  return models.map((model) => ({ name: model.name }));
}

export function load({ params }) {
  const model = getModel(params.name);
  if (!model) error(404, "Model not found");
  return { model };
}
