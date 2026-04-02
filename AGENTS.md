# AGENTS.md — HiveCode 多 Agent 协作框架

> 蜂群协作，各司其职。一个蜂后指挥，多个专业蜂各司其职。

## 项目概述

这是一个 Reddit 运营 Web 全栈项目，包含：
- **后端**：Python Flask 应用（app.py），负责数据处理、爬虫管理、内容生成等
- **前端**：web/ 目录下的 Web 应用
- **数据**：data/ 目录下存储 Reddit 帖子、候选内容、生成内容等

## HiveCode 协作架构

本项目采用 HiveCode 蜂群式多 AI 协作架构，配置三个 Agent 角色协同工作：

### Agent 角色

| 角色 | 模型 | 类型 | 职责 |
|------|------|------|------|
| **queen** (build) | Kimi K2.5 | primary | 蜂后 / 总架构师 |
| **worker** | Minimax M2.7 HighSpeed | subagent | 工蜂 / 代码实现者 |
| **inspector** | Qwen 3.6 Plus Free | subagent | 侦察蜂 / 代码审查员 |

### 协作工作流

```
用户需求
   │
   ▼
┌─────────────┐
│   queen     │  📋 分析需求，拆解为 2-5 个子任务
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   worker    │  🐝 接收具体编码任务，实现功能代码
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  inspector  │  🔍 审查代码，返回结构化审查报告
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   queen     │  🔄 审查意见 → 决定修复方式 → 📦 汇总报告
└─────────────┘
```

### 详细流程

1. **📋 拆解** — queen 接收用户需求，分析并拆解为 2-5 个可并行或串行的子任务，输出任务清单
2. **🐝 分派** — queen 将编码任务分派给 @worker，每个任务清晰明确
3. **🔍 审查** — worker 完成后，queen 将代码提交给 @inspector 审查
4. **🔄 修正** — 如果 inspector 发现问题，queen 决定让 worker 修复或自行修复
5. **📦 交付** — queen 汇总所有结果，向用户报告完成情况

### 触发方式

- **完整协作流程**：消息开头写 **"请拆解并分工"**，queen 自动进入 HiveCode 协作模式
- **手动调用 worker**：在消息中使用 `@worker`
- **手动调用 inspector**：在消息中使用 `@inspector`
- **切换主 Agent**：按 `Tab` 键

## 代码规范

### Python 后端

1. **类型注解**：所有函数/方法必须添加类型注解
2. **错误处理**：使用 try-except 处理可能的异常，不要吞掉异常
3. **命名规范**：
   - 变量/函数：snake_case
   - 类名：PascalCase
   - 常量：UPPER_SNAKE_CASE
4. **文档字符串**：所有公开函数/类必须有 docstring
5. **依赖管理**：新增依赖必须添加到 requirements.txt

### 前端

1. **代码风格**：遵循项目现有的代码风格
2. **组件设计**：保持组件职责单一，避免过度耦合
3. **状态管理**：合理使用状态管理，避免 prop drilling

### 通用规范

1. **提交信息**：使用中文编写，格式：`类型: 描述`（如 `feat: 添加用户认证功能`）
2. **注释**：复杂逻辑必须添加注释，解释"为什么"而不是"做什么"
3. **安全**：
   - 不硬编码敏感信息
   - 对用户输入进行验证
   - 使用参数化查询防止 SQL 注入
4. **性能**：
   - 避免 N+1 查询
   - 合理使用缓存
   - 注意内存使用

## 项目结构

```
├── app.py                  # Flask 主应用
├── config.py               # 配置管理
├── data_manager.py         # 数据管理
├── reddit_scraper.py       # Reddit 爬虫
├── content_generator.py    # 内容生成
├── scoring.py              # 评分系统
├── scheduler.py            # 定时任务
├── models.py               # 数据模型
├── web/                    # 前端应用
├── data/                   # 数据存储
│   ├── reddit/             # Reddit 帖子数据
│   ├── product_cards/      # 产品卡片
│   └── history/            # 历史记录
├── .opencode/              # OpenCode Agent 配置
│   └── agents/             # HiveCode Agent 系统提示词
└── opencode.json           # HiveCode 主配置
```

## 注意事项

1. **模型 ID**：配置中使用的模型 ID 已确认可用，如需调整请在 opencode.json 中修改
2. **API Key**：确保已通过 `/connect` 命令配置好 moonshot、minimax、opencode 三个 provider 的 API Key
3. **权限**：inspector Agent 被设置为只读，不能修改文件，只能提供审查意见
4. **温度设置**：各 Agent 的温度已根据角色特点设置，如需调整可在 opencode.json 中修改

## 对话状态管理

### 结束对话时（保存上下文）

当你需要结束当前对话（上下文过长或切换 Agent）时：

```bash
# 保存当前对话（自动命名：时间_角色_主题）
./save-conversation.sh [role] [topic]

# 示例
./save-conversation.sh queen reddit-ops-deploy
./save-conversation.sh worker fix-auth-bug
```

**会自动创建：**
- `.conversation-history/2026-04/2026-04-02_1545_queen_reddit-ops.md`
- 软链接 `.conversation-history/latest.md` → 最新文件

### 新对话承接时

```bash
# 方法1：直接读取最新对话
@queen 读取 .conversation-history/latest.md

# 方法2：查看索引选择特定对话
@queen 读取 .conversation-history/index.md
```

### 快速命令参考

| 场景 | 命令 |
|------|------|
| 保存当前对话 | `./save-conversation.sh queen reddit-task` |
| 读取最新对话 | `@queen read .conversation-history/latest.md` |
| 查看历史索引 | `@queen read .conversation-history/index.md` |

---

**目录结构：**
```
.conversation-history/
├── index.md           # 对话索引和快速导航
├── latest.md          # 软链接 → 最新导出
└── 2026-04/           # 按月归档
    └── 2026-04-02_1545_queen_reddit-task.md
```
