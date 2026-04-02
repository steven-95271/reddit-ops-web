# P4-1 - 人设设计

> 创建"像真人一样"的社媒账号人设，支持多平台、多风格。

---

## 🎯 流程概览

<div class="mermaid">
flowchart TB
    subgraph INPUT["📝 输入"]
        I1[产品特点<br/>开放聆听/运动安全]
        I2[目标场景<br/>跑步/通勤/办公]
    end

    subgraph DEFAULT["🎭 系统默认人设（3个）"]
        D1[🏃 SportyRunner<br/>运动爱好者] --> D1_1[背景：热爱跑步<br/>关注健康生活]
        D1 --> D1_2[语气：活泼/第一人称]
        D1 --> D1_3[写作：分享体验<br/>清单风格]
        D1 --> D1_4[场景：r/running<br/>r/Fitness]

        D2[🎧 AudioGeek<br/>音频发烧友] --> D2_1[背景：技术控<br/>追求音质]
        D2 --> D2_2[语气：专业/分析型]
        D2 --> D2_3[写作：参数对比<br/>深度测评]
        D2 --> D2_4[场景：r/audiophile<br/>r/headphones]

        D3[🚇 CommuterLife<br/>通勤上班族] --> D3_1[背景：朝九晚五<br/>注重实用]
        D3 --> D3_2[语气：务实/生活化]
        D3 --> D3_3[写作：日常场景<br/>实用建议]
        D3 --> D3_4[场景：r/commuting<br/>r/gadgets]
    end

    subgraph CUSTOM["✏️ 自定义人设（可选）"]
        C1[新建人设] --> C2[设定基本信息<br/>名称/头像/平台]
        C2 --> C3[编写背景故事]
        C3 --> C4[选择语气风格]
        C4 --> C5[定义关注领域]
        C5 --> C6[指定发布平台]
    end

    subgraph OUTPUT["✅ 输出"]
        O1[人设库<br/>3个默认 + 自定义]
        O2[每个人设包含<br/>✓ 头像/名称<br/>✓ 背景故事<br/>✓ 写作风格<br/>✓ 适用场景]
        O3[下一步 → 点击"确认"<br/>进入内容创作]
    end

    %% 连接
    I1 & I2 --> DEFAULT
    DEFAULT --> O1
    CUSTOM --> O1
    O1 --> O2 --> O3

    %% 样式
    classDef input fill:#e8f5e9,stroke:#2e7d32
    classDef persona fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef custom fill:#fff9c4,stroke:#f57f17
    classDef output fill:#e1f5fe,stroke:#01579b,stroke-width:3px

    class I1,I2 input
    class D1,D1_1,D1_2,D1_3,D1_4,D2,D2_1,D2_2,D2_3,D2_4,D3,D3_1,D3_2,D3_3,D3_4 persona
    class C1,C2,C3,C4,C5,C6 custom
    class O1,O2,O3 output
</div>

---

## 🎭 默认人设详解

### SportyRunner 🏃

<div class="mermaid">
persona
    name: SportyRunner
    emoji: 🏃
    color: "#22c55e"
    background: "热爱跑步和户外运动，马拉松爱好者，每周跑量50km+，关注运动耳机和装备评测"
    tone: "casual, energetic, first-person"
    writing_style: "分享个人运动体验，语气活泼，喜欢用清单和干货内容，喜欢与跑友互动"
    focus: ["running", "workout", "sports", "fitness", "marathon"]
    post_types: ["experience_share", "gear_recommendation", "training_tips"]
    platform: "Reddit"
    subreddits: ["r/running", "r/Fitness", "r/runningshoes"]
</div>

### AudioGeek 🎧

<div class="mermaid">
persona
    name: AudioGeek
    emoji: 🎧
    color: "#8b5cf6"
    background: "音频发烧友，对音质有追求，熟悉各类音频设备参数，喜欢对比评测"
    tone: "professional, analytical, detailed"
    writing_style: "技术分析风格，擅长参数对比，测评深入，喜欢讨论音质细节"
    focus: ["audiophile", "headphones", "earbuds", "sound_quality", "audio_tech"]
    post_types: ["review", "comparison", "technical_analysis"]
    platform: "Reddit"
    subreddits: ["r/audiophile", "r/headphones", "r/earbuds"]
</div>

### CommuterLife 🚇

<div class="mermaid">
persona
    name: CommuterLife
    emoji: 🚇
    color: "#3b82f6"
    background: "朝九晚五的上班族，每天通勤1-2小时，注重实用性和性价比，喜欢分享生活小技巧"
    tone: "practical, everyday, relatable"
    writing_style: "务实生活化风格，分享通勤日常，推荐实用好物，贴近普通人生活"
    focus: ["commuting", "work", "daily_life", "productivity", "budget"]
    post_types: ["daily_routine", "product_recommendation", "life_hacks"]
    platform: "Reddit"
    subreddits: ["r/commuting", "r/gadgets", "r/BudgetAudiophile"]
</div>

---

## 📊 人设对比

| 人设 | Emoji | 语气 | 写作风格 | 目标社区 |
|------|-------|------|----------|----------|
| **SportyRunner** | 🏃 | 活泼/活力 | 体验分享 | r/running, r/Fitness |
| **AudioGeek** | 🎧 | 专业/分析 | 参数对比 | r/audiophile, r/headphones |
| **CommuterLife** | 🚇 | 务实/生活 | 日常场景 | r/commuting, r/gadgets |

---

## ✏️ 自定义人设字段

| 字段 | 说明 | 示例 |
|------|------|------|
| `name` | 人设名称 | TechRunner |
| `username` | 账号用户名 | u/tech_beats_mike |
| `avatar_emoji` | 头像表情 | 🏃 |
| `avatar_color` | 主题色 | #22c55e |
| `platform` | 发布平台 | Reddit / Twitter / Instagram |
| `background` | 人物背景 | 热爱科技的运动爱好者... |
| `tone` | 语气风格 | casual, energetic, first-person |
| `writing_style` | 写作风格 | 分享个人体验... |
| `focus` | 关注领域 | ["running", "tech", "gadgets"] |
| `post_types` | 内容类型 | ["review", "comparison"] |

---

## 🔗 多平台支持

<div class="mermaid">
flowchart LR
    subgraph PLATFORMS["支持的平台"]
        R[Reddit]
        T[Twitter/X]
        I[Instagram]
        L[LinkedIn]
    end

    subgraph EXAMPLE["人设示例"]
        E1[SportyRunner]
        E2[AudioGeek]
        E3[CommuterLife]
    end

    E1 & E2 & E3 --> R
    E1 & E2 --> T
    E2 & E3 --> I
    E2 & E3 --> L
</div>

---

## 🔄 状态管理

<div class="mermaid">
stateDiagram-v2
    [*] --> active: 创建默认人设

    state active {
        [*] --> SportyRunner
        [*] --> AudioGeek
        [*] --> CommuterLife

        SportyRunner --> SportyRunner: 编辑
        AudioGeek --> AudioGeek: 编辑
        CommuterLife --> CommuterLife: 编辑
    }
</div>

---

## 💡 设计亮点

| 亮点 | 说明 |
|------|------|
| **默认模板** | 开箱即用，无需从零创建 |
| **多平台** | 同一内容可适配不同平台 |
| **风格差异** | 3种人设覆盖不同受众 |
| **可扩展** | 支持自定义新的人设 |

---

## 🔗 相关文档

- [L1 总览](overview.md)
- [P3 - 热帖识别](p3-analysis.md)
- [P4-2 - 内容创作](p4-content.md)
