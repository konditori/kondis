import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const logout: RequestHandler = ({ cookies }) => {
  cookies.delete("kondis_session", { path: "/" });
  throw redirect(303, "/login");
};

export const POST = logout;
