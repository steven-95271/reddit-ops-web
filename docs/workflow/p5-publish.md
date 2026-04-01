# P5 - 发布追踪

> 内容审核、发布执行、品牌提及追踪的完整闭环管理。

---

## 🎯 流程概览

```mermaid
flowchart TB
    subgraph INPUT["📝 输入"]
        I1[6条内容<br/>status: pending]
        I2[发布平台<br/>Reddit/Twitter<br/>Instagram/LinkedIn]
    end

    subgraph REVIEW["👤 人工审核工作流"]
        R1[查看内容列表]
        R1 --> R2{审核决策}

        R2 -- ✅ 通过 --> R3[状态: approved<br/>进入待发布队列]
        R2 -- ❌ 拒绝 --> R4[状态: rejected<br/>归档]
        R2 -- ✏️ 编辑 --> R5[修改标题/正文<br/>edited: true]
        R5 --> R2
    end

    subgraph PUBLISH["📤 发布流程"]
        P1[待发布队列<br/>status: approved]
        P1 --> P2{发布方式}

        P2 -- 手动 --> P3[复制内容<br/>登录平台<br/>手动发布]
        P2 -- API --> P4[调用平台API<br/>自动发布]

        P3 & P4 --> P5[更新状态<br/>status: published<br/>published_at]
    end

    subgraph TRACK["📊 品牌追踪"]
        T1[品牌提及监控]
        T1 --> T2[追踪关键词<br/>Oladance/OWS Pro]
        T2 --> T3[统计指标<br/>✓ 提及次数<br/>✓ 竞品对比<br/>✓ 情感倾向]

        T4[数据分析] --> T5[生成报告<br/>周报/月报]
    end

    subgraph RETENTION["🗄️ 数据管理"]
        RM1[每日自动清理]
        RM1 --> RM2{数据年龄<br/>>30天?}
        RM2 -- 是 --> RM3[归档/删除<br/>节省存储]
        RM2 -- 否 --> RM4[保留]
    end

    subgraph OUTPUT["✅ 输出"]
        O1[发布历史记录<br/>✓ 已发布内容<br/>✓ 发布时间<br/>✓ 平台数据]
        O2[品牌提及报告<br/>✓ Share of Voice<br/>✓ 情感分析<br/>✓ 趋势图表]
        O3[流程完成 ✨<br/>每日自动循环]
    end

    %% 连接
    I1 & I2 --> REVIEW
    REVIEW --> PUBLISH
    PUBLISH --> TRACK
    TRACK --> RETENTION
    RETENTION --> OUTPUT

    %% 样式
    classDef input fill:#e8f5e9,stroke:#2e7d32
    classDef human fill:#fff9c4,stroke:#f57f17,stroke-width:2px
    classDef publish fill:#f3e5f5,stroke:#7b1fa2
    classDef track fill:#e1f5fe,stroke:#01579b
    classDef output fill:#e1f5fe,stroke:#01579b,stroke-width:3px

    class I1,I2 input
    class REVIEW,R1,R2,R3,R4,R5 human
    class PUBLISH,P1,P2,P3,P4,P5 publish
    class TRACK,T1,T2,T3,T4,T5,RETENTION,RM1,RM2,RM3,RM4 track
    class OUTPUT,O1,O2,O3 output
```

---

## 👤 审核工作流

### 状态机

```mermaid
stateDiagram-v2
    [*] --> pending: AI生成

    pending --> approved: ✅ 通过
    pending --> rejected: ❌ 拒绝
    pending --> pending: ✏️ 编辑

    approved --> published: 📤 发布
    approved --> approved: 🔄 重新编辑

    published --> [*]

    rejected --> [*]: 🗄️ 归档
```

### 审核决策说明

| 决策 | 状态 | 说明 |
|------|------|------|
| ✅ 通过 | approved | 内容质量合格，进入待发布 |
| ❌ 拒绝 | rejected | 不合格，直接归档 |
| ✏️ 编辑 | pending | 需要修改，保存后重新审核 |

---

## 📤 发布管理

### 发布方式对比

| 方式 | 适用场景 | 优点 | 缺点 |
|------|----------|------|------|
| **手动** | 所有平台 | 完全可控 | 耗时 |
| **API** | Twitter/LinkedIn | 自动高效 | 需要平台授权 |

### 发布配置

```json
{
  "publishing": {
    "manual": {
      "instructions": "复制内容，登录对应平台发布"
    },
    "api": {
      "twitter": {
        "enabled": true,
        "auto_schedule": true
      },
      "linkedin": {
        "enabled": true,
        "auto_schedule": false
      }
    }
  }
}
```

---

## 📊 品牌追踪

### 追踪维度

```mermaid
mindmap
    root((品牌追踪))
        自有品牌
            Oladance
            OWS Pro
            Heyup
            提及次数
            情感倾向
        竞品对比
            Shokz
            Bose
            soundcore
            Share of Voice
        情感分析
            Positive
            Negative
            Neutral
        上下文
            mention_context
            原文链接
            发布时间
```

### 追踪数据示例

```json
{
  "brand_mentions": [
    {
      "brand_name": "Oladance",
      "post_title": "Just tried OWS Pro...",
      "subreddit": "r/headphones",
      "sentiment": "positive",
      "mention_context": "...Oladance OWS Pro delivers surprisingly rich bass...",
      "scraped_at": "2024-03-01T09:00:00Z"
    }
  ]
}
```

### 情感分析规则

| 情感 | 关键词示例 | 说明 |
|------|------------|------|
| **Positive** | amazing, love, great, best | 正面评价 |
| **Negative** | hate, terrible, awful, disappointing | 负面评价 |
| **Neutral** | mentioned, compared, listed | 中性提及 |

---

## 🗄️ 数据管理

### 保留策略

```mermaid
timeline
    title 数据保留策略
        0-7天 : 全部保留
            raw_posts.json
            candidates.json
            generated_content.json
        8-30天 : 保留核心数据
            candidates.json
            generated_content.json
            post_scores.json
        31天+ : 自动清理
            删除 raw_posts
            保留统计聚合
```

### 清理规则

| 数据类型 | 保留天数 | 说明 |
|----------|----------|------|
| 原始帖子 | 7天 | raw_posts.json |
| 候选热帖 | 30天 | candidates.json |
| 生成内容 | 30天 | generated_content.json |
| 发布历史 | 永久 | publish_log.json |
| 品牌追踪 | 永久 | brand_mentions.json |

---

## 🔄 每日自动化循环

```mermaid
flowchart TB
    subgraph SCHEDULE["⏰ 每日定时触发"]
        S1[09:00 AM<br/>Asia/Shanghai]
    end

    subgraph PIPELINE["🔄 流水线"]
        P1[执行抓取] --> P2[识别热帖]
        P2 --> P3[生成内容]
        P3 --> P4[发送通知]
        P4 --> P5[等待审核]
    end

    subgraph NOTIFY["📬 通知"]
        N1[微信/Telegram<br/>通知摘要]
        N1 --> N2[包含<br/>抓取数量<br/>候选数量<br/>待审核内容]
    end

    SCHEDULE --> PIPELINE
    P4 --> NOTIFY
```

---

## 💡 设计亮点

| 亮点 | 说明 |
|------|------|
| **人工把关** | AI生成 + 人工审核，确保内容质量 |
| **灵活发布** | 支持手动和API自动发布 |
| **品牌追踪** | 自有品牌 + 竞品对比，持续监控 |
| **数据清理** | 自动清理过期数据，节省存储 |

---

## 🔗 相关文档

- [L1 总览](overview.md)
- [P4-2 - 内容创作](p4-content.md)
- [系统架构](../architecture/system-design.md)
