import * as server from '../entries/pages/activities/_id_/_page.server.ts.js';

export const index = 3;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/activities/_id_/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/activities/[id]/+page.server.ts";
export const imports = ["_app/immutable/nodes/3.Buc4VQCD.js","_app/immutable/chunks/DZPN_XES.js","_app/immutable/chunks/BZPeFR_U.js","_app/immutable/chunks/6m88CkHh.js","_app/immutable/chunks/Bev8-oX9.js","_app/immutable/chunks/BKfxLMX0.js","_app/immutable/chunks/PPVm8Dsz.js","_app/immutable/chunks/Cgkxwj0B.js","_app/immutable/chunks/DeKr6iUq.js","_app/immutable/chunks/BCdTP6ZO.js","_app/immutable/chunks/CU2BsiG_.js","_app/immutable/chunks/HqjlFIrg.js"];
export const stylesheets = [];
export const fonts = [];
