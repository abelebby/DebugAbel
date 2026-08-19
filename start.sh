#!/usr/bin/env bash
# Bug Tracker - one-step local start (macOS / Linux).
# Installs dependencies if needed, applies database migrations, builds, starts
# the app on 127.0.0.1 and opens your browser.
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-3000}"

if [ ! -f .env ]; then
  echo "No .env file found."
  cp .env.example .env
  echo "-> Created .env from .env.example."
  echo "   Open it, fill in DATABASE_URL, AUTH_PASSWORD and SESSION_SECRET, then run this again."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing dependencies (first run only)…"
  npm install
fi

if [ ! -d mcp-server/node_modules ]; then
  echo "Installing MCP server dependencies…"
  (cd mcp-server && npm install)
fi

echo "Applying database migrations…"
npm run db:migrate

echo "Building…"
npm run build

echo "Starting on http://127.0.0.1:${PORT} (localhost only)…"
PORT="$PORT" npm start &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT

# Wait for the server to answer before opening the browser.
for _ in $(seq 1 40); do
  if curl -sf -o /dev/null "http://127.0.0.1:${PORT}/login"; then break; fi
  sleep 0.5
done

URL="http://localhost:${PORT}"
if command -v open >/dev/null 2>&1; then open "$URL"
elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"
else echo "Open $URL in your browser."; fi

wait $SERVER_PID
