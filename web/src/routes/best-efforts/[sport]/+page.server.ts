import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params }) => {
  redirect(
    308,
    `/best-efforts/${params.sport}/${params.sport === "ride" ? "10k" : "5k"}`,
  );
};
