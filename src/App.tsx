import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { flushSync } from 'react-dom'
import 'katex/dist/katex.min.css'
import { Laser, Sheet, laserFor, markerColors, type Glow, type Mark } from './board'
import { loadState, reduce, saveState, type State } from './model'
import { boardPdf, captureSheet, sharePdf } from './pdf'
import { anchorsOf, boardToolPrompt, parseCourse, parseTeacherTurn, planPrompt } from './prompt'
import { QuizScreen } from './quiz'
import { askProvider, isConnected, loadSettings, modelFor, optionFor } from './settings'
import { HomeScreen, SettingsScreen } from './shell'
import { listen, speak } from './speech'

const fast = new URLSearchParams(window.location.search).has('fast')

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
  const [screen, setScreen] = useState<'home' | 'class' | 'settings' | 'quiz'>('home')
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

  useEffect(() => saveState(state), [state])

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
        boardToolPrompt(courseNow.title, anchors),
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
    if (state.phase === 'quiz-ask') dispatch({ type: 'answer', text, at: at() })
    else {
      let say: string | undefined
      const settings = loadSettings()
      if (isConnected(settings) && state.course) {
        try {
          const context = [
            ...state.course.sections.map((section) => `${section.title}\n${section.body}`),
            state.caption,
          ].join('\n')
          const raw = await askProvider(settings, text, context, boardToolPrompt(state.course.title, anchorsOf(state.reveals)))
          if (raw) {
            const turn = parseTeacherTurn(raw, '')
            say = turn.say
            if (turn.highlights.length) setGlows((current) => [...current, ...turn.highlights])
          }
        } catch {
          setHint('這次沒連上模型。')
        }
      }
      dispatch({ type: 'ask', text, at: at(), say })
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

  async function onPlan(source: string, audience: string) {
    const settings = loadSettings()
    if (!isConnected(settings)) {
      setPlanError('先到模型接上 API。')
      setScreen('settings')
      return
    }
    setPlanning(true)
    setPlanError('')
    try {
      const raw = await askProvider(settings, planPrompt(source, audience), source, '你只負責備課，只回 JSON，不要講課。')
      const course = raw ? parseCourse(raw, source, audience) : null
      if (!course) throw new Error('empty')
      dispatch({ type: 'load-course', course, at: at() })
      setScreen('class')
    } catch {
      setPlanError('備課沒有成功。確認 API 有回應，或把教材縮短再試。')
    } finally {
      setPlanning(false)
    }
  }

  function enterClass() {
    if (!state.course) return
    setScreen('class')
    if (state.phase === 'paused') dispatch({ type: 'resume', at: at() })
    else if (state.phase === 'ready' && !state.finished) play()
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
        title={state.course?.title ?? ''}
        finished={state.finished}
        stepLabel={state.course ? (state.finished ? '這一堂已經講完' : state.reveals.length ? `寫到第 ${writtenPage + 1} 頁` : '備好了，還沒開始講') : '貼上教材或主題，由模型備課'}
        providerName={optionFor(loadSettings().provider).name}
        model={modelFor(loadSettings())}
        connected={isConnected(loadSettings())}
        sections={state.course?.sections ?? []}
        planning={planning}
        planError={planError}
        onEnter={enterClass}
        onPlan={(source, audience) => void onPlan(source, audience)}
        onQuiz={() => openQuiz('home')}
        onSettings={() => setScreen('settings')}
      />
    )
  }

  if (screen === 'settings') {
    return <SettingsScreen onBack={() => setScreen('home')} onQuiz={() => openQuiz('home')} />
  }

  if (screen === 'quiz') {
    return (
      <QuizScreen
        materialText={state.course?.sections.map((section) => `${section.title}\n${section.body}`).join('\n\n') ?? ''}
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
      <section className="board-frame">
        <div className="board">
          <div className="hud-top">
              <button type="button" onClick={() => { if (speaking) dispatch({ type: 'pause' }); setScreen('home') }}>離開</button>
              <button type="button" aria-pressed={fullscreen} onClick={() => setFullscreen((value) => !value)}>
                {fullscreen ? '顯示教材' : '全螢幕'}
              </button>
              <button type="button" onClick={() => openQuiz('class')} disabled={state.phase === 'replay'}>測驗</button>
              <button type="button" onClick={() => void onExport()} disabled={exporting || state.reveals.length === 0}>PDF</button>
              <button
                type="button"
                onClick={state.phase === 'replay' ? stopReplay : startReplay}
                disabled={state.phase !== 'replay' && state.events.length === 0}
                title={state.events.length === 0 ? '第一次發問之後才開始錄，避免把整堂課重送模型' : '回放發問之後的內容'}
              >
                {state.phase === 'replay' ? '結束回放' : '回放'}
              </button>
              <span className="hud-progress">{progress}</span>
              <button type="button" aria-pressed={tool === 'pen'} onClick={() => setTool((value) => (value === 'pen' ? 'off' : 'pen'))}>螢光筆</button>
              <button type="button" aria-pressed={tool === 'erase'} onClick={() => setTool((value) => (value === 'erase' ? 'off' : 'erase'))}>橡皮擦</button>
              <button
                type="button"
                onClick={() => {
                  setMarks((current) => current.filter((item) => item.page !== shownPage))
                  setGlows((current) => current.filter((item) => item.page !== shownPage))
                }}
              >
                清除本頁
              </button>
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
              {state.reveals.length === 0 && <p className="empty-hint">開始上課後，板書會跟著講解寫上來。</p>}
              <Laser target={state.laser} root={pagesRef} />
            </div>
            {(state.caption || hint) && (
              <div className="hud-caption">
                {state.caption && <p className="yt-caption">{state.caption}</p>}
                {hint && <p className="hud-hint">{hint}</p>}
              </div>
            )}
            <div className="hud-bottom">
              {state.phase === 'replay' ? (
                <button type="button" className="icon-btn" onClick={stopReplay} aria-label="結束回放">結束</button>
              ) : (
                <button type="button" className="icon-btn" onClick={play} disabled={speaking || (state.finished && state.phase !== 'paused')} aria-label={state.phase === 'paused' ? '繼續' : '開始'}>
                  {state.phase === 'paused' ? '繼續' : '開始'}
                </button>
              )}
              <button type="button" className="icon-btn" aria-label="暫停" onClick={() => dispatch({ type: 'pause' })} disabled={!speaking}>II</button>
              <button type="button" className="icon-btn" aria-pressed={listening} aria-label="麥克風" onClick={() => void onListen()}>
                {listening ? '停' : '麥'}
              </button>
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
              <button type="button" className="icon-btn" onClick={() => void onSend()}>送出</button>
              <div className="pager" aria-label="翻頁">
                <button type="button" onClick={() => setViewPage((page) => Math.max(0, page - 1))} disabled={shownPage === 0}>上一頁</button>
                <span>{shownPage + 1} / {pageCount}</span>
                <button type="button" onClick={() => setViewPage((page) => Math.min(pageCount - 1, page + 1))} disabled={shownPage >= pageCount - 1}>下一頁</button>
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
