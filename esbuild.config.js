const esbuild = require("esbuild");
const postcssPlugin = require("esbuild-plugin-postcss2");

const watch = process.argv.includes("--watch");

const extensionCtx = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  platform: "node",
  format: "cjs",
  sourcemap: true,
  target: "node18",
  logLevel: "info",
};

const webviewCtx = {
  entryPoints: ["src/webview/main.tsx"],
  bundle: true,
  outfile: "dist/webview.js",
  platform: "browser",
  format: "iife",
  sourcemap: true,
  target: ["chrome100"],
  loader: {
    ".tsx": "tsx",
    ".ts": "ts",
  },
  define: {
    "process.env.NODE_ENV": watch ? '"development"' : '"production"',
  },
  plugins: [
    postcssPlugin.default({
      plugins: [require("tailwindcss"), require("autoprefixer")],
    }),
  ],
  logLevel: "info",
};

async function build() {
  if (watch) {
    const extCtx = await esbuild.context(extensionCtx);
    const webCtx = await esbuild.context(webviewCtx);
    await extCtx.watch();
    await webCtx.watch();
    console.log("[cursor-clone] watching extension + webview...");
  } else {
    await esbuild.build(extensionCtx);
    await esbuild.build(webviewCtx);
    console.log("[cursor-clone] build complete");
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
