import type { Glow } from './board'
import type { Course, Difficulty, MaterialSection, QuizQ, Reveal, Step } from './model'

const colors = new Set(['yellow', 'green', 'pink'])

export function anchorsOf(reveals: Reveal[]) {
  const ids: string[] = []
  for (const item of reveals) {
    if (item.type === 'mark') ids.push(item.id.replace(/^mark-/, ''))
    else ids.push(item.id)
    if (item.type === 'note') ids.push(item.anchor)
  }
  return [...new Set(ids)]
}

export function boardToolPrompt(title: string, anchors: string[]) {
  return [
    `你是白板老師，正在講「${title || '這一課'}」。科目以教材為準，不要假設是哪一科。`,
    '回覆必須是一個 JSON 物件，不要加 markdown。',
    '{"say":"要念出來的話","highlights":[{"page":0,"anchor":"某個已存在的id","color":"yellow"}]}',
    'say：用教材的語言，兩到四句，適合直接念出來，不要列點。',
    'highlights：螢光筆，只能標目前白板上已有的 anchor。沒有要畫就給空陣列。',
    'color 只能是 yellow、green、pink。',
    `目前白板上有的 anchor：${anchors.length ? anchors.join('、') : '還沒有'}。`,
    '學生沒有明確要求時，只講這份教材。學生明確要求超出教材時，用一句話帶過，然後說要回到進度，highlights 留空。',
  ].join('\n')
}

export function planPrompt(source: string, audience: string) {
  return [
    '把下面的來源編成一堂課。只講來源裡有的內容。來源只是一個主題時，就講這個主題，不要換成別的課，也不要假設是物理。',
    audience.trim() ? `教學對象：${audience.trim()}` : '教學對象沒有指定，依來源自己判斷。',
    '只回 JSON，不要 markdown。',
    '{"title":"課名","sections":[{"id":"s1","title":"小標","body":"這一段教材"}],"steps":[{"id":"p1","say":"要念的兩到四句","material":"s1","reveals":[{"type":"text","id":"t1","page":0,"variant":"title","text":"板書標題"},{"type":"text","id":"t2","page":0,"variant":"body","text":"一句定義"},{"type":"formula","id":"f1","page":1,"latex":"a=b","plain":"a=b"},{"type":"note","id":"n1","page":1,"anchor":"f1","text":"旁註"}]}]}',
    '4 到 8 段。每段 1 到 4 個板書。page 從 0 開始，換一個主題就換頁。',
    'say 用來源的語言，適合直接念。variant 只能是 title 或 body。',
    '沒有必要就不要寫 formula。note 的 anchor 必須是這堂課裡已出現的 reveal id。',
    `來源：\n${source}`,
  ].join('\n')
}

export function parseTeacherTurn(raw: string, fallback: string): { say: string; highlights: Glow[] } {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return { say: raw.trim() || fallback, highlights: [] }
  try {
    const data = JSON.parse(match[0]) as { say?: unknown; highlights?: unknown }
    const say = typeof data.say === 'string' && data.say.trim() ? data.say.trim() : fallback
    const highlights = Array.isArray(data.highlights)
      ? data.highlights.flatMap((item) => {
          if (!item || typeof item !== 'object') return []
          const row = item as { page?: unknown; anchor?: unknown; color?: unknown }
          const anchor = typeof row.anchor === 'string' ? row.anchor.trim() : ''
          const color = typeof row.color === 'string' ? row.color.trim() : ''
          const page = typeof row.page === 'number' ? row.page : Number(row.page)
          if (!anchor || !colors.has(color) || !Number.isFinite(page)) return []
          return [{ page, anchor, color }]
        })
      : []
    return { say, highlights }
  } catch {
    return { say: raw.trim() || fallback, highlights: [] }
  }
}

export function parseCourse(raw: string, source: string, audience: string): Course | null {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const data = JSON.parse(match[0]) as { title?: unknown; sections?: unknown; steps?: unknown }
    const title = typeof data.title === 'string' ? data.title.trim() : ''
    const sections = parseSections(data.sections)
    const steps = parseSteps(data.steps, sections)
    if (!title || sections.length === 0 || steps.length === 0) return null
    return { title, audience: audience.trim(), source, sections, steps }
  } catch {
    return null
  }
}

function parseSections(value: unknown): MaterialSection[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return []
    const row = item as { id?: unknown; title?: unknown; body?: unknown }
    const title = typeof row.title === 'string' ? row.title.trim() : ''
    const body = typeof row.body === 'string' ? row.body.trim() : ''
    if (!title || !body) return []
    const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : `s${index + 1}`
    return [{ id, title, body }]
  }).slice(0, 12)
}

function parseSteps(value: unknown, sections: MaterialSection[]): Step[] {
  if (!Array.isArray(value)) return []
  const sectionIds = new Set(sections.map((section) => section.id))
  const seen = new Set<string>()
  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return []
    const row = item as { id?: unknown; say?: unknown; material?: unknown; reveals?: unknown }
    const say = typeof row.say === 'string' ? row.say.trim() : ''
    const reveals = parseReveals(row.reveals, seen)
    if (!say || reveals.length === 0) return []
    const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : `p${index + 1}`
    const material = typeof row.material === 'string' && sectionIds.has(row.material) ? row.material : sections[0].id
    return [{ id, say, material, reveals, lasers: reveals.map((reveal) => reveal.id) }]
  }).slice(0, 8)
}

function parseReveals(value: unknown, seen: Set<string>): Reveal[] {
  if (!Array.isArray(value)) return []
  const reveals: Reveal[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object' || reveals.length >= 4) continue
    const row = item as Record<string, unknown>
    const type = row.type
    const page = typeof row.page === 'number' && row.page >= 0 ? Math.floor(row.page) : 0
    let id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : ''
    if (!id || seen.has(id)) id = `b${seen.size + 1}`
    if (type === 'text' && typeof row.text === 'string' && row.text.trim()) {
      seen.add(id)
      reveals.push({
        type: 'text',
        id,
        page,
        text: row.text.trim(),
        variant: row.variant === 'title' ? 'title' : 'body',
      })
    } else if (type === 'formula' && typeof row.latex === 'string' && row.latex.trim()) {
      seen.add(id)
      const plain = typeof row.plain === 'string' && row.plain.trim() ? row.plain.trim() : row.latex.trim()
      reveals.push({ type: 'formula', id, page, latex: row.latex.trim(), plain })
    } else if (type === 'note' && typeof row.text === 'string' && typeof row.anchor === 'string' && seen.has(row.anchor)) {
      seen.add(id)
      reveals.push({ type: 'note', id, page, anchor: row.anchor, text: row.text.trim() })
    }
  }
  return reveals
}

export function quizPrompt(difficulty: Difficulty, count: number) {
  const name = difficulty === 'easy' ? '容易' : difficulty === 'hard' ? '難' : '中等'
  return [
    '你是出題老師。只根據下面的教材出題，不要超出教材。',
    `難易度：${name}。題數：${count}。`,
    '只回 JSON，不要 markdown：{"questions":[{"prompt":"題目","kind":"choice","choices":["A","B","C"],"accept":["正確選項原文"],"explain":"一句檢討"}]}',
    'kind 為 choice 時 choices 要有 3 個，accept 必須是 choices 裡的其中一個原文。',
    '用繁體中文。',
  ].join('\n')
}

export function parseQuiz(raw: string): QuizQ[] {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return []
  try {
    const data = JSON.parse(match[0]) as { questions?: unknown }
    if (!Array.isArray(data.questions)) return []
    return data.questions.flatMap((item, index) => {
      if (!item || typeof item !== 'object') return []
      const row = item as { prompt?: unknown; kind?: unknown; choices?: unknown; accept?: unknown; explain?: unknown }
      const prompt = typeof row.prompt === 'string' ? row.prompt.trim() : ''
      const explain = typeof row.explain === 'string' ? row.explain.trim() : ''
      const accept = Array.isArray(row.accept) ? row.accept.filter((value): value is string => typeof value === 'string' && value.trim() !== '') : []
      if (!prompt || !explain || accept.length === 0) return []
      const choices = Array.isArray(row.choices) ? row.choices.filter((value): value is string => typeof value === 'string') : undefined
      const kind = row.kind === 'fill' || !choices?.length ? 'fill' : 'choice'
      return [
        {
          id: `model-${index}`,
          requires: 'def',
          difficulty: 'mid' as const,
          prompt,
          kind,
          choices: kind === 'choice' ? choices : undefined,
          accept,
          explain,
          laser: 'def',
          anchor: 'def',
          page: 0,
          note: explain,
        },
      ]
    })
  } catch {
    return []
  }
}
