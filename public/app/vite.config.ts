import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../../shared"),
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 4828,
    proxy: {
      "/api": "http://localhost:4827",
      "/socket.io": {
        target: "http://localhost:4827",
        ws: true,
      },
      "^/(?!src|node_modules|@)": {
        target: "http://localhost:4827",
        changeOrigin: true,
      },
    },
  },
  base: "/_app/",
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          markdown: ["marked", "highlight.js"],
          terminal: ["xterm", "@xterm/addon-fit"],
          state: ["zustand", "socket.io-client"],
        },
      },
    },
  },
});
