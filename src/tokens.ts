export interface TokenUsage {
  prompt: number
  completion: number
}

export interface TokenTotals {
  prompt: number
  completion: number
  calls: number
  updatedAt: number
}

const KEY = 'ai-study-tokens-v1'

export function loadTokenTotals(): TokenTotals {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { prompt: 0, completion: 0, calls: 0, updatedAt: 0 }
    const saved = JSON.parse(raw) as TokenTotals
    return {
      prompt: saved.prompt ?? 0,
      completion: saved.completion ?? 0,
      calls: saved.calls ?? 0,
      updatedAt: saved.updatedAt ?? 0,
    }
  } catch {
    return { prompt: 0, completion: 0, calls: 0, updatedAt: 0 }
  }
}

export function addTokenUsage(usage: TokenUsage) {
  if (usage.prompt <= 0 && usage.completion <= 0) return
  const current = loadTokenTotals()
  const next: TokenTotals = {
    prompt: current.prompt + usage.prompt,
    completion: current.completion + usage.completion,
    calls: current.calls + 1,
    updatedAt: Date.now(),
  }
  localStorage.setItem(KEY, JSON.stringify(next))
}

export function resetTokenTotals() {
  localStorage.setItem(KEY, JSON.stringify({ prompt: 0, completion: 0, calls: 0, updatedAt: Date.now() }))
}

export function estimateTokens(text: string) {
  const normalized = text.trim()
  if (!normalized) return 0
  return Math.max(1, Math.ceil(normalized.length / 3.2))
}

export function extractOpenAiUsage(data: Record<string, unknown>, promptText: string, answerText: string): TokenUsage {
  const usage = data.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined
  if (usage?.prompt_tokens != null && usage.completion_tokens != null) {
    return { prompt: usage.prompt_tokens, completion: usage.completion_tokens }
  }
  return { prompt: estimateTokens(promptText), completion: estimateTokens(answerText) }
}

export function extractGeminiUsage(data: Record<string, unknown>, promptText: string, answerText: string): TokenUsage {
  const meta = data.usageMetadata as { promptTokenCount?: number; candidatesTokenCount?: number } | undefined
  if (meta?.promptTokenCount != null && meta.candidatesTokenCount != null) {
    return { prompt: meta.promptTokenCount, completion: meta.candidatesTokenCount }
  }
  return { prompt: estimateTokens(promptText), completion: estimateTokens(answerText) }
}

export function extractAnthropicUsage(data: Record<string, unknown>, promptText: string, answerText: string): TokenUsage {
  const usage = data.usage as { input_tokens?: number; output_tokens?: number } | undefined
  if (usage?.input_tokens != null && usage.output_tokens != null) {
    return { prompt: usage.input_tokens, completion: usage.output_tokens }
  }
  return { prompt: estimateTokens(promptText), completion: estimateTokens(answerText) }
}