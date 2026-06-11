import path from "path"
import { createRequire } from "module"
import { fileURLToPath } from "url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// Force one React copy so TanStack Query and the app share the same dispatcher.
const reactDir = path.dirname(require.resolve("react/package.json"))
const reactDomDir = path.dirname(require.resolve("react-dom/package.json"))

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
    dedupe: ["react", "react-dom", "@tanstack/react-query"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      react: reactDir,
      "react-dom": reactDomDir,
    },
  },
})