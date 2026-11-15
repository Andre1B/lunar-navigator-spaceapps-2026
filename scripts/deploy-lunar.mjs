// Deliberately fixed destination. Never creates, deletes or configures projects.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const account = "73685e7dd2f519edd87ed44c4c5b17f9";
const project = "lunar-navigator-2026";
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token)
  throw new Error(
    "CLOUDFLARE_API_TOKEN is required; no publication attempted.",
  );
if (
  process.env.CLOUDFLARE_ACCOUNT_ID &&
  process.env.CLOUDFLARE_ACCOUNT_ID !== account
)
  throw new Error("Unexpected Cloudflare account; refusing publication.");
const response = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects`,
  {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
  },
);
const body = await response.json();
if (!response.ok || !body.success || !Array.isArray(body.result))
  throw new Error(
    `Read-only project preflight failed (${response.status}); no publication attempted.`,
  );
if (body.result.some((p) => /casa.?bom.?dia/i.test(p.name)))
  throw new Error("Protected account; refusing publication.");
if (!body.result.some((p) => p.name === project))
  throw new Error(
    "Lunar project does not exist in the fixed account; refusing to create anything.",
  );
console.log(
  JSON.stringify({
    checkedProject: project,
    account: "onlyone",
    otherProjectsUntouched: body.result
      .filter((p) => p.name !== project)
      .map((p) => p.name),
  }),
);
if (!process.argv.includes("--check-only")) {
  if (!existsSync(new URL("../dist/index.html", import.meta.url)))
    throw new Error("Production build is missing.");
  if (
    execFileSync("git", ["status", "--porcelain"], {
      cwd: root,
      encoding: "utf8",
    }).trim()
  )
    throw new Error("Build publication requires a clean source tree.");
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/wrangler/bin/wrangler.js",
      "pages",
      "deploy",
      "dist",
      "--project-name",
      project,
      "--branch",
      "main",
    ],
    {
      cwd: root,
      env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: account },
      stdio: "inherit",
      windowsHide: true,
    },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
