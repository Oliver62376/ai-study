export type MemoryKind = 'profile' | 'lesson' | 'fact' | 'intent'

export interface MemoryEntry {
  id: string
  kind: MemoryKind
  text: string
  tags: string[]
  source: string
  createdAt: number
  pinned?: boolean
}

const KEY = 'ai-study-memory-v1'
const MAX = 48

export const memoryKindLabels: Record<MemoryKind, string> = {
  profile: '學習者',
  lesson: '上過的課',
  fact: '重點／問過的事',
  intent: '教學意圖',
}

export function loadMemoryBank(): MemoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as MemoryEntry[]
    if (!Array.isArray(list)) return []
    return list
      .filter((item) => item?.id && typeof item.text === 'string' && item.text.trim())
      .sort((a, b) => {
        if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1
        return b.createdAt - a.createdAt
      })
  } catch {
    return []
  }
}

function syncNativeMemory(raw: string) {
  if (typeof window === 'undefined' || !window.__AI_STUDY_EMBEDDED__) return
  window.webkit?.messageHandlers?.aiStudyMemorySave?.postMessage({ json: raw })
}

function write(list: MemoryEntry[]) {
  const raw = JSON.stringify(list.slice(0, MAX))
  localStorage.setItem(KEY, raw)
  syncNativeMemory(raw)
}

export function addMemory(entry: Omit<MemoryEntry, 'id' | 'createdAt'> & { id?: string }) {
  const text = entry.text.trim()
  if (!text) return null
  const list = loadMemoryBank()
  const id = entry.id?.trim() || `M${Date.now()}`
  if (list.some((item) => item.id === id)) return id
  const duplicate = list.find(
    (item) => item.kind === entry.kind && item.text.trim() === text && item.source === entry.source,
  )
  if (duplicate) return duplicate.id
  const record: MemoryEntry = {
    id,
    kind: entry.kind,
    text,
    tags: entry.tags?.filter(Boolean) ?? [],
    source: entry.source?.trim() || 'app',
    createdAt: Date.now(),
    pinned: entry.pinned,
  }
  write([record, ...list])
  return id
}

export function updateMemory(id: string, patch: Partial<Pick<MemoryEntry, 'text' | 'tags' | 'kind' | 'pinned'>>) {
  const list = loadMemoryBank()
  const idx = list.findIndex((item) => item.id === id)
  if (idx < 0) return
  const prev = list[idx]!
  list[idx] = {
    ...prev,
    ...patch,
    text: patch.text !== undefined ? patch.text.trim() : prev.text,
    tags: patch.tags ?? prev.tags,
  }
  write(list)
}

export function deleteMemory(id: string) {
  write(loadMemoryBank().filter((item) => item.id !== id))
}

/** 注入各種提示詞前的濃縮記憶（控制長度避免爆 token） */
export function memoryContextForPrompt(maxChars = 2200): string {
  const list = loadMemoryBank()
  if (!list.length) return ''
  const lines: string[] = []
  let size = 0
  for (const item of list) {
    const tag = item.tags.length ? ` [${item.tags.join(',')}]` : ''
    const line = `- (${memoryKindLabels[item.kind]})${tag} ${item.text.trim()}`
    if (size + line.length > maxChars) break
    lines.push(line)
    size += line.length
  }
  if (!lines.length) return ''
  return ['【記憶庫】以下為本機累積、可信任的背景（勿與當下教材矛盾時覆寫教材）:', ...lines].join('\n')
}

export function rememberLesson(title: string, audience: string, sectionTitles: string[]) {
  const text = `曾教過「${title}」${audience ? `（${audience}）` : ''}，段落：${sectionTitles.join('、')}。`
  addMemory({ kind: 'lesson', text, tags: [title], source: 'lesson-plan' })
}

export function rememberStudentQuestion(question: string, answerSummary: string, courseTitle: string) {
  const q = question.trim().slice(0, 120)
  const a = answerSummary.trim().slice(0, 200)
  if (!q || !a) return
  addMemory({
    kind: 'fact',
    text: `在「${courseTitle}」中學生問：${q} → 重點：${a}`,
    tags: [courseTitle],
    source: 'classroom-ask',
  })
}

export function rememberTeachingIntent(intent: string, courseTitle: string) {
  const text = intent.trim().slice(0, 280)
  if (!text) return
  addMemory({
    kind: 'intent',
    text: `「${courseTitle}」意圖：${text}`,
    tags: [courseTitle],
    source: 'svg-intent',
  })
}