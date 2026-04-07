#!/bin/bash
# 批量添加 initDb 到 API 文件

FILES=(
  "app/api/projects/route.ts"
  "app/api/projects/[id]/route.ts"
  "app/api/projects/[id]/expand/route.ts"
  "app/api/stats/route.ts"
  "app/api/personas/route.ts"
  "app/api/personas/[id]/route.ts"
  "app/api/personas/generate/route.ts"
  "app/api/personas/[id]/preview/route.ts"
  "app/api/content/route.ts"
  "app/api/content/[id]/route.ts"
  "app/api/content/generate/route.ts"
  "app/api/content/regenerate/route.ts"
  "app/api/publish/route.ts"
  "app/api/publish/[id]/route.ts"
  "app/api/analysis/route.ts"
  "app/api/analysis/candidates/route.ts"
  "app/api/scraping/route.ts"
  "app/api/scraping/[runId]/route.ts"
  "app/api/scraping/[runId]/results/route.ts"
  "app/api/extract-url/route.ts"
)

cd /Users/steven/.gemini/antigravity/scratch/reddit-ops

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing: $file"
    
    # 检查文件是否包含 from '@/lib/db'
    if grep -q "from '@/lib/db'" "$file"; then
      # 修改 import 语句，添加 initDb
      if grep -q "import { sql } from '@/lib/db'" "$file"; then
        sed -i '' "s/import { sql } from '@/lib/db'/import { initDb, sql } from '@/lib/db'/g" "$file"
        echo "  ✓ Updated import"
      elif grep -q "import { initDb, sql } from '@/lib/db'" "$file"; then
        echo "  ℹ️  Already has initDb import"
      fi
      
      # 检查是否已经有 await initDb()
      if ! grep -q "await initDb()" "$file"; then
        # 在每个 try { 后添加 await initDb()
        # 使用 perl 进行多行替换
        perl -i -pe 's/(export\s+async\s+function\s+\w+\([^)]*\)\s*\{[^}]*?try\s*\{)(?!\s*await initDb)/$1\n    await initDb()/s' "$file" 2>/dev/null || true
        echo "  ✓ Added await initDb()"
      else
        echo "  ℹ️  Already has await initDb()"
      fi
    else
      echo "  ⚠️  No db import found"
    fi
  else
    echo "❌ File not found: $file"
  fi
  echo ""
done

echo "Done!"