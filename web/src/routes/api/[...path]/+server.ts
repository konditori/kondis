import { apiUrl } from "$lib/server/api";
import type { RequestHandler } from "./$types";

const proxy: RequestHandler = async ({ request, params, url, locals }) => {
  const target = apiUrl(params.path ?? "");
  target.search = url.search;

  const headers = new Headers(request.headers);
  headers.delete("host");

  return locals.kondisFetch(target, {
    method: request.method,
    headers,
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.arrayBuffer(),
    redirect: "manual",
  });
};

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
