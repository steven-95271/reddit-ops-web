# P4-2 - 内容创作

> AI 扮演不同人设，基于热帖生成符合账号风格的原创内容。

---

## 🎯 流程概览

<div class="mermaid">
flowchart TB
    subgraph INPUT["📝 输入"]
        I1[12条候选热帖<br/>Top 4精选]
        I2[人设库<br/>3个人设]
    end

    subgraph LOOP["🔄 批量生成循环<br/>每人设×2条=6条内容"]
        L1[选取人设] --> L2[选取热帖<br/>轮流匹配]
        L2 --> L3{API配置<br/>正常?}

        L3 -- 是 --> OPENAI["🤖 OpenAI生成<br/>GPT-4o-mini"]
        L3 -- 否 --> TEMPLATE["📄 模板生成<br/>智能回退"]

        subgraph OPENAI_FLOW["AI生成流程"]
            O1_1[构建角色设定<br/>System Prompt] --> O1_2[你是AudioGeek<br/>音频发烧友<br/>专业分析风格]
            O1_2 --> O1_3[构建写作任务<br/>User Prompt]
            O1_3 --> O1_4[基于这篇热帖<br/>"Shokz vs Oladance"<br/>写一篇你的看法]
            O1_4 --> O1_5[调用AI模型]
            O1_5 --> O1_6[生成内容<br/>TITLE/BODY/TAGS]
        end

        subgraph TEMPLATE_FLOW["模板生成流程"]
            T2_1[选择对应模板<br/>根据帖子分类]
            T2_1 --> T2_2{A类测评?<br/>有对应模板}
            T2_2 -- 是 --> T2_3[使用对比模板]
            T2_2 -- 否 --> T2_4[使用默认模板]
            T2_3 & T2_4 --> T2_5[填充变量<br/>产品名/场景/关键词]
            T2_5 --> T2_6[生成内容]
        end

        OPENAI --> OPENAI_FLOW
        TEMPLATE --> TEMPLATE_FLOW

        O1_6 & T2_6 --> L4[构建内容卡片]
        L4 --> L5[内容字段<br/>标题/正文/标签<br/>人设信息/来源<br/>生成方式]
        L5 --> L6[状态：待审核<br/>pending]
    end

    subgraph BATCH["📦 批量结果"]
        B1[6条内容<br/>3人设×2条]
        B1 --> B2[PersonA: 2条<br/>PersonB: 2条<br/>PersonC: 2条]
        B2 --> B3[风格各异<br/>角度不同]
    end

    subgraph OUTPUT["✅ 输出"]
        OUT1[创作卡包含<br/>✓ 6条待审核内容<br/>✓ 关联热帖来源<br/>✓ 生成方式标记<br/>✓ 状态：草稿]
        OUT2[下一步 → 点击"确认"<br/>进入审核发布]
    end

    %% 连接
    I1 & I2 --> L1
    L6 --> B1
    B3 --> OUT1

    %% 样式
    classDef input fill:#e8f5e9,stroke:#2e7d32
    classDef ai fill:#f3e5f5,stroke:#7b1fa2
    classDef template fill:#fff3e0,stroke:#e65100
    classDef decision fill:#fff9c4,stroke:#f57f17,stroke-width:2px
    classDef output fill:#e1f5fe,stroke:#01579b,stroke-width:3px

    class I1,I2 input
    class O1_1,O1_2,O1_3,O1_4,O1_5,O1_6 ai
    class T2_1,T2_3,T2_4,T2_5,T2_6 template
    class L3 decision
    class OUT1,OUT2 output
</div>

---

## 🤖 AI 生成原理

### System Prompt 构建

<div class="mermaid">
sequenceDiagram
    participant User as 系统
    participant AI as GPT-4o-mini

    User->>AI: 你是 AudioGeek，一个Reddit音频发烧友
    Note over AI: 背景：技术控，追求音质...
    Note over AI: 语气：专业/分析型
    Note over AI: 写作：参数对比，深度测评
    Note over AI: 关注：audiophile, headphones, sound_quality

    User->>AI: 基于这篇热帖写一篇Reddit帖子
    Note over AI: 标题：TITLE: xxx
    Note over AI: 正文：BODY: xxx
    Note over AI: 标签：TAGS: tag1, tag2, tag3
</div>

### 生成内容示例

**人设：AudioGeek 🎧**

</div>
TITLE: After 2 weeks with Oladance OWS Pro, here's my take vs Shokz OpenFit

BODY:
Been testing both for two weeks now, and I have thoughts.

**Sound Quality:**
Oladance wins. The dual 23×10mm drivers deliver actual bass, not that tinny bone conduction sound.

**Comfort:**
Both solid, but Shokz feels more "secured" during runs. Oladance has better weight distribution for all-day wear.

**Battery:**
Oladance: 16h (real world). Shokz: 8h.

**Verdict:**
If you prioritize sound quality above everything, Oladance. If you do hardcore trail runs, Shokz.

Tags: openEar, Oladance, Shokz, comparison, review
</div>

---

## 📄 模板回退机制

### 模板分类映射

| 分类 | 模板类型 | 示例 |
|------|----------|------|
| A 结构型测评 | 对比模板 | "我的测评：XXX vs YYY" |
| B 场景痛点 | 经验模板 | "解决XXX问题的经历" |
| C 观点争议 | 讨论模板 | "我对XXX的看法" |
| D 竞品KOL | 提及模板 | "提到XXX的一些想法" |
| E 平台趋势 | 分享模板 | "我发现XXX的趋势" |

### 模板示例

</div>json
{
  "A_comparison": {
    "title": "My take on {product} after {time_period}: {comparison_phrase}",
    "body": "Been using {product} for {time_period}. Here's my honest assessment.\n\n**What I like:**\n{likes}\n\n**What could be better:**\n{improvements}\n\n**Bottom line:** {conclusion}",
    "tags": ["review", "{category}"]
  }
}
</div>

---

## 🔄 生成循环详解

<div class="mermaid">
flowchart LR
    subgraph LOOP["生成循环"]
        A[人设1] --> B[帖子1]
        A --> C[帖子2]
        B --> D[内容1]
        C --> E[内容2]
    end

    subgraph RESULT["结果"]
        R1[内容1<br/>AudioGeek<br/>基于帖子1]
        R2[内容2<br/>AudioGeek<br/>基于帖子2]
    end

    D --> R1
    E --> R2
</div>

### 轮流匹配规则

</div>
人设 A → 帖子 1, 2
人设 B → 帖子 2, 3
人设 C → 帖子 3, 4

确保：
1. 每条帖子至少被2个人设使用
2. 每条内容关联不同角度
3. 避免内容重复
</div>

---

## 📊 输出内容结构

</div>json
{
  "id": "uuid-xxx",
  "persona_id": "persona_001",
  "persona_name": "AudioGeek",
  "persona_username": "u/audio_beats_mike",
  "persona_emoji": "🎧",
  "persona_color": "#8b5cf6",
  "source_post_id": "post_abc123",
  "source_post_title": "Shokz vs Oladance - my experience",
  "source_category": "A",
  "title": "After 2 weeks with Oladance...",
  "body": "Been testing both...",
  "tags": ["review", "openEar", "comparison"],
  "platform": "Reddit",
  "status": "pending",
  "generated_at": "2024-03-01T10:00:00Z",
  "method": "openai"
}
</div>

---

## ⚙️ API 配置参数

| 参数 | 值 | 说明 |
|------|-----|------|
| model | gpt-4o-mini | 使用的小模型 |
| max_tokens | 400 | 限制输出长度 |
| temperature | 0.8 | 创造性参数 |
| messages | [system, user] | 对话格式 |

---

## 💡 设计亮点

| 亮点 | 说明 |
|------|------|
| **人设一致性** | AI 严格遵循人设背景和语气 |
| **多角度生成** | 同一热帖，3种不同视角 |
| **模板回退** | API 不可用时，保证流程不中断 |
| **质量控制** | 人工审核确保内容质量 |

---

## 🔗 相关文档

- [L1 总览](overview.md)
- [P3 - 热帖识别](p3-analysis.md)
- [P4-1 - 人设设计](p4-persona.md)
- [P5 - 发布追踪](p5-publish.md)
