// Minimal stub to satisfy `npm run evaluate -- --input cases.json --output kits.json` from clean clone.
// Full runPipeline integration ships in Phase 1.
import fs from "fs";
import path from "path";

function parseArgs() {
  const args = process.argv.slice(2);
  let input = "", output = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input") input = args[++i];
    else if (args[i] === "--output") output = args[++i];
    else if (!input && !args[i].startsWith("-")) input = args[i];
    else if (!output && !args[i].startsWith("-")) output = args[i];
  }
  // also handle case where npm strips flags and only positional remain
  if (!input || !output) {
    const positional = args.filter((a) => !a.startsWith("-"));
    if (positional.length >= 2) {
      input = input || positional[0];
      output = output || positional[1];
    }
  }
  if (!input || !output) {
    console.error("Usage: npm run evaluate -- --input <cases.json> --output <kits.json>");
    process.exit(1);
  }
  return { input, output };
}

const { input, output } = parseArgs();
const resolvedInput = path.resolve(input);
if (!fs.existsSync(resolvedInput)) {
  console.error(`[evaluate] input not found: ${input}`);
  console.error(`  cwd: ${process.cwd()}`);
  console.error(`  resolved: ${resolvedInput}`);
  console.error(`  hint: from repo root use --input backend/fixtures/cases.sample.json; from backend/ use --input fixtures/cases.sample.json`);
  process.exit(1);
}
const cases = JSON.parse(fs.readFileSync(resolvedInput, "utf8"));
const now = new Date().toISOString();
const kits = (Array.isArray(cases) ? cases : []).map((c: any) => ({
  id: c.id,
  status: "failed" as const,
  kit: null,
  error: { code: "SCHEMA_INVALID", message: "Phase 0 scaffold — pipeline ships in Phase 1" },
}));
const out = { version: "1.0" as const, generated_at: now, kits };
fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
fs.writeFileSync(output, JSON.stringify(out, null, 2));
console.log(`[evaluate] stub wrote ${kits.length} entries to ${output}`);
