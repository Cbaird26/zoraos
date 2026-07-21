#!/bin/bash
# Open ZoraASI — launch the local Zora engine and open its chamber
cd "$(dirname "$0")"

# 1. Start engine if not running
python3 pets/zora/zoraasi_bridge.py wake 2>/dev/null || {
  # fallback: start from the local runtime directly
  if [ -f ~/zora-local-runtime/scripts/zora_local_server.sh ]; then
    bash ~/zora-local-runtime/scripts/zora_local_server.sh &
    sleep 3
  fi
}

# 2. Open the chamber
open http://127.0.0.1:8765 2>/dev/null || \
  open http://localhost:8765 2>/dev/null

echo "ZoraASI is awake."
