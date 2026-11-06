// Herdr resolves its host modules, not npm packages. Bundle dependencies as readable, DOM-free ESM.
import { build, context } from "esbuild";

const options = {
  entryPoints: ["src/github/main.ts"],
  outfile: "mods/github/main.js",
  bundle: true,
  format: "esm",
  platform: "neutral", // Browser-conditioned entity decoders require document; QuickJS has no DOM.
  target: "es2022",
  external: ["herdr", "gpui-kit", "gpui-base"],
  minify: false,
  legalComments: "none",
};
if (process.argv.includes("--watch")) {
  const watcher = await context(options);
  await watcher.watch();
  console.log("Watching GitHub source; assets are copied once at startup.");
} else await build(options);
