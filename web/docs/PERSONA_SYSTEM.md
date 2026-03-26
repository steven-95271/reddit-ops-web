# Reddit运营工具 - 人设与多账号管理系统

## 新增功能概览

### 1. 预置人设模板

系统提供5种预置人设模板，覆盖不同角色类型：

- **科技产品测评师** (tech_expert) - 专业理性，深度分析
- **普通消费者** (casual_user) - 真实体验，轻松自然  
- **产品发烧友** (enthusiast) - 热情分享，深度爱好者
- **新手求助者** (newcomer) - 虚心请教，真实新手
- **理性质疑者** (skeptical_buyer) - 谨慎对比，追求真相

每个模板包含完整的发帖和评论策略配置。

### 2. 对标账号学习

支持手动输入标杆Reddit账号URL，系统自动分析：

```bash
GET /api/personas/analyze-profile?url=https://reddit.com/user/ExampleUser
```

分析维度：
- 语言风格（正式度、情感倾向、争议性、热情度）
- 内容特征（平均长度、常用句式、表情使用）
- 互动模式（回复率、互动风格）
- 品牌行为（是否推荐产品、推荐方式）

### 3. AI人设生成

基于标杆账号分析结果，使用MiniMax生成新人设：

```bash
POST /api/personas/analyze-profile
{
  "profile_url": "https://reddit.com/user/ExampleUser",
  "project_info": {
    "product_name": "开放式耳机",
    "category": "音频设备",
    "target_audience": "运动爱好者"
  },
  "differentiation": "medium",
  "count": 3
}
```

推荐生成组合（3-5个）：
- 1个专家型 + 2个路人型 + 1个新手型

### 4. Reddit账号管理

多账号管理系统：

```bash
# 获取账号列表
GET /api/reddit-accounts?project_id=xxx

# 创建账号
POST /api/reddit-accounts
{
  "project_id": "xxx",
  "username": "u/TechEnthusiast2024",
  "email": "user@example.com",
  "persona_bindings": ["persona_id_1"]
}
```

支持：
- 账号与人设绑定（1对1或1对多）
- 基础版账号轮换（简单轮换策略）
- 账号状态监控

### 5. 双轨内容生成

分离发帖和评论两种内容生成逻辑：

#### 发帖生成
```bash
POST /api/content/generate
{
  "project_id": "xxx",
  "persona_id": "xxx",
  "content_type": "post",
  "count": 3
}
```

- 基于人设的发帖策略（频率、时间、内容类型）
- 轻度品牌植入（20%概率自然提及）
- 真实度评分和可编辑性

#### 评论生成
```bash
POST /api/content/generate
{
  "project_id": "xxx",
  "persona_id": "xxx",
  "content_type": "comment"
}
```

- 基于目标帖子和已有评论上下文
- 人设特定的评论策略（分享经验/补充信息/温和质疑）
- 智能品牌提及（基于规则控制频率）

### 6. 人工审核工作流

完整的人工审核流程：

```bash
# 获取待审核内容
GET /api/content/review?project_id=xxx&status=pending

# 审核操作（批准/拒绝/编辑）
PATCH /api/content/review
{
  "content_id": "xxx",
  "action": "approve"  // approve | reject | edit
}

# 批量操作
POST /api/content/review/batch
{
  "content_ids": ["id1", "id2"],
  "action": "approve"
}
```

审核状态流转：
```
AI生成 → 人工审核 → 批准/编辑 → 发布
                ↓
               拒绝
```

### 7. 预置模板快速生成

不使用标杆账号，直接基于模板生成：

```bash
# 获取可用模板
GET /api/personas/templates

# 生成推荐人设组合
POST /api/personas/templates/generate-set
{
  "project_info": {
    "product_name": "开放式耳机",
    "key_benefits": ["不入耳", "运动适用"]
  }
}
```

## 数据库结构

### 新增表

1. **reddit_accounts** - Reddit账号管理
2. **scraped_posts** - 抓取的内容存储
3. **content_generation_tasks** - 内容生成任务和审核状态
4. **scrape_templates** - 抓取配置模板

### 扩展表

**personas** 表新增字段：
- `reddit_account_id` - 绑定的Reddit账号
- `role_type` - 角色类型（expert/enthusiast/casual_user/newcomer）
- `brand_integration_level` - 品牌植入级别
- `content_strategy` - 发帖和评论策略（JSON）
- `generation_config` - 生成参数配置（JSON）
- `prototype_analysis` - 标杆账号分析结果（JSON）

## 文件结构

```
web/
├── lib/
│   ├── persona-templates.ts     # 预置人设模板
│   ├── persona-analyzer.ts      # 标杆账号分析
│   ├── persona-generator.ts     # AI人设生成
│   ├── content-generator.ts     # 双轨内容生成
│   └── db.ts                    # 数据库定义
│
├── app/api/
│   ├── reddit-accounts/
│   │   └── route.ts            # Reddit账号管理API
│   ├── personas/
│   │   ├── route.ts            # 现有人设列表
│   │   ├── analyze-profile/    # 标杆账号分析
│   │   │   └── route.ts
│   │   └── templates/          # 模板管理
│   │       └── route.ts
│   ├── content/
│   │   ├── route.ts            # 内容列表
│   │   ├── generate/           # 内容生成
│   │   │   └── route.ts
│   │   └── review/             # 内容审核
│   │       └── route.ts
│   └── ...
```

## 使用流程

### 完整人设搭建流程

1. **准备项目信息**
   ```javascript
   const projectInfo = {
     product_name: "开放式耳机",
     category: "音频设备",
     target_audience: "运动爱好者",
     key_benefits: ["不入耳设计", "运动稳固", "环境音感知"]
   };
   ```

2. **选择生成方式**
   
   **方式A：基于标杆账号（推荐）**
   ```bash
   # 分析标杆账号
   GET /api/personas/analyze-profile?url=https://reddit.com/user/TargetUser
   
   # 生成人设
   POST /api/personas/analyze-profile
   { profile_url, project_info, count: 4 }
   ```
   
   **方式B：基于预置模板**
   ```bash
   POST /api/personas/templates/generate-set
   { project_info }
   ```

3. **审核并保存人设**
   - 查看生成的人设列表
   - 编辑调整细节
   - 保存到数据库

4. **绑定Reddit账号**
   ```bash
   POST /api/reddit-accounts
   {
     project_id,
     username,
     persona_bindings: [persona_id]
   }
   ```

5. **生成内容**
   ```bash
   POST /api/content/generate
   {
     project_id,
     persona_id,
     content_type: "post",
     count: 5
   }
   ```

6. **人工审核**
   ```bash
   GET /api/content/review?status=pending
   PATCH /api/content/review
   { content_id, action: "approve" }
   ```

## 品牌植入策略

系统采用**轻度植入**策略：

- 发帖：20%的内容会自然提及产品
- 评论：10-20%的评论会轻描淡写提及
- 植入方式：个人体验式（"我最近也在用..."）
- 植入要点：客观真实，可以说优点也可以说小缺点

## 下一步开发建议

1. **前端组件**
   - 人设生成器UI（支持标杆账号输入）
   - Reddit账号管理面板
   - 内容审核工作台

2. **功能增强**
   - 评论生成的上下文获取（需要集成Apify）
   - 自动发布时间调度
   - 多账号协调策略（避免自相矛盾）

3. **质量优化**
   - A/B测试不同人设的效果
   - 基于反馈优化生成Prompt
   - 真实度评分算法调优

## API测试示例

```bash
# 1. 分析标杆账号
curl "http://localhost:3000/api/personas/analyze-profile?url=https://www.reddit.com/user/ExampleUser"

# 2. 基于模板生成人设
curl -X POST "http://localhost:3000/api/personas/templates/generate-set" \
  -H "Content-Type: application/json" \
  -d '{
    "project_info": {
      "product_name": "开放式耳机",
      "key_benefits": ["不入耳", "运动适用"]
    }
  }'

# 3. 生成内容
curl -X POST "http://localhost:3000/api/content/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "xxx",
    "persona_id": "xxx",
    "content_type": "post",
    "count": 3
  }'
```
