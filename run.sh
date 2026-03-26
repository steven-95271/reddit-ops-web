#!/bin/bash
# Reddit Ops – Startup Script
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Reddit内容运营系统"
echo "─────────────────────────────────"

# Check Python
if ! command -v python3 &>/dev/null; then
  echo "❌ 未找到 python3，请先安装 Python 3.10+"
  exit 1
fi

# Create virtualenv if needed
if [ ! -d "venv" ]; then
  echo "📦 创建虚拟环境..."
  python3 -m venv venv
fi

# Activate
source venv/bin/activate

# Install dependencies
echo "📦 安装依赖..."
pip install -q -r requirements.txt

# Load .env if exists
if [ -f ".env" ]; then
  echo "⚙️  加载 .env 配置..."
  export $(grep -v '^#' .env | xargs)
fi

echo ""
echo "✅ 启动 Flask 服务..."
if [ -n "$APP_URL" ]; then
  echo "   地址: $APP_URL"
elif [ -n "$PORT" ]; then
  echo "   地址: http://127.0.0.1:$PORT"
else
  echo "   地址: http://127.0.0.1:5000"
fi
echo "   按 Ctrl+C 退出"
echo "─────────────────────────────────"

python app.py
