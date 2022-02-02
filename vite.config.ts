/// <reference types="vitest" />
import path from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
	resolve: {
		alias: {
			"~/": `${path.resolve(__dirname, "src")}/`,
		},
	},
	build: {
		lib: {
			name: "particle-components",
			entry: path.resolve(__dirname, "src/plugin.ts"),
			formats: ["es", "cjs"],
		},
		minify: "esbuild",
		rollupOptions: {
			external: ["vue", "mermaid"],
			output: {
				globals: {
					vue: "Vue",
					router: "VueRouter",
				},
			},
		},
	},
	plugins: [dts()],

	// https://github.com/vitest-dev/vitest
	test: {
		include: ["test/**/*.test.ts"],
		// environment: "jsdom",
		api: {
			port: 4444,
			host: "0.0.0.0",
		},
		deps: {},
	},
});