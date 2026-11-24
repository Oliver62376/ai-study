import { upsertReveal } from './reveal-merge'

export type Role = 'teacher' | 'student'

export type InkColor = 'default' | 'chalk' | 'blue' | 'red' | 'green'

export type LessonIntent = 'topic' | 'exam' | 'homework'

export interface PlotCurve {
  fn: string
  label?: string
  color?: string
}

export interface PlotPoint {
  x: number
  y: number
  label?: string
}

export interface PlotReveal {
  type: 'plot'
  id: string
  page: number
  xMin: number
  xMax: number
  yMin?: number
  yMax?: number
  curves?: PlotCurve[]
  points?: PlotPoint[]
  showAxes?: boolean
  caption?: string
  intent?: string
}

export interface ForceBody {
  x: number
  y: number
  w: number
  h: number
  label?: string
}

export interface ForceArrow {
  id: string
  dx: number
  dy: number
  label: string
  color?: string
}

export interface ForcesReveal {
  type: 'forces'
  id: string
  page: number
  body?: ForceBody
  arrows: ForceArrow[]
  caption?: string
  intent?: string
}

export interface WaveParamsReveal {
  type: 'wave'
  id: string
  page: number
  amplitude?: number
  wavelength?: number
  phase?: number
  marks?: string[]
  caption?: string
}

export type Reveal =
  | { type: 'text'; id: string; page: number; text: string; variant: 'title' | 'body' | 'ink'; color?: InkColor }
  | { type: 'formula'; id: string; page: number; latex: string; plain: string }
  | {
      type: 'svg'
      id: string
      page: number
      svg: string
      caption?: string
      /** 這張圖想表達的教學意圖（給記憶庫／後續講解） */
      intent?: string
    }
  | PlotReveal
  | ForcesReveal
  | WaveParamsReveal
  | { type: 'mark'; id: string; page: number }
  | { type: 'anim'; id: string; page: number }
  | { type: 'lab'; id: string; page: number }
  | { type: 'note'; id: string; page: number; anchor: string; text: string }

export interface Step {
  id: string
  say: string
  material: string
  reveals: Reveal[]
  lasers: string[]
  /** 講完這一段後停下來等學生回應，再進下一段 */
  waitForStudent?: boolean
}

export type Difficulty = 'easy' | 'mid' | 'hard'

export interface QuizQ {
  id: string
  requires: string
  difficulty: Difficulty
  prompt: string
  kind: 'choice' | 'fill'
  choices?: string[]
  accept: string[]
  explain: string
  laser: string
  anchor: string
  page: number
  note: string
}

export interface Line {
  role: Role
  text: string
}

export interface QuizItem {
  id: string
  prompt: string
  answer: string
  correct: boolean
  explain: string
}

export interface QuizSession {
  items: QuizItem[]
}

export type RecEvent =
  | { t: number; type: 'say'; role: Role; text: string }
  | { t: number; type: 'reveal'; reveal: Reveal }
  | { t: number; type: 'laser'; id: string | null }

export type JobKind = 'step' | 'supplement' | 'review' | 'bridge'

export interface Job {
  id: number
  kind: JobKind
  text: string
  note?: Reveal
  laser?: string | null
  /** 備考錯題時螢光標回板書 */
  reviewHighlight?: { page: number; anchor: string; color: string }
}

export type Phase =
  | 'ready'
  | 'speaking'
  | 'awaiting_student'
  | 'paused'
  | 'supplement'
  | 'quiz-ask'
  | 'quiz-review'
  | 'bridge'
  | 'done'
  | 'replay'

export interface MaterialSection {
  id: string
  title: string
  body: string
}

export interface Course {
  title: string
  audience: string
  source: string
  intent: LessonIntent
  sections: MaterialSection[]
  steps: Step[]
  /** 學生看不見的備課教案摘要，供家教對齊解法順序 */
  lessonPlan?: string
  /** 備考／主題課收尾小測（備課內嵌或講完後由 App 補出） */
  quizQuestions?: QuizQ[]
}

export function courseSteps(state: { course: Course | null }) {
  return state.course?.steps ?? []
}


export interface Persist {
  stepIndex: number
  finished: boolean
  reveals: Reveal[]
  laser: string | null
  caption: string
  transcript: Line[]
  materialId: string
  course: Course | null
  quizLog: QuizSession[]
  recording: boolean
  replayBoard: Reveal[]
  events: RecEvent[]
}

export interface State extends Persist {
  phase: Phase
  job: Job | null
  jobSeq: number
  pausedKind: JobKind | null
  pausedText: string | null
  quizQueue: QuizQ[]
  quizIndex: number
  quizAnswers: QuizItem[]
  replaySnap: Persist | null
  /** 作業模式：學生要求後才允許畫完整解法 */
  homeworkUnlocked: boolean
}

export const emptyPersist = (): Persist => ({
  stepIndex: 0,
  finished: false,
  reveals: [],
  laser: null,
  caption: '',
  transcript: [],
  materialId: '',
  course: null,
  quizLog: [],
  recording: false,
  replayBoard: [],
  events: [],
})

export function freshState(): State {
  return {
    ...emptyPersist(),
    phase: 'ready',
    job: null,
    jobSeq: 0,
    pausedKind: null,
    pausedText: null,
    quizQueue: [],
    quizIndex: 0,
    quizAnswers: [],
    replaySnap: null,
    homeworkUnlocked: false,
  }
}

const STORAGE_KEY = 'ai-study-course-v1'

export function loadState(): State {
  try {
    if (new URLSearchParams(window.location.search).has('fresh')) {
      localStorage.removeItem(STORAGE_KEY)
      return freshState()
    }
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return freshState()
    const saved = JSON.parse(raw) as Persist
    if (!saved?.course || !Array.isArray(saved.course.steps) || saved.course.steps.length === 0) return freshState()
    if (!saved.course.intent) saved.course.intent = 'topic'
    if (!Array.isArray(saved.reveals)) return freshState()
    return {
      ...freshState(),
      ...saved,
      course: saved.course,
      replayBoard: Array.isArray(saved.replayBoard) ? saved.replayBoard : [],
      phase: saved.finished ? 'done' : 'ready',
      caption: saved.finished
        ? '上次已經講完。板書和測驗紀錄都還在。'
        : saved.reveals.length
          ? '上次的板書還在，按繼續上課接下去。'
          : '',
    }
  } catch {
    return freshState()
  }
}

export function saveState(state: State) {
  if (state.phase === 'replay') return
  const data: Persist = {
    stepIndex: state.stepIndex,
    finished: state.finished,
    reveals: state.reveals,
    laser: null,
    caption: state.caption,
    transcript: state.transcript,
    materialId: state.materialId,
    course: state.course,
      quizLog: state.quizLog,
    recording: state.recording,
    replayBoard: state.replayBoard,
    events: state.events,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function hasId(reveals: Reveal[], id: string) {
  return reveals.some((item) => item.id === id)
}

function appendLine(lines: Line[], role: Role, text: string): Line[] {
  const last = lines[lines.length - 1]
  if (last && last.role === role && last.text === text) return lines
  return [...lines, { role, text }]
}

function record(state: State, event: RecEvent, at: number): RecEvent[] {
  if (!state.recording || state.phase === 'replay') return state.events
  return [...state.events, { ...event, t: at }]
}

function nextJob(state: State, kind: JobKind, text: string, extra?: Partial<Job>): Job {
  return { id: state.jobSeq + 1, kind, text, ...extra }
}

function withJob(state: State, job: Job, phase: Phase, patch: Partial<State> = {}): State {
  return { ...state, ...patch, phase, job, jobSeq: job.id }
}

function finishCaption(state: State) {
  const intent = state.course?.intent
  if (intent === 'homework') return '這一題的提示都講完了。若要完整解法，跟我說「直接給我答案」。'
  if (intent === 'topic') return '觀念講完了，正在準備小測…'
  if (intent === 'exam') return '考點與易錯都講過了。正在準備備考小測…'
  return '這一段教材講完了。可以進入測驗，或把白板存成 PDF。'
}

function examQuizBridgeSay() {
  return '重點與易錯都講過了。接下來做備考小測；答錯我會指回白板上的圖。'
}

function topicQuizBridgeSay() {
  return '這個觀念講完了。來幾題小測；答錯我會指回剛才白板上的地方。'
}

function finishExamQuizCaption(correct: number, total: number) {
  if (correct === total) return `備考小測全對（${total} 題）。照這個節奏進考場。`
  return `備考小測結束：${correct} / ${total} 題。錯題已標在白板，考前再掃一次易錯處。`
}

function finishTopicQuizCaption(correct: number, total: number) {
  if (correct === total) return `小測全對（${total} 題）。這個觀念你掌握了。`
  return `小測結束：${correct} / ${total} 題。錯題已標在板上，再看一次圖示與註記。`
}

function endLecture(state: State, at: number): State {
  const steps = courseSteps(state)
  const base: State = {
    ...state,
    stepIndex: steps.length,
    finished: true,
    job: null,
    laser: null,
  }
  const qs = base.course?.quizQuestions ?? []
  const wrapIntent = base.course?.intent
  if ((wrapIntent === 'exam' || wrapIntent === 'topic') && qs.length > 0) {
    const say = wrapIntent === 'exam' ? examQuizBridgeSay() : topicQuizBridgeSay()
    const job = nextJob(base, 'bridge', say)
    return withJob(
      {
        ...base,
        quizQueue: qs,
        quizIndex: 0,
        quizAnswers: [],
        transcript: appendLine(base.transcript, 'teacher', say),
        events: record(base, { t: at, type: 'say', role: 'teacher', text: say }, at),
      },
      job,
      'bridge',
      { caption: say, laser: null },
    )
  }
  return { ...base, phase: 'done', caption: finishCaption(base) }
}

function startInlineExamQuiz(state: State, at: number): State {
  const qs = state.quizQueue
  if (!qs.length) return { ...state, phase: 'done', caption: finishCaption(state) }
  const first = qs[0]
  const say = '請聽題，直接在下面回答。'
  const job = nextJob(state, 'bridge', say)
  return withJob(state, job, 'quiz-ask', { caption: first.prompt, laser: first.laser ?? null })
}

function beginStep(state: State, at: number): State {
  const steps = courseSteps(state)
  if (state.stepIndex >= steps.length) {
    return {
      ...state,
      phase: 'done',
      finished: true,
      job: null,
      laser: null,
      caption: finishCaption(state),
    }
  }
  const step = steps[state.stepIndex]
  const job = nextJob(state, 'step', step.say)
  const transcript = appendLine(state.transcript, 'teacher', step.say)
  const added = transcript.length !== state.transcript.length
  return withJob(state, job, 'speaking', {
    caption: step.say,
    materialId: step.material,
    laser: null,
    transcript,
    events: added ? record(state, { t: at, type: 'say', role: 'teacher', text: step.say }, at) : state.events,
    pausedKind: null,
    pausedText: null,
  })
}

export function grade(q: QuizQ, answer: string) {
  const value = answer.trim().toLowerCase().replace(/\s+/g, '')
  if (q.kind === 'choice') return q.accept.some((item) => item.toLowerCase() === value)
  return q.accept.some((item) => value.includes(item.toLowerCase().replace(/\s+/g, '')))
}

interface AskResult {
  say: string
  laser: string | null
  note: Reveal | null
}

function interpret(text: string, state: State): AskResult | 'quiz' {
  const t = text.replace(/\s+/g, '')
  if (/測驗|考考|出題|練習/.test(t)) return 'quiz'
  if (/重講|再說|不懂|不了解|聽不懂/.test(t)) {
    const steps = courseSteps(state)
    const step = steps[Math.min(state.stepIndex, Math.max(steps.length - 1, 0))]
    return {
      say: step ? `我把剛剛那句再講一次。${step.say}` : '還沒有可以重講的內容。',
      laser: state.laser,
      note: null,
    }
  }
  return {
    say: '這句要由接上的模型回答。到「模型」填好 API 之後再問一次，我會回到現在的進度。',
    laser: null,
    note: null,
  }
}

function startQuiz(state: State, at: number): State {
  const say = '測驗在另一面白板，題目由模型依照這份教材出。'
  const job = nextJob(state, 'bridge', say)
  return withJob(state, job, 'bridge', {
    caption: say,
    transcript: appendLine(state.transcript, 'teacher', say),
    events: record(state, { t: at, type: 'say', role: 'teacher', text: say }, at),
  })
}

function finishQuiz(state: State, at: number): State {
  const session = { items: state.quizAnswers }
  const correct = state.quizAnswers.filter((item) => item.correct).length
  const total = state.quizAnswers.length
  const base: State = {
    ...state,
    quizLog: [...state.quizLog, session],
    quizQueue: [],
    quizIndex: 0,
    quizAnswers: [],
  }
  if (base.finished || base.stepIndex >= courseSteps(base).length) {
    const caption =
      base.course?.intent === 'exam'
        ? finishExamQuizCaption(correct, total)
        : base.course?.intent === 'topic'
          ? finishTopicQuizCaption(correct, total)
          : '檢討結束，課程也已經講完。'
    return { ...base, phase: 'done', job: null, caption }
  }
  const say = '檢討結束，回到剛才還沒講完的地方。'
  const primed: State = {
    ...base,
    transcript: appendLine(base.transcript, 'teacher', say),
    events: record(base, { t: at, type: 'say', role: 'teacher', text: say }, at),
    caption: say,
  }
  return beginStep(primed, at)
}

export type Action =
  | { type: 'start'; at: number }
  | { type: 'pause' }
  | { type: 'resume'; at: number }
  | { type: 'spoken'; at: number }
  | { type: 'reveal'; reveal: Reveal; laser?: string | null; at: number }
  | { type: 'laser'; id: string | null; at: number }
  | { type: 'ask'; text: string; at: number; say?: string }
  | { type: 'student-ready'; text: string; at: number }
  | { type: 'retell'; text: string }
  | { type: 'answer'; text: string; at: number }
  | { type: 'quiz'; at: number }
  | { type: 'toggle-record' }
  | { type: 'toggle-done-caption' }
  | { type: 'reset' }
  | { type: 'load-course'; course: Course; at: number }
  | { type: 'restore-lesson'; persist: Persist; at: number }
  | { type: 'quiz-load'; questions: QuizQ[]; at: number }
  | { type: 'homework-unlock'; at: number }
  | { type: 'replay-start' }
  | { type: 'replay-event'; event: RecEvent }
  | { type: 'replay-end' }

function applyReveal(state: State, reveal: Reveal, at: number): State {
  const { reveals, merged } = upsertReveal(state.reveals, reveal)
  if (reveals === state.reveals) return state
  const stored = merged ? reveals.find((item) => item.id === reveal.id) ?? reveal : reveal
  return {
    ...state,
    reveals,
    events: record(state, { t: at, type: 'reveal', reveal: stored }, at),
  }
}

function flushReveals(state: State, incoming: Reveal[], at: number): State {
  let next = state
  for (const reveal of incoming) {
    next = applyReveal(next, reveal, at)
  }
  return next
}

export function snapshot(state: State): Persist {
  return {
    stepIndex: state.stepIndex,
    finished: state.finished,
    reveals: state.reveals,
    laser: state.laser,
    caption: state.caption,
    transcript: state.transcript,
    materialId: state.materialId,
    course: state.course,
    quizLog: state.quizLog,
    recording: state.recording,
    replayBoard: state.replayBoard,
    events: state.events,
  }
}

export function reduce(state: State, action: Action): State {
  switch (action.type) {
    case 'start': {
      if (state.phase !== 'ready' && state.phase !== 'done') return state
      if (state.finished) return state
      return beginStep(state, action.at)
    }
    case 'pause': {
      if (!state.job) return state
      if (state.phase !== 'speaking' && state.phase !== 'supplement' && state.phase !== 'quiz-review' && state.phase !== 'bridge') {
        return state
      }
      return {
        ...state,
        phase: 'paused',
        pausedKind: state.job.kind,
        pausedText: state.job.text,
        job: null,
      }
    }
    case 'resume': {
      if (state.phase !== 'paused' || !state.pausedKind || !state.pausedText) return state
      const kind = state.pausedKind
      const phase: Phase =
        kind === 'step' ? 'speaking' : kind === 'review' ? 'quiz-review' : kind === 'bridge' ? 'bridge' : 'supplement'
      const job = nextJob(state, kind, state.pausedText)
      return withJob(state, job, phase, { caption: state.pausedText })
    }
    case 'spoken': {
      if (!state.job && state.phase !== 'speaking' && state.phase !== 'supplement' && state.phase !== 'bridge' && state.phase !== 'quiz-review') {
        return state
      }
      if (state.phase === 'speaking') {
        const flushed = state
        const steps = courseSteps(flushed)
        const step = steps[flushed.stepIndex]
        if (step?.waitForStudent) {
          return {
            ...flushed,
            phase: 'awaiting_student',
            job: null,
            laser: null,
            caption: step.say.includes('？')
              ? step.say
              : `${step.say}（請在下方回答或試著畫出下一步，家教會等你。）`,
          }
        }
        const nextIndex = flushed.stepIndex + 1
        if (nextIndex >= steps.length) return endLecture(flushed, action.at)
        return beginStep({ ...flushed, stepIndex: nextIndex }, action.at)
      }
      if (state.phase === 'supplement' || state.phase === 'bridge') {
        const flushed = state.job?.note ? flushReveals(state, [state.job.note], action.at) : state
        if (
          (flushed.course?.intent === 'exam' || flushed.course?.intent === 'topic') &&
          flushed.finished &&
          flushed.quizQueue.length > 0 &&
          flushed.phase === 'bridge'
        ) {
          return startInlineExamQuiz(flushed, action.at)
        }
        if (flushed.finished || flushed.stepIndex >= courseSteps(flushed).length) {
          return { ...flushed, phase: 'done', job: null, caption: '補充結束。課程先前已經講完。' }
        }
        return beginStep(flushed, action.at)
      }
      if (state.phase === 'quiz-review') {
        const flushed = state.job?.note ? flushReveals(state, [state.job.note], action.at) : state
        const next = flushed.quizIndex + 1
        if (next >= flushed.quizQueue.length) return finishQuiz(flushed, action.at)
        return { ...flushed, quizIndex: next, phase: 'quiz-ask', job: null, caption: '下一題。' }
      }
      return state
    }
    case 'reveal': {
      if (state.phase === 'replay') return state
      const laser = action.laser === undefined ? state.laser : action.laser
      const next = applyReveal(state, action.reveal, action.at)
      return { ...next, laser }
    }
    case 'homework-unlock': {
      if (state.course?.intent !== 'homework') return state
      const say = '好，你要看完整解法。我會把步驟都畫在板上。'
      return {
        ...state,
        homeworkUnlocked: true,
        caption: say,
        transcript: appendLine(state.transcript, 'teacher', say),
        events: record(state, { t: action.at, type: 'say', role: 'teacher', text: say }, action.at),
      }
    }
    case 'laser': {
      if (state.phase === 'replay') return state
      if (state.laser === action.id) return state
      return {
        ...state,
        laser: action.id,
        events: record(state, { t: action.at, type: 'laser', id: action.id }, action.at),
      }
    }
    case 'student-ready': {
      const text = action.text.trim()
      if (!text || state.phase !== 'awaiting_student') return state
      const withStudent: State = {
        ...state,
        transcript: appendLine(state.transcript, 'student', text),
        events: record(state, { t: action.at, type: 'say', role: 'student', text }, action.at),
      }
      const steps = courseSteps(withStudent)
      const nextIndex = withStudent.stepIndex + 1
      if (nextIndex >= steps.length) return endLecture(withStudent, action.at)
      return beginStep({ ...withStudent, stepIndex: nextIndex }, action.at)
    }
    case 'ask': {
      const text = action.text.trim()
      if (!text) return state
      if (state.phase === 'replay' || state.phase === 'quiz-ask' || state.phase === 'quiz-review') return state
      if (state.phase === 'awaiting_student') {
        const withStudent: State = {
          ...state,
          transcript: appendLine(state.transcript, 'student', text),
          events: record(state, { t: action.at, type: 'say', role: 'student', text }, action.at),
        }
        const steps = courseSteps(withStudent)
        const nextIndex = withStudent.stepIndex + 1
        if (nextIndex >= steps.length) return endLecture(withStudent, action.at)
        return beginStep({ ...withStudent, stepIndex: nextIndex }, action.at)
      }
      const armed = state.recording ? state : { ...state, recording: true, replayBoard: state.reveals }
      const withStudent: State = {
        ...armed,
        transcript: appendLine(armed.transcript, 'student', text),
        events: record(armed, { t: action.at, type: 'say', role: 'student', text }, action.at),
      }
      const result = interpret(text, withStudent)
      if (result === 'quiz') return startQuiz(withStudent, action.at)
      const say = action.say?.trim() || result.say
      const job = nextJob(withStudent, 'supplement', say, {
        note: result.note ?? undefined,
        laser: result.laser,
      })
      return withJob(withStudent, job, 'supplement', {
        caption: say,
        transcript: appendLine(withStudent.transcript, 'teacher', say),
        events: record(withStudent, { t: action.at, type: 'say', role: 'teacher', text: say }, action.at),
        laser: result.laser,
      })
    }
    case 'quiz':
      if (state.phase === 'replay' || state.phase === 'quiz-ask' || state.phase === 'quiz-review') return state
      return startQuiz({ ...state, job: null }, action.at)
    case 'answer': {
      if (state.phase !== 'quiz-ask') return state
      const q = state.quizQueue[state.quizIndex]
      if (!q) return state
      const text = action.text.trim()
      if (!text) return state
      const correct = grade(q, text)
      const note: Reveal = {
        type: 'note',
        id: `quiz-${q.id}`,
        page: q.page,
        anchor: q.anchor,
        text: q.note,
      }
      const examWrong =
        !correct && state.course?.intent === 'exam' && q.anchor
          ? `這題容易踩到剛才的易錯點。請看白板上「${q.anchor}」那一帶。`
          : '這題我們改一下。'
      const explain = `${correct ? '這題答對了。' : examWrong}${q.explain}`
      const item: QuizItem = { id: q.id, prompt: q.prompt, answer: text, correct, explain: q.explain }
      const reviewExtra: Partial<Job> = { note, laser: q.laser }
      if (!correct && (state.course?.intent === 'exam' || state.course?.intent === 'topic') && q.anchor) {
        reviewExtra.reviewHighlight = { page: q.page, anchor: q.anchor, color: 'pink' }
      }
      const job = nextJob(state, 'review', explain, reviewExtra)
      return withJob(
        {
          ...state,
          quizAnswers: [...state.quizAnswers, item],
          transcript: appendLine(appendLine(state.transcript, 'student', text), 'teacher', explain),
          events: record(
            {
              ...state,
              events: record(state, { t: action.at, type: 'say', role: 'student', text }, action.at),
            },
            { t: action.at, type: 'say', role: 'teacher', text: explain },
            action.at,
          ),
        },
        job,
        'quiz-review',
        { caption: explain, laser: q.laser },
      )
    }
    case 'retell': {
      const text = action.text.trim()
      if (!text) return state
      const transcript = state.transcript.map((line, index, all) =>
        index === all.length - 1 && line.role === 'teacher' ? { ...line, text } : line,
      )
      const events = state.events.map((event, index, all) =>
        index === all.length - 1 && event.type === 'say' && event.role === 'teacher' ? { ...event, text } : event,
      )
      return { ...state, caption: text, transcript, events }
    }
    case 'toggle-record':
      return { ...state, recording: !state.recording }
    case 'reset':
      return { ...freshState(), quizLog: state.quizLog, recording: state.recording, course: state.course }
    case 'load-course':
      return beginStep(
        {
          ...freshState(),
          course: action.course,
          quizLog: state.quizLog,
          recording: true,
          replayBoard: [],
          events: [],
          homeworkUnlocked: false,
        },
        action.at,
      )
    case 'restore-lesson': {
      const snap = action.persist
      if (!snap.course) return state
      return {
        ...freshState(),
        ...snap,
        phase: snap.finished ? 'done' : 'ready',
        job: null,
        caption: snap.finished ? '這一堂已講完。' : snap.reveals.length ? '已載入板書，按繼續上課。' : '已載入課程。',
        recording: true,
        replaySnap: null,
      }
    }
    case 'quiz-load': {
      if (!action.questions.length) return state
      const first = action.questions[0]
      const say = '測驗開始。請聽題並回答。'
      const job = nextJob(state, 'bridge', say)
      return withJob(
        { ...state, quizQueue: action.questions, quizIndex: 0, quizAnswers: [] },
        job,
        'quiz-ask',
        { caption: first.prompt, laser: first.laser },
      )
    }
    case 'replay-start': {
      if (state.events.length === 0 || state.phase === 'replay') return state
      return {
        ...state,
        phase: 'replay',
        job: null,
        replaySnap: snapshot(state),
        reveals: state.replayBoard,
        laser: null,
        caption: '從你發問的地方回放',
      }
    }
    case 'replay-event': {
      if (state.phase !== 'replay') return state
      const event = action.event
      if (event.type === 'reveal') {
        if (hasId(state.reveals, event.reveal.id)) return state
        return { ...state, reveals: [...state.reveals, event.reveal] }
      }
      if (event.type === 'laser') return { ...state, laser: event.id }
      if (event.type === 'say' && event.role === 'teacher') return { ...state, caption: event.text }
      if (event.type === 'say' && event.role === 'student') return { ...state, caption: `你：${event.text}` }
      return state
    }
    case 'replay-end': {
      if (!state.replaySnap) return { ...state, phase: 'ready' }
      const snap = state.replaySnap
      return {
        ...state,
        ...snap,
        phase: snap.finished ? 'done' : 'ready',
        job: null,
        replaySnap: null,
        caption: snap.finished ? '回放結束。' : '回放結束，板書回到剛才的進度。',
      }
    }
    default:
      return state
  }
}

export function clockNow(origin: number) {
  return Math.max(0, Math.round(performance.now() - origin))
}
