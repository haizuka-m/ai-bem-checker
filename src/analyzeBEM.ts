// Minimal BEM analyzer implementing analyzeBEM(content, filePath)
// Returns a JSON matching spec.yaml output_formats.lint_result.schema

export type Violation = {
  rule_id: string;
  message: string;
  line: number;
  column?: number;
  original: string;
  suggestion: string;
};

export type FileResult = {
  file_path: string;
  violations: Violation[];
};

export type LintResult = {
  summary: {
    file_count: number;
    violation_count: number;
  };
  files: FileResult[];
};

// --- Helpers: extract class names (basic, regex-based) ---
export function extractClassNames(content: string): { className: string; line: number; column: number }[] {
  const results: { className: string; line: number; column: number }[] = [];

  // Match class="..." or class='...' or className="..." / className='...' or className={`...`} or className={"..."}
  const attrRegex = /class(?:Name)?\s*=\s*(?:"([^"]+)"|'([^']+)'|\{\s*`([^`]+)`\s*\}|\{\s*"([^"]+)"\s*\}|\{\s*'([^']+)'\s*\})/g;
  let m: RegExpExecArray | null;
  while ((m = attrRegex.exec(content)) !== null) {
    const raw = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? "";
    const classes = raw.split(/\s+/).map(s => s.trim()).filter(Boolean);

    // Determine the absolute index of the attribute value within the full content so we can compute line/column
    const fullMatch = m[0];
    const matchStart = m.index ?? 0; // start index of the whole attribute match
    const rawStartInFull = fullMatch.indexOf(raw);
    const attrValueStartIndex = matchStart + (rawStartInFull >= 0 ? rawStartInFull : 0);

    // For each class token, compute its absolute index by searching within raw (track offset for duplicates)
    let searchOffsetInRaw = 0;
    for (const cls of classes) {
      const idxInRaw = raw.indexOf(cls, searchOffsetInRaw);
      searchOffsetInRaw = (idxInRaw >= 0 ? idxInRaw + cls.length : searchOffsetInRaw);
      const absoluteIndex = attrValueStartIndex + (idxInRaw >= 0 ? idxInRaw : 0);

      // compute line and column (1-based)
      const before = content.slice(0, absoluteIndex);
      const lastNewline = before.lastIndexOf('\n');
      const line = before.split('\n').length;
      const column = lastNewline === -1 ? absoluteIndex + 1 : absoluteIndex - lastNewline;

      results.push({ className: cls, line, column });
    }
  }

  return results;
}

// Default ignore list (strings). Project-specific user ignore patterns will be merged with these.
export const defaultIgnoreList: string[] = [
  '^is-',
  'swiper(?:-|$)',
  'material-symbols(?:-|$)'
];

function patternToRegex(p: string): RegExp {
  // Try to build regex directly; if invalid, treat '*' as wildcard and escape other chars.
  try {
    return new RegExp(p);
  } catch (_e) {
    const placeholder = '___WILDCARD___';
    const withPlaceholder = p.replace(/\*/g, placeholder);
    const escaped = withPlaceholder.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');
    const final = escaped.replace(new RegExp(placeholder, 'g'), '.*');
    return new RegExp(final);
  }
}

// --- R4: Element nesting detection ---
export function detectElementNesting(className: string): Violation | null {
  const occurrences = (className.match(/__/g) || []).length;
  if (occurrences < 2) return null;

  const message = "Element のネスト（`__` が複数回）が検出されました。BEM では element の二重ネストを避けます (R4).";

  // Build suggestion: keep first '__', replace subsequent '__' with '-' to flatten sub-elements
  const parts = className.split("__");
  const suggestion = parts.length > 1 ? `${parts[0]}__${parts[1]}${parts.slice(2).map(p => `-${p}`).join("")}` : className;

  const violation: Violation = {
    rule_id: "R4_NO_ELEMENT_NESTING",
    message,
    line: 1,
    column: 1,
    original: className,
    suggestion,
  };
  return violation;
}

// --- Other simple rule checks (R1,R2,R3,R5) ---
export function checkOtherRules(className: string): Violation[] {
  const violations: Violation[] = [];


  // R1: block (base) should be kebab-case
  const baseSeg = className.split(/__|--/)[0];
  const kebabRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!kebabRegex.test(baseSeg)) {
    violations.push({
      rule_id: "R1_CHECK_BLOCK",
      message: "Block 名は kebab-case であるべきです（例: `profile-card`）。",
      line: 1,
      column: 1,
      original: className,
      suggestion: baseSeg
        .replace(/[_\s]+/g, "-")
        .replace(/([a-z0-9])([A-Z])/g, (_, a, b) => `${a}-${b.toLowerCase()}`)
        .toLowerCase(),
    });
  }

  // R2: Element delimiter should be __ (detect block-element or block_element)
  if (!className.includes("__")) {
    if (!className.includes("--")) {
      const hyphenParts = className.split("-");
      // If it's a simple single-hyphen block like `section-faq`, treat as valid kebab-case block and do not
      // flag R2/R3. Only flag when multiple hyphen parts suggest element naming or when underscores are used.
      if (hyphenParts.length >= 3 && /^[a-z]/.test(className)) {
        violations.push({
          rule_id: "R2_CHECK_ELEMENT",
          message: "Element は `__` で連結するべきです。`block-element` のような形式は避けてください (R2).",
          line: 1,
          column: 1,
          original: className,
          suggestion: className.replace(/-/, "__"),
        });
      }
      if (className.includes("_")) {
        violations.push({
          rule_id: "R2_CHECK_ELEMENT",
          message: "Element は `__` で連結するべきです（`_` は使用しないでください） (R2).",
          line: 1,
          column: 1,
          original: className,
          suggestion: className.replace(/_/g, "__"),
        });
      }
    }
  }

  // R3: modifier delimiter should be -- (detect underscore modifiers or single hyphen modifiers)
  if (/__[^-\s]+_[^-\s]+/.test(className)) {
    violations.push({
      rule_id: "R3_CHECK_MODIFIER",
      message: "Modifier は `--` で連結するべきです。`_` を使った形式が検出されました (R3).",
      line: 1,
      column: 1,
      original: className,
      suggestion: className.replace(/_([^_]+)$/, "--$1"),
    });
  }

  if (/^[a-z0-9]+-[a-z0-9]+$/.test(className) && !className.includes("__") && !className.includes("--")) {
    violations.push({
      rule_id: "R3_CHECK_MODIFIER",
      message: "Modifier は `--` を使用することが推奨されます（例: `block--modifier`） (R3).",
      line: 1,
      column: 1,
      original: className,
      suggestion: className.replace(/-/, "--"),
    });
  }

  // R5: modifier format check
  if (className.includes("--")) {
    const [left, right] = className.split("--");
    if (!left || !right) {
      violations.push({
        rule_id: "R5_MODIFIER_FORMAT",
        message: "Modifier の形式が不正です。`block--modifier` または `block__element--modifier` の形式にしてください (R5).",
        line: 1,
        column: 1,
        original: className,
        suggestion: left && !right ? `${left}--modifier` : `block--modifier`,
      });
    }
  }

  return violations;
}

// --- Main exported function ---
export function analyzeBEM(content: string, filePath: string, userIgnoreList: string[] = []): LintResult {
  const extracted = extractClassNames(content);
  // combine default and user-provided ignore patterns into RegExp objects
  const combinedPatterns = [...defaultIgnoreList, ...userIgnoreList];
  const combinedRegex = combinedPatterns.map(patternToRegex);
  const fileViolations: Violation[] = [];

  for (const { className, line, column } of extracted) {
    // If className matches any ignore pattern, skip further checks
    if (combinedRegex.some(r => r.test(className))) continue;
    const vR4 = detectElementNesting(className);
    if (vR4) {
      vR4.line = line;
      vR4.column = column;
      fileViolations.push(vR4);
    }

    const others = checkOtherRules(className);
    for (const v of others) {
      v.line = line;
      v.column = column;
      fileViolations.push(v);
    }
  }

  return {
    summary: {
      file_count: 1,
      violation_count: fileViolations.length,
    },
    files: [
      {
        file_path: filePath || "snippet",
        violations: fileViolations,
      },
    ],
  } as LintResult;
}
