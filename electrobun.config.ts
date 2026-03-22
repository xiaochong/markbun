import type { ElectrobunConfig } from "electrobun";

// CEF is only needed in dev mode for debugging; exclude from release builds to reduce package size
const isBuild = process.argv.some(arg => arg === "build");

export default {
	app: {
		name: "MarkBun",
		identifier: "dev.markbun.app",
		version: "0.1.0",
		urlSchemes: ["markbun"],
	},
	build: {
		// Vite builds to dist/, we copy from there
		copy: {
			"dist/index.html": "views/mainview/index.html",
			"dist/assets": "views/mainview/assets",
		},
		// @ts-ignore
		// Ignore Vite output in watch mode — HMR handles view rebuilds separately
		watchIgnore: ["dist/**"],
		mac: {
			bundleCEF: !isBuild,
		},
		linux: {
			bundleCEF: true,
			// icon: 'src/bun/assets/icon.png',
		},
		win: {
			bundleCEF: false,
			// icon: 'src/bun/assets/icon.ico',
		},
	},
} satisfies ElectrobunConfig;
