#!/bin/bash
set -e

echo "=== ZoraOS Startup ==="
echo ""

# Check for .env
if [ ! -f ".env" ]; then
    echo "[!] No .env found. Copying from .env.example..."
    cp .env.example .env
    echo "[!] Edit .env with your API keys before using model providers."
    echo ""
fi

# Create data directories
mkdir -p data/chroma data/logs

# Start services
echo "[+] Starting ZoraOS services..."

# Check for docker
if command -v docker &> /dev/null; then
    echo "[+] Docker available. Starting containers..."
    docker compose up -d postgres redis chroma
    echo "[+] Waiting for databases..."
    sleep 3
else
    echo "[!] Docker not found. Starting in standalone mode."
fi

# Install dependencies if needed
if [ ! -d ".venv" ]; then
    echo "[+] Creating virtual environment..."
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -e ".[all]"
fi

# Start the API server
echo "[+] Starting API server on http://localhost:8000"
echo "[+] API docs at http://localhost:8000/docs"
echo ""
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload --log-level info
