#!/bin/bash
# Save conversation history to .conversation-history/
# Usage: ./save-conversation.sh [role] [topic]

set -e

TIMESTAMP=$(date +"%Y-%m-%d_%H%M")
MONTH=$(date +%Y-%m)
ROLE=${1:-"queen"}
TOPIC=${2:-"general"}

# Sanitize topic for filename (remove spaces, special chars)
TOPIC_SAFE=$(echo "$TOPIC" | sed 's/[^a-zA-Z0-9_-]/-/g' | tr '[:upper:]' '[:lower:]')
ROLE_SAFE=$(echo "$ROLE" | tr '[:upper:]' '[:lower:]')

FILENAME=".conversation-history/${MONTH}/${TIMESTAMP}_${ROLE_SAFE}_${TOPIC_SAFE}.md"
mkdir -p "$(dirname "$FILENAME")"

echo "=== Compacting conversation..."
opencode compact

echo "=== Exporting to $FILENAME..."
opencode export > "$FILENAME"

# Create/update latest symlink
LATEST_LINK=".conversation-history/latest.md"
rm -f "$LATEST_LINK"
ln -s "$FILENAME" "$LATEST_LINK"

echo ""
echo "✅ 对话已保存: $FILENAME"
echo "🔗 快捷链接: $LATEST_LINK"
