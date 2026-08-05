#!/usr/bin/env bash
set -euo pipefail

selfhost_data_dir="${SELFHOST_DATA_DIR:-/data}"
selfhost_port="${PORT:-3000}"
selfhost_xdg_dir="${selfhost_data_dir}/xdg"
mkdir -p "${selfhost_data_dir}" "${selfhost_xdg_dir}"

export CI=1
export XDG_CONFIG_HOME="${selfhost_xdg_dir}"
export WRANGLER_LOG_PATH="${selfhost_data_dir}/wrangler.log"

npx wrangler d1 migrations apply DB \
  --config wrangler.selfhost.jsonc \
  --local \
  --persist-to "${selfhost_data_dir}"

wrangler_args=(
  dev dist/server/index.js
  --config wrangler.selfhost.jsonc
  --local
  --persist-to "${selfhost_data_dir}"
  --ip 0.0.0.0
  --port "${selfhost_port}"
  --log-level warn
)

for selfhost_var in PCO_APP_ID PCO_SECRET GOOGLE_MAPS_API_KEY ADMIN_EMAILS SELF_HOST_AUTH_EMAIL_HEADER SELF_HOST_AUTH_NAME_HEADER; do
  if [[ -n "${!selfhost_var:-}" ]]; then
    wrangler_args+=(--var "${selfhost_var}:${!selfhost_var}")
  fi
done

exec npx wrangler "${wrangler_args[@]}"
