import { Capacitor, CapacitorHttp } from '@capacitor/core'

export type ProviderId = 'grok' | 'openai' | 'gemini' | 'claude' | 'deepseek' | 'groq' | 'mistral' | 'lan'

export interface ProviderOption {
  id: ProviderId
  name: string
  required: boolean
  defaultModel: string
  hint: string
  base?: string
  local?: boolean
}

export const providerOptions: ProviderOption[] = [
  {
    id: 'grok',
    name: 'Grok',
    required: true,
    defaultModel: 'grok-4.7',
    hint: 'xAI。這個選項會一直留在設定裡。',
    base: 'https://api.x.ai/v1',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    required: false,
    defaultModel: 'gpt-4.1',
    hint: 'OpenAI 的 API 金鑰。模型名稱可以改。',
    base: 'https://api.openai.com/v1',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    required: false,
    defaultModel: 'gemini-2.5-flash',
    hint: 'Google AI 的 API 金鑰。模型名稱可以改。',
  },
  {
    id: 'claude',
    name: 'Claude',
    required: false,
    defaultModel: 'claude-sonnet-4-5',
    hint: 'Anthropic 的 API 金鑰。模型名稱可以改。',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    required: false,
    defaultModel: 'deepseek-chat',
    hint: 'DeepSeek 的 API 金鑰，介面與 OpenAI 相同。',
    base: 'https://api.deepseek.com/v1',
  },
  {
    id: 'groq',
    name: 'Groq',
    required: false,
    defaultModel: 'llama-3.3-70b-versatile',
    hint: 'Groq 的 API 金鑰，介面與 OpenAI 相同。',
    base: 'https://api.groq.com/openai/v1',
  },
  {
    id: 'mistral',
    name: 'Mistral',
    required: false,
    defaultModel: 'mistral-small-latest',
    hint: 'Mistral 的 API 金鑰，介面與 OpenAI 相同。',
    base: 'https://api.mistral.ai/v1',
  },
  {
    id: 'lan',
    name: '局域網',
    required: false,
    defaultModel: 'qwen2.5',
    hint: '區網裡的 OpenAI 相容服務，例如 Ollama、LM Studio、vLLM。填位址即可，金鑰可以留空。',
    base: 'http://127.0.0.1:11434/v1',
    local: true,
  },
]

export interface AiSettings {
  provider: ProviderId
  keys: Partial<Record<ProviderId, string>>
  models: Partial<Record<ProviderId, string>>
  bases: Partial<Record<ProviderId, string>>
}

const KEY = 'ai-study-provider-v1'

export function defaultSettings(): AiSettings {
  return { provider: 'grok', keys: {}, models: {}, bases: {} }
}

export function loadSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultSettings()
    const saved = JSON.parse(raw) as AiSettings
    const provider = providerOptions.some((item) => item.id === saved.provider) ? saved.provider : 'grok'
    return { provider, keys: saved.keys ?? {}, models: saved.models ?? {}, bases: saved.bases ?? {} }
  } catch {
    return defaultSettings()
  }
}

export function saveSettings(settings: AiSettings) {
  localStorage.setItem(KEY, JSON.stringify(settings))
}

export function optionFor(id: ProviderId) {
  return providerOptions.find((item) => item.id === id) ?? providerOptions[0]
}

export function modelFor(settings: AiSettings, id: ProviderId = settings.provider) {
  return settings.models[id]?.trim() || optionFor(id).defaultModel
}

export function keyFor(settings: AiSettings, id: ProviderId = settings.provider) {
  return settings.keys[id]?.trim() ?? ''
}

export function baseFor(settings: AiSettings, id: ProviderId = settings.provider) {
  return settings.bases[id]?.trim() || optionFor(id).base || ''
}

export function isConnected(settings: AiSettings) {
  if (optionFor(settings.provider).local) return Boolean(baseFor(settings))
  return Boolean(keyFor(settings))
}

function chatLike(id: string) {
  const lower = id.toLowerCase()
  return !(
    lower.includes('embed') ||
    lower.includes('whisper') ||
    lower.includes('tts') ||
    lower.includes('dall-e') ||
    lower.includes('realtime') ||
    lower.includes('/embed') ||
    lower.includes('moderation') ||
    lower.includes('sora') ||
    lower.includes('image') ||
    lower.includes('audio')
  )
}

async function getJson(url: string, headers: Record<string, string>) {
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({ url, headers })
    if (response.status >= 400) throw new Error(`供應商回應 ${response.status}`)
    return response.data as Record<string, unknown>
  }
  const response = await fetch(url, { headers })
  if (!response.ok) throw new Error(`供應商回應 ${response.status}`)
  return (await response.json()) as Record<string, unknown>
}

export async function listProviderModels(settings: AiSettings, id: ProviderId = settings.provider) {
  const option = optionFor(id)
  const key = keyFor(settings, id)
  const base = baseFor(settings, id)
  const fallback = modelFor(settings, id)

  if (option.local) {
    if (!base) return [fallback]
    const headers: Record<string, string> = {}
    if (key) headers.Authorization = `Bearer ${key}`
    const data = await getJson(`${base.replace(/\/$/, '')}/models`, headers)
    const rows = data.data as { id?: unknown }[] | undefined
    const names = (rows ?? [])
      .map((row) => (typeof row.id === 'string' ? row.id.trim() : ''))
      .filter((name) => name && chatLike(name))
    return uniqModels(names, fallback)
  }

  if (!key) return [fallback]

  if (id === 'gemini') {
    const data = await getJson(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
      { 'Content-Type': 'application/json' },
    )
    const rows = data.models as { name?: unknown; supportedGenerationMethods?: unknown }[] | undefined
    const names = (rows ?? [])
      .flatMap((row) => {
        const raw = typeof row.name === 'string' ? row.name.replace(/^models\//, '').trim() : ''
        if (!raw) return []
        const methods = Array.isArray(row.supportedGenerationMethods)
          ? row.supportedGenerationMethods.filter((item): item is string => typeof item === 'string')
          : []
        if (methods.length && !methods.includes('generateContent')) return []
        return [raw]
      })
      .filter(chatLike)
    return uniqModels(names, fallback)
  }

  if (id === 'claude') {
    const data = await getJson('https://api.anthropic.com/v1/models', {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    })
    const rows = data.data as { id?: unknown }[] | undefined
    const names = (rows ?? [])
      .map((row) => (typeof row.id === 'string' ? row.id.trim() : ''))
      .filter((name) => name && chatLike(name))
    return uniqModels(names, fallback)
  }

  const openAiBase =
    base ||
    (id === 'grok'
      ? 'https://api.x.ai/v1'
      : id === 'openai'
        ? 'https://api.openai.com/v1'
        : id === 'deepseek'
          ? 'https://api.deepseek.com/v1'
          : id === 'groq'
            ? 'https://api.groq.com/openai/v1'
            : id === 'mistral'
              ? 'https://api.mistral.ai/v1'
              : '')
  if (!openAiBase) return [fallback]

  const data = await getJson(`${openAiBase.replace(/\/$/, '')}/models`, {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  })
  const rows = data.data as { id?: unknown }[] | undefined
  const names = (rows ?? [])
    .map((row) => (typeof row.id === 'string' ? row.id.trim() : ''))
    .filter((name) => name && chatLike(name))
  return uniqModels(names, fallback)
}

function uniqModels(names: string[], fallback: string) {
  const list = [...new Set(names)].sort((a, b) => a.localeCompare(b, 'zh-Hant'))
  if (!list.length) return [fallback]
  if (fallback && !list.includes(fallback)) list.unshift(fallback)
  return list
}

async function postJson(url: string, headers: Record<string, string>, data: unknown) {
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.post({ url, headers, data })
    if (response.status >= 400) throw new Error(`供應商回應 ${response.status}`)
    return response.data as Record<string, unknown>
  }
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  })
  if (!response.ok) throw new Error(`供應商回應 ${response.status}`)
  return (await response.json()) as Record<string, unknown>
}

function readChat(data: Record<string, unknown>) {
  const choices = data.choices as { message?: { content?: string } }[] | undefined
  const text = choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('沒有回答')
  return text
}

export async function askProvider(settings: AiSettings, question: string, context: string, system?: string) {
  const provider = settings.provider
  const key = keyFor(settings)
  const connected = isConnected(settings)
  if (!connected) return null
  const model = modelFor(settings)
  const instruction = system ?? [
    '你是白板老師。科目和語言以教材為準，不要假設是哪一科。',
    '用教材的語言，兩到四句，適合直接念出來。',
    '學生沒有明確要求時，只講教材範圍。學生明確要求超出教材時，用一句話帶過，然後說要回到進度。',
    '不要使用項目符號。',
    `教材與目前進度：${context}`,
  ].join('\n')

  const base = baseFor(settings)
  if (base) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (key) headers.Authorization = `Bearer ${key}`
    const data = await postJson(`${base.replace(/\/$/, '')}/chat/completions`, headers, {
      model,
      messages: [
        { role: 'system', content: instruction },
        { role: 'user', content: question },
      ],
    })
    return readChat(data)
  }

  if (provider === 'gemini') {
    const data = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      { 'Content-Type': 'application/json' },
      {
        systemInstruction: { parts: [{ text: instruction }] },
        contents: [{ role: 'user', parts: [{ text: question }] }],
      },
    )
    const candidates = data.candidates as { content?: { parts?: { text?: string }[] } }[] | undefined
    const text = candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim()
    if (!text) throw new Error('沒有回答')
    return text
  }

  const data = await postJson(
    'https://api.anthropic.com/v1/messages',
    {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    { model, max_tokens: 700, system: instruction, messages: [{ role: 'user', content: question }] },
  )
  const content = data.content as { text?: string }[] | undefined
  const text = content?.map((part) => part.text ?? '').join('').trim()
  if (!text) throw new Error('沒有回答')
  return text
}
