# L1 - 流程总览

> 6阶段完整流程图，展示 Reddit 内容运营自动化系统的全貌。

---

## 🎯 系统总览

<div class="mermaid">
flowchart TB
    subgraph INPUT["📥 输入层"]
        I1[项目背景<br/>产品信息/卖点]
        I2[种子关键词<br/>目标人群/竞品]
    end

    subgraph P1["🎯 P1 - 项目配置"]
        P1_1[第一轮对话<br/>扩展关键词]
        P1_2[第二轮对话<br/>推荐 Subreddits]
        P1_3[第三轮对话<br/>生成搜索策略]
        P1_1 --> P1_2 --> P1_3
    end

    subgraph P2["🔍 P2 - 内容抓取"]
        P2_1[获取 P1 搜索策略]
        P2_2{选择模式}
        P2_3[Mock 模式<br/>生成模拟数据]
        P2_4[真实 APIFY<br/>Reddit 抓取]
        P2_2 -->|Mock| P2_3
        P2_2 -->|真实| P2_4
        P2_1 --> P2_2
    end

    subgraph P3["📊 P3 - 热帖识别"]
        P3_1[数据清洗]
        P3_2[计算双评分算法]
        P3_3[五维分类打标]
        P3_4[生成候选热帖]
        P3_1 --> P3_2 --> P3_3 --> P3_4
    end

    subgraph P4["✍️ P4 - 内容创作"]
        subgraph P4_1["P4-1 人设设计"]
            P4_1_1[创建多个人设<br/>Persona]
            P4_1_2[配置背景/语气<br/>写作风格]
        end

        subgraph P4_2["P4-2 内容生成"]
            P4_2_1[获取 Top 4 候选帖]
            P4_2_2[每个人设生成 2 条]
            P4_2_3{生成方式}
            P4_2_4[GPT-4o-mini<br/>人设风格生成]
            P4_2_5[预定义模板<br/>回退生成]
            P4_2_3 -->|OpenAI| P4_2_4
            P4_2_3 -->|模板| P4_2_5
        end
    end

    subgraph P5["🚀 P5 - 发布追踪"]
        P5_1[内容审核]
        P5_2{审核决策}
        P5_3[待发布队列]
        P5_4[归档]
        P5_5[发布到平台]
        P5_6[品牌提及追踪<br/>情感分析]
        P5_1 --> P5_2
        P5_2 -->|Approved| P5_3
        P5_2 -->|Rejected| P5_4
        P5_3 --> P5_5 --> P5_6
    end

    %% 连接流程
    I1 & I2 --> P1
    P1 --> P2
    P2 --> P3
    P3 --> P4_1
    P4_1 --> P4_2
    P4_2 --> P5

    %% 样式定义
    classDef phase fill:#e1f5fe,stroke:#01579b,stroke-width:3px
    classDef process fill:#fff3e0,stroke:#e65100,stroke-width:1px
    classDef input fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    classDef output fill:#fce4ec,stroke:#c2185b,stroke-width:1px
    classDef decision fill:#fff9c4,stroke:#f57f17,stroke-width:2px

    class P1,P2,P3,P4,P5 phase
    class I1,I2 input
</div>

---

## 🔄 数据流转总览

<div class="mermaid">
flowchart LR
    subgraph PHASES["阶段"]
        P1[🎯 P1<br/>项目配置]
        P2[🔍 P2<br/>内容抓取]
        P3[📊 P3<br/>热帖识别]
        P4[✍️ P4<br/>内容创作]
        P5[🚀 P5<br/>发布追踪]
    end

    subgraph DATA["数据"]
        D1[产品信息]
        D2[搜索策略<br/>关键词+板块]
        D3[原始帖子<br/>87条]
        D4[候选热帖<br/>12条]
        D5[生成内容<br/>6条]
        D6[发布历史<br/>品牌追踪]
    end

    %% 数据流动
    D1 --> P1
    P1 --> D2
    D2 --> P2
    P2 --> D3
    D3 --> P3
    P3 --> D4
    D4 --> P4
    P4 --> D5
    P4 --> P5
    P5 --> D6

    %% 样式
    classDef phase fill:#e1f5fe,stroke:#01579b,stroke-width:3px
    classDef data fill:#f3e5f5,stroke:#7b1fa2

    class P1,P2,P3,P4,P5 phase
    class D1,D2,D3,D4,D5,D6 data
</div>

---

## 📊 核心指标

| 指标 | 数值 | 说明 |
|------|------|------|
| 抓取量 | 87条/次 | Reddit 帖子 |
| 候选率 | ~14% | 87条 → 12条候选 |
| 生成量 | 6条/天 | 3人设 × 2条 |
| 审核时间 | ~5分钟 | 只需审核6条 |
| 发布时间 | 可配置 | 手动/定时 |

---

## 🎨 设计原则

| 原则 | 说明 |
|------|------|
| 业务语言 | 非技术人员也能理解 |
| 关键决策点 | 分支判断清晰标注 |
| 数据可视化 | 真实数字展示 |
| 人工把关 | AI生成 + 人工审核 |

---

## 🔗 相关文档

- [P1 - 项目配置](p1-config.md)
- [P2 - 内容抓取](p2-scraping.md)
- [P3 - 热帖识别](p3-analysis.md)
- [P4-1 - 人设设计](p4-persona.md)
- [P4-2 - 内容创作](p4-content.md)
- [P5 - 发布追踪](p5-publish.md)
