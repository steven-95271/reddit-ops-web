# Reddit 内容运营自动化系统

> 智能抓取 Reddit 热点、多维评分筛选、AI 内容生成与审核，构建数据驱动的社媒运营闭环。

[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://python.org) [![Flask](https://img.shields.io/badge/Flask-3.0-green.svg)](https://flask.palletsprojects.com) [![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🎯 快速导航

| 阶段 | 名称 | 说明 |
|------|------|------|
| [L1 总览](docs/workflow/overview.md) | 流程总览 | 6阶段完整流程图 |
| [P1](docs/workflow/p1-config.md) | 项目配置 | AI 3轮对话生成搜索策略 |
| [P2](docs/workflow/p2-scraping.md) | 内容抓取 | APIFY + Mock 双模式 |
| [P3](docs/workflow/p3-analysis.md) | 热帖识别 | 5维评分 + 自动分类 |
| [P4-1](docs/workflow/p4-persona.md) | 人设设计 | 3种默认人设 |
| [P4-2](docs/workflow/p4-content.md) | 内容创作 | AI 人设风格生成 |
| [P5](docs/workflow/p5-publish.md) | 发布追踪 | 审核工作流 + 品牌追踪 |

---

## 📊 系统架构

```mermaid
flowchart TB
    subgraph Frontend["🌐 前端层"]
        F1[Flask/Jinja2<br/>生产环境]
        F2[Next.js 14<br/>开发中]
    end

    subgraph Backend["⚙️ 后端层"]
        B1[Flask 3.x App]
        B2[REST API<br/>/api/*]
        B3[Scheduler<br/>每日流水线]
    end

    subgraph Data["💾 数据层"]
        D1[SQLite<br/>app.db]
        D2[JSON<br/>文件系统]
        D3[Apify API<br/>Reddit抓取]
    end

    Frontend <--> Backend
    Backend <--> Data
```

---

## 🔄 核心流程

```mermaid
flowchart LR
    subgraph Input["📥 输入"]
        I1[产品信息]
        I2[关键词]
        I3[竞品]
    end

    subgraph P1["🎯 P1<br/>项目配置"]
        P1_1[AI扩展关键词]
        P1_2[AI推荐板块]
        P1_3[生成策略]
    end

    subgraph P2["🔍 P2<br/>内容抓取"]
        P2_1[APIFY抓取]
        P2_2[Mock测试]
    end

    subgraph P3["📊 P3<br/>热帖识别"]
        P3_1[计算评分]
        P3_2[自动分类]
        P3_3[筛选候选]
    end

    subgraph P4["✍️ P4<br/>内容创作"]
        P4_1[人设设计]
        P4_2[AI生成]
    end

    subgraph P5["🚀 P5<br/>发布追踪"]
        P5_1[审核工作流]
        P5_2[品牌追踪]
    end

    Input --> P1
    P1 --> P2
    P2 --> P3
    P3 --> P4
    P4 --> P5
```

---

## 📈 主要功能

| 功能 | 说明 |
|------|------|
| 智能抓取 | Apify Reddit 数据抓取，支持 Mock 测试 |
| 双评分算法 | Hot Score (0-100) + Composite Score (0-1) |
| 五维分类 | A结构型测评/B场景痛点/C观点争议/D竞品KOL/E平台趋势 |
| AI 生成 | OpenAI GPT-4o-mini + 模板回退 |
| 多账号人设 | 3种默认人设，支持自定义扩展 |
| 品牌追踪 | 自有品牌 + 竞品提及监控 |

---

## 🚀 快速开始

```bash
# 克隆仓库
git clone https://github.com/steven-95271/reddit-ops-web.git
cd reddit-ops-web

# 安装依赖
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 启动服务
python app.py
```

访问 http://127.0.0.1:5000

---

## 🌐 在线文档

- 📖 [在线文档站](https://steven-95271.github.io/reddit-ops-web/) - 包含完整流程图
- 📊 [Mermaid Live Editor](https://mermaid.live/edit#https://raw.githubusercontent.com/steven-95271/reddit-ops-web/main/docs/index.md) - 在线编辑图表

---

*最后更新：2026-04-01*
