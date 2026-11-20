export interface ChatLine {
  id: string
  role: 'user' | 'assistant'
  text: string
}

const KEY = 'ai-study-chat-v1'

export function loadChat(): ChatLine[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as ChatLine[]
    return Array.isArray(list) ? list.slice(-40) : []
  } catch {
    return []
  }
}

export function saveChat(lines: ChatLine[]) {
  localStorage.setItem(KEY, JSON.stringify(lines.slice(-40)))
}

import { appendExtra, loadCustomPrompts } from './custom-prompts'

export function chatSystem(audience: string) {
  const base = [
    '你是課業助教。用繁體中文，清楚回答學生的問題。',
    audience.trim() ? `對象：${audience.trim()}。用詞要符合程度。` : '',
    '不要假設科目；依學生問題與附件內容回答。',
    '簡短分段，必要時用例子。不要使用 markdown 標題；不要用 # 或 *。',
  ]
    .filter(Boolean)
    .join('\n')
  return appendExtra(base, loadCustomPrompts().chat, 'Chat 風格補充')
}