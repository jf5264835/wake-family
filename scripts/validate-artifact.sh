#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${WAKE_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/project-env.sh" -- "$0" "$@"
fi

worker="${WAKE_PROJECT_ROOT}/dist/server/index.js"
[[ -f "${worker}" ]] || {
  echo "Missing Worker entry: dist/server/index.js" >&2
  exit 1
}

node --input-type=module - "${worker}" <<'NODE'
import { pathToFileURL } from "node:url";

const [workerPath] = process.argv.slice(2);
const workerUrl = pathToFileURL(workerPath);
workerUrl.searchParams.set("artifact-validation", `${process.pid}-${Date.now()}`);
const module = await import(workerUrl.href);
if (typeof module.default?.fetch !== "function") {
  throw new Error("Worker artifact does not export default.fetch");
}
NODE

echo "Validated Worker artifact: ESM default.fetch is present."
