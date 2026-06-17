#!/usr/bin/env bash
# One-shot GitHub repo optimization: description, topics, homepage.
# Requires the GitHub CLI (`gh auth login` first).
#
#   REPO=yerdaulet-damir/json-vision ./scripts/setup-github.sh
#
# After running, upload docs/social-preview.png manually:
#   Repo → Settings → General → Social preview → Upload an image
# (GitHub has no API for the social preview image yet.)

set -euo pipefail
REPO="${REPO:-yerdaulet-damir/json-vision}"

DESCRIPTION="Open multi-GB JSON, JSONL & NDJSON in VS Code without freezing — a large-file JSON viewer that streams from disk and shows data as virtualized tables, posts, trees & schema graphs with live search, filter & sort. 100% local."

HOMEPAGE="https://marketplace.visualstudio.com/items?itemName=aimyerdaulet.json-vision"

# Up to 20 topics — chosen for high-traffic topic pages AND niche, low-competition discovery.
TOPICS=(
  json jsonl ndjson json-lines
  json-viewer json-visualizer data-viewer log-viewer
  vscode-extension vscode openvsx
  large-files big-data streaming table-view
  data-visualization developer-tools devtools
  react typescript
)

echo "→ Setting description & homepage on $REPO"
gh repo edit "$REPO" --description "$DESCRIPTION" --homepage "$HOMEPAGE"

echo "→ Setting ${#TOPICS[@]} topics"
TOPIC_ARGS=()
for t in "${TOPICS[@]}"; do TOPIC_ARGS+=(--add-topic "$t"); done
gh repo edit "$REPO" "${TOPIC_ARGS[@]}"

echo "✓ Done. Now upload docs/social-preview.png in Settings → General → Social preview."
