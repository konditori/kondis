import { apiEndpointUrl } from "$lib/server/api";
import type { RequestHandler } from "./$types";

const proxy: RequestHandler = async ({ request, params, url, locals }) => {
  const target = apiEndpointUrl(params.path ?? "");
  target.search = url.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");
  headers.delete("transfer-encoding");
  headers.delete("connection");

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : request.body;
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    body,
    redirect: "manual",
  };
  if (body) init.duplex = "half";
  return locals.kondisFetch(target, init);
};

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
