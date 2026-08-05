import * as server from '../entries/pages/_page.server.ts.js';

export const index = 2;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/+page.server.ts";
export const imports = ["_app/immutable/nodes/2.BwMlCZIe.js","_app/immutable/chunks/DZPN_XES.js","_app/immutable/chunks/BZPeFR_U.js","_app/immutable/chunks/6m88CkHh.js","_app/immutable/chunks/Bev8-oX9.js","_app/immutable/chunks/BKfxLMX0.js","_app/immutable/chunks/BCdTP6ZO.js","_app/immutable/chunks/Z-QXmsl-.js"];
export const stylesheets = [];
export const fonts = [];
