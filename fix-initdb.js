const fs = require('fs');
const path = require('path');

const files = [
  "app/api/projects/route.ts",
  "app/api/projects/[id]/route.ts",
  "app/api/projects/[id]/expand/route.ts",
  "app/api/stats/route.ts",
  "app/api/personas/route.ts",
  "app/api/personas/[id]/route.ts",
  "app/api/personas/generate/route.ts",
  "app/api/personas/[id]/preview/route.ts",
  "app/api/content/route.ts",
  "app/api/content/[id]/route.ts",
  "app/api/content/generate/route.ts",
  "app/api/content/regenerate/route.ts",
  "app/api/publish/route.ts",
  "app/api/publish/[id]/route.ts",
  "app/api/analysis/route.ts",
  "app/api/analysis/candidates/route.ts",
  "app/api/scraping/route.ts",
  "app/api/scraping/[runId]/route.ts",
  "app/api/scraping/[runId]/results/route.ts",
  "app/api/extract-url/route.ts"
];

const baseDir = "/Users/steven/.gemini/antigravity/scratch/reddit-ops";

files.forEach(file => {
  const filePath = path.join(baseDir, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${file}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // 1. 修改 import 语句
  if (content.includes("from '@/lib/db'")) {
    if (content.includes("import { sql } from '@/lib/db'") && !content.includes("import { initDb, sql } from '@/lib/db'")) {
      content = content.replace(
        /import\s*\{\s*sql\s*\}\s*from\s*['"]@\/lib\/db['"]/g,
        "import { initDb, sql } from '@/lib/db'"
      );
      modified = true;
      console.log(`✓ ${file}: Updated import`);
    }
  }
  
  // 2. 在每个 export async function 的 try { 后添加 await initDb()
  // 匹配 export async function XXX(...) { ... try { ... }
  const handlerRegex = /(export\s+async\s+function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?try\s*\{)(?!\s*await initDb)/g;
  
  if (handlerRegex.test(content)) {
    content = content.replace(handlerRegex, '$1\n    await initDb()');
    modified = true;
    console.log(`✓ ${file}: Added await initDb()`);
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
  } else {
    console.log(`ℹ️ ${file}: No changes needed`);
  }
});

console.log('\n✨ Done!');