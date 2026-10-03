import { bindings, defineConfig } from "cf/config";

export default defineConfig({
	worker: {
		name: "fiscaiscanoas",
		compatibilityDate: "2026-10-03",
		entrypoint: "cloudflare/worker.js",
		observability: {
			enabled: true,
			traces: { enabled: true },
		},
		env: {
			DB: bindings.d1({
				name: "fiscaiscanoas-db",
				id: "8ec1b0db-4d9c-45dc-b18a-15b694b18e94",
			}),
			ASSETS: bindings.assets(),
		},
	},
});
