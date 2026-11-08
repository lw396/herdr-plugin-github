// Herdr resolves its host modules, not npm packages. Bundle dependencies as readable, DOM-free ESM.
// bun scripts/bundle.mjs [--watch] [<entry> <outfile>]: the mod by default; the smoke test passes its own
// entry and output, so it is bundled exactly as the mod is.
import { build, context } from "esbuild";

const [entry = "src/github/main.ts", outfile = "github/mods/github/main.js"] = process.argv
	.slice(2)
	.filter((arg) => !arg.startsWith("--"));
const options = {
	entryPoints: [entry],
	outfile,
	bundle: true,
	format: "esm",
	platform: "neutral", // Browser-conditioned entity decoders require document; QuickJS has no DOM.
	target: "es2022",
	external: ["herdr", "gpui-kit", "gpui-base"],
	minify: false,
	legalComments: "none",
	logLevel: "warning",
};
if (process.argv.includes("--watch")) {
	const watcher = await context(options);
	await watcher.watch();
	console.log("Watching GitHub source; assets are copied once at startup.");
} else await build(options);
