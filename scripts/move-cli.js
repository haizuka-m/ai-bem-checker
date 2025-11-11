import fs from "fs";
import path from "path";

const src = path.resolve("dist", "src", "cli.js");
const dest = path.resolve("dist", "cli.js");

if (!fs.existsSync(src)) {
  console.error(`Compiled CLI not found at ${src}. Did TypeScript compile successfully?`);
  process.exit(0);
}

let content = fs.readFileSync(src, "utf8");
if (!content.startsWith("#!")) {
  content = "#!/usr/bin/env node\n" + content;
}

// When moving compiled CLI from dist/src/cli.js -> dist/cli.js we must
// fix ESM import specifiers so the top-level CLI can import dist/src/analyzeBEM.js
// (compiled file paths are .js). Replace "from './analyzeBEM.js'" with "from './src/analyzeBEM.js'".
content = content.replace(/from\s+['"]\.\/analyzeBEM(\.js)?['"]/g, "from './src/analyzeBEM.js'");

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, content, { mode: 0o755 });
console.log(`Wrote CLI => ${dest}`);
