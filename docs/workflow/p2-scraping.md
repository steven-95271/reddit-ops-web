# P2 抓取

> P2 基于 P1 的 phase 配置调用 Apify Reddit Scraper，并把结果同步进 `posts`。

## 页面能力

`/workflow/scraping`

- 选择项目
- 按 4 个 phase 配置时间范围、排序方式、抓取条数
- 选择要抓取的关键词或 subreddit
- 发起 batch 抓取
- 轮询单个 run 状态
- 查看 item 数、成本、dataset id
- 成功后将结果同步写入 `posts`

## 当前实现特点
- 每个关键词或 subreddit 会形成独立 run 记录
- 运行记录写入 `scraping_runs`
- 抓取结果最终进入 `posts`

## 实际流程

```mermaid
flowchart LR
    A["选择项目"] --> B["选择 phase 与抓取项"]
    B --> C["POST /api/scraping/batch"]
    C --> D["创建 scraping_runs"]
    D --> E["Apify actor run"]
    E --> F["轮询 /api/scraping/[runId]/status"]
    F --> G["POST /api/scraping/[runId]/results"]
    G --> H["写入 posts"]
```

## 抓取配置

当前 UI 和 `lib/apify.ts` 中可配置的核心参数包括：

- `time_range`: `24h | 7d | 30d | year`
- `sort_by`: `hot | new | top | relevance`
- `max_posts`
- `includeComments`
- `maxCommentsPerPost`
- `commentDepth`
- `deduplicatePosts`
- `maxRetries`

## 相关接口

| 接口 | 作用 |
|------|------|
| `GET /api/scraping/runs` | 获取抓取记录 |
| `POST /api/scraping/batch` | 批量启动抓取 |
| `GET /api/scraping/[runId]/status` | 查询 Apify 运行状态 |
| `POST /api/scraping/[runId]/results` | 同步抓取结果到数据库 |
| `GET /api/scraping/[runId]/download` | 下载数据集 |

## 产出字段

抓取后的帖子主要落在 `posts` 表：

- `reddit_id`
- `subreddit`
- `title`
- `body`
- `author`
- `url`
- `score`
- `num_comments`
- `upvote_ratio`
- `created_utc`
- `project_id`

## 下一步

[P3 分析](p3-analysis.md)
