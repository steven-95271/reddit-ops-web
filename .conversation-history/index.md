# 对话历史索引

记录所有已保存的对话上下文，方便追溯和承接。

## 快速导航

- [最新对话](./latest.md)（软链接，总是指向最新的导出）

## 按月份归档

### 2026-04

| 时间 | 角色 | 主题 | 关键决策/状态 | 文件 |
|------|------|------|---------------|------|
| 2026-04-02 16:21 | queen | workflow-docs | 创建 L1-L3 流程图，配置 GitHub Pages | [查看](./2026-04/2026-04-02_1621_queen_workflow-docs.md) |
| 2026-04-02 16:05 | queen | 项目迁移 | 复制到 "/Users/steven/Social Media/Reddit" | [查看](./2026-04/2026-04-02_1605_queen_project-relocation.md) |
| 2026-04-02 15:45 | queen | 对话管理优化 | 创建 `.conversation-history/` 系统 | [查看](./2026-04/2026-04-02_1545_queen_conversation-mgmt.md) |

---

## 使用规范

### 结束对话时

```bash
# 保存当前对话
./save-conversation.sh [role] [topic]

# 示例
./save-conversation.sh queen reddit-ops-deploy
./save-conversation.sh worker fix-auth-bug
./save-conversation.sh inspector code-review
```

### 新对话承接时

```bash
# 方法1：读取最新对话
opencode read .conversation-history/latest.md

# 方法2：读取特定日期的对话
opencode read .conversation-history/2026-04/2026-04-02_1545_queen_conversation-mgmt.md

# 方法3：先查看索引，再选择
opencode read .conversation-history/index.md
```

### 命名规范

文件名格式：`{YYYY-MM-DD}_{HHMM}_{role}_{topic}.md`

- `role`: queen / worker / inspector / user
- `topic`: 简短描述，用连字符连接

---

## 目录结构

```
.conversation-history/
├── index.md              # 本索引文件
├── latest.md             # 软链接 → 最新的导出文件
├── 2026-04/              # 按月归档
│   ├── 2026-04-02_1545_queen_conversation-mgmt.md
│   └── ...
└── 2026-05/              # 下个月
    └── ...
```
