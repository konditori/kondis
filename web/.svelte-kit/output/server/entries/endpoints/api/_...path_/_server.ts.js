import { b as private_env } from "../../../../chunks/shared-server.js";
const proxy = async ({ request, params, url, fetch }) => {
  const apiBase = private_env.KONDIS_API_URL ?? "http://localhost:2293";
  const target = new URL(params.path ?? "", `${apiBase.replace(/\/$/, "")}/`);
  target.search = url.search;
  const headers = new Headers(request.headers);
  headers.delete("host");
  return fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? void 0 : await request.arrayBuffer(),
    redirect: "manual"
  });
};
const GET = proxy;
const POST = proxy;
const PUT = proxy;
const DELETE = proxy;
export {
  DELETE,
  GET,
  POST,
  PUT
};
