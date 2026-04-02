# P1 - 项目配置

> AI 3轮对话，将模糊的产品信息转化为精准的搜索策略。

---

## 🎯 流程概览

<div class="mermaid">
flowchart TB
    subgraph INPUT["📝 输入"]
        I1[项目背景<br/>产品特点/卖点]
        I2[目标人群<br/>使用场景]
        I3[种子关键词<br/>品牌/竞品]
    end

    subgraph VALIDATION["✅ 验证层"]
        V1{检查 AI<br/>API Key?}
        V1 -->|存在| V2[使用 AI 生成]
        V1 -->|不存在| V3[使用 Fallback<br/>基础关键词]
    end

    subgraph ROUND1["🤖 第1轮：扩展关键词"]
        R1_1[AI分析输入信息] --> R1_2[生成4类关键词]
        R1_2 --> R1_3[🔑 核心词 5-8个<br/>open ear headphones<br/>wireless earbuds]
        R1_2 --> R1_4[📏 长尾词 5-10个<br/>comfortable earbuds all day]
        R1_2 --> R1_5[🏢 竞品词 3-5个<br/>Shokz vs Oladance]
        R1_2 --> R1_6[🎯 场景词 5-8个<br/>running headphones<br/>workout earbuds]

        R1_3 & R1_4 & R1_5 & R1_6 --> R1_7[共 18-31个关键词]
    end

    subgraph ROUND2["🤖 第2轮：推荐 Subreddits"]
        R2_1[AI分析目标人群<br/>+ 关键词组合] --> R2_2[推荐 Reddit 板块]
        R2_2 --> R2_3[⭐ 高相关 5-8个<br/>r/headphones<br/>r/running<br/>r/audiophile]
        R2_2 --> R2_4[📊 中相关 3-5个<br/>r/gadgets<br/>r/commuting]

        R2_3 & R2_4 --> R2_5[精选 5个最佳板块]
    end

    subgraph ROUND3["⚙️ 第3轮：搜索策略"]
        R3_1[整合前2轮结果] --> R3_2[构建搜索配置]
        R3_2 --> R3_3[🔍 搜索词 5个<br/>"open ear earbuds"<br/>"running headphones"<br/>"Shokz alternative"<br/>...]
        R3_2 --> R3_4[📍 监控板块 5个<br/>headphones/running<br/>earbuds/audiophile<br/>commuting]
        R3_2 --> R3_5[⏱️ 抓取规则<br/>过去7天 | 最多100帖<br/>最少5个赞]
    end

    subgraph OUTPUT["✅ 输出：项目配置卡"]
        O1[配置卡包含<br/>✓ 18-31个关键词<br/>✓ 5个Reddit板块<br/>✓ 完整搜索策略<br/>✓ 状态：草稿]
        O2[下一步 → 点击"确认"<br/>进入内容抓取]
    end

    %% 连接流程
    I1 & I2 & I3 --> V1
    V2 & V3 --> R1_1
    R1_7 --> R2_1
    R2_5 --> R3_1
    R3_3 & R3_4 & R3_5 --> O1

    %% 样式
    classDef input fill:#e8f5e9,stroke:#2e7d32,stroke-width:3px
    classDef ai fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef output fill:#e1f5fe,stroke:#01579b,stroke-width:3px
    classDef human fill:#fff9c4,stroke:#f57f17,stroke-width:2px

    class I1,I2,I3 input
    class V1,R1_1,R1_2,R1_3,R1_4,R1_5,R1_6,R1_7,R2_1,R2_2,R2_3,R2_4,R2_5,R3_1,R3_2,R3_3,R3_4,R3_5 ai
    class O1,O2 output
</div>

---

## 📝 输入参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `project_background` | 项目背景介绍 | Oladance开放式耳机，$99促销 |
| `target_audience` | 目标人群 | 运动爱好者、通勤上班族 |
| `unique_selling_points` | 核心卖点 | 开放聆听、全天舒适、16小时续航 |
| `seed_keywords` | 种子关键词 | open ear earbuds, running headphones |
| `brand_names` | 自有品牌 | Oladance, Heyup |
| `competitor_brands` | 竞品品牌 | Shokz, Bose, soundcore |

---

## 🤖 AI 对话流程

### 第1轮：扩展关键词

<div class="mermaid">
sequenceDiagram
    participant User as 用户
    participant AI as MiniMax AI
    participant System as 系统

    User->>System: 输入种子关键词
    System->>AI: 发送 Prompt<br/>(项目背景+种子词)
    AI->>AI: 分析+联想
    AI-->>System: 返回4类关键词
    System->>System: 解析 JSON
    alt JSON 解析成功
        System->>System: 提取字段
    else JSON 解析失败
        System->>System: 从文本提取
    end
    System-->>User: 展示扩展结果
</div>

**AI Prompt 示例**：
</div>
你是一个 Reddit 营销专家。基于以下信息生成关键词建议：
项目背景: Oladance开放式耳机，主打全天佩戴舒适
种子关键词: open ear earbuds

请分析并提供：
1. 核心关键词（直接相关的5-8个）
2. 长尾关键词（更具体的搜索词5-10个）
3. 竞品关键词（竞品相关的3-5个）
4. 场景关键词（使用场景相关的5-8个）
</div>

### 第2轮：推荐 Subreddits

**AI Prompt 示例**：
</div>
基于目标人群（运动爱好者、通勤族）
和扩展后的关键词列表，
推荐最相关的 Reddit 板块。

输出格式：
{
    "high_relevance": ["r/headphones", ...],
    "medium_relevance": ["r/gadgets", ...],
    "reasoning": "推荐理由"
}
</div>

### 第3轮：生成搜索策略

**输出配置**：
</div>json
{
    "search_queries": [
        "open ear earbuds",
        "running headphones",
        "Shokz vs Oladance",
        "comfortable earbuds all day",
        "workout earbuds"
    ],
    "subreddits": [
        "headphones",
        "running",
        "earbuds",
        "audiophile",
        "commuting"
    ],
    "time_filter": "week",
    "maxItems": 100,
    "min_score": 5
}
</div>

---

## 📊 输出结果

### 配置卡内容

| 字段 | 内容 | 说明 |
|------|------|------|
| `card_id` | uuid | 产品卡唯一标识 |
| `card_name` | "项目配置 - Oladance" | 包含项目名 |
| `level` | L1 | 配置级别 |
| `status` | draft | 待确认 |
| `all_keywords` | 18-31个 | 去重后总数 |
| `search_strategy` | 见上方JSON | 用于P2抓取 |

---

## 🔄 状态流转

<div class="mermaid">
stateDiagram-v2
    [*] --> draft: 创建
    draft --> active: 点击确认
    active --> [*]: 触发 P2

    note right of draft: 可编辑、可删除
    note right of active: 不可编辑
</div>

---

## 💡 设计亮点

| 亮点 | 说明 |
|------|------|
| **Fallback 机制** | AI 不可用时，使用本地算法保证流程不中断 |
| **多轮对话** | 每轮聚焦单一任务，保证输出质量 |
| **去重处理** | 合并多轮结果时自动去重 |
| **灵活配置** | 支持自定义 AI 模型和 API |

---

## 🔗 相关文档

- [L1 总览](overview.md)
- [P2 - 内容抓取](p2-scraping.md)
