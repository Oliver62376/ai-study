import { useEffect, useRef, useState, type ComponentProps, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import 'katex/dist/katex.min.css'
import { Laser, Sheet, laserFor, markerColors, type Glow, type Mark } from './board'
import { ChatView } from './chat-view'
import { deleteLesson, lessonById, loadLessons, syncLessonToNative, upsertLesson } from './lessons'
import { NotebookLibrary } from './notebook-hub'
import { NotebookScreen } from './notebook-ui'
import type { VisionPage } from './ocr'
import { loadState, reduce, saveState, snapshot, type Course, type Persist, type State } from './model'
import { boardPdf, captureSheet, sharePdf } from './pdf'
import {
  anchorsOf,
  bindQuizAnchors,
  boardToolPrompt,
  EXAM_MATERIAL_LABELS,
  examQuizPrompt,
  topicQuizPrompt,
  parseCourse,
  parseQuiz,
  parseTeacherTurn,
  planPrompt,
  type TeacherTurn,
} from './prompt'
import {
  rememberLesson,
  rememberStudentQuestion,
  rememberTeachingIntent,
} from './memory-bank'
import { QuizScreen } from './quiz'
import { askProvider, isConnected, loadSettings } from './settings'
import { gradeLabel } from './profile'
import {
  IconBtn,
  IconChevronLeft,
  IconChevronRight,
  IconEraser,
  IconExpand,
  IconHighlighter,
  IconHome,
  IconMic,
  IconPause,
  IconPdf,
  IconPlay,
  IconQuiz,
  IconReplay,
  IconSend,
  IconSettings,
  IconTrash,
} from './icons'
import { HomeScreen, SettingsScreen } from './shell'
import { flushSpeakQueue, listen, speak, speakWhenDone } from './speech'
import { consumeNativeClassBoot } from './native-bridge'
import { loadPreferences, savePreferences, type AppPreferences, type LessonIntent } from './preferences'

const fast = new URLSearchParams(window.location.search).has('fast')

function HudTool({
  label,
  children,
  ...props
}: { label: string; children: ReactNode } & ComponentProps<typeof IconBtn>) {
  return (
    <div className="hud-tool">
      <IconBtn {...props} label={label}>
        {children}
      </IconBtn>
      <span className="hud-tool-label">{label}</span>
    </div>
  )
}

export default function App() {
  const [state, setState] = useState<State>(() => loadState())
  const stateRef = useRef(state)
  stateRef.current = state
  const clock = useRef<{ origin: number; base: number } | null>(null)
  if (clock.current == null) {
    const last = state.events.reduce((max, event) => Math.max(max, event.t), 0)
    clock.current = { origin: performance.now(), base: last }
  }
  const at = () => clock.current!.base + Math.round(performance.now() - clock.current!.origin)
  const dispatch = (action: Parameters<typeof reduce>[1]) => {
    setState((current) => reduce(current, action))
  }

  const pagesRef = useRef<HTMLDivElement>(null)
  const replayTimers = useRef<number[]>([])
  const replayRunId = useRef(0)
  const listenStop = useRef<null | (() => void) | (() => Promise<void>)>(null)
  const [draft, setDraft] = useState('')
  const [hint, setHint] = useState('')
  const [listening, setListening] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [screen, setScreen] = useState<'home' | 'class' | 'settings' | 'quiz' | 'chat' | 'notebook' | 'notebook-library'>(
    'home',
  )
  const [lessons, setLessons] = useState(() => loadLessons())
  const [activeLessonId, setActiveLessonId] = useState('')
  const pendingLessonIdRef = useRef('')
  const lessonMemorizedRef = useRef('')
  const [chatSeed, setChatSeed] = useState('')
  const [chatContext, setChatContext] = useState('')
  const [chatVision, setChatVision] = useState<VisionPage[]>([])
  const [chatSessionKey, setChatSessionKey] = useState('default')
  const [notebookBookId, setNotebookBookId] = useState<string | undefined>()
  const visionRef = useRef<VisionPage[]>([])
  const [materialWidth, setMaterialWidth] = useState(300)
  const [fullscreen, setFullscreen] = useState(false)
  const [viewPage, setViewPage] = useState(0)
  const [tool, setTool] = useState<'off' | 'pen' | 'erase'>('off')
  const [marker, setMarker] = useState<(typeof markerColors)[number]>(markerColors[0])
  const [marks, setMarks] = useState<Mark[]>([])
  const [glows, setGlows] = useState<Glow[]>([])
  const [planning, setPlanning] = useState(false)
  const [planError, setPlanError] = useState('')
  const [hudMore, setHudMore] = useState(false)
  const planIntentRef = useRef<LessonIntent>('topic')
  const wrapQuizFetchedRef = useRef('')
  const autoMicHintRef = useRef('')
  const autoMicAwaitRef = useRef('')

  function boardPromptExtras(course: Course) {
    return {
      homeworkUnlocked: stateRef.current.homeworkUnlocked,
      lessonPlan: course.lessonPlan,
    }
  }
  const [classPrefs, setClassPrefs] = useState<AppPreferences>(() => loadPreferences())
  const quizBack = useRef<'home' | 'class'>('home')
  const followedPage = useRef(0)

  function lessonIdForSave() {
    return activeLessonId || pendingLessonIdRef.current || ''
  }

  function ensureLessonId() {
    const existing = lessonIdForSave()
    if (existing) return existing
    const id = `L${Date.now()}`
    pendingLessonIdRef.current = id
    setActiveLessonId(id)
    return id
  }

  function applyTeacherTurn(turn: TeacherTurn, courseTitle: string, studentQuestion?: string) {
    if (turn.highlights.length) setGlows((current) => [...current, ...turn.highlights])
    for (const reveal of turn.draws) {
      dispatch({ type: 'reveal', reveal, laser: laserFor(reveal), at: at() })
      if ((reveal.type === 'svg' || reveal.type === 'plot' || reveal.type === 'forces') && 'intent' in reveal && reveal.intent) {
        rememberTeachingIntent(reveal.intent, courseTitle)
      }
    }
    if (turn.intent) rememberTeachingIntent(turn.intent, courseTitle)
    if (studentQuestion && turn.say.trim()) rememberStudentQuestion(studentQuestion, turn.say, courseTitle)
  }

  useEffect(() => {
    const course = state.course
    if (!course || lessonMemorizedRef.current === course.title) return
    lessonMemorizedRef.current = course.title
    rememberLesson(course.title, course.audience, course.sections.map((section) => section.title))
  }, [state.course])

  useEffect(() => {
    saveState(state)
    if (!state.course) return
    const id = ensureLessonId()
    const snap = snapshot(state)
    upsertLesson(snap, id)
    syncLessonToNative(id, snap)
    setLessons(loadLessons())
  }, [state])

  useEffect(() => {
    const job = state.job
    if (!job) return
    const timers: number[] = []
    let cancelSpeak = () => {}
    let closed = false
    const pageTurnDelayMs = () => {
      if (job.kind !== 'step') return 0
      const course = stateRef.current.course
      if (!course) return 0
      const nextStep = course.steps[stateRef.current.stepIndex + 1]
      if (!nextStep?.reveals.length) return 0
      const currentMax = stateRef.current.reveals.reduce((max, item) => Math.max(max, item.page), 0)
      const nextPage = nextStep.reveals.reduce((max, item) => Math.max(max, item.page), 0)
      if (nextPage > currentMax) return loadPreferences().pauseOnPageTurnMs ?? 2000
      return 0
    }

    const finish = () => {
      if (closed) return
      closed = true
      const wait = pageTurnDelayMs()
      window.setTimeout(() => dispatch({ type: 'spoken', at: at() }), wait)
    }

    const writeStep = (text: string, onWritten: () => void) => {
      if (job.kind !== 'step') {
        onWritten()
        return
      }
      const items = stateRef.current.course?.steps[stateRef.current.stepIndex]?.reveals ?? []
      if (items.length === 0) {
        onWritten()
        return
      }
      const pace = fast ? 40 : Math.max(1200, Math.min(2400, Math.round((text.length * 160) / items.length)))
      let left = items.length
      items.forEach((reveal, index) => {
        timers.push(
          window.setTimeout(() => {
            if (closed) return
            dispatch({ type: 'reveal', reveal, laser: laserFor(reveal), at: at() })
            left -= 1
            if (left === 0) onWritten()
          }, 360 + index * pace),
        )
      })
    }

    if (job.reviewHighlight) {
      setGlows((current) => [...current, job.reviewHighlight!])
    }
    if ((job.kind === 'review' || job.kind === 'supplement') && job.note) {
      const note = job.note
      timers.push(
        window.setTimeout(() => {
          const laser = job.laser ?? (note.type === 'note' ? note.anchor : null)
          dispatch({ type: 'reveal', reveal: note, laser, at: at() })
        }, fast ? 30 : 280),
      )
    } else if (job.kind === 'supplement' && job.laser) {
      dispatch({ type: 'laser', id: job.laser, at: at() })
    }

    const arm = (text: string) => {
      let said = false
      let wrote = job.kind !== 'step'
      const settle = () => {
        if (closed || !said || !wrote) return
        finish()
      }
      writeStep(text, () => {
        wrote = true
        settle()
      })
      cancelSpeak = speak(text, () => {
        said = true
        settle()
      }, fast)
    }

    const settings = loadSettings()
    const connected = isConnected(settings)
    const courseNow = stateRef.current.course
    if (job.kind === 'supplement' && job.supplementLocal) {
      arm(job.text)
    } else if (!fast && job.kind === 'supplement' && courseNow && connected) {
      const studentSaid = job.text
      const anchors = anchorsOf(stateRef.current.reveals)
      const awaiting = job.advanceStep ? '學生正在回答你剛才的提問。先回饋對錯或思路，再自然接到下一段。' : '學生剛打斷你。'
      void askProvider(
        settings,
        `${awaiting}只依這份課與白板內容回答；需要時在 draws 補圖或 highlights 標位置，最後一句說會繼續上課。\n學生說：${studentSaid}`,
        [
          ...courseNow.sections.map((section) => `${section.title}\n${section.body}`),
          `目前字幕：${stateRef.current.caption}`,
        ].join('\n\n'),
        boardToolPrompt(
          courseNow.title,
          anchors,
          courseNow.audience || gradeLabel(),
          courseNow.intent ?? 'topic',
          boardPromptExtras(courseNow),
        ),
      )
        .then((spoken) => {
          if (closed || !spoken) return
          const turn = parseTeacherTurn(spoken, '我先回你剛才那句。')
          applyTeacherTurn(turn, courseNow.title, studentSaid)
          dispatch({ type: 'retell', text: turn.say })
          arm(turn.say)
        })
        .catch(() => {
          if (closed) return
          setHint('模型沒有回應。檢查網路或設定後再問一次。')
          arm('我這邊暫時連不上模型。你可以先把想法記在底下，或再試一次。')
        })
    } else if (job.kind === 'supplement' && !connected) {
      arm('還沒接上模型。請到設定頁完成連線，我才能針對你的問題思考回答。')
    } else {
      arm(job.text)
    }
    return () => {
      closed = true
      timers.forEach((timer) => window.clearTimeout(timer))
      cancelSpeak()
    }
  }, [state.job?.id])

  useEffect(() => {
    if (screen !== 'class' || !state.course) return
    if (!loadPreferences().autoMicInClass) return
    const lessonKey = activeLessonId || state.course.title
    const opening = state.phase === 'speaking' && state.job?.kind === 'step' && state.stepIndex === 0
    if (opening && autoMicHintRef.current !== lessonKey) {
      autoMicHintRef.current = lessonKey
      setHint('上課開始。先聽家教講課；輪到你回答時麥克風會自動開啟，也可隨時點麥克風。')
    }
    if (state.phase !== 'awaiting_student' || listening) return
    const awaitKey = `${lessonKey}-s${state.stepIndex}`
    if (autoMicAwaitRef.current === awaitKey) return
    autoMicAwaitRef.current = awaitKey
    setHint('輪到你了：麥克風已開，說完會自動送出，家教會連模型回你。')
    void onListen(true, false)
  }, [screen, state.course?.title, state.phase, state.job?.id, state.job?.kind, state.stepIndex, listening, activeLessonId])

  useEffect(() => {
    autoMicHintRef.current = ''
    autoMicAwaitRef.current = ''
  }, [state.course?.title, activeLessonId])

  useEffect(() => {
    const course = state.course
    const intent = course?.intent
    if (!course || (intent !== 'exam' && intent !== 'topic')) return
    if (!state.finished || state.phase !== 'done') return
    if (state.quizQueue.length > 0) return
    if (course.quizQuestions?.length) return
    const key = `${intent}-${course.title}-${state.stepIndex}-${state.reveals.length}`
    if (wrapQuizFetchedRef.current === key) return
    wrapQuizFetchedRef.current = key
    const settings = loadSettings()
    if (!isConnected(settings)) {
      setHint(intent === 'exam' ? '備考講完了。接上模型後說「出題」。' : '講完了。接上模型後說「出題」。')
      return
    }
    const material = course.sections.map((section) => `${section.title}\n${section.body}`).join('\n\n')
    const anchors = anchorsOf(state.reveals)
    const prompt =
      intent === 'exam'
        ? examQuizPrompt(course.audience || gradeLabel(), anchors, material, 4)
        : topicQuizPrompt(course.audience || gradeLabel(), anchors, material, 3)
    setHint(intent === 'exam' ? '正在出備考小測…' : '正在出主題小測…')
    void askProvider(settings, prompt, material, '只出題，不要講課。')
      .then((raw) => {
        const qs = bindQuizAnchors(raw ? parseQuiz(raw) : [], anchors).slice(0, intent === 'exam' ? 5 : 4)
        if (!qs.length) {
          setHint('小測這次沒出成。可手動點工具列測驗。')
          return
        }
        dispatch({ type: 'quiz-load', questions: qs, at: at() })
        setHint('')
      })
      .catch(() => setHint('小測連線失敗。稍後再試或手動出題。'))
  }, [state.phase, state.finished, state.course, state.stepIndex, state.reveals.length, state.quizQueue.length])

  useEffect(() => () => {
    replayTimers.current.forEach((timer) => window.clearTimeout(timer))
  }, [])

  const writtenPage = state.reveals.reduce((max, item) => Math.max(max, item.page), 0)
  useEffect(() => {
    if (writtenPage === followedPage.current) return
    followedPage.current = writtenPage
    setViewPage(writtenPage)
  }, [writtenPage])

  const pageCount = state.reveals.length ? writtenPage + 1 : 1
  const shownPage = Math.min(viewPage, pageCount - 1)

  async function onListen(forceAutoSend = false, pauseLesson = true) {
    if (listening) {
      await listenStop.current?.()
      listenStop.current = null
      setListening(false)
      setHint('')
      if (draft.trim()) void onSend(draft.trim())
      return
    }
    if (
      pauseLesson &&
      (state.phase === 'speaking' || state.phase === 'supplement' || state.phase === 'quiz-review' || state.phase === 'bridge')
    ) {
      dispatch({ type: 'pause' })
    }
    try {
      listenStop.current = await listen(setDraft, {
        onFinal: (text) => {
          if (!forceAutoSend && !loadPreferences().voiceAutoSend) return
          setDraft(text)
          void onSend(text)
        },
      })
      setListening(true)
      setHint(
        loadPreferences().voiceAutoSend
          ? '正在聽。辨識完成會自動送出。'
          : '正在聽。只把內容轉成文字，不保存原聲。',
      )
    } catch {
      setHint('這台裝置現在不能用語音輸入，直接打字即可。')
    }
  }

  function openQuiz(from: 'home' | 'class') {
    quizBack.current = from
    if (speakingNow()) dispatch({ type: 'pause' })
    setScreen('quiz')
  }

  function speakingNow() {
    const phase = stateRef.current.phase
    return phase === 'speaking' || phase === 'supplement' || phase === 'quiz-review' || phase === 'bridge'
  }

  async function onSend(text = draft.trim()) {
    if (!text) return
    if (speakingNow() && stateRef.current.phase !== 'awaiting_student') dispatch({ type: 'pause' })
    if (/測驗|考考|出題|練習/.test(text.replace(/\s+/g, ''))) {
      openQuiz('class')
      setDraft('')
      return
    }
    if (state.phase === 'quiz-ask') {
      dispatch({ type: 'answer', text, at: at() })
    } else {
      const course = stateRef.current.course
      if (course?.intent === 'homework' && /直接|完整解法|給我答案|看解答/.test(text.replace(/\s+/g, ''))) {
        dispatch({ type: 'homework-unlock', at: at() })
      }
      dispatch({ type: 'ask', text, at: at() })
    }
    setDraft('')
    void listenStop.current?.()
    listenStop.current = null
    setListening(false)
  }

  function play() {
    if (state.phase === 'paused') dispatch({ type: 'resume', at: at() })
    else dispatch({ type: 'start', at: at() })
  }

  function startReplay() {
    replayTimers.current.forEach((timer) => window.clearTimeout(timer))
    replayTimers.current = []
    const runId = (replayRunId.current += 1)
    const events = state.events
    if (!events.length) return
    dispatch({ type: 'replay-start' })

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = window.setTimeout(resolve, ms)
        replayTimers.current.push(id)
      })

    void (async () => {
      await sleep(240)
      let prevT = events[0]?.t ?? 0
      for (let index = 0; index < events.length; index += 1) {
        if (runId !== replayRunId.current) return
        const event = events[index]!
        if (index > 0) {
          const delta = Math.min(fast ? 40 : 1000, Math.max(fast ? 20 : 240, event.t - prevT))
          await sleep(delta)
          prevT = event.t
        }
        if (runId !== replayRunId.current) return
        dispatch({ type: 'replay-event', event })
        if (!fast && event.type === 'say' && event.role === 'teacher' && event.text.trim()) {
          await speakWhenDone(event.text, false)
        }
      }
      if (runId !== replayRunId.current) return
      dispatch({ type: 'replay-end' })
    })()
  }

  function stopReplay() {
    replayRunId.current += 1
    replayTimers.current.forEach((timer) => window.clearTimeout(timer))
    replayTimers.current = []
    flushSpeakQueue()
    dispatch({ type: 'replay-end' })
  }

  async function onExport() {
    const back = shownPage
    setExporting(true)
    setHint('等白板畫完，再照現在這一面截圖。')
    const images: string[] = []
    try {
      for (let page = 0; page < pageCount; page += 1) {
        flushSync(() => setViewPage(page))
        await new Promise((resolve) => window.setTimeout(resolve, 80))
        const sheet = pagesRef.current?.querySelector('.sheet')
        if (sheet instanceof HTMLElement) images.push(await captureSheet(sheet))
      }
      if (!images.length) throw new Error('empty')
      const filename = `${(stateRef.current.course?.title || '白板').replace(/[\\/:*?"<>|]/g, '')}.pdf`
      await sharePdf(await boardPdf(images), filename)
      setHint('白板 PDF 已照畫面上的白板截下來。雷射筆和字幕沒有放進去。')
    } catch {
      setHint('這次沒能匯出 PDF。')
    } finally {
      flushSync(() => setViewPage(back))
      setExporting(false)
    }
  }

  const speaking =
    state.phase === 'speaking' ||
    state.phase === 'supplement' ||
    state.phase === 'quiz-review' ||
    state.phase === 'bridge'
  const waitingStudent = state.phase === 'awaiting_student'
  const stepTotal = state.course?.steps.length ?? 0
  const examMaterial = state.course?.intent === 'exam' ? state.course.steps[state.stepIndex]?.material : ''
  const examLabel = examMaterial && EXAM_MATERIAL_LABELS[examMaterial] ? `·${EXAM_MATERIAL_LABELS[examMaterial]}` : ''
  const progress =
    !stepTotal
      ? '尚未備課'
      : state.phase === 'quiz-ask' || state.phase === 'quiz-review'
        ? state.course?.intent === 'exam'
          ? `備考小測 ${state.quizIndex + 1} / ${state.quizQueue.length || '?'}`
          : `小測 ${state.quizIndex + 1} / ${state.quizQueue.length || '?'}`
        : state.finished && (state.course?.intent === 'exam' || state.course?.intent === 'topic') && !state.quizQueue.length
          ? state.course?.intent === 'exam'
            ? '備考·收尾'
            : '主題·收尾'
          : state.finished
            ? '講完'
            : state.course?.intent === 'exam'
              ? `備考${examLabel} ${Math.min(state.stepIndex + 1, stepTotal)} / ${stepTotal}`
              : state.course?.intent === 'topic'
                ? `主題 ${Math.min(state.stepIndex + 1, stepTotal)} / ${stepTotal}`
                : `第 ${Math.min(state.stepIndex + 1, stepTotal)} / ${stepTotal} 段`

  function buildPlanSource(topic: string, fileText: string) {
    const t = topic.trim()
    const f = fileText.trim()
    if (f && t) return `學生想學：${t}\n\n教材：\n${f}`
    if (f) return f
    return t
  }

  async function onPlan(topic: string, fileText: string, vision: VisionPage[] = visionRef.current, intent: LessonIntent = planIntentRef.current) {
    planIntentRef.current = intent
    const source = buildPlanSource(topic, fileText)
    if (!source) {
      setPlanError('先輸入主題，或上傳檔案。')
      return
    }
    const audience = gradeLabel()
    const settings = loadSettings()
    if (!isConnected(settings)) {
      setPlanError('先到模型接上 API。')
      setScreen('settings')
      return
    }
    setPlanning(true)
    setPlanError('')
    setScreen('class')
    try {
      const raw = await askProvider(
        settings,
        planPrompt(source, audience, intent),
        source,
        '你只負責備課，只回 JSON，不要講課。科目由來源決定。',
        vision,
      )
      const course = raw ? parseCourse(raw, source, audience) : null
      if (!course) throw new Error('empty')
      dispatch({ type: 'load-course', course: { ...course, intent }, at: at() })
      if (pendingLessonIdRef.current) setActiveLessonId(pendingLessonIdRef.current)
    } catch {
      setPlanError('備課沒有成功。確認 API 有回應，或把教材縮短再試。')
      setScreen('home')
    } finally {
      setPlanning(false)
    }
  }

  function onStartChat(topic: string, fileText: string, vision: VisionPage[]) {
    const source = buildPlanSource(topic, fileText)
    if (!source) {
      setPlanError('先輸入主題或上傳檔案。')
      return
    }
    setChatSeed(topic.trim() || source.slice(0, 200))
    setChatContext(source)
    setChatVision(vision)
    setChatSessionKey(`chat-${Date.now()}`)
    setScreen('chat')
  }

  function enterClass() {
    if (!state.course) return
    setScreen('class')
    if (state.phase === 'paused') dispatch({ type: 'resume', at: at() })
    else if (state.phase === 'ready' && !state.finished) play()
  }

  function restoreLessonPersist(persist: Persist, id: string) {
    upsertLesson(persist, id)
    dispatch({ type: 'restore-lesson', persist, at: at() })
    setActiveLessonId(id)
    pendingLessonIdRef.current = id
    setPlanning(false)
    setPlanError('')
    setLessons(loadLessons())
  }

  useEffect(() => {
    const boot = consumeNativeClassBoot()
    if (!boot) return
    visionRef.current = boot.vision ?? []
    setScreen('class')

    const tryId = boot.lessonId?.trim() ?? ''
    if (tryId) pendingLessonIdRef.current = tryId

    if (boot.snapshot?.course) {
      restoreLessonPersist(boot.snapshot, tryId || `L${Date.now()}`)
      return
    }

    if (tryId) {
      const saved = lessonById(tryId)
      if (saved?.snapshot?.course) {
        restoreLessonPersist(saved.snapshot, tryId)
        return
      }
    }

    setPlanning(true)
    void onPlan(boot.topic, boot.fileText, visionRef.current)
  }, [])

  function patchClassPrefs(patch: Partial<AppPreferences>) {
    const next = { ...loadPreferences(), ...patch }
    savePreferences(next)
    setClassPrefs(next)
  }

  function beginResize(event: ReactPointerEvent<HTMLDivElement>) {
    const startX = event.clientX
    const startWidth = materialWidth
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    const move = (ev: PointerEvent) => {
      setMaterialWidth(Math.min(520, Math.max(220, startWidth + startX - ev.clientX)))
    }
    const stop = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', stop)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', stop)
  }

  if (screen === 'home') {
    return (
      <HomeScreen
        lessons={lessons}
        activeLessonId={activeLessonId}
        connected={isConnected(loadSettings())}
        planning={planning}
        planError={planError}
        onEnterLesson={enterClass}
        onOpenLesson={(id) => {
          const lesson = lessonById(id)
          if (!lesson) return
          dispatch({ type: 'restore-lesson', persist: lesson.snapshot, at: at() })
          setActiveLessonId(id)
          setScreen('class')
        }}
        onDeleteLesson={(id) => {
          deleteLesson(id)
          setLessons(loadLessons())
          if (id === activeLessonId) setActiveLessonId('')
        }}
        onStartBoard={(topic, fileText, vision, intent) => {
          visionRef.current = vision
          const id = `L${Date.now()}`
          pendingLessonIdRef.current = id
          setActiveLessonId(id)
          void onPlan(topic, fileText, vision, intent)
        }}
        onStartChat={onStartChat}
        onSettings={() => setScreen('settings')}
        onNotebook={() => setScreen('notebook-library')}
        onOpenNotebook={(id) => {
          setNotebookBookId(id)
          setScreen('notebook')
        }}
        onManageNotebooks={() => setScreen('notebook-library')}
      />
    )
  }

  if (screen === 'settings') {
    return <SettingsScreen onBack={() => setScreen('home')} />
  }

  if (screen === 'chat') {
    return (
      <div className="os-page os-page-glass chat-page">
        <div className="os-aurora" aria-hidden />
        <header className="os-topbar glass-bar">
          <IconBtn label="返回首頁" onClick={() => setScreen('home')}>
            <IconHome />
          </IconBtn>
          <span className="os-topbar-title">Chat</span>
          <IconBtn label="設定" onClick={() => setScreen('settings')}>
            <IconSettings />
          </IconBtn>
        </header>
        <ChatView
          sessionKey={chatSessionKey}
          seed={chatSeed}
          context={chatContext}
          vision={chatVision.length ? chatVision : visionRef.current}
          onSettings={() => setScreen('settings')}
        />
      </div>
    )
  }

  if (screen === 'notebook-library') {
    return (
      <NotebookLibrary
        onBack={() => setScreen('home')}
        onOpen={(id) => {
          setNotebookBookId(id)
          setScreen('notebook')
        }}
      />
    )
  }

  if (screen === 'notebook') {
    return (
      <NotebookScreen
        initialBookId={notebookBookId}
        onBack={() => setScreen('notebook-library')}
        onSettings={() => setScreen('settings')}
        onAttach={(text, image) => {
          setChatContext(text)
          setChatVision(image ? [{ name: '筆記', dataUrl: image }] : [])
          setChatSeed('請根據筆記內容說明重點')
          setChatSessionKey(`chat-${Date.now()}`)
          setScreen('chat')
        }}
      />
    )
  }

  if (screen === 'quiz') {
    return (
      <QuizScreen
        materialText={state.course?.sections.map((section) => `${section.title}\n${section.body}`).join('\n\n') ?? ''}
        audience={state.course?.audience ?? gradeLabel()}
        onClose={() => setScreen(quizBack.current)}
        onSettings={() => setScreen('settings')}
      />
    )
  }

  const sheetProps = {
    reveals: state.reveals,
    marks,
    glows,
    tool,
    marker,
    onMark: (mark: Mark) => setMarks((current) => [...current, mark]),
    onEraseMark: (mark: Mark) => setMarks((current) => current.filter((item) => item !== mark)),
    onEraseGlow: (glow: Glow) => setGlows((current) => current.filter((item) => item !== glow)),
  }

  return (
    <div className={fullscreen ? 'classroom fullscreen' : 'classroom'} style={{ ['--side' as string]: `${materialWidth}px` }}>
      {planning && (
        <div className="class-planning glass-panel" role="status">
          <span className="planning-spinner" aria-hidden />
          <p>AI 備課中…</p>
        </div>
      )}
      <section className="board-frame">
        <div className="board">
          <div className="hud-top hud-top-minimal">
              <HudTool label="離開" onClick={() => { if (speaking) dispatch({ type: 'pause' }); setScreen('home') }}>
                <IconHome />
              </HudTool>
              <span className="hud-progress">{progress}</span>
              {waitingStudent && <span className="hud-waiting">等你回答或試著畫…</span>}
              <HudTool
                label={hudMore ? '收起' : '工具'}
                aria-pressed={hudMore}
                className="hud-more-toggle"
                onClick={() => setHudMore((value) => !value)}
              >
                <span aria-hidden className="hud-more-glyph">
                  ···
                </span>
              </HudTool>
            </div>
            {hudMore && (
              <div className="hud-more-panel">
                <HudTool
                  label={fullscreen ? '教材' : '全螢幕'}
                  aria-pressed={fullscreen}
                  onClick={() => setFullscreen((value) => !value)}
                >
                  <IconExpand />
                </HudTool>
                <HudTool label="測驗" onClick={() => openQuiz('class')} disabled={state.phase === 'replay'}>
                  <IconQuiz />
                </HudTool>
                <HudTool label="PDF" onClick={() => void onExport()} disabled={exporting || state.reveals.length === 0}>
                  <IconPdf />
                </HudTool>
                <HudTool
                  label={state.phase === 'replay' ? '停回放' : '回放'}
                  onClick={state.phase === 'replay' ? stopReplay : startReplay}
                  disabled={state.phase !== 'replay' && state.events.length === 0}
                  title={state.events.length === 0 ? '開課後會開始錄製' : undefined}
                >
                  <IconReplay />
                </HudTool>
                <HudTool label="螢光筆" aria-pressed={tool === 'pen'} onClick={() => setTool((value) => (value === 'pen' ? 'off' : 'pen'))}>
                  <IconHighlighter />
                </HudTool>
                <HudTool label="橡皮擦" aria-pressed={tool === 'erase'} onClick={() => setTool((value) => (value === 'erase' ? 'off' : 'erase'))}>
                  <IconEraser />
                </HudTool>
                <HudTool
                  label="清本頁"
                  onClick={() => {
                    setMarks((current) => current.filter((item) => item.page !== shownPage))
                    setGlows((current) => current.filter((item) => item.page !== shownPage))
                  }}
                >
                  <IconTrash />
                </HudTool>
                {tool === 'pen' && markerColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="swatch"
                    aria-label="螢光筆顏色"
                    aria-pressed={marker === color}
                    style={{ background: color }}
                    onClick={() => setMarker(color)}
                  />
                ))}
                <label className="hud-inline" title="雷射筆">
                  <input
                    type="checkbox"
                    checked={classPrefs.laserEnabled}
                    onChange={(event) => patchClassPrefs({ laserEnabled: event.target.checked })}
                  />
                  雷射
                </label>
                <label className="hud-inline hud-laser-size" title="雷射大小">
                  {classPrefs.laserSizePx}px
                  <input
                    type="range"
                    min={10}
                    max={42}
                    value={classPrefs.laserSizePx}
                    disabled={!classPrefs.laserEnabled}
                    onChange={(event) => patchClassPrefs({ laserSizePx: Number(event.target.value) })}
                  />
                </label>
              </div>
            )}
            <div
              className="pages"
              ref={pagesRef}
              style={{ ['--laser-size' as string]: `${classPrefs.laserSizePx}px` }}
            >
              <Sheet
                {...sheetProps}
              page={shownPage}
              register={() => {}}
              />
              {state.reveals.length === 0 && (
                <p className="empty-hint">{planning ? 'AI 備課中…' : '按開始，板書會跟著講解寫上來。'}</p>
              )}
              <Laser target={classPrefs.laserEnabled ? state.laser : null} root={pagesRef} />
            </div>
            {(state.caption || hint || listening) && (
              <div className="hud-caption">
                {listening && <p className="mic-status">麥克風開啟 · 正在聽（不存原聲）</p>}
                {state.caption && <p className="yt-caption">{state.caption}</p>}
                {hint && !listening && <p className="hud-hint">{hint}</p>}
              </div>
            )}
            <div className="hud-bottom">
              {state.phase === 'replay' ? (
                <IconBtn label="結束回放" className="icon-btn" onClick={stopReplay}>
                  <IconPause />
                </IconBtn>
              ) : (
                <IconBtn
                  label={state.phase === 'paused' ? '繼續' : '開始'}
                  className="icon-btn"
                  onClick={play}
                  disabled={speaking || waitingStudent || (state.finished && state.phase !== 'paused')}
                >
                  <IconPlay />
                </IconBtn>
              )}
              <IconBtn label="暫停" className="icon-btn" onClick={() => dispatch({ type: 'pause' })} disabled={!speaking}>
                <IconPause />
              </IconBtn>
              <IconBtn
                label={listening ? '關閉麥克風' : '開啟麥克風'}
                className={`icon-btn${listening ? ' mic-live' : ''}`}
                aria-pressed={listening}
                onClick={() => void onListen()}
              >
                <IconMic />
              </IconBtn>
              <input
                className="ask"
                value={draft}
                placeholder={
                  state.phase === 'quiz-ask'
                    ? '輸入答案'
                    : waitingStudent
                      ? '試著回答或畫出下一步…'
                      : '打斷、發問'
                }
                onChange={(event) => setDraft(event.target.value)}
                onFocus={() => {
                  if (speaking) dispatch({ type: 'pause' })
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void onSend()
                }}
              />
              <IconBtn label="送出" className="icon-btn send" onClick={() => void onSend()}>
                <IconSend />
              </IconBtn>
              <div className="pager" aria-label="翻頁">
                <IconBtn label="上一頁" onClick={() => setViewPage((page) => Math.max(0, page - 1))} disabled={shownPage === 0}>
                  <IconChevronLeft />
                </IconBtn>
                <span>{shownPage + 1} / {pageCount}</span>
                <IconBtn label="下一頁" onClick={() => setViewPage((page) => Math.min(pageCount - 1, page + 1))} disabled={shownPage >= pageCount - 1}>
                  <IconChevronRight />
                </IconBtn>
              </div>
            </div>
        </div>
      </section>
      <div
        className="resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="調整教材寬度"
        onPointerDown={beginResize}
      />
      <aside className="material">
        <div className="material-head">
          <h2>側欄</h2>
          <select
            className="model-select material-mode"
            value={classPrefs.materialPanel}
            onChange={(event) => patchClassPrefs({ materialPanel: event.target.value as AppPreferences['materialPanel'] })}
            aria-label="右側功能"
          >
            <option value="material">教材</option>
            <option value="quiz">測驗</option>
            <option value="notebook">筆記</option>
          </select>
        </div>
        <div className="material-body">
          {classPrefs.materialPanel === 'material' &&
            (state.course?.sections ?? []).map((section) => (
              <article key={section.id} className={section.id === state.materialId ? 'section current' : 'section'}>
                <h3>{section.title}</h3>
                <p>{section.body}</p>
              </article>
            ))}
          {classPrefs.materialPanel === 'quiz' && (
            <div className="side-panel-card">
              <p className="os-muted">在此區塊快速開測驗，不需離開白板。</p>
              <button type="button" className="nb-plain-btn" onClick={() => openQuiz('class')}>
                開始測驗
              </button>
              <p className="os-muted">進度：{progress}</p>
            </div>
          )}
          {classPrefs.materialPanel === 'notebook' && (
            <div className="side-panel-card">
              <p className="os-muted">
                筆記請用 App 下方「筆記」分頁。上課時可先記重點，再回到白板繼續。
              </p>
              <button type="button" className="nb-plain-btn" onClick={() => setScreen('notebook-library')}>
                打開筆記庫
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
