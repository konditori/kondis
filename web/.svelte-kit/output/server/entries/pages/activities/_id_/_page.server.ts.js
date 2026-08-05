import { error } from "@sveltejs/kit";
const load = async ({ fetch, params }) => {
  const response = await fetch(`/api/activities/${params.id}`);
  if (response.status === 404) error(404, "Activity not found");
  if (!response.ok) error(503, "Could not load this activity");
  return { activity: await response.json() };
};
export {
  load
};
