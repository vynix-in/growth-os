#!/usr/bin/env bash
# Install an hourly cron entry that runs one orchestration pass.
# Safe to run more than once: it replaces the existing Vynix Growth OS line.
set -euo pipefail

GROWTH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="$(command -v node)"
MARKER="vynix-growth.js orchestrate"
LINE="0 * * * * cd ${GROWTH_DIR} && ${NODE_BIN} bin/vynix-growth.js orchestrate >> logs/cron.log 2>&1"

# Keep every existing crontab line except a previous Vynix Growth OS entry.
current="$(crontab -l 2>/dev/null | grep -v "${MARKER}" || true)"
printf '%s\n%s\n' "${current}" "${LINE}" | sed '/^$/d' | crontab -

echo "Installed hourly orchestration:"
echo "  ${LINE}"
echo
echo "View it with: crontab -l"
echo "Remove it with: crontab -l | grep -v '${MARKER}' | crontab -"
