import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  define: { "process.env.IS_PREACT": JSON.stringify("false") },
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
})
