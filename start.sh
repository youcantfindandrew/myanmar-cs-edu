#!/usr/bin/env bash
echo "Starting Code Myanmar..."
echo "Opening app at http://localhost:8080"
echo "Press Ctrl+C to stop the server."

# Open browser (try common commands)
if command -v xdg-open &>/dev/null; then
  (sleep 1 && xdg-open http://localhost:8080) &
elif command -v open &>/dev/null; then
  (sleep 1 && open http://localhost:8080) &
fi

python3 -m http.server 8080
