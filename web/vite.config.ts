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
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": resolve(import.meta.dirname, "./src"),
        "@shared": resolve(import.meta.dirname, "../shared/src"),
        "@fixtures": resolve(import.meta.dirname, "../fixtures"),
      },
    },
    // shared/ and fixtures/ sit outside web/
    server: { fs: { allow: [".."] } },
  }
})
