import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

// https://vite.dev/config/
// Only these two values reach the browser. SUPABASE_SERVICE_ROLE_KEY and the
// others in .env stay out of the bundle, because they are not listed here.
// The anon key is safe in the browser: the access rules in the database protect the data.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(import.meta.dirname, ".."), "")
  return {
    define: {
      "process.env.IS_PREACT": JSON.stringify("false"),
      __SUPABASE_URL__: JSON.stringify(env.SUPABASE_URL ?? ""),
      __SUPABASE_ANON_KEY__: JSON.stringify(env.SUPABASE_ANON_KEY ?? ""),
      // "demo" shows a saved example and calls no AI. "service" marks for real.
      __MARK_MODE__: JSON.stringify(
        env.MARK_MODE === "service" ? "service" : "demo"
      ),
      // Where the app sends a marking request. The dev server forwards this path.
      __MARK_URL__: JSON.stringify(env.MARK_URL || "/api/mark"),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        // shared/ sits outside web/, so it must find zod in web/node_modules too
        zod: resolve(import.meta.dirname, "node_modules/zod"),
        "@": resolve(import.meta.dirname, "./src"),
        "@shared": resolve(import.meta.dirname, "../shared/src"),
        "@fixtures": resolve(import.meta.dirname, "../fixtures"),
      },
    },
    // shared/ and fixtures/ sit outside web/
    server: {
      fs: { allow: [".."] },
      // Same address for the laptop and the tablet, and no cross-site rules to set up.
      proxy: { "/api/mark": `http://localhost:${env.PORT || 3001}` },
    },
  }
})
