// Trusted schedule/manual workflow only. Credentials stay in the child environment.
import { execFileSync } from "node:child_process";
const run = (args, env = process.env) =>
  execFileSync("git", args, {
    encoding: "utf8",
    env,
    windowsHide: true,
  }).trim();
if (
  process.env.GITHUB_REPOSITORY !== "Andre1B/lunar-navigator-spaceapps-2026" ||
  process.env.GITHUB_REF !== "refs/heads/main"
)
  throw new Error(
    "Daily publication is restricted to the original repository main branch.",
  );
if (!process.env.GITHUB_TOKEN)
  throw new Error("Repository token is unavailable.");
if (
  !/^https:\/\/github\.com\/Andre1B\/lunar-navigator-spaceapps-2026(?:\.git)?$/.test(
    run(["remote", "get-url", "origin"]),
  )
)
  throw new Error("Unexpected repository remote; refusing to push.");
const destination =
  "https://github.com/Andre1B/lunar-navigator-spaceapps-2026.git";
const allowed = (name) =>
  name.startsWith("public/data/") ||
  name.startsWith("public/licenses/") ||
  ["public/credits.json", "THIRD_PARTY_NOTICES.md"].includes(name);
const changed = run(["diff", "--name-only"]).split("\n").filter(Boolean);
const staged = run(["diff", "--cached", "--name-only"])
  .split("\n")
  .filter(Boolean);
const untracked = run(["ls-files", "--others", "--exclude-standard"])
  .split("\n")
  .filter(Boolean);
if ([...changed, ...staged, ...untracked].some((name) => !allowed(name)))
  throw new Error("Unexpected generated path; refusing to commit or publish.");
run(["config", "user.name", "github-actions[bot]"]);
run([
  "config",
  "user.email",
  "41898282+github-actions[bot]@users.noreply.github.com",
]);
run([
  "add",
  "--",
  "public/data",
  "public/credits.json",
  "public/licenses",
  "THIRD_PARTY_NOTICES.md",
]);
if (run(["diff", "--cached", "--name-only"])) {
  run([
    "commit",
    "-m",
    `Update rolling lunar dataset for ${new Date().toISOString().slice(0, 10)} UTC`,
  ]);
  const authorization = Buffer.from(
    `x-access-token:${process.env.GITHUB_TOKEN}`,
  ).toString("base64");
  const env = {
    ...process.env,
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${authorization}`,
  };
  // A concurrent human push rejects the fast-forward; no force/rebase/deploy.
  run(["push", destination, "HEAD:main"], env);
}
console.log(
  JSON.stringify({
    revision: run(["rev-parse", "HEAD"]),
    dirty: !!run(["status", "--porcelain"]),
  }),
);
