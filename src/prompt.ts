import { appendExtra, loadCustomPrompts } from './custom-prompts'
import { memoryContextForPrompt } from './memory-bank'
import type { Glow } from './board'
import type { Course, Difficulty, InkColor, MaterialSection, QuizQ, Reveal, Step } from './model'
import { sanitizeBoardSvg } from './svg-sanitize'

const colors = new Set(['yellow', 'green', 'pink'])
const inkColors = new Set<InkColor>(['default', 'chalk', 'blue', 'red', 'green'])

export function anchorsOf(reveals: Reveal[]) {
  const ids: string[] = []
  for (const item of reveals) {
    if (item.type === 'mark') ids.push(item.id.replace(/^mark-/, ''))
    else ids.push(item.id)
    if (item.type === 'note') ids.push(item.anchor)
  }
  return [...new Set(ids)]
}

export interface TeacherTurn {
  say: string
  highlights: Glow[]
  draws: Reveal[]
  intent?: string
}

export function boardToolPrompt(title: string, anchors: string[], audience: string) {
  const who = audience.trim() ? `教學對象：${audience.trim()}。用詞與例子要符合這個年級。` : ''
  const mem = memoryContextForPrompt(1400)
  const core = [
    `你是白板老師，正在講「${title || '這一課'}」。用視覺化方式帶領，像真的在黑板邊畫邊講。${who}`,
    '回覆必須是一個 JSON 物件，不要加 markdown。',
    '{"say":"要念出來的話","highlights":[{"page":0,"anchor":"某個已存在的id","color":"yellow"}],"draws":[{"page":0,"id":"x1","svg":"<svg viewBox=\\"0 0 200 120\\" xmlns=\\"http://www.w3.org/2000/svg\\">...</svg>","caption":"一句說明","intent":"這張圖想讓學生看懂什麼"}],"teachingIntent":"可選，一句本次補充的教學意圖"}',
    'say：兩到五句，適合念出來；先說要看哪裡，再解釋。不要條列。',
    'highlights：只能標記白板上已有的 anchor。color 只能是 yellow、green、pink。',
    'draws（可選）：需要「畫出來」時用。svg 必須是完整 <svg>…</svg>，只用 path、line、circle、rect、text、polyline，viewBox 建議 0 0 200 120～320 200，stroke #2b2b2b、勿用 script／外部連結。id 用英文字母數字，不可重複。caption、intent 用繁體。',
    '若學生只是在問概念、不必新圖，draws 留空陣列。',
    `目前 anchor：${anchors.length ? anchors.join('、') : '還沒有'}。`,
    '只講教材範圍；超出時一句帶過並回到進度，highlights 可留空。',
    mem,
  ]
    .filter(Boolean)
    .join('\n')
  return appendExtra(core, loadCustomPrompts().teach, '講課風格補充')
}

export function planPrompt(source: string, audience: string) {
  const who = audience.trim() ? `教學對象：${audience.trim()}。用詞、例子、步調要符合這個年級。` : '教學對象沒有指定，依來源自己判斷。'
  const mem = memoryContextForPrompt(1800)
  const base = [
    '把下面的來源編成一堂「視覺化」課程。像老師用粉筆在黑板上邊寫邊畫，不要整頁塞滿段落。',
    who,
    '只回 JSON，不要 markdown。',
    '{"title":"課名","sections":[{"id":"s1","title":"小標","body":"教材摘要"}],"steps":[{"id":"p1","say":"口語講解","material":"s1","reveals":[{"type":"text","id":"t1","page":0,"variant":"title","text":"大標","color":"chalk"},{"type":"diagram","id":"d1","page":0,"caption":"圖說","intent":"學生應看懂的重點","svg":"<svg viewBox=\\"0 0 240 140\\" xmlns=\\"http://www.w3.org/2000/svg\\"><path d=\\"M10 70 L230 70\\" stroke=\\"#333\\" fill=\\"none\\"/></svg>"}]}]}',
    '4 到 8 段。每段 2 到 6 個板書元素。page 從 0 起，換主題可換頁。',
    'text：variant 為 title（大標）、body（短句）、ink（手寫感重點）。color 可為 chalk、blue、red、green、default。',
    'note：anchor 必須是同一 step 內已出現過的 id。',
    'diagram：能畫就用 svg 畫示意（箭頭、幾何、座標、流程）。欄位：caption（一句）、intent（教學意圖）、svg（完整 <svg>，僅基本圖形與文字，無 script）。若真的無法畫，只填 caption 也行。',
    'formula：只在需要時使用。',
    'say 要配合板書步驟，講到什麼就先 reveal 什麼（由前端依序顯示）。',
    '備課時參考記憶庫，延續學生過去上過的課與易錯點，但不要捏造沒出現在來源裡的事實。',
    mem,
    `來源：\n${source}`,
  ]
    .filter(Boolean)
    .join('\n')
  return appendExtra(base, loadCustomPrompts().plan, '備課風格補充')
}

function parseDrawReveals(value: unknown, seen: Set<string>): Reveal[] {
  if (!Array.isArray(value)) return []
  const out: Reveal[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object' || out.length >= 3) continue
    const row = item as Record<string, unknown>
    const reveal = parseSvgReveal(row, seen, typeof row.page === 'number' ? row.page : Number(row.page))
    if (reveal) out.push(reveal)
  }
  return out
}

function parseSvgReveal(row: Record<string, unknown>, seen: Set<string>, pageRaw: number): Reveal | null {
  const page = Number.isFinite(pageRaw) && pageRaw >= 0 ? Math.floor(pageRaw) : 0
  let id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : ''
  if (!id || seen.has(id)) id = `svg${seen.size + 1}`
  const svgRaw = typeof row.svg === 'string' ? row.svg : ''
  const safe = svgRaw ? sanitizeBoardSvg(svgRaw) : null
  if (!safe) return null
  seen.add(id)
  const caption = typeof row.caption === 'string' ? row.caption.trim() : undefined
  const intent = typeof row.intent === 'string' ? row.intent.trim() : undefined
  return { type: 'svg', id, page, svg: safe, caption, intent }
}

export function parseTeacherTurn(raw: string, fallback: string): TeacherTurn {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return { say: raw.trim() || fallback, highlights: [], draws: [] }
  try {
    const data = JSON.parse(match[0]) as {
      say?: unknown
      highlights?: unknown
      draws?: unknown
      teachingIntent?: unknown
    }
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
    const seen = new Set<string>()
    const draws = parseDrawReveals(data.draws, seen)
    const intent = typeof data.teachingIntent === 'string' && data.teachingIntent.trim() ? data.teachingIntent.trim() : undefined
    return { say, highlights, draws, intent }
  } catch {
    return { say: raw.trim() || fallback, highlights: [], draws: [] }
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

function parseInkColor(value: unknown): InkColor | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim() as InkColor
  return inkColors.has(normalized) ? normalized : undefined
}

function parseReveals(value: unknown, seen: Set<string>): Reveal[] {
  if (!Array.isArray(value)) return []
  const reveals: Reveal[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object' || reveals.length >= 6) continue
    const row = item as Record<string, unknown>
    const type = row.type
    const page = typeof row.page === 'number' && row.page >= 0 ? Math.floor(row.page) : 0
    let id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : ''
    if (!id || seen.has(id)) id = `b${seen.size + 1}`
    if (type === 'text' && typeof row.text === 'string' && row.text.trim()) {
      seen.add(id)
      const variant = row.variant === 'title' ? 'title' : row.variant === 'ink' ? 'ink' : 'body'
      reveals.push({
        type: 'text',
        id,
        page,
        text: row.text.trim(),
        variant,
        color: parseInkColor(row.color),
      })
    } else if (type === 'formula' && typeof row.latex === 'string' && row.latex.trim()) {
      seen.add(id)
      const plain = typeof row.plain === 'string' && row.plain.trim() ? row.plain.trim() : row.latex.trim()
      reveals.push({ type: 'formula', id, page, latex: row.latex.trim(), plain })
    } else if (type === 'note' && typeof row.text === 'string' && typeof row.anchor === 'string' && seen.has(row.anchor)) {
      seen.add(id)
      reveals.push({ type: 'note', id, page, anchor: row.anchor, text: row.text.trim() })
    } else if (type === 'diagram' || type === 'svg') {
      const svgReveal = parseSvgReveal(row, seen, page)
      if (svgReveal) {
        reveals.push(svgReveal)
      } else if (typeof row.caption === 'string' && row.caption.trim()) {
        seen.add(id)
        reveals.push({ type: 'text', id, page, text: row.caption.trim(), variant: 'ink', color: 'blue' })
      }
    }
  }
  return reveals
}

export function quizPrompt(difficulty: Difficulty, count: number, audience: string) {
  const name = difficulty === 'easy' ? '容易' : difficulty === 'hard' ? '難' : '中等'
  const who = audience.trim() ? `教學對象：${audience.trim()}。` : ''
  const mem = memoryContextForPrompt(800)
  const base = [
    '你是出題老師。只根據下面的教材出題，不要超出教材。',
    who,
    mem,
    `難易度：${name}。題數：${count}。`,
    '只回 JSON，不要 markdown：{"questions":[{"prompt":"題目","kind":"choice","choices":["A","B","C"],"accept":["正確選項原文"],"explain":"一句檢討"}]}',
    'kind 為 choice 時 choices 要有 3 個，accept 必須是 choices 裡的其中一個原文。',
    '用繁體中文。',
  ].join('\n')
  return appendExtra(base, loadCustomPrompts().quiz, '測驗風格補充')
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