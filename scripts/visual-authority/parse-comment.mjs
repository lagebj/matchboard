// Visual Authority Gate (ADR-0159) — structured PR-comment command parsing. Pure, synchronous.
// Recognized commands (first non-empty line, trimmed, case-sensitive on the command token):
//   /visual-approve <sha>            (optional next line: "scenarios: B01, B04")
//   /visual-reject <sha>              (rest of the comment body, trimmed, is the reason)
//   /visual-review deploy
//   /visual-review release
// Anything else returns { kind: "none" } — unrecognized comments are silently ignored, not
// treated as errors, since most PR comments are ordinary conversation.

const SHA_RE = /^[0-9a-f]{7,40}$/i;

function firstNonEmptyLine(body) {
  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) return { trimmed, index: lines.indexOf(line), lines };
  }
  return null;
}

function parseScenarios(line) {
  const match = line?.trim().match(/^scenarios:\s*(.+)$/i);
  if (!match) return null;
  return match[1]
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @param {string} commentBody
 * @returns {
 *   | { kind: "approve", sha: string, scenarios: string[] | null }
 *   | { kind: "reject", sha: string, reason: string | null }
 *   | { kind: "deploy-request" }
 *   | { kind: "release-request" }
 *   | { kind: "none" }
 * }
 */
export function parseCommand(commentBody) {
  if (typeof commentBody !== "string") return { kind: "none" };

  const first = firstNonEmptyLine(commentBody);
  if (!first) return { kind: "none" };
  const { trimmed, index, lines } = first;

  const approveMatch = trimmed.match(/^\/visual-approve\s+(\S+)\s*$/);
  if (approveMatch) {
    if (!SHA_RE.test(approveMatch[1])) return { kind: "none" };
    const nextLine = lines[index + 1];
    const scenarios = parseScenarios(nextLine);
    return { kind: "approve", sha: approveMatch[1].toLowerCase(), scenarios };
  }

  const rejectMatch = trimmed.match(/^\/visual-reject\s+(\S+)\s*$/);
  if (rejectMatch) {
    if (!SHA_RE.test(rejectMatch[1])) return { kind: "none" };
    const reasonLines = lines.slice(index + 1).join("\n").trim();
    return { kind: "reject", sha: rejectMatch[1].toLowerCase(), reason: reasonLines.length > 0 ? reasonLines : null };
  }

  if (trimmed === "/visual-review deploy") return { kind: "deploy-request" };
  if (trimmed === "/visual-review release") return { kind: "release-request" };

  return { kind: "none" };
}
