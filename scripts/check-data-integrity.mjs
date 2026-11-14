import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export function verifyDatasetIntegrity(
  directory = fileURLToPath(new URL("../public/data/", import.meta.url)),
) {
  const root = resolve(directory);
  const read = (name) => readFileSync(resolve(root, name));
  const manifest = JSON.parse(read("manifest.json"));
  const integrity = JSON.parse(read("integrity.json"));
  if (integrity.schemaVersion !== "1.0.0" || !Array.isArray(integrity.files))
    throw Error("Unsupported or missing derived-dataset integrity record.");
  if (integrity.manifestGeneratedAtUtc !== manifest.generatedAtUtc)
    throw Error("Integrity record identifies a different manifest generation.");
  const expected = new Set([
    "manifest.json",
    "sky.json",
    "planets.json",
    "validation.json",
    ...manifest.sites.map((s) => s.file),
  ]);
  const observed = new Set();
  for (const entry of integrity.files) {
    if (!entry || typeof entry.file !== "string")
      throw Error("Invalid integrity entry.");
    const absolute = resolve(root, entry.file);
    if (
      !absolute.startsWith(root + sep) ||
      !expected.has(entry.file) ||
      observed.has(entry.file)
    )
      throw Error(
        "Unexpected, duplicated or unsafe integrity path: " + entry.file,
      );
    observed.add(entry.file);
    const bytes = read(entry.file);
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (bytes.length !== entry.bytes || hash !== entry.sha256)
      throw Error(
        "Dataset bytes do not match the recorded checksum: " + entry.file,
      );
  }
  if (observed.size !== expected.size)
    throw Error("Integrity record omits required derived-data files.");
  return { valid: true, filesChecked: observed.size };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    console.log(JSON.stringify(verifyDatasetIntegrity()));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
