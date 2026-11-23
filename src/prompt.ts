import { appendExtra, loadCustomPrompts } from './custom-prompts'
import { memoryContextForPrompt } from './memory-bank'
import type { Glow } from './board'
import type {
  Course,
  Difficulty,
  ForceArrow,
  ForcesReveal,
  InkColor,
  LessonIntent,
  MaterialSection,
  PlotCurve,
  PlotPoint,
  QuizQ,
  Reveal,
  Step,
} from './model'
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

const computedDrawDoc = [
  'draws 裡函數／受力／波請用下列類型，由 App 畫準，不要手畫 SVG path：',
  'plot：{"type":"plot","page":0,"id":"g1","xMin":-4,"xMax":4,"yMin":-2,"yMax":6,"showAxes":true,"curves":[{"fn":"x**2","label":"y=x²"}],"points":[{"x":2,"y":4,"label":"(2,4)"}],"caption":"拋物線"}。fn 用 x 與 Math 函數，例如 sin(x)、0.5*x+1。',
  'forces：{"type":"forces","page":0,"id":"f1","body":{"x":160,"y":100,"w":80,"h":48,"label":"物體"},"arrows":[{"id":"g","dx":0,"dy":60,"label":"G"}],"caption":"受力"}。一次可加一支箭，dx/dy 為箭頭向量。',
  'wave：{"type":"wave","page":0,"id":"w1","amplitude":64,"wavelength":280,"marks":["eq","crest"],"caption":"橫波"}。marks 可含 eq、crest、trough、amp、lambda。',
  '示意類（流程、生物週期）才用 svg。',
].join('\n')

const planComputedDoc = [
  '要算的圖必須用 plot／forces／wave，禁止用 SVG 猜曲線或受力。',
  'plot：xMin、xMax、curves[].fn（如 x**2、sin(x)）、points 標交點。',
  'forces：先 body，再 steps 裡逐步加 arrows（每段可加一支）。',
  'wave：amplitude、wavelength、marks 逐步出現。',
  'svg／diagram 只留給非數學精準的示意。',
].join('\n')

function intentRules(intent: LessonIntent): string[] {
  if (intent === 'homework') {
    return [
      '這是作業家教模式：禁止在一開始就給最終答案或寫出最後數值。',
      '每一步只給一個提示，並用 waitForStudent:true 停下來等學生試。',
      '板書只畫「這一步」需要的式子或圖，不要整題解法一次 reveal。',
      '學生明確說「直接給我答案」時，最後一步才可畫完整解法。',
    ]
  }
  if (intent === 'exam') {
    return ['備考模式：抓重點、易錯、速解步驟；每個易錯點要畫出來或標在圖上。']
  }
  return [
    '主題模式：講一個小觀念就問一句，多數 steps 設 waitForStudent:true。',
    '問句要寫在 say 裡，等學生回答後才進下一段。',
  ]
}

export function boardToolPrompt(title: string, anchors: string[], audience: string, intent: LessonIntent = 'topic') {
  const who = audience.trim() ? `教學對象：${audience.trim()}。用詞與例子要符合這個年級。` : ''
  const mem = memoryContextForPrompt(1400)
  const core = [
    `你是坐在對面的白板家教，正在帶「${title || '這一課'}」。邊講邊畫，一次一個步驟。${who}`,
    ...intentRules(intent),
    '回覆必須是一個 JSON 物件，不要加 markdown。',
    '{"say":"要念出來的話","highlights":[{"page":0,"anchor":"某個已存在的id","color":"yellow"}],"draws":[],"teachingIntent":"可選"}',
    'say：兩到五句，適合念出來；先說要看哪裡，再解釋。可問學生一句並停下等他。',
    'highlights：只能標記白板上已有的 anchor。color 只能是 yellow、green、pink。',
    computedDrawDoc,
    '若學生只是在問概念、不必新圖，draws 留空陣列。',
    `目前 anchor：${anchors.length ? anchors.join('、') : '還沒有'}。`,
    '優先在同一張圖上加註、螢光筆，不要清板重畫。',
    mem,
  ]
    .filter(Boolean)
    .join('\n')
  return appendExtra(core, loadCustomPrompts().teach, '講課風格補充')
}

export function planPrompt(source: string, audience: string, intent: LessonIntent = 'topic') {
  const who = audience.trim() ? `教學對象：${audience.trim()}。用詞、例子、步調要符合這個年級。` : '教學對象沒有指定，依來源自己判斷。'
  const mem = memoryContextForPrompt(1800)
  const base = [
    '把下面的來源編成一堂「白板家教」課程：先在心裡寫完整解法與圖的順序，再拆成多個短 steps 輸出。不要整頁塞滿。',
    `intent 欄位固定為 "${intent}"。`,
    who,
    ...intentRules(intent),
    '只回 JSON，不要 markdown。',
    '{"title":"課名","intent":"topic","sections":[{"id":"s1","title":"小標","body":"教材摘要"}],"steps":[{"id":"p1","say":"口語＋問句","material":"s1","waitForStudent":true,"reveals":[{"type":"text","id":"t1","page":0,"variant":"ink","text":"第一步"}]}]}',
    intent === 'homework' ? '6 到 14 個短步驟，每步一個提示；最後一步以前不可出現最終答案。' : '4 到 10 段。每段 1 到 4 個板書元素。',
    'page 從 0 起。同一張圖拆多段 reveal，講到才出現。',
    'waitForStudent：true 表示這段講完要停下來等學生回應（作業與主題課多用 true）。',
    'text：variant 為 title、body、ink。color 可為 chalk、blue、red、green、default。',
    planComputedDoc,
    'formula：需要時使用。',
    '備課參考記憶庫，不捏造來源沒有的事實。',
    mem,
    `來源：\n${source}`,
  ]
    .filter(Boolean)
    .join('\n')
  return appendExtra(base, loadCustomPrompts().plan, '備課風格補充')
}

function pageOf(row: Record<string, unknown>) {
  const pageRaw = typeof row.page === 'number' ? row.page : Number(row.page)
  return Number.isFinite(pageRaw) && pageRaw >= 0 ? Math.floor(pageRaw) : 0
}

function parsePlotReveal(row: Record<string, unknown>, seen: Set<string>): Reveal | null {
  const page = pageOf(row)
  let id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : ''
  if (!id || seen.has(id)) id = `plot${seen.size + 1}`
  const xMin = typeof row.xMin === 'number' ? row.xMin : Number(row.xMin)
  const xMax = typeof row.xMax === 'number' ? row.xMax : Number(row.xMax)
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMin === xMax) return null
  seen.add(id)
  const yMin = typeof row.yMin === 'number' ? row.yMin : Number.isFinite(Number(row.yMin)) ? Number(row.yMin) : undefined
  const yMax = typeof row.yMax === 'number' ? row.yMax : Number.isFinite(Number(row.yMax)) ? Number(row.yMax) : undefined
  const curves = Array.isArray(row.curves)
    ? row.curves.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const c = item as { fn?: unknown; label?: unknown; color?: unknown }
        const fn = typeof c.fn === 'string' ? c.fn.trim() : ''
        if (!fn) return []
        const curve: PlotCurve = { fn }
        if (typeof c.label === 'string' && c.label.trim()) curve.label = c.label.trim()
        if (typeof c.color === 'string' && c.color.trim()) curve.color = c.color.trim()
        return [curve]
      })
    : undefined
  const points = Array.isArray(row.points)
    ? row.points.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const p = item as { x?: unknown; y?: unknown; label?: unknown }
        const x = typeof p.x === 'number' ? p.x : Number(p.x)
        const y = typeof p.y === 'number' ? p.y : Number(p.y)
        if (!Number.isFinite(x) || !Number.isFinite(y)) return []
        const point: PlotPoint = { x, y }
        if (typeof p.label === 'string' && p.label.trim()) point.label = p.label.trim()
        return [point]
      })
    : undefined
  const caption = typeof row.caption === 'string' ? row.caption.trim() : undefined
  const intent = typeof row.intent === 'string' ? row.intent.trim() : undefined
  const showAxes = row.showAxes === false ? false : true
  return { type: 'plot', id, page, xMin, xMax, yMin, yMax, curves, points, showAxes, caption, intent }
}

function parseForcesReveal(row: Record<string, unknown>, seen: Set<string>): Reveal | null {
  const page = pageOf(row)
  let id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : ''
  if (!id || seen.has(id)) id = `force${seen.size + 1}`
  const arrowsRaw = Array.isArray(row.arrows) ? row.arrows : []
  const arrows: ForceArrow[] = arrowsRaw.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return []
    const a = item as { id?: unknown; dx?: unknown; dy?: unknown; label?: unknown; color?: unknown }
    const dx = typeof a.dx === 'number' ? a.dx : Number(a.dx)
    const dy = typeof a.dy === 'number' ? a.dy : Number(a.dy)
    const label = typeof a.label === 'string' ? a.label.trim() : ''
    if (!label || !Number.isFinite(dx) || !Number.isFinite(dy)) return []
    const arrow: ForceArrow = {
      id: typeof a.id === 'string' && a.id.trim() ? a.id.trim() : `a${index}`,
      dx,
      dy,
      label,
    }
    if (typeof a.color === 'string' && a.color.trim()) arrow.color = a.color.trim()
    return [arrow]
  })
  if (!arrows.length && !row.body) return null
  seen.add(id)
  let body: ForcesReveal['body']
  if (row.body && typeof row.body === 'object') {
    const b = row.body as { x?: unknown; y?: unknown; w?: unknown; h?: unknown; label?: unknown }
    const x = typeof b.x === 'number' ? b.x : Number(b.x)
    const y = typeof b.y === 'number' ? b.y : Number(b.y)
    const w = typeof b.w === 'number' ? b.w : Number(b.w)
    const h = typeof b.h === 'number' ? b.h : Number(b.h)
    if ([x, y, w, h].every(Number.isFinite)) {
      body = { x, y, w, h, label: typeof b.label === 'string' ? b.label.trim() : undefined }
    }
  }
  const caption = typeof row.caption === 'string' ? row.caption.trim() : undefined
  const intent = typeof row.intent === 'string' ? row.intent.trim() : undefined
  return { type: 'forces', id, page, body, arrows, caption, intent }
}

function parseWaveParamsReveal(row: Record<string, unknown>, seen: Set<string>): Reveal | null {
  const page = pageOf(row)
  let id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : ''
  if (!id || seen.has(id)) id = `wave${seen.size + 1}`
  seen.add(id)
  const amplitude = typeof row.amplitude === 'number' ? row.amplitude : Number.isFinite(Number(row.amplitude)) ? Number(row.amplitude) : undefined
  const wavelength = typeof row.wavelength === 'number' ? row.wavelength : Number.isFinite(Number(row.wavelength)) ? Number(row.wavelength) : undefined
  const phase = typeof row.phase === 'number' ? row.phase : Number.isFinite(Number(row.phase)) ? Number(row.phase) : undefined
  const marks = Array.isArray(row.marks) ? row.marks.filter((m): m is string => typeof m === 'string') : undefined
  const caption = typeof row.caption === 'string' ? row.caption.trim() : undefined
  return { type: 'wave', id, page, amplitude, wavelength, phase, marks, caption }
}

function parseBoardReveal(row: Record<string, unknown>, seen: Set<string>): Reveal | null {
  const type = row.type
  const page = pageOf(row)
  if (type === 'plot') return parsePlotReveal(row, seen)
  if (type === 'forces') return parseForcesReveal(row, seen)
  if (type === 'wave') return parseWaveParamsReveal(row, seen)
  if (type === 'diagram' || type === 'svg') return parseSvgReveal(row, seen, page)
  return null
}

function parseDrawReveals(value: unknown, seen: Set<string>): Reveal[] {
  if (!Array.isArray(value)) return []
  const out: Reveal[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object' || out.length >= 3) continue
    const row = item as Record<string, unknown>
    const reveal = parseBoardReveal(row, seen)
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
    const data = JSON.parse(match[0]) as { title?: unknown; sections?: unknown; steps?: unknown; intent?: unknown }
    const title = typeof data.title === 'string' ? data.title.trim() : ''
    const sections = parseSections(data.sections)
    const steps = parseSteps(data.steps, sections)
    if (!title || sections.length === 0 || steps.length === 0) return null
    const intentRaw = typeof data.intent === 'string' ? data.intent.trim() : ''
    const intent: LessonIntent =
      intentRaw === 'homework' || intentRaw === 'exam' || intentRaw === 'topic' ? intentRaw : 'topic'
    return { title, audience: audience.trim(), source, intent, sections, steps }
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
    const row = item as { id?: unknown; say?: unknown; material?: unknown; reveals?: unknown; waitForStudent?: unknown }
    const say = typeof row.say === 'string' ? row.say.trim() : ''
    const reveals = parseReveals(row.reveals, seen)
    if (!say || reveals.length === 0) return []
    const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : `p${index + 1}`
    const material = typeof row.material === 'string' && sectionIds.has(row.material) ? row.material : sections[0].id
    const waitForStudent = row.waitForStudent === true || row.waitForStudent === 'true'
    return [{ id, say, material, reveals, lasers: reveals.map((reveal) => reveal.id), waitForStudent: waitForStudent || undefined }]
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
    } else if (type === 'plot' || type === 'forces' || type === 'wave') {
      const built = parseBoardReveal(row, seen)
      if (built) reveals.push(built)
    } else if (type === 'diagram' || type === 'svg') {
      const svgReveal = parseSvgReveal(row, seen, page)
      if (svgReveal) {
        reveals.push(svgReveal)
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