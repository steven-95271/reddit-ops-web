#!/bin/bash

# Reddit Ops 自动推送脚本
# 每天 23:00 北京时间自动 commit 并 push

cd /Users/steven/.gemini/antigravity/scratch/reddit-ops

# 检查是否有未提交的更改
if git diff --quiet && git diff --cached --quiet; then
    echo "$(date): 没有需要推送的更改"
    exit 0
fi

# 获取更改的文件列表
CHANGED_FILES=$(git status --porcelain)

# 生成 commit message
if [ -n "$CHANGED_FILES" ]; then
    # 分析更改的文件类型，生成对应的 commit message
    if echo "$CHANGED_FILES" | grep -q "docs/"; then
        if echo "$CHANGED_FILES" | grep -q "workflow/"; then
            MSG="docs: 更新工作流程文档"
        elif echo "$CHANGED_FILES" | grep -q "index.md"; then
            MSG="docs: 更新项目文档"
        else
            MSG="docs: 更新文档"
        fi
    elif echo "$CHANGED_FILES" | grep -q "app.py\|config.py\|models.py"; then
        MSG="feat: 更新核心功能模块"
    elif echo "$CHANGED_FILES" | grep -q ".py"; then
        MSG="refactor: 优化代码实现"
    elif echo "$CHANGED_FILES" | grep -q "web/"; then
        MSG="feat: 更新前端组件"
    elif echo "$CHANGED_FILES" | grep -q "requirements.txt"; then
        MSG="chore: 更新依赖配置"
    else
        MSG="chore: 项目更新 ($(date +%Y-%m-%d))"
    fi
    
    # 添加所有更改
    git add -A
    
    # Commit
    git commit -m "$MSG"
    
    # Push
    git push origin main
    
    echo "$(date): 已推送 - $MSG"
else
    echo "$(date): 没有需要推送的更改"
fi
