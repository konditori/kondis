
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/" | "/activities" | "/activities/[id]" | "/api" | "/api/[...path]";
		RouteParams(): {
			"/activities/[id]": { id: string };
			"/api/[...path]": { path: string }
		};
		LayoutParams(): {
			"/": { id?: string | undefined; path?: string | undefined };
			"/activities": { id?: string | undefined };
			"/activities/[id]": { id: string };
			"/api": { path?: string | undefined };
			"/api/[...path]": { path: string }
		};
		Pathname(): "/" | `/activities/${string}` & {} | `/api/${string}` & {};
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): string & {};
	}
}