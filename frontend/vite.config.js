import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api/pdf-converter": {
        target: "http://127.0.0.1:5001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/pdf-converter/, ""),
      },
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
        timeout: 300000,
        proxyTimeout: 300000,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})