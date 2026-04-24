import { defineConfig } from "vite";
import { fresh } from "@fresh/plugin-vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [
    fresh(),
    // Svelte 5 islands. Compiled client-side only; mounted by a thin Preact
    // island wrapper so SSR stays Preact-only and the page works without JS.
    svelte(),
  ],
});
