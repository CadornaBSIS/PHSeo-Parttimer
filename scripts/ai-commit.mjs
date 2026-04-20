import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import OpenAI from "openai";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PROVIDER = process.env.AI_COMMIT_PROVIDER || (GEMINI_API_KEY ? "gemini" : "openai");
const DEFAULT_MODEL =
  PROVIDER === "gemini"
    ? process.env.AI_COMMIT_MODEL || process.env.GEMINI_COMMIT_MODEL || "gemini-2.5-flash"
    : process.env.AI_COMMIT_MODEL || process.env.OPENAI_COMMIT_MODEL || "gpt-5.3-codex";
const RETRYABLE_STATUS_CODES = new Set([429, 503]);
const RETRYABLE_STATUS_TEXT = new Set(["RESOURCE_EXHAUSTED", "UNAVAILABLE"]);
const EMOJI_BY_TYPE = {
  feat: "✨",
  fix: "🐛",
  refactor: "♻️",
  docs: "📝",
  style: "🎨",
  test: "✅",
  chore: "🧹",
  perf: "⚡",
  build: "🏗️",
  ci: "🤖",
  revert: "⏪",
};

function runGit(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function truncate(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorDetail(error) {
  return error instanceof Error ? error.message : String(error);
}

function parseRetryDelayMs(detail) {
  const match =
    detail.match(/Please retry in\s+([\d.]+)s/i) ||
    detail.match(/"retryDelay":"(\d+)s"/i);
  if (!match) return null;

  const seconds = Number.parseFloat(match[1]);
  return Number.isFinite(seconds) ? Math.ceil(seconds * 1000) : null;
}

function isRetryableProviderError(error) {
  const detail = getErrorDetail(error);
  return (
    [...RETRYABLE_STATUS_CODES].some((code) => detail.includes(`"code":${code}`)) ||
    [...RETRYABLE_STATUS_TEXT].some((status) => detail.includes(`"status":"${status}"`))
  );
}

async function withRetries(task, label, maxAttempts = 4) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;

      if (!isRetryableProviderError(error) || attempt === maxAttempts) {
        break;
      }

      const detail = getErrorDetail(error);
      const retryDelayMs = parseRetryDelayMs(detail) ?? attempt * 5000;
      console.warn(
        `${label} attempt ${attempt}/${maxAttempts} failed with a temporary provider error. Retrying in ${Math.ceil(retryDelayMs / 1000)}s...`,
      );
      await sleep(retryDelayMs);
    }
  }

  throw lastError;
}

function normalizeCommitMessage(message) {
  const cleaned = message
    .replace(/^```(?:\w+)?\r?\n?/g, "")
    .replace(/\r?\n?```$/g, "")
    .trim();

  if (!cleaned) {
    fail("The AI response did not include a commit message.");
  }

  const lines = cleaned
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/\s+$/g, "")
        .replace(/^\*\s+/, "- ")
        .replace(/^[•·]\s+/, "- "),
    )
    .filter((line, index, all) => {
      if (line !== "") return true;
      return all[index - 1] !== "";
    });

  let subject = lines[0].trim();
  if (!/^[^\w\s]+\s+/.test(subject)) {
    const typeMatch = subject.match(/^([a-z]+)(\(|:)/);
    const emoji = typeMatch ? EMOJI_BY_TYPE[typeMatch[1]] || "✨" : "✨";
    subject = `${emoji} ${subject}`;
  }
  subject = truncate(subject, 72);
  const body = lines.slice(1).join("\n").trim();
  return body ? `${subject}\n\n${body}` : subject;
}

async function generateCommitMessage(diff, files, branch) {
  const prompt = [
    "Write a detailed conventional commit message for this staged git diff.",
    "Return plain text only, with no markdown fences.",
    "Rules:",
    "- First line: start with an appropriate emoji, then a conventional commit subject in lowercase type(scope?): summary format when appropriate.",
    "- Example subject: ✨ feat(exports): redesign schedule pdf layout",
    "- Keep the first line under 72 characters.",
    "- After the subject, include a blank line, then a short explanatory paragraph.",
    "- Then include a blank line and 3-6 bullet points describing the key code changes.",
    "- Every bullet must start with '-'. Do not use '*'.",
    "- End with a final short paragraph describing the impact or behavior change.",
    "- Be specific about the actual change.",
    "- Do not wrap the output in quotes.",
    `Current branch: ${branch || "unknown"}`,
    `Changed files: ${files.join(", ") || "unknown"}`,
    "",
    "Staged diff:",
    diff,
  ].join("\n");

  let message = "";

  if (PROVIDER === "gemini") {
    if (!GEMINI_API_KEY) {
      fail("Missing GEMINI_API_KEY. Add it to your environment before running pnpm ai:commit.");
    }

    const client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const response = await withRetries(
      () =>
        client.models.generateContent({
          model: DEFAULT_MODEL,
          contents: prompt,
          config: {
            systemInstruction:
              "You write terse, accurate git commit subjects and return only the subject line.",
          },
        }),
      `Gemini ${DEFAULT_MODEL}`,
    );

    message = response.text?.trim() || "";
  } else {
    if (!OPENAI_API_KEY) {
      fail("Missing OPENAI_API_KEY. Add it to your environment before running pnpm ai:commit.");
    }

    const client = new OpenAI({ apiKey: OPENAI_API_KEY });
    const response = await withRetries(
      () =>
        client.responses.create({
          model: DEFAULT_MODEL,
          input: prompt,
        }),
      `OpenAI ${DEFAULT_MODEL}`,
    );

    message = response.output_text?.trim() || "";
  }

  if (!message) {
    fail("The AI response did not include a commit message.");
  }

  return normalizeCommitMessage(message);
}

async function main() {
  try {
    runGit(["rev-parse", "--is-inside-work-tree"]);
  } catch {
    fail("This command must be run inside a git repository.");
  }

  const diff = runGit(["diff", "--cached", "--unified=0", "--no-color"]);
  if (!diff) {
    fail("No staged changes found. Stage files first with git add and run pnpm ai:commit again.");
  }

  const files = runGit(["diff", "--cached", "--name-only"])
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);
  const branch = runGit(["branch", "--show-current"]);

  const dryRun = process.argv.includes("--dry-run");
  const message = await generateCommitMessage(diff, files, branch);

  if (dryRun) {
    console.log(message);
    return;
  }

  const tempDir = mkdtempSync(join(tmpdir(), "ai-commit-"));
  const messageFile = join(tempDir, "COMMIT_EDITMSG");

  try {
    writeFileSync(messageFile, `${message}\n`, "utf8");
    execFileSync("git", ["commit", "-F", messageFile], { stdio: "inherit" });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  const detail = getErrorDetail(error);
  fail(`ai commit failed: ${detail}`);
});
