import app from "./.svelte-kit/cloudflare/_worker.js";

export default {
  fetch(request, env, context) {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/events" || pathname === "/api/v1/events") {
      return env.KONDIS_API.fetch(request);
    }
    return app.fetch(request, env, context);
  },
};
