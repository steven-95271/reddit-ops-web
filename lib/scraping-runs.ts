import { getScrapingResults, getScrapingStatus } from '@/lib/apify'
import { initDb, sql } from '@/lib/db'
import crypto from 'crypto'

type LocalRunStatus = 'pending' | 'running' | 'succeeded' | 'failed'
type SyncOutcome = 'synced' | 'skipped_recently_checked' | 'skipped_locked' | 'skipped_not_syncable'

const SYNC_CONCURRENCY = 3
const MIN_SYNC_INTERVAL_MS = 8_000
const SYNC_LOCK_TTL_MS = 60_000

type ScrapingRunRow = {
  id: string
  batch_id: string
  project_id: string
  phase: string
  query: string
  subreddit: string | null
  apify_run_id: string | null
  apify_dataset_id: string | null
  apify_status: string | null
  status: string
  params: string | null
  total_posts: number | null
  inserted_posts: number | null
  skipped_posts: number | null
  cost_usd: number | null
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string | null
  last_checked_at?: string | null
  results_synced_at?: string | null
  sync_lock_token?: string | null
  sync_lock_expires_at?: string | null
}

export type ScrapingRunRecord = {
  id: string
  batch_id: string
  project_id: string
  phase: string
  query: string
  subreddit: string | null
  status: LocalRunStatus
  params: Record<string, unknown> | null
  total_posts: number
  inserted_posts: number
  skipped_posts: number
  apify_run_id: string | null
  apify_dataset_id: string | null
  apify_status: string | null
  cost_usd: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string | null
  last_checked_at: string | null
  results_synced_at: string | null
}

export type ScrapingRunSyncResult = {
  runs: ScrapingRunRecord[]
  summary: {
    total_runs: number
    sync_candidates: number
    processed: number
    skipped_recently_checked: number
    skipped_locked: number
    skipped_not_syncable: number
  }
}

const FAILED_APIFY_STATUSES = new Set(['FAILED', 'TIMED_OUT', 'TIMED-OUT', 'ABORTED'])

function parseParams(params: string | null): Record<string, unknown> | null {
  if (!params) {
    return null
  }

  try {
    return JSON.parse(params) as Record<string, unknown>
  } catch {
    return null
  }
}

function normalizeApifyStatus(status: string | null | undefined): string | null {
  if (!status) {
    return null
  }

  return status.toUpperCase().replace(/_/g, '-')
}

export function normalizeRunStatus(status: string | null | undefined): LocalRunStatus {
  if (!status) {
    return 'pending'
  }

  const normalized = normalizeApifyStatus(status) ?? 'PENDING'

  if (normalized === 'SUCCEEDED') {
    return 'succeeded'
  }

  if (FAILED_APIFY_STATUSES.has(normalized) || normalized === 'FAILED') {
    return 'failed'
  }

  if (normalized === 'RUNNING') {
    return 'running'
  }

  if (normalized === 'PENDING') {
    return 'pending'
  }

  const lowered = status.toLowerCase()
  if (lowered === 'succeeded') {
    return 'succeeded'
  }
  if (lowered === 'failed') {
    return 'failed'
  }
  if (lowered === 'running') {
    return 'running'
  }

  return 'pending'
}

function mapApifyStatusToLocalStatus(status: string | null | undefined): LocalRunStatus {
  const normalized = normalizeApifyStatus(status)

  if (!normalized || normalized === 'PENDING') {
    return 'pending'
  }

  if (normalized === 'SUCCEEDED') {
    return 'succeeded'
  }

  if (FAILED_APIFY_STATUSES.has(normalized)) {
    return 'failed'
  }

  return 'running'
}

function isTerminalLocalStatus(status: string | null | undefined): boolean {
  const normalized = normalizeRunStatus(status)
  return normalized === 'succeeded' || normalized === 'failed'
}

function shouldSyncRun(row: ScrapingRunRow): boolean {
  const status = normalizeRunStatus(row.status)

  if (status === 'pending' || status === 'running') {
    return true
  }

  // 已成功但结果尚未真正落库时，仍视为“未完成”
  if (status === 'succeeded' && !row.results_synced_at) {
    return true
  }

  return false
}

function wasCheckedRecently(lastCheckedAt: string | null | undefined): boolean {
  if (!lastCheckedAt) {
    return false
  }

  const lastCheckedTs = new Date(lastCheckedAt).getTime()
  if (Number.isNaN(lastCheckedTs)) {
    return false
  }

  return Date.now() - lastCheckedTs < MIN_SYNC_INTERVAL_MS
}

export function serializeScrapingRun(row: ScrapingRunRow): ScrapingRunRecord {
  return {
    id: row.id,
    batch_id: row.batch_id,
    project_id: row.project_id,
    phase: row.phase,
    query: row.query,
    subreddit: row.subreddit,
    status: normalizeRunStatus(row.status),
    params: parseParams(row.params),
    total_posts: Number(row.total_posts ?? 0),
    inserted_posts: Number(row.inserted_posts ?? 0),
    skipped_posts: Number(row.skipped_posts ?? 0),
    apify_run_id: row.apify_run_id,
    apify_dataset_id: row.apify_dataset_id,
    apify_status: normalizeApifyStatus(row.apify_status),
    cost_usd: Number(row.cost_usd ?? 0),
    error_message: row.error_message,
    started_at: row.started_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
    last_checked_at: row.last_checked_at ?? null,
    results_synced_at: row.results_synced_at ?? null,
  }
}

async function saveScrapingResults(row: ScrapingRunRow): Promise<ScrapingRunRow> {
  if (!row.apify_run_id) {
    return row
  }

  const results = await getScrapingResults(row.apify_run_id)
  let inserted = 0
  let skipped = 0
  const syncedAt = new Date().toISOString()

  for (const post of results) {
    const postId = post.post_id || `${post.subreddit}_${post.created_utc}_${(post.title || '').slice(0, 50)}`
    const createdAt = post.created_utc
      ? new Date(post.created_utc * 1000).toISOString()
      : syncedAt
    const redditUrl = post.permalink ? `https://www.reddit.com${post.permalink}` : (post.url || '')
    const postType = post.type || 'post'
    const postBody = post.body || post.selftext || ''
    const postTitleForComment = post.type === 'comment' ? (post.post_title || post.title || '') : ''

    const insertResult = await sql`
      INSERT INTO posts (
        id,
        project_id,
        scraping_run_id,
        apify_run_id,
        batch_id,
        phase,
        keyword,
        reddit_id,
        subreddit,
        title,
        body,
        author,
        url,
        reddit_url,
        score,
        upvotes,
        num_comments,
        comments,
        created_utc,
        created_at_reddit,
        scraped_at,
        type,
        post_id,
        parent_id,
        depth,
        post_title,
        subreddit_subscribers,
        upvote_ratio,
        link_flair_text,
        permalink,
        is_stickied,
        is_nsfw,
        replies,
        total_awards
      )
      VALUES (
        ${postId},
        ${row.project_id},
        ${row.id},
        ${row.apify_run_id},
        ${row.batch_id},
        ${row.phase},
        ${row.query},
        ${post.post_id || null},
        ${post.subreddit || ''},
        ${post.title || ''},
        ${postBody},
        ${post.author || ''},
        ${post.url || ''},
        ${redditUrl},
        ${post.score || 0},
        ${post.score || 0},
        ${post.num_comments || 0},
        ${post.num_comments || 0},
        ${createdAt},
        ${createdAt},
        ${syncedAt},
        ${postType},
        ${post.type === 'comment' ? (post.parent_id || null) : null},
        ${post.parent_id || null},
        ${post.depth || 0},
        ${postTitleForComment || null},
        ${post.subreddit_subscribers || 0},
        ${post.upvote_ratio || 0},
        ${post.link_flair_text || null},
        ${post.permalink || null},
        ${post.is_stickied || false},
        ${post.is_nsfw || false},
        ${post.replies || 0},
        ${post.total_awards || 0}
      )
      ON CONFLICT (id) DO NOTHING
    `

    if ((insertResult.rowCount ?? 0) > 0) {
      inserted += 1
    } else {
      skipped += 1
    }
  }

  await sql`
    UPDATE scraping_runs
    SET
      total_posts = ${results.length},
      inserted_posts = ${inserted},
      skipped_posts = ${skipped},
      results_synced_at = ${syncedAt},
      completed_at = COALESCE(completed_at, ${syncedAt})
    WHERE id = ${row.id}
  `

  return {
    ...row,
    total_posts: results.length,
    inserted_posts: inserted,
    skipped_posts: skipped,
    results_synced_at: syncedAt,
    completed_at: row.completed_at ?? syncedAt,
  }
}

async function syncScrapingRunRow(row: ScrapingRunRow): Promise<ScrapingRunRow> {
  if (!row.apify_run_id) {
    return row
  }

  const needsApifyRefresh =
    !isTerminalLocalStatus(row.status) ||
    !row.apify_dataset_id ||
    (normalizeRunStatus(row.status) === 'succeeded' && !row.results_synced_at)

  let currentRow = row

  if (needsApifyRefresh) {
    const apifyRun = await getScrapingStatus(row.apify_run_id)
    const apifyStatus = normalizeApifyStatus(apifyRun.status)
    const localStatus = mapApifyStatusToLocalStatus(apifyStatus)
    const checkedAt = new Date().toISOString()
    const datasetId = apifyRun.defaultDatasetId ?? row.apify_dataset_id
    const totalPosts = Number(apifyRun.stats?.itemCount ?? row.total_posts ?? 0)
    const costUsd = Number(apifyRun.usageTotalUsd ?? row.cost_usd ?? 0)
    const completedAt =
      localStatus === 'running'
        ? row.completed_at
        : (apifyRun.finishedAt ?? row.completed_at ?? checkedAt)
    const errorMessage = localStatus === 'failed'
      ? (apifyRun.statusMessage ?? row.error_message ?? apifyStatus)
      : null

    await sql`
      UPDATE scraping_runs
      SET
        status = ${localStatus},
        apify_status = ${apifyStatus},
        total_posts = ${totalPosts},
        cost_usd = ${costUsd},
        apify_dataset_id = ${datasetId ?? null},
        error_message = ${errorMessage},
        started_at = COALESCE(started_at, ${apifyRun.startedAt ?? null}),
        completed_at = ${completedAt ?? null},
        last_checked_at = ${checkedAt}
      WHERE id = ${row.id}
    `

    currentRow = {
      ...row,
      status: localStatus,
      apify_status: apifyStatus,
      total_posts: totalPosts,
      cost_usd: costUsd,
      apify_dataset_id: datasetId ?? null,
      error_message: errorMessage,
      started_at: row.started_at ?? apifyRun.startedAt ?? null,
      completed_at: completedAt ?? null,
      last_checked_at: checkedAt,
    }
  }

  if (
    normalizeRunStatus(currentRow.status) === 'succeeded' &&
    currentRow.apify_dataset_id &&
    !currentRow.results_synced_at
  ) {
    currentRow = await saveScrapingResults(currentRow)
  }

  return currentRow
}

async function tryAcquireRunSyncLock(row: ScrapingRunRow): Promise<string | null> {
  const lockToken = crypto.randomUUID()
  const lockExpiresAt = new Date(Date.now() + SYNC_LOCK_TTL_MS).toISOString()

  const result = await sql<{ sync_lock_token: string }>`
    UPDATE scraping_runs
    SET
      sync_lock_token = ${lockToken},
      sync_lock_expires_at = ${lockExpiresAt}
    WHERE
      id = ${row.id}
      AND (
        sync_lock_expires_at IS NULL
        OR sync_lock_expires_at < NOW()
      )
      AND (
        last_checked_at IS NULL
        OR last_checked_at < ${new Date(Date.now() - MIN_SYNC_INTERVAL_MS).toISOString()}
      )
    RETURNING sync_lock_token
  `

  return result.rows[0]?.sync_lock_token ?? null
}

async function releaseRunSyncLock(runId: string, lockToken: string): Promise<void> {
  await sql`
    UPDATE scraping_runs
    SET
      sync_lock_token = NULL,
      sync_lock_expires_at = NULL
    WHERE id = ${runId} AND sync_lock_token = ${lockToken}
  `
}

async function syncScrapingRunRowSafely(row: ScrapingRunRow): Promise<SyncOutcome> {
  if (!row.apify_run_id) {
    return 'skipped_not_syncable'
  }

  if (wasCheckedRecently(row.last_checked_at)) {
    return 'skipped_recently_checked'
  }

  const lockToken = await tryAcquireRunSyncLock(row)
  if (!lockToken) {
    return 'skipped_locked'
  }

  try {
    await syncScrapingRunRow(row)
    return 'synced'
  } finally {
    await releaseRunSyncLock(row.id, lockToken)
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(items[index])
    }
  })

  await Promise.all(runners)
  return results
}

type SyncSelector =
  | { projectId: string; batchId?: never; runIds?: never }
  | { batchId: string; projectId?: never; runIds?: never }
  | { runIds: string[]; projectId?: never; batchId?: never }

async function getRunsForSync(selector: SyncSelector): Promise<ScrapingRunRow[]> {
  if ('runIds' in selector) {
    const result = await sql<ScrapingRunRow>`
      SELECT * FROM scraping_runs
      WHERE id = ANY(${selector.runIds})
      ORDER BY created_at DESC
    `
    return result.rows
  }

  if ('batchId' in selector) {
    const result = await sql<ScrapingRunRow>`
      SELECT * FROM scraping_runs
      WHERE batch_id = ${selector.batchId}
      ORDER BY created_at ASC
      LIMIT 500
    `
    return result.rows
  }

  const result = await sql<ScrapingRunRow>`
    SELECT * FROM scraping_runs
    WHERE project_id = ${selector.projectId}
    ORDER BY created_at DESC
    LIMIT 200
  `
  return result.rows
}

export async function syncScrapingRuns(selector: SyncSelector): Promise<ScrapingRunSyncResult> {
  await initDb()
  const rows = await getRunsForSync(selector)
  const syncCandidates = rows.filter(shouldSyncRun)
  const outcomes = await runWithConcurrency(syncCandidates, syncScrapingRunRowSafely, SYNC_CONCURRENCY)
  const refreshedRows = await getRunsForSync(selector)

  return {
    runs: refreshedRows.map(serializeScrapingRun),
    summary: {
      total_runs: refreshedRows.length,
      sync_candidates: syncCandidates.length,
      processed: outcomes.filter((outcome) => outcome === 'synced').length,
      skipped_recently_checked: outcomes.filter((outcome) => outcome === 'skipped_recently_checked').length,
      skipped_locked: outcomes.filter((outcome) => outcome === 'skipped_locked').length,
      skipped_not_syncable: outcomes.filter((outcome) => outcome === 'skipped_not_syncable').length,
    },
  }
}
