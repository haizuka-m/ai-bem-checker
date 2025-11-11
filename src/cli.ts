import fs from "fs";
import path from "path";
import { analyzeBEM } from "./analyzeBEM.js";

type LintResult = ReturnType<typeof analyzeBEM>;

function printUsage() {
  console.log("Usage: ai-bem-checker check <path> [--json]");
}

function collectFiles(
  targetPath: string,
  exts = [".html", ".htm", ".js", ".jsx", ".ts", ".tsx", ".vue"],
  excludedDirs = new Set(["node_modules", ".git", "dist", "reports", "bem-reports"])
): string[] {
  const results: string[] = [];
  if (!fs.existsSync(targetPath)) return results;
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    results.push(targetPath);
    return results;
  }
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(targetPath)) {
      // do not traverse excluded directories
      if (excludedDirs.has(name)) continue;
      // skip hidden folders (like .vscode) as well
      if (name.startsWith('.') && name !== '.') continue;

      const p = path.join(targetPath, name);
      const s = fs.statSync(p);
      if (s.isDirectory()) {
        results.push(...collectFiles(p, exts, excludedDirs));
      } else if (s.isFile()) {
        const e = path.extname(name).toLowerCase();
        if (exts.includes(e)) results.push(p);
      }
    }
  }
  return results;
}

function mergeResults(all: LintResult[]) {
  const files = all.flatMap(r => r.files);
  const violation_count = files.reduce((acc, f) => acc + f.violations.length, 0);
  return {
    summary: { file_count: files.length, violation_count },
    files,
  } as LintResult;
}

function prettyPrint(result: LintResult) {
  for (const f of result.files) {
    console.log(`\nFile: ${f.file_path}`);
    if (!f.violations || f.violations.length === 0) {
      console.log("  ✔ No BEM violations found");
      continue;
    }
    for (const v of f.violations) {
      console.log(`  - [${v.rule_id}] ${v.message}`);
      console.log(`      at ${v.line}:${v.column}  original: ${v.original}`);
      if (v.suggestion) console.log(`      suggestion: ${v.suggestion}`);
    }
  }
  console.log(`\nSummary: ${result.summary.file_count} file(s), ${result.summary.violation_count} violation(s)`);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 2 || argv[0] !== "check") {
    printUsage();
    process.exit(1);
  }

  const target = argv[1];
  const jsonOutput = argv.includes("--json");

  // Load project config early so we can obtain user ignoreList before analysis
  const rcPath = path.resolve(process.cwd(), '.bem-checker-rc.json');
  let rc: any = null;
  let userIgnoreList: string[] = [];
  try {
    if (fs.existsSync(rcPath)) {
      const rcRaw = fs.readFileSync(rcPath, { encoding: 'utf-8' });
      rc = JSON.parse(rcRaw);
      if (Array.isArray(rc?.ignoreList)) userIgnoreList = rc.ignoreList;
    }
  } catch (err) {
    console.error('Failed to read .bem-checker-rc.json:', err instanceof Error ? err.message : String(err));
  }

  const files = collectFiles(target);
  if (files.length === 0) {
    console.error("No files found to check at:", target);
    process.exit(1);
  }

  const results: LintResult[] = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, "utf8");
      const r = analyzeBEM(content, file, userIgnoreList);
      results.push(r);
    } catch (err) {
      console.error(`Failed to read/process ${file}:`, err instanceof Error ? err.message : String(err));
    }
  }

  const merged = mergeResults(results);
  if (jsonOutput) {
    console.log(JSON.stringify(merged, null, 2));
  } else {
    prettyPrint(merged);
  }

  // Output to file if .bem-checker-rc.json exists and contains output configuration
  try {
    const rcPath = path.resolve(process.cwd(), '.bem-checker-rc.json');
    const now = new Date();
    const YYYY = now.getFullYear().toString();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');

    const rcExists = fs.existsSync(rcPath);
    let usedOutPath: string | null = null;
    let usedFilename: string | null = null;

    if (rcExists) {
      const rcRaw = fs.readFileSync(rcPath, { encoding: 'utf-8' });
      const rc = JSON.parse(rcRaw);
      const out = rc?.output;
      if (out && out.path && out.filenamePattern) {
        usedOutPath = path.resolve(process.cwd(), out.path);
        usedFilename = out.filenamePattern
          .replace(/\{YYYY\}/g, YYYY)
          .replace(/\{MM\}/g, MM)
          .replace(/\{DD\}/g, DD)
          .replace(/\{HH\}/g, HH)
          .replace(/\{mm\}/g, mm)
          .replace(/\{ss\}/g, ss);
      }
    }

    // Zero-config fallback: if no rc or missing output config, write to ./bem-reports/
    if (!usedOutPath || !usedFilename) {
      usedOutPath = path.resolve(process.cwd(), 'bem-reports');
      usedFilename = `bem-report_${YYYY}-${MM}-${DD}_${HH}${mm}${ss}.json`;
    }

    fs.mkdirSync(usedOutPath, { recursive: true });
    const outPath = path.join(usedOutPath, usedFilename);
    fs.writeFileSync(outPath, JSON.stringify(merged, null, 2), { encoding: 'utf-8' });
    console.log(`Wrote report to ${outPath}`);
  } catch (err) {
    console.error('Failed to write output file from .bem-checker-rc.json:', err instanceof Error ? err.message : String(err));
  }
}

main().catch(err => {
  console.error("Unexpected error:", err);
  process.exit(2);
});
