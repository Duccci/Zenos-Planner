/**
 * Validate Guardrail Coverage
 *
 * Extracts guardrails from all skill files, matches them against validator source,
 * and reports coverage. Exits non-zero if any unmatched (non-allowlisted) guardrails exist.
 *
 * Usage:
 *   npx ts-node scripts/validate-guardrail-coverage.ts
 *
 * Output:
 *   - Markdown table showing guardrail status (matched / allowlisted / unmatched)
 *   - Coverage percentage
 *   - Exit code 1 if unmatched guardrails found
 */

import fs from "fs";
import path from "path";
import { globSync } from "glob";
import { GUARDRAIL_ALLOWLIST } from "../src/mcp/allowlists/guardrail-allowlist";

interface GuardrailMatch {
  text: string;
  file: string;
  line: number;
  status: "matched" | "allowlisted" | "unmatched";
  matchedIn?: string;
}

/**
 * Extract all guardrails from skill files
 */
function extractGuardrails(): GuardrailMatch[] {
  const skillFiles = globSync(".claude/skills/**/*.md", {
    ignore: ["node_modules/**"],
  });

  const guardrails: GuardrailMatch[] = [];

  for (const skillFile of skillFiles) {
    const content = fs.readFileSync(skillFile, "utf8");
    const lines = content.split("\n");

    let inGuardrails = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for **Guardrails** section header
      if (line.includes("**Guardrails**")) {
        inGuardrails = true;
        continue;
      }

      // Stop at next section header (e.g., **Functions**)
      if (inGuardrails && line.match(/^\*\*[A-Za-z]+\*\*$/)) {
        inGuardrails = false;
        break;
      }

      // Extract bullet points under Guardrails
      if (inGuardrails && line.trim().startsWith("- ")) {
        const bulletText = line.trim().substring(2);
        guardrails.push({
          text: bulletText,
          file: skillFile,
          line: i + 1,
          status: "unmatched", // default; will be updated below
        });
      }
    }
  }

  return guardrails;
}

/**
 * Check if guardrail is in the allowlist
 */
function isAllowlisted(guardrailText: string): boolean {
  return GUARDRAIL_ALLOWLIST.some((entry) => entry.pattern.test(guardrailText));
}

/**
 * Search for a guardrail match in validator source code
 */
function findValidatorMatch(guardrailText: string): string | undefined {
  const validatorFiles = globSync("src/mcp/validators/**/*.ts", {
    ignore: ["node_modules/**"],
  });

  for (const validatorFile of validatorFiles) {
    const content = fs.readFileSync(validatorFile, "utf8");

    // Simple substring match: look for key phrases from the guardrail
    const keywords = guardrailText
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3); // Filter short words

    let matchScore = 0;
    for (const keyword of keywords) {
      if (content.toLowerCase().includes(keyword)) {
        matchScore++;
      }
    }

    // If at least 2 keywords match, consider it a potential match
    if (matchScore >= 2) {
      return validatorFile;
    }
  }

  return undefined;
}

/**
 * Classify guardrail status and update matches
 */
function classifyGuardrails(guardrails: GuardrailMatch[]): GuardrailMatch[] {
  return guardrails.map((gr) => {
    if (isAllowlisted(gr.text)) {
      return { ...gr, status: "allowlisted" };
    }

    const matchedIn = findValidatorMatch(gr.text);
    if (matchedIn) {
      return { ...gr, status: "matched", matchedIn };
    }

    return gr;
  });
}

/**
 * Format guardrails as Markdown table
 */
function formatAsTable(guardrails: GuardrailMatch[]): string {
  let table = "| Guardrail | File | Status | Matched In |\n";
  table += "|-----------|------|--------|------------|\n";

  for (const gr of guardrails) {
    const shortenedText =
      gr.text.length > 60 ? gr.text.substring(0, 57) + "..." : gr.text;
    const shortFile = gr.file.replace(".claude/skills/", "");
    const matchedInText = gr.matchedIn
      ? gr.matchedIn.replace("src/mcp/validators/", "")
      : "—";

    table += `| ${shortenedText} | ${shortFile}:${gr.line} | ${gr.status} | ${matchedInText} |\n`;
  }

  return table;
}

/**
 * Main execution
 */
async function main() {
  console.log("Extracting guardrails from skill files...\n");

  let guardrails = extractGuardrails();
  console.log(`Found ${guardrails.length} guardrails\n`);

  guardrails = classifyGuardrails(guardrails);

  const matched = guardrails.filter((g) => g.status === "matched").length;
  const allowlisted = guardrails.filter((g) => g.status === "allowlisted").length;
  const unmatched = guardrails.filter((g) => g.status === "unmatched").length;

  // Output table
  console.log(formatAsTable(guardrails));
  console.log();

  // Output summary
  const coverage = ((matched + allowlisted) / guardrails.length) * 100;
  console.log(
    `Coverage: ${matched + allowlisted}/${guardrails.length} (${coverage.toFixed(1)}%)`
  );
  console.log(`  - Matched: ${matched}`);
  console.log(`  - Allowlisted: ${allowlisted}`);
  console.log(`  - Unmatched: ${unmatched}`);
  console.log();

  // Report unmatched guardrails
  if (unmatched > 0) {
    console.error(
      "ERROR: Unmatched guardrails found (no validator, not allowlisted):\n"
    );
    const unmatchedGuardrails = guardrails.filter((g) => g.status === "unmatched");
    for (const gr of unmatchedGuardrails) {
      console.error(`  ${gr.file}:${gr.line}`);
      console.error(`    ${gr.text}\n`);
    }
    process.exit(1);
  }

  console.log("✓ All guardrails are matched or allowlisted");
  process.exit(0);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
