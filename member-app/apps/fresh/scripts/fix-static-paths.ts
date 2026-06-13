// Normalize OS-specific path separators in the built Fresh server bundle.
//
// `vite build` bakes the build host's path separator into the `filePath` of
// each registerStaticFile() entry in _fresh/server.js. A Windows build emits
// `client\assets\…`, which fail to resolve when the bundle runs on Linux (e.g.
// Deno Deploy, or a cross-compiled `deno compile` binary) — the static CSS
// chunks 404. Forward slashes work on both Windows and Linux, so this runs
// unconditionally after every build to keep the output OS-portable.
const serverJs = new URL("../_fresh/server.js", import.meta.url);
const before = await Deno.readTextFile(serverJs);
const after = before.replaceAll("\\\\", "/");
if (after !== before) {
  await Deno.writeTextFile(serverJs, after);
  console.log("fix-static-paths: normalized backslash paths in _fresh/server.js");
} else {
  console.log("fix-static-paths: no backslash paths to normalize");
}
