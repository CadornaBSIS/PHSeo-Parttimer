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
    .map((line) => line.replace(/\s+$/g, ""))
    .filter((line, index, all) => {
      if (line !== "") return true;
      return all[index - 1] !== "";
    });

  const subject = truncate(lines[0].trim(), 72);
  const body = lines.slice(1).join("\n").trim();
  return body ? `${subject}\n\n${body}` : subject;
}

async function generateCommitMessage(diff, files, branch) {
  const prompt = [
    "Write a detailed conventional commit message for this staged git diff.",
    "Return plain text only, with no markdown fences.",
    "Rules:",
    "- First line: conventional commit subject in lowercase type(scope?): summary format when appropriate.",
    "- Keep the first line under 72 characters.",
    "- After the subject, include a blank line, then a short explanatory paragraph.",
    "- Then include a blank line and 3-6 bullet points describing the key code changes.",
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
    const response = await client.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        systemInstruction:
          "You write terse, accurate git commit subjects and return only the subject line.",
      },
    });

    message = response.text?.trim() || "";
  } else {
    if (!OPENAI_API_KEY) {
      fail("Missing OPENAI_API_KEY. Add it to your environment before running pnpm ai:commit.");
    }

    const client = new OpenAI({ apiKey: OPENAI_API_KEY });
    const response = await client.responses.create({
      model: DEFAULT_MODEL,
      input: prompt,
    });

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
  const detail = error instanceof Error ? error.message : String(error);
  fail(`ai commit failed: ${detail}`);
});
