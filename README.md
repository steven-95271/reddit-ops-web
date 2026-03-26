# Reddit内容运营自动化系统

> 每日自动抓取 Reddit 热点、分类、生成三账号人设内容，并提供 Web 审核界面。

---

## 快速启动

```bash
cd /path/to/reddit-ops
chmod +x run.sh
./run.sh
# 访问 http://127.0.0.1:5000
```

或手动：
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

---

## 配置（可选）

创建 `.env` 文件（无此文件系统仍可正常运行，使用模拟模式）：

```env
# OpenAI（用于内容生成，可选）
OPENAI_API_KEY=sk-...

# Telegram 通知（可选）
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# 邮件通知（可选）
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_USER=your@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_TO=notify@example.com

# 其他
APP_URL=http://127.0.0.1:5000
PORT=5000
```

---

## 功能模块

### 1. 自动抓取
- 每日 09:00（北京时间）自动执行
- 抓取过去 48 小时内含关键词 "open ear earbuds" 的帖子
- 来源：r/headphones, r/earbuds, r/audiophile, r/running, r/commuting
- API：Arctic Shift Pushshift 镜像

### 2. 5类热点分类
| 代码 | 名称 | 识别规则 |
|------|------|----------|
| A | 结构型测评 | review, comparison, ranking... |
| B | 场景痛点 | problem, issue, hate, broke... |
| C | 观点争议 | 评论/点赞比高，争议关键词 |
| D | 竞品KOL | Shokz, Bose, Sony, Apple... |
| E | 平台趋势 | 高赞贴，trending 类词 |

### 3. 三账号人设
| 账号 | 人设 | 风格 |
|------|------|------|
| SportyRunner | 运动跑者 | 体验分享，活泼 |
| AudioGeek | 音频发烧友 | 技术解析，专业 |
| CommuterLife | 通勤上班族 | 实用清单，贴近生活 |

每账号每日生成 2 条内容 = 共 6 条。

### 4. Web 审核界面
- **Dashboard**：数据概览 + 热点分布图表
- **候选帖子**：筛选、排序、查看详情
- **内容编辑器**：审核、编辑、复制、标记状态
- **历史记录**：已发布内容追踪

### 5. 通知系统
- Telegram Bot 通知（配置后生效）
- 邮件通知（配置后生效）
- 消息包含摘要数据和审核链接

---

## 数据结构

```
data/
├── reddit/
│   └── YYYY-MM-DD/
│       ├── raw_posts.json       # 原始抓取
│       ├── candidates.json      # 分类后候选
│       └── generated_content.json  # 生成内容
└── history/
    └── publish_log.json         # 发布历史
```

数据自动保留 30 天，超期自动清理。

---

## 手动触发

在 Dashboard 点击「⚡ 执行流水线」按钮，选择：
- **模拟模式**（推荐测试用）：使用内置模拟数据，无需任何 API Key
- **真实模式**：调用 Pushshift API 抓取真实数据

---

## 技术栈

- **后端**：Python 3.10+ / Flask 3.x / APScheduler
- **前端**：Tailwind CSS / Chart.js / Vanilla JS
- **存储**：JSON 文件（无需数据库）
- **内容生成**：OpenAI GPT-4o-mini（可选）
