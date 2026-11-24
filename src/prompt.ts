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
import { sanitizeBoardSvg, svgRejectedForComputedPlot } from './svg-sanitize'

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

function intentRules(intent: LessonIntent, homeworkUnlocked = false): string[] {
  if (intent === 'homework') {
    if (homeworkUnlocked) {
      return [
        '學生已要求完整解法。可以把剩餘步驟畫在板上，但仍要一步一步 reveal，邊畫邊講。',
        '函數／受力用 plot、forces，不要 SVG 瞎畫曲線。',
      ]
    }
    return [
      '這是作業家教模式：禁止在一開始就給最終答案或寫出最後數值。',
      '每一步只給一個提示，並用 waitForStudent:true 停下來等學生試。',
      '板書只畫「這一步」需要的式子或圖，不要整題解法一次 reveal。',
      '學生明確說「直接給我答案」時，最後一步才可畫完整解法。',
    ]
  }
  if (intent === 'exam') {
    return [
      '備考模式：照「考點重點 → 易錯點 → 速解練習」順序講，不要跳著背。',
      '易錯段落每一步至少一個 plot、forces 或 svg 圖，並給穩定 id（例如 trap1、g2），供小測錯題指回。',
      '禁止易錯只寫一行字不畫圖。',
    ]
  }
  return [
    '主題模式：講一個小觀念就問一句，多數 steps 設 waitForStudent:true。',
    '問句要寫在 say 裡，等學生回答後才進下一段。',
  ]
}

export interface BoardPromptOptions {
  homeworkUnlocked?: boolean
  lessonPlan?: string
}

export function boardToolPrompt(
  title: string,
  anchors: string[],
  audience: string,
  intent: LessonIntent = 'topic',
  options: BoardPromptOptions = {},
) {
  const who = audience.trim() ? `教學對象：${audience.trim()}。用詞與例子要符合這個年級。` : ''
  const mem = memoryContextForPrompt(1400)
  const plan = options.lessonPlan?.trim() ? `（內部教案，不要念給學生聽）\n${options.lessonPlan.trim().slice(0, 1200)}` : ''
  const core = [
    `你是坐在對面的白板家教，正在帶「${title || '這一課'}」。邊講邊畫，一次一個步驟。${who}`,
    plan,
    ...intentRules(intent, options.homeworkUnlocked),
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

export const EXAM_SECTION_IDS = ['focus', 'traps', 'drill'] as const

export const EXAM_MATERIAL_LABELS: Record<string, string> = {
  focus: '考點',
  traps: '易錯',
  drill: '速解',
}

function examPlanBlock() {
  return [
    '備考課固定三個 section（id 必須完全一致）：',
    '{"id":"focus","title":"考點重點","body":"…"},{"id":"traps","title":"易錯點","body":"…"},{"id":"drill","title":"速解練習","body":"…"}',
    'steps 順序：先若干段 material 為 focus（考點）→ 若干段 material 為 traps（易錯，必須有 plot/forces/svg）→ 若干段 material 為 drill（速解套路）。至少 8 段。',
    'quizQuestions：3～5 題備考小測，每題要有 anchor、laser（必須是 steps 裡出現過的 reveal id，優先 traps 段）、page。',
    '{"quizQuestions":[{"prompt":"題目","kind":"choice","choices":["A","B","C"],"accept":["A"],"explain":"一句檢討","anchor":"trap1","laser":"trap1","page":0}]}',
  ].join('\n')
}

export function planPrompt(source: string, audience: string, intent: LessonIntent = 'topic') {
  const who = audience.trim() ? `教學對象：${audience.trim()}。用詞、例子、步調要符合這個年級。` : '教學對象沒有指定，依來源自己判斷。'
  const mem = memoryContextForPrompt(1800)
  const examExample =
    '{"title":"牛頓定律備考","intent":"exam","sections":[{"id":"focus","title":"考點重點","body":"…"},{"id":"traps","title":"易錯點","body":"…"},{"id":"drill","title":"速解練習","body":"…"}],"steps":[{"id":"p1","say":"…","material":"focus","reveals":[{"type":"text","id":"k1","page":0,"variant":"title","text":"考點"}]}],"quizQuestions":[{"prompt":"…","kind":"choice","choices":["A","B","C"],"accept":["A"],"explain":"…","anchor":"trap1","laser":"trap1","page":0}]}'
  const base = [
    '把下面的來源編成一堂「白板家教」課程：先在心裡寫完整解法與圖的順序，再拆成多個短 steps 輸出。不要整頁塞滿。',
    `intent 欄位固定為 "${intent}"。`,
    who,
    ...intentRules(intent),
    '只回 JSON，不要 markdown。',
    intent === 'exam'
      ? examExample
      : '{"title":"課名","intent":"topic","sections":[{"id":"s1","title":"小標","body":"教材摘要"}],"steps":[{"id":"p1","say":"口語＋問句","material":"s1","waitForStudent":true,"reveals":[{"type":"text","id":"t1","page":0,"variant":"ink","text":"第一步"}]}]}',
    'lessonPlan：必填，繁體，學生看不到。寫完整解法／易錯／圖的出現順序，供你自家對齊，不要印上板。',
    intent === 'homework'
      ? '6 到 14 個短步驟，每步一個提示；最後一步以前不可出現最終答案。'
      : intent === 'exam'
        ? examPlanBlock()
        : intent === 'topic'
          ? [
              '主題課：4 到 10 段。多數 steps 設 waitForStudent:true，say 裡要有問句。',
              'quizQuestions：2～4 題小測，anchor／laser 對應板上圖或重點文字 id。',
            ].join('\n')
          : '4 到 10 段。每段 1 到 4 個板書元素。',
    'page 從 0 起。同一張圖拆多段 reveal，講到才出現。',
    'waitForStudent：true 表示這段講完要停下來等學生回應（作業與主題課多用 true；備考 traps 段可 false 以加快）。',
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
  if (svgRaw && svgRejectedForComputedPlot(svgRaw)) return null
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
    const data = JSON.parse(match[0]) as {
      title?: unknown
      sections?: unknown
      steps?: unknown
      intent?: unknown
      lessonPlan?: unknown
      quizQuestions?: unknown
    }
    const title = typeof data.title === 'string' ? data.title.trim() : ''
    const sections = parseSections(data.sections)
    const steps = parseSteps(data.steps, sections)
    if (!title || sections.length === 0 || steps.length === 0) return null
    const intentRaw = typeof data.intent === 'string' ? data.intent.trim() : ''
    const intent: LessonIntent =
      intentRaw === 'homework' || intentRaw === 'exam' || intentRaw === 'topic' ? intentRaw : 'topic'
    const anchorIds = [...new Set(steps.flatMap((step) => step.reveals.map((r) => r.id)))]
    const quizQuestions = parseQuizQuestions(data.quizQuestions, anchorIds)
    const lessonPlan = typeof data.lessonPlan === 'string' ? data.lessonPlan.trim() : ''
    return {
      title,
      audience: audience.trim(),
      source,
      intent,
      sections,
      steps,
      lessonPlan: lessonPlan || undefined,
      quizQuestions: quizQuestions.length ? quizQuestions : undefined,
    }
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

export function bindQuizAnchors(questions: QuizQ[], anchors: string[]): QuizQ[] {
  const pool = anchors.filter(Boolean)
  const fallback = pool[0] ?? 'def'
  const trap = pool.find((id) => /trap|易錯|err|pit/i.test(id)) ?? pool[Math.min(1, pool.length - 1)] ?? fallback
  return questions.map((q, index) => {
    const anchor = q.anchor && pool.includes(q.anchor) ? q.anchor : index % 2 === 0 ? trap : fallback
    const laser = q.laser && pool.includes(q.laser) ? q.laser : anchor
    const page = Number.isFinite(q.page) ? q.page : 0
    return { ...q, anchor, laser, page }
  })
}

function parseQuizQuestions(value: unknown, anchorPool: string[]): QuizQ[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item, index) => {
    const rows = parseQuiz(JSON.stringify({ questions: [item] }))
    const row = rows[0]
    if (!row) return []
    const bound = bindQuizAnchors([{ ...row, id: `exam-${index}` }], anchorPool)[0]
    return [bound]
  })
}

export function topicQuizPrompt(audience: string, anchors: string[], material: string, count = 3) {
  const who = audience.trim() ? `教學對象：${audience.trim()}。` : ''
  const mem = memoryContextForPrompt(600)
  const anchorHint = anchors.length ? anchors.join('、') : '（請選板上已有 id）'
  return [
    '主題課收尾小測：只考這堂白板上的觀念與圖。',
    who,
    mem,
    `題數：${count}。`,
    '每題必須帶 anchor、laser、page，錯題要能指回剛才的圖或重點。',
    `可選 anchor：${anchorHint}`,
    '只回 JSON：{"questions":[{"prompt":"…","kind":"choice","choices":["A","B","C"],"accept":["A"],"explain":"…","anchor":"g1","laser":"g1","page":0}]}',
    `教材：\n${material}`,
  ].join('\n')
}

export function examQuizPrompt(audience: string, anchors: string[], material: string, count = 4) {
  const who = audience.trim() ? `教學對象：${audience.trim()}。` : ''
  const mem = memoryContextForPrompt(600)
  const anchorHint = anchors.length ? anchors.join('、') : '（尚無，請依教材自訂並與考點相關）'
  return [
    '備考收尾小測：只考這份教材與白板上出現過的考點、易錯點。',
    who,
    mem,
    `題數：${count}。難度中等。`,
    '每題必須帶 anchor、laser（從下列白板 id 選，優先易錯圖）和 page。',
    `可選 anchor：${anchorHint}`,
    '只回 JSON：{"questions":[{"prompt":"題目","kind":"choice","choices":["A","B","C"],"accept":["A"],"explain":"檢討","anchor":"trap1","laser":"trap1","page":0}]}',
    `教材：\n${material}`,
  ].join('\n')
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
      const row = item as {
        prompt?: unknown
        kind?: unknown
        choices?: unknown
        accept?: unknown
        explain?: unknown
        anchor?: unknown
        laser?: unknown
        page?: unknown
        id?: unknown
      }
      const prompt = typeof row.prompt === 'string' ? row.prompt.trim() : ''
      const explain = typeof row.explain === 'string' ? row.explain.trim() : ''
      const accept = Array.isArray(row.accept) ? row.accept.filter((value): value is string => typeof value === 'string' && value.trim() !== '') : []
      if (!prompt || !explain || accept.length === 0) return []
      const choices = Array.isArray(row.choices) ? row.choices.filter((value): value is string => typeof value === 'string') : undefined
      const kind = row.kind === 'fill' || !choices?.length ? 'fill' : 'choice'
      const anchor = typeof row.anchor === 'string' && row.anchor.trim() ? row.anchor.trim() : 'def'
      const laser = typeof row.laser === 'string' && row.laser.trim() ? row.laser.trim() : anchor
      const pageRaw = typeof row.page === 'number' ? row.page : Number(row.page)
      const page = Number.isFinite(pageRaw) && pageRaw >= 0 ? Math.floor(pageRaw) : 0
      const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : `model-${index}`
      return [
        {
          id,
          requires: anchor,
          difficulty: 'mid' as const,
          prompt,
          kind,
          choices: kind === 'choice' ? choices : undefined,
          accept,
          explain,
          laser,
          anchor,
          page,
          note: explain,
        },
      ]
    })
  } catch {
    return []
  }
}