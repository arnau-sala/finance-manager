import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isStorybookBuild = process.env.STORYBOOK === "true";
  const canUploadSentrySourceMaps = Boolean(
    !isStorybookBuild &&
      env.SENTRY_AUTH_TOKEN &&
      env.SENTRY_ORG &&
      env.SENTRY_PROJECT,
  );

  return {
    plugins: [
      react(),
      ...(canUploadSentrySourceMaps
        ? [
            sentryVitePlugin({
              authToken: env.SENTRY_AUTH_TOKEN,
              org: env.SENTRY_ORG,
              project: env.SENTRY_PROJECT,
              telemetry: false,
              release: {
                name: env.VITE_SENTRY_RELEASE || undefined,
              },
              sourcemaps: {
                filesToDeleteAfterUpload: "./dist/**/*.map",
              },
            }),
          ]
        : []),
    ],
    build: {
      sourcemap: canUploadSentrySourceMaps ? "hidden" : false,
    },
    server: {
      port: 5173,
      allowedHosts: true,
      proxy: {
        "/api": {
          target: "http://localhost:3001",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              proxyReq.setHeader("origin", "http://localhost:3001");
            });
          },
        }
      },
    },
    preview: {
      allowedHosts: true,
    },
  };
});
