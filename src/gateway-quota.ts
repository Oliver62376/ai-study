import type { GatewayQuota } from './gateway'

const KEY = 'ai-study-gateway-quota-v1'

export interface GatewayQuotaState {
  quota: GatewayQuota
  /** 推估上限（用於顯示已用 %） */
  caps: {
    requests_minute?: number
    requests_day?: number
    tokens_day?: number
  }
  updatedAt: number
}

export function loadGatewayQuotaState(): GatewayQuotaState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as GatewayQuotaState
  } catch {
    return null
  }
}

function save(state: GatewayQuotaState) {
  localStorage.setItem(KEY, JSON.stringify(state))
}

/** 依 gateway 回傳更新剩餘與推估上限。 */
export function applyGatewayQuota(quota: GatewayQuota, usageTokens?: number) {
  const prev = loadGatewayQuotaState()
  const caps = { ...prev?.caps }

  if (quota.remaining_requests_minute >= 0) {
    caps.requests_minute = Math.max(caps.requests_minute ?? 0, quota.remaining_requests_minute + 1)
  }
  if (quota.remaining_requests_day >= 0) {
    caps.requests_day = Math.max(caps.requests_day ?? 0, quota.remaining_requests_day + 1)
  }
  if (quota.remaining_tokens >= 0) {
    const bump = usageTokens ?? 0
    caps.tokens_day = Math.max(caps.tokens_day ?? 0, quota.remaining_tokens + Math.max(bump, 1))
  }

  save({ quota, caps, updatedAt: Date.now() })
}

export interface QuotaMeter {
  label: string
  remaining: number
  cap: number
  percentUsed: number
  unlimited: boolean
}

export function quotaMeters(state: GatewayQuotaState | null): QuotaMeter[] {
  if (!state) return []
  const { quota, caps } = state
  const rows: QuotaMeter[] = []

  const push = (label: string, remaining: number, cap?: number) => {
    if (remaining < 0) return
    const unlimited = cap == null || cap <= 0
    const c = cap && cap > 0 ? cap : Math.max(remaining, 1)
    const used = Math.max(0, c - remaining)
    const percentUsed = unlimited ? (remaining <= 0 ? 100 : 0) : Math.min(100, Math.round((used / c) * 100))
    rows.push({ label, remaining, cap: c, percentUsed, unlimited })
  }

  push('每分鐘請求', quota.remaining_requests_minute, caps.requests_minute)
  push('今日請求', quota.remaining_requests_day, caps.requests_day)
  push('今日 Token', quota.remaining_tokens, caps.tokens_day)
  return rows
}

export function clearGatewayQuota() {
  localStorage.removeItem(KEY)
}