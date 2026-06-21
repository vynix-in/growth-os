#!/usr/bin/env bash
# Install the recurring jobs for the Vynix Growth OS.
#
# Two jobs:
#   - hourly  "maintain": re-audit pages, apply the approval policy, refresh the
#             dashboard. Light, no AI, no content churn.
#   - weekly  "orchestrate": full pass that can regenerate content and redeploy
#             the live site. Runs Mondays at 03:00.
#
# Safe to run more than once: it replaces the existing Vynix Growth OS lines.
set -euo pipefail

GROWTH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="$(command -v node)"
MARKER="vynix-growth.js"
HOURLY="0 * * * * cd ${GROWTH_DIR} && ${NODE_BIN} bin/vynix-growth.js maintain >> logs/cron.log 2>&1"
WEEKLY="0 3 * * 1 cd ${GROWTH_DIR} && ${NODE_BIN} bin/vynix-growth.js orchestrate >> logs/cron.log 2>&1"
REBOOT="@reboot cd ${GROWTH_DIR} && ${NODE_BIN} bin/vynix-growth.js dashboard >> logs/dashboard.log 2>&1"

current="$(crontab -l 2>/dev/null | grep -v "${MARKER}" || true)"
printf '%s\n%s\n%s\n%s\n' "${current}" "${HOURLY}" "${WEEKLY}" "${REBOOT}" | sed '/^$/d' | crontab -

echo "Installed Vynix Growth OS cron jobs:"
echo "  hourly  maintain (review + policy + dashboard)"
echo "  weekly  orchestrate (full pass + deploy), Mondays 03:00"
echo "  @reboot dashboard (keeps the command center running)"
echo
echo "View with:   crontab -l"
echo "Remove with: crontab -l | grep -v '${MARKER}' | crontab -"
