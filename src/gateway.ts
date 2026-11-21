/** Gemini Gateway（官方 API）— 固定 Token 內嵌，使用者只填啟用碼。 */

export const OFFICIAL_GATEWAY_BASE = 'https://gemini-gateway.boboyuyu125.workers.dev/v1'

const BUILTIN_OFFICIAL_BEARER = 'sk-proxy-XIkMNYU8u8ct6hPZQoexCVQTX4rK-Emq4ko5xdIV83M'

/** 建置可覆寫 VITE_OFFICIAL_GATEWAY_TOKEN；未設時使用內建官方 Token（仍須啟用碼） */
export const OFFICIAL_GATEWAY_BEARER =
  (import.meta.env.VITE_OFFICIAL_GATEWAY_TOKEN as string | undefined)?.trim() || BUILTIN_OFFICIAL_BEARER

export const ACTIVATION_HEADER = 'X-Activation-Code'

export interface GatewayQuota {
  remaining_requests_minute: number
  remaining_requests_day: number
  remaining_tokens: number
}

function num(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export function parseGatewayQuota(
  headers: Record<string, string> = {},
  body?: Record<string, unknown>,
): GatewayQuota | null {
  const lower: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    lower[k.toLowerCase()] = v
  }

  const fromBody = body?.gateway_quota as Record<string, unknown> | undefined
  const minute =
    num(fromBody?.remaining_requests_minute) ??
    num(lower['x-remaining-requests-minute'])
  const day = num(fromBody?.remaining_requests_day) ?? num(lower['x-remaining-requests-day'])
  const tokens = num(fromBody?.remaining_tokens) ?? num(lower['x-remaining-tokens'])

  if (minute == null && day == null && tokens == null) return null
  return {
    remaining_requests_minute: minute ?? -1,
    remaining_requests_day: day ?? -1,
    remaining_tokens: tokens ?? -1,
  }
}

export function activationCodeFor(settings: { keys: Partial<Record<string, string>> }) {
  return settings.keys.official?.trim() ?? ''
}

export function officialGatewayHeaders(activationCode: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (OFFICIAL_GATEWAY_BEARER) headers.Authorization = `Bearer ${OFFICIAL_GATEWAY_BEARER}`
  if (activationCode) headers[ACTIVATION_HEADER] = activationCode
  return headers
}

export function officialGatewayReady(activationCode: string) {
  return Boolean(OFFICIAL_GATEWAY_BEARER && activationCode.trim())
}