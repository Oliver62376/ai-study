export interface NbAiLine {
  id: string
  role: 'user' | 'assistant'
  text: string
  at: number
}

const KEY = 'ai-study-nb-ai-threads-v1'
const MAX_LINES = 80

type Store = Record<string, NbAiLine[]>

function readAll(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const data = JSON.parse(raw) as Store
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

function writeAll(data: Store) {
  localStorage.setItem(KEY, JSON.stringify(data))
}

export function loadNbAiThread(bookId: string): NbAiLine[] {
  const list = readAll()[bookId]
  return Array.isArray(list) ? list.slice(-MAX_LINES) : []
}

export function saveNbAiThread(bookId: string, lines: NbAiLine[]) {
  const all = readAll()
  all[bookId] = lines.slice(-MAX_LINES)
  writeAll(all)
}

export function clearNbAiThread(bookId: string) {
  const all = readAll()
  delete all[bookId]
  writeAll(all)
}

export function historyBlock(lines: NbAiLine[]): string {
  if (!lines.length) return ''
  return lines
    .slice(-24)
    .map((line) => `${line.role === 'user' ? '學生' : '助教'}：${line.text}`)
    .join('\n')
}