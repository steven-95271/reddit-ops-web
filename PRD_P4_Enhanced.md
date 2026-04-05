# PRD 补充文档 — P4 人设与内容创作（增强版）

> 版本：v2.0  
> 更新日期：2026-04-06  
> 本文档替代 PRD v1.0 中 P4-1 和 P4-2 的全部内容

---

## P4 设计理念

**核心原则（来自 Reddit 营销最佳实践）：**

"你不是在 Reddit 做营销——你是在成为一个碰巧代表品牌的、有价值的社区成员。"

P4 的目标不是批量生产广告文案，而是生成**让真实 Reddit 用户觉得有价值、愿意互动**的高质量内容。每一条内容都应该：先提供价值（回答问题、分享经验），再自然提及产品。

---

## P4-1 人设管理（/workflow/persona）

### 设计变更：从"手动定义"到"AI 根据项目智能生成"

旧方案问题：3 个写死的默认人设（运动达人/音频极客/通勤白领）只适用于耳机品类，换个产品就不适用了。

**新方案：AI 根据项目背景自动生成 3-5 个针对性人设。**

### 人设自动生成逻辑

当用户在 P4-1 页面选择项目后，系统读取该项目的产品信息（来自 P1 配置），调用 AI 生成一组适合该产品的人设：

**AI Prompt 策略：**

```
你是一个 Reddit 社区运营专家。基于以下产品信息，生成 3-5 个适合在 Reddit 上推广此产品的虚拟用户人设。

产品信息：
- 产品名：{product_name}
- 产品描述：{product_description}
- 目标受众：{target_audience}
- 品牌名：{brand_names}
- 竞品：{competitor_brands}

每个人设需要包含：
1. 名字（英文，普通人名）
2. 背景故事（50-100 字，要具体真实，包含职业、生活场景、使用产品的理由）
3. Reddit 使用习惯（常逛哪些 subreddit、发帖频率、互动风格）
4. 语气风格（从以下选择并混搭：casual / nerdy / enthusiastic / skeptical-then-convinced / practical）
5. 写作特征（具体到：句式长短偏好、是否用缩写、是否用 emoji、是否用 Reddit 特有表达如 "tbh"/"imo"/"ngl"）
6. 品牌提及策略（这个人设如何自然提到产品：亲身体验分享 / 朋友推荐 / 偶然发现 / 对比后选择）
7. 英文人设描述（完整版，给 AI 内容生成时使用）

要求：
- 人设之间要有明显差异（不同年龄、不同职业、不同使用场景）
- 人设要像真实的 Reddit 用户，不要像营销账号
- 每个人设至少有一个"缺点"或"吐槽点"（增加真实感，如"唯一不满意的是价格有点贵"）
```

### 人设数据模型（更新）

在原有 personas 表基础上新增字段：

| 新增字段 | 类型 | 说明 |
|---|---|---|
| reddit_habits | TEXT | Reddit 使用习惯（JSON） |
| writing_traits | TEXT | 写作特征（JSON，含句式偏好、缩写习惯、emoji 使用等） |
| brand_strategy | TEXT | 品牌提及策略 |
| flaws | TEXT | 人设的"不完美点"（增加真实感） |
| sample_comments | TEXT | AI 生成的 2-3 条示例评论（JSON 数组，让用户预览这个人设的"说话方式"） |

### 用户操作流程

1. 选择项目 → 点击"AI 生成人设"
2. AI 根据产品信息生成 3-5 个人设
3. 每个人设以卡片展示，包含：头像 emoji、名字、背景摘要、语气标签、示例评论预览
4. 用户可以：
   - 编辑任何人设的细节
   - 删除不满意的人设
   - 手动创建自定义人设
   - 重新生成（全部或单个）
5. 确认人设后进入 P4-2

### API 设计

```
POST /api/personas/generate
  Body: { project_id }
  → 读取项目信息 → 调用 AI 生成人设 → 保存到 personas 表
  → 返回生成的人设列表

GET /api/personas?project_id=xxx
  → 返回该项目的所有人设

PUT /api/personas/[id]
  → 更新人设

DELETE /api/personas/[id]
  → 删除人设

POST /api/personas/[id]/preview
  Body: { sample_post_title, sample_post_body }
  → 用该人设生成一条示例回复，用于预览效果
```

---

## P4-2 内容创作（/workflow/content）

### 设计变更：支持三种内容创作模式

旧方案只支持"针对候选帖生成回复"一种模式。新方案支持三种：

### 模式一：回复候选帖（Reply to Post）

针对 P3 筛选出的候选帖，AI 扮演人设生成回复评论。

**使用场景**：发现一个热帖讨论耳机推荐，用"运动达人"人设回复分享使用体验。

### 模式二：回复他人评论（Reply to Comment）

用户粘贴某个帖子下其他人的评论内容，AI 扮演人设生成针对性回复。

**使用场景**：有人在帖子下评论"骨传导耳机音质真的好吗？"，你想用人设回复他。

**操作方式**：
- 用户粘贴他人评论文本到输入框
- 可选择性粘贴原帖标题/正文作为上下文
- 选择人设 → AI 生成回复

### 模式三：自由创作（Free Compose）

用户输入一段模糊的主题、想法或简要提纲，AI 扮演人设生成一条完整的 Reddit 主帖内容。

**使用场景**：想在 r/running 发一个分享帖，大概想聊"跑步时听歌的耳机选择"，但不知道怎么写。

**操作方式**：
- 用户输入主题/想法（中英文均可，系统自动翻译）
- 选择目标 Subreddit
- 选择人设
- 选择内容类型：经验分享帖 / 求推荐帖 / 对比评测帖 / 讨论帖
- AI 生成完整主帖（标题 + 正文）

### 去 AI 味内容生成策略

这是整个 P4-2 的技术核心。所有模式共用以下 prompt 工程策略：

**Anti-AI Detection Prompt Framework：**

```
[System Prompt - 所有内容生成共用]

你现在是一个真实的 Reddit 用户，用户名 {username}。以下是你的完整人设：
{persona_description_en}

你的写作必须遵循以下规则：

1. 句式变化：混合使用短句（3-8 词）和长句（15-25 词），比例约 6:4
2. 开头方式：永远不要用 "I think..." 或 "In my opinion..." 开头，改用：
   - 直接讲经历："So I've been using X for about 3 months now..."
   - 回应对方："Yeah this is exactly what happened to me..."
   - 反问："Wait, you guys don't use X for this?"
3. 禁止使用以下 AI 高频词汇：
   delve, leverage, utilize, facilitate, streamline, foster, harness,
   moreover, furthermore, additionally, consequently, thus, hence,
   comprehensive, robust, seamless, cutting-edge, game-changer,
   it's worth noting, it's important to note, in conclusion
4. 使用 Reddit 特有表达（适量）：tbh, imo, ngl, FWIW, lol, nah, 
   "edit: ...", "not sponsored btw", "take this with a grain of salt"
5. 加入不完美元素：
   - 偶尔的语法不完美（but 开头、sentence fragment）
   - 一个小的吐槽点（"my only complaint is..."）
   - 纠正自己（"well actually, let me rephrase that"）
6. 品牌提及规则：
   - 全文最多提及品牌名 1-2 次
   - 品牌名周围必须有个人体验描述
   - 永远不要用"推荐"这个词，改用"换了之后就没回去过"、"朋友安利的"等
   - 如果是回帖，品牌提及应在回复的后半段自然出现
7. 格式要求：
   - 不要使用标题标记（#）
   - 段落之间用空行分隔
   - 可以使用 Reddit markdown（**加粗**、*斜体*）
   - 长回复可以用 bullet points，但不要每条都用
8. 长度指导：
   - 回复评论：2-4 个段落，80-200 词
   - 主帖内容：3-6 个段落，200-500 词
```

**各模式的额外 prompt：**

**模式一（回复候选帖）的 User Prompt：**
```
你在浏览 r/{subreddit}，看到了这个帖子：

标题：{post_title}
内容：{post_body}

请以 {persona_name} 的身份写一条回复。
你的目标是：先提供有价值的回答或分享，然后自然提到 {brand_name}。
```

**模式二（回复评论）的 User Prompt：**
```
你在 r/{subreddit} 的一个帖子下看到有人评论：

原帖标题（可选）：{post_title}
他人评论：{comment_text}

请以 {persona_name} 的身份回复这条评论。
回复要直接针对对方说的内容，感觉像两个人在对话。
```

**模式三（自由创作）的 User Prompt：**
```
你想在 r/{subreddit} 发一个帖子。

你的想法/主题：{user_idea}
帖子类型：{post_type}（经验分享 / 求推荐 / 对比评测 / 讨论）

请以 {persona_name} 的身份写一个完整的帖子，包含标题和正文。
标题要像真实 Reddit 帖子：具体、有个人色彩、能引发点击。
不要用 clickbait 标题。
```

### 内容质量评估（生成后自动检查）

每条 AI 生成的内容，系统自动做以下检查并给出质量评分：

| 检查项 | 方法 | 扣分条件 |
|---|---|---|
| AI 高频词检测 | 正则匹配禁词表 | 出现 1 个扣 5 分 |
| 句式多样性 | 统计句长标准差 | 标准差 < 3 词扣 10 分 |
| 品牌提及次数 | 计数品牌名出现次数 | 超过 2 次扣 15 分 |
| 内容长度 | 词数统计 | 过短(<50) 或过长(>500) 扣 10 分 |
| Reddit 调性 | 检查是否有 Reddit 特有表达 | 完全没有扣 5 分 |
| 开头模式 | 检查首句是否是 AI 典型开头 | 是则扣 10 分 |

满分 100，低于 70 分自动标记为需要人工修改。

### 内容数据模型（更新）

在原有 contents 表基础上新增字段：

| 新增字段 | 类型 | 说明 |
|---|---|---|
| content_mode | TEXT | reply_post / reply_comment / free_compose |
| target_comment | TEXT | 模式二时，被回复的评论原文 |
| user_idea | TEXT | 模式三时，用户输入的想法/主题 |
| target_subreddit | TEXT | 模式三时，目标 Subreddit |
| post_type | TEXT | 模式三时，帖子类型 |
| quality_score | INTEGER | 自动质量评分（0-100） |
| quality_issues | TEXT | 质量问题列表（JSON） |
| ai_model_used | TEXT | 使用的 AI 模型 |
| generation_prompt | TEXT | 完整的生成 prompt（方便调试优化） |

### API 设计

```
POST /api/content/generate
  Body: {
    project_id,
    persona_id,
    mode: "reply_post" | "reply_comment" | "free_compose",
    
    // 模式一
    post_id?,         // 候选帖 ID
    
    // 模式二
    post_title?,      // 原帖标题（可选上下文）
    post_body?,       // 原帖内容（可选上下文）
    target_comment?,  // 被回复的评论原文
    
    // 模式三
    user_idea?,       // 用户的想法/主题
    target_subreddit?, // 目标板块
    post_type?        // 帖子类型
  }
  → 构建 prompt → 调用 AI → 质量评分 → 保存到 contents 表
  → 返回 { content, quality_score, quality_issues }

POST /api/content/regenerate
  Body: { content_id, feedback? }
  → 基于反馈重新生成（保留原始参数，调整 prompt）

POST /api/content/quality-check
  Body: { text }
  → 对任意文本跑质量评分（用于用户编辑后重新评分）

GET /api/content?project_id=xxx&status=draft&mode=reply_post
  → 返回内容列表（支持按模式、状态筛选）

PUT /api/content/[id]
  Body: { body_edited, status }
  → 更新内容（编辑后自动重新跑质量评分）
```

### 页面设计

页面分为三个 Tab，对应三种模式：

**Tab 1 — 回复候选帖**
- 左侧：候选帖列表（从 P3 标记的候选帖加载）
- 右上：原帖预览
- 右中：人设选择器 + "生成回复"按钮
- 右下：AI 生成的回复 + 质量评分展示 + 编辑器
- 底部：审核按钮

**Tab 2 — 回复评论**
- 上方：粘贴区（原帖标题 + 他人评论文本）
- 中间：人设选择器 + "生成回复"按钮
- 下方：AI 生成的回复 + 编辑器

**Tab 3 — 自由创作**
- 上方：主题/想法输入框 + 目标 Subreddit 选择 + 帖子类型选择
- 中间：人设选择器 + "生成帖子"按钮
- 下方：AI 生成的标题 + 正文 + 编辑器

**所有模式共有：**
- 质量评分仪表盘（分数 + 具体问题提示）
- "重新生成"按钮
- "换个人设"快速切换
- 审核状态管理（draft → approved → published / rejected）

---

## 开发计划调整

P4 由于功能增强，开发时间调整为：

| 任务 | 说明 | 预计耗时 |
|---|---|---|
| 人设智能生成 API | /api/personas/generate + prompt 工程 | 1.5 天 |
| 人设管理页面重写 | AI 生成 + 预览 + 编辑 | 1.5 天 |
| 内容生成 API（三种模式） | /api/content/generate + anti-AI prompt | 2 天 |
| 质量评分引擎 | lib/quality-check.ts | 1 天 |
| 内容创作页面（三 Tab） | 三种模式 + 质量评分展示 | 2.5 天 |
| 联调测试 | 端到端走通三种模式 | 0.5 天 |
| **合计** | | **9 天** |
