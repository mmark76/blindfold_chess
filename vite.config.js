import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function getShortCommit() {
  const cloudflareCommit = process.env.CF_PAGES_COMMIT_SHA?.trim();
  if (cloudflareCommit) return cloudflareCommit.slice(0, 7);

  try {
    return execSync("git rev-parse --short=7 HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "local";
  }
}

const shortCommit = getShortCommit();
const baseVersionDeclaration = 'const APP_VERSION = "v1.2.1_20260806";';

export default defineConfig({
  plugins: [
    react(),
    {
      name: "inject-app-commit-version",
      enforce: "pre",
      transform(code, id) {
        const normalizedId = id.replaceAll("\\", "/");
        if (!normalizedId.endsWith("/src/App.jsx") || !code.includes(baseVersionDeclaration)) {
          return null;
        }

        return {
          code: code.replace(
            baseVersionDeclaration,
            `const APP_VERSION = "v1.2.1_20260806_${shortCommit}";`,
          ),
          map: null,
        };
      },
    },
  ],
});
