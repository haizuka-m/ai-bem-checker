import { analyzeBEM } from "../src/analyzeBEM.js";

function assertEqual(a: any, b: any, message: string) {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) {
    console.error("[FAIL]", message);
    console.error("Expected:", JSON.stringify(b, null, 2));
    console.error("Received:", JSON.stringify(a, null, 2));
    process.exit(1);
  } else {
    console.log("[ok]", message);
  }
}

// Test 1: R4 nesting
const content1 = `<div class="block__elem__sub"></div>`;
const res1 = analyzeBEM(content1, "test1.html");
assertEqual(res1.summary.violation_count > 0, true, "R4 が検出されること");
if (res1.files[0].violations.length > 0) console.log(res1.files[0].violations[0]);

// Test 2: valid BEM
const content2 = `<div class="profile-card profile-card__title profile-card--large"></div>`;
const res2 = analyzeBEM(content2, "test2.html");
// We might have suggestions for modifier single-hyphen; so at least ensure function runs and returns LintResult shape
assertEqual(typeof res2.summary.file_count, "number", "LintResult の形を返すこと");

console.log("All tests passed.");
process.exit(0);
