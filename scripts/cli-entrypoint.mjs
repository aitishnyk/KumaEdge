/**
 * Compare real filesystem paths rather than literal file: URLs.
 *
 * Node resolves import.meta.url to the physical file, while process.argv[1]
 * may be a logical macOS /var -> /private/var path or another symlink.
 * A string comparison silently skips CLI entrypoints and can report exit 0.
 * Keep imported modules inert.
 */
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function isDirectInvocation(moduleUrl, scriptPath = process.argv[1]) {
  if (!scriptPath) return false;
  try {
    return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(scriptPath);
  } catch {
    return false;
  }
}
