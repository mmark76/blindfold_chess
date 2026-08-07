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

function getCyprusBuildStamp() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Nicosia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}${values.month}${values.day}_${values.hour}${values.minute}`;
}

const shortCommit = getShortCommit();
const buildStamp = getCyprusBuildStamp();
const appVersionDeclarationPattern = /const APP_VERSION = "(v\d+\.\d+\.\d+)_\d{8}";/;

export default defineConfig({
  plugins: [
    react(),
    {
      name: "inject-app-build-version",
      enforce: "pre",
      transform(code, id) {
        const normalizedId = id.replaceAll("\\", "/");
        const versionMatch = code.match(appVersionDeclarationPattern);

        if (!normalizedId.endsWith("/src/App.jsx") || !versionMatch) {
          return null;
        }

        return {
          code: code.replace(
            appVersionDeclarationPattern,
            `const APP_VERSION = "${versionMatch[1]}_${buildStamp}_${shortCommit}";`,
          ),
          map: null,
        };
      },
    },
  ],
});
