#!/bin/sh
set -eu
state_dir="$(cd "$(dirname "$0")/.." && pwd)/data/sentinel"
mkdir -p "$state_dir"
date -u +%Y-%m-%dT%H:%M:%SZ > "$state_dir/stop"
launchctl bootout "gui/$(id -u)/com.zoraasi.sentinel" 2>/dev/null || true
