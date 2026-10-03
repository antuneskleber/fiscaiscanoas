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
				id: "ca80d17d-169a-48a6-b5e2-6c6bbe346af2",
			}),
			ASSETS: bindings.assets(),
		},
	},
});
