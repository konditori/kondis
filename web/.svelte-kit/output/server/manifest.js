export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.CP9os34O.js",app:"_app/immutable/entry/app.IFtnDjN9.js",imports:["_app/immutable/entry/start.CP9os34O.js","_app/immutable/chunks/1P6JBUTA.js","_app/immutable/chunks/BZPeFR_U.js","_app/immutable/chunks/Cgkxwj0B.js","_app/immutable/entry/app.IFtnDjN9.js","_app/immutable/chunks/PPVm8Dsz.js","_app/immutable/chunks/BZPeFR_U.js","_app/immutable/chunks/DZPN_XES.js","_app/immutable/chunks/Cgkxwj0B.js","_app/immutable/chunks/6m88CkHh.js","_app/immutable/chunks/DeKr6iUq.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			},
			{
				id: "/activities/[id]",
				pattern: /^\/activities\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/api/[...path]",
				pattern: /^\/api(?:\/([^]*))?\/?$/,
				params: [{"name":"path","optional":false,"rest":true,"chained":true}],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/_...path_/_server.ts.js'))
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
