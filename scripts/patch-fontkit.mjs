import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const root = dirname(fileURLToPath(import.meta.url));
const target = resolve(root, "..", "node_modules", "fontkit", "dist", "module.mjs");

try {
  if (!existsSync(target)) {
    console.warn("[patch-fontkit] fontkit not found at", target);
    process.exit(0);
  }
  const original = readFileSync(target, "utf8");
  const fixed = original.replace(
    /import {applyDecoratedDescriptor as ([^}]+)} from "@swc\/helpers";/,
    'import {_apply_decorated_descriptor as $5OpyM$applyDecoratedDescriptor} from "@swc/helpers";',
  );
  if (original === fixed) {
    console.log("[patch-fontkit] already patched.");
  } else {
    writeFileSync(target, fixed, "utf8");
    console.log("[patch-fontkit] patched fontkit module.mjs");
  }
} catch (err) {
  console.warn("[patch-fontkit] patch failed:", err?.message ?? err);
  process.exit(0);
}
