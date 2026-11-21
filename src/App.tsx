import { useEffect, useRef, useState, type ComponentProps, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import 'katex/dist/katex.min.css'
import { Laser, Sheet, laserFor, markerColors, type Glow, type Mark } from './board'
import { ChatView } from './chat-view'
import { deleteLesson, lessonById, loadLessons, upsertLesson } from './lessons'
import { NotebookLibrary } from './notebook-hub'
import { NotebookScreen } from './notebook-ui'
import type { VisionPage } from './ocr'
import { loadState, reduce, saveState, snapshot, type State } from './model'
import { boardPdf, captureSheet, sharePdf } from './pdf'
import { anchorsOf, boardToolPrompt, parseCourse, parseTeacherTurn, planPrompt } from './prompt'
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
import { listen, speak } from './speech'
import { consumeNativeClassBoot } from './native-bridge'

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
  const quizBack = useRef<'home' | 'class'>('home')
  const followedPage = useRef(0)

  useEffect(() => {
    saveState(state)
    if (!state.course) return
    upsertLesson(snapshot(state))
    setLessons(loadLessons())
  }, [state])

  useEffect(() => {
    const job = state.job
    if (!job) return
    const timers: number[] = []
    let cancelSpeak = () => {}
    let closed = false
    const finish = () => {
      if (closed) return
      closed = true
      dispatch({ type: 'spoken', at: at() })
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
    if (!fast && connected && job.kind === 'supplement' && courseNow) {
      const outline = job.text
      const anchors = anchorsOf(stateRef.current.reveals)
      void askProvider(
        settings,
        `學生剛打斷你。只依這份教材回答，然後說要回到課程進度。需要時用螢光筆標出你指的位置。\n學生說：${outline}`,
        courseNow.sections.map((section) => `${section.title}\n${section.body}`).join('\n\n'),
        boardToolPrompt(courseNow.title, anchors, courseNow.audience || gradeLabel()),
      )
        .then((spoken) => {
          if (closed || !spoken) return
          const turn = parseTeacherTurn(spoken, outline)
          if (turn.highlights.length) setGlows((current) => [...current, ...turn.highlights])
          dispatch({ type: 'retell', text: turn.say })
          arm(turn.say)
        })
        .catch(() => {
          if (closed) return
          setHint('模型沒有回應，這句先用教材講稿。')
          arm(outline)
        })
    } else {
      arm(job.text)
    }
    return () => {
      closed = true
      timers.forEach((timer) => window.clearTimeout(timer))
      cancelSpeak()
    }
  }, [state.job?.id])

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

  async function onListen() {
    if (listening) {
      await listenStop.current?.()
      listenStop.current = null
      setListening(false)
      setHint('')
      if (draft.trim()) void onSend(draft.trim())
      return
    }
    if (state.phase === 'speaking' || state.phase === 'supplement' || state.phase === 'quiz-review' || state.phase === 'bridge') {
      dispatch({ type: 'pause' })
    }
    try {
      listenStop.current = await listen(setDraft)
      setListening(true)
      setHint('正在聽。只把內容轉成文字，不保存原聲。')
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
    if (/測驗|考考|出題|練習/.test(text.replace(/\s+/g, ''))) {
      openQuiz('class')
      setDraft('')
      return
    }
    if (state.phase === 'quiz-ask') {
      dispatch({ type: 'answer', text, at: at() })
    } else {
      dispatch({ type: 'ask', text, at: at() })
      const settings = loadSettings()
      const course = stateRef.current.course
      if (isConnected(settings) && course) {
        void (async () => {
          try {
            const context = [
              ...course.sections.map((section) => `${section.title}\n${section.body}`),
              stateRef.current.caption,
            ].join('\n')
            const raw = await askProvider(
              settings,
              text,
              context,
              boardToolPrompt(course.title, anchorsOf(stateRef.current.reveals), course.audience || gradeLabel()),
            )
            if (!raw) return
            const turn = parseTeacherTurn(raw, '')
            if (turn.highlights.length) setGlows((current) => [...current, ...turn.highlights])
            if (turn.say?.trim()) dispatch({ type: 'retell', text: turn.say.trim() })
          } catch {
            setHint('這次沒連上模型。')
          }
        })()
      }
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
    const events = state.events
    dispatch({ type: 'replay-start' })
    let acc = 240
    let prev = events[0]?.t ?? 0
    events.forEach((event, index) => {
      if (index > 0) acc += Math.min(fast ? 40 : 1000, Math.max(fast ? 20 : 240, event.t - prev))
      prev = event.t
      const wait = acc
      replayTimers.current.push(
        window.setTimeout(() => {
          dispatch({ type: 'replay-event', event })
          if (!fast && event.type === 'say' && event.role === 'teacher') speak(event.text, () => {}, false)
        }, wait),
      )
    })
    replayTimers.current.push(window.setTimeout(() => dispatch({ type: 'replay-end' }), acc + (fast ? 60 : 600)))
  }

  function stopReplay() {
    replayTimers.current.forEach((timer) => window.clearTimeout(timer))
    replayTimers.current = []
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

  const speaking = state.phase === 'speaking' || state.phase === 'supplement' || state.phase === 'quiz-review' || state.phase === 'bridge'
  const stepTotal = state.course?.steps.length ?? 0
  const progress = !stepTotal ? '尚未備課' : state.finished ? '講完' : `第 ${Math.min(state.stepIndex + 1, stepTotal)} / ${stepTotal} 段`

  function buildPlanSource(topic: string, fileText: string) {
    const t = topic.trim()
    const f = fileText.trim()
    if (f && t) return `學生想學：${t}\n\n教材：\n${f}`
    if (f) return f
    return t
  }

  async function onPlan(topic: string, fileText: string, vision: VisionPage[] = visionRef.current) {
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
        planPrompt(source, audience),
        source,
        '你只負責備課，只回 JSON，不要講課。科目由來源決定。',
        vision,
      )
      const course = raw ? parseCourse(raw, source, audience) : null
      if (!course) throw new Error('empty')
      dispatch({ type: 'load-course', course, at: at() })
      setActiveLessonId('')
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

  useEffect(() => {
    const boot = consumeNativeClassBoot()
    if (!boot) return
    visionRef.current = boot.vision ?? []
    void onPlan(boot.topic, boot.fileText, visionRef.current)
  }, [])

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
        onStartBoard={(topic, fileText, vision) => {
          visionRef.current = vision
          void onPlan(topic, fileText, vision)
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
          <div className="hud-top">
              <HudTool label="離開" onClick={() => { if (speaking) dispatch({ type: 'pause' }); setScreen('home') }}>
                <IconHome />
              </HudTool>
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
              <span className="hud-progress">{progress}</span>
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
            </div>
            <div className="pages" ref={pagesRef}>
              <Sheet
                {...sheetProps}
              page={shownPage}
              register={() => {}}
              />
              {state.reveals.length === 0 && (
                <p className="empty-hint">{planning ? 'AI 備課中…' : '按開始，板書會跟著講解寫上來。'}</p>
              )}
              <Laser target={state.laser} root={pagesRef} />
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
                  disabled={speaking || (state.finished && state.phase !== 'paused')}
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
                placeholder={state.phase === 'quiz-ask' ? '輸入答案' : '打斷、發問'}
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
        <h2>教材</h2>
        <div className="material-body">
          {(state.course?.sections ?? []).map((section) => (
            <article key={section.id} className={section.id === state.materialId ? 'section current' : 'section'}>
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </article>
          ))}
        </div>
      </aside>
    </div>
  )
}
