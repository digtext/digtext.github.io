import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const DIG_SOURCE_PATH = path.resolve(__dirname, "public/dig.md");

const digSourceHotReload = () => ({
  name: "dig-source-hot-reload",
  handleHotUpdate({ file, server }: { file: string; server: { ws: { send: (payload: unknown) => void } } }) {
    if (path.resolve(file) !== DIG_SOURCE_PATH) return;

    server.ws.send({
      type: "custom",
      event: "dig:source-updated",
      data: {
        url: "/dig.md",
        timestamp: Date.now(),
      },
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    digSourceHotReload(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
