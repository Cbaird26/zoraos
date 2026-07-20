#!/bin/bash
# ZoraOS Multi-Machine Cluster Setup
# Run on each Mac to configure it for the ZoraOS cluster
set -e

NODE_NAME="${1:-$(scutil --get ComputerName | tr '[:upper:]' '[:lower:]' | sed 's/ /-/g')}"
NODE_ROLE="${2:-worker}"

echo "=== ZoraOS Cluster Setup ==="
echo "  Hostname: $(hostname)"
echo "  Node Name: $NODE_NAME"
echo "  Role: $NODE_ROLE"
echo ""

# Check requirements
for cmd in python3 curl git; do
    if ! command -v $cmd &> /dev/null; then
        echo "Error: $cmd not found"
        exit 1
    fi
done

# Clone/update ZoraOS
if [ ! -d "$HOME/zoraos" ]; then
    echo "[+] Setting up ZoraOS..."
    mkdir -p "$HOME/zoraos"
fi

# Create node config
cat > "$HOME/zoraos/.env" << EOF
ZORAOS_ENV=production
ZORAOS_NODE_NAME=$NODE_NAME
ZORAOS_NODE_ROLE=$NODE_ROLE

# M5 Orchestrator address
ZORAOS_ORCHESTRATOR_HOST=http://m5-orchestrator.local:8000

# Node capabilities
ZORAOS_NODE_CAPABILITIES=$([ "$NODE_ROLE" = "orchestrator" ] && echo "orchestrator,models,tools" || echo "models,tools")
EOF

echo "[+] Node configured as $NODE_NAME ($NODE_ROLE)"
echo ""

if [ "$NODE_ROLE" = "orchestrator" ]; then
    echo "This machine will run:"
    echo "  - API Gateway"
    echo "  - Planner & Router"
    echo "  - Web UI"
    echo ""
    echo "Start with: cd ~/zoraos && bash scripts/start.sh"
else
    echo "This machine will run:"
    echo "  - Ollama (local models)"
    echo "  - Worker processes"
    echo ""
    echo "Start Ollama: ollama serve"
    echo "Start worker: python -m scheduler.runner"
fi
