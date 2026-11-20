import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { formatAiPlainText, noMarkdownHint } from './ai-format'
import { appendExtra, loadCustomPrompts } from './custom-prompts'
import {
  clearNbAiThread,
  historyBlock,
  loadNbAiThread,
  saveNbAiThread,
  type NbAiLine,
} from './notebook-ai-thread'
import { gradeLabel } from './profile'
import { askProvider, isConnected, loadSettings } from './settings'
import type { VisionPage } from './ocr'
import type { NotebookAiMode } from './notebook-ai'

function IconCloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 8l8 8M16 8l-8 8" strokeLinecap="round" />
    </svg>
  )
}

const modePrompts: Record<NotebookAiMode, string> = {
  explain: '你是家教。看這頁筆記（含手寫），解釋重點與推論步驟。缺字處合理補齊但不要瞎編。',
  summarize: '整理這頁筆記成條列重點（5 點內），適合考前複習。',
  quiz: '依這頁筆記出 3 題小測驗（含答案與一句檢討）。',
  clean: '把筆記內容轉成乾淨的教科書式段落（保留公式與符號）。',
}

export function NotebookAiPanel({
  bookId,
  pageTitle,
  pageContext,
  pagePreview,
  onClose,
  onSettings,
}: {
  bookId: string
  pageTitle: string
  pageContext: string
  pagePreview: string | null
  onClose: () => void
  onSettings: () => void
}) {
  const [pos, setPos] = useState({ x: 48, y: 96 })
  const [mode, setMode] = useState<NotebookAiMode>('explain')
  const [lines, setLines] = useState<NbAiLine[]>(() => loadNbAiThread(bookId))
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [attachPageImage, setAttachPageImage] = useState(true)
  const logRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLines(loadNbAiThread(bookId))
  }, [bookId])

  useEffect(() => {
    const node = logRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [lines, busy])

  const persist = useCallback(
    (next: NbAiLine[]) => {
      setLines(next)
      saveNbAiThread(bookId, next)
    },
    [bookId],
  )

  async function send(preset?: string) {
    const message = (preset ?? draft).trim()
    if (!message || busy) return
    const settings = loadSettings()
    if (!isConnected(settings)) {
      onSettings()
      return
    }
    const user: NbAiLine = { id: `u-${Date.now()}`, role: 'user', text: message, at: Date.now() }
    const withUser = [...lines, user]
    persist(withUser)
    setDraft('')
    setBusy(true)
    try {
      const who = gradeLabel()
      const history = historyBlock(lines)
      const noteContext = [
        `筆記本頁：${pageTitle}`,
        pageContext.trim() ? `本頁文字：\n${pageContext.trim()}` : '',
        history ? `【先前對話】\n${history}` : '',
        `【學生程度】${who}`,
      ]
        .filter(Boolean)
        .join('\n\n')
      const system = appendExtra(`${modePrompts[mode]}\n${noMarkdownHint}`, loadCustomPrompts().notebook, '筆記 AI 風格補充')
      const vision: VisionPage[] =
        attachPageImage && pagePreview ? [{ name: pageTitle, dataUrl: pagePreview }] : []
      const raw = await askProvider(settings, message, noteContext, system, vision)
      const answer = formatAiPlainText(raw ?? '這次沒有收到回覆。')
      const assistant: NbAiLine = { id: `a-${Date.now()}`, role: 'assistant', text: answer, at: Date.now() }
      persist([...withUser, assistant])
    } catch (error) {
      const assistant: NbAiLine = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: error instanceof Error ? error.message : '連線失敗',
        at: Date.now(),
      }
      persist([...withUser, assistant])
    } finally {
      setBusy(false)
    }
  }

  const clampPos = useCallback((x: number, y: number) => {
    const pad = 8
    const top = 52
    const el = panelRef.current
    const w = el?.offsetWidth ?? 380
    const h = el?.offsetHeight ?? 420
    const maxX = Math.max(pad, window.innerWidth - w - pad)
    const maxY = Math.max(top, window.innerHeight - h - pad)
    return {
      x: Math.min(maxX, Math.max(pad, x)),
      y: Math.min(maxY, Math.max(top, y)),
    }
  }, [])

  function onHeaderPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest('button, a, input, label')) return
    event.preventDefault()
    const start = { ox: event.clientX, oy: event.clientY, px: pos.x, py: pos.y }
  const onMove = (ev: PointerEvent) => {
      const next = clampPos(start.px + ev.clientX - start.ox, start.py + ev.clientY - start.oy)
      setPos(next)
    }
    const end = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  const panel = (
    <div
      ref={panelRef}
      className="nb-ai-float glass-panel"
      style={{ left: pos.x, top: pos.y }}
      role="dialog"
      aria-label="筆記 AI"
    >
      <div className="nb-ai-float-head" onPointerDown={onHeaderPointerDown}>
        <span className="nb-ai-float-title">
          筆記 AI <span className="nb-ai-drag-hint">· 拖曳此列移動</span>
        </span>
        <button type="button" className="nb-ai-close" aria-label="關閉" onClick={onClose}>
          <IconCloseGlyph />
        </button>
      </div>
      <AiModeBar mode={mode} onMode={setMode} onQuick={(_label, text) => void send(text)} />
      <label className="checkbox-line nb-ai-check">
        <input type="checkbox" checked={attachPageImage} onChange={(event) => setAttachPageImage(event.target.checked)} />
        附本頁截圖（含手寫）
      </label>
      <div className="nb-ai-float-log" ref={logRef}>
        {lines.length === 0 && <p className="os-muted">輸入問題或點上方快捷，對話會自動保存。</p>}
        {lines.map((line) => (
          <div key={line.id} className={`nb-ai-line ${line.role}`}>
            {line.text}
          </div>
        ))}
        {busy && <p className="chat-thinking">處理中…</p>}
      </div>
      <form
        className="nb-ai-float-form"
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        <input
          className="selectable"
          value={draft}
          placeholder="繼續追問…"
          disabled={busy}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="os-primary" disabled={busy || !draft.trim()}>
          送出
        </button>
      </form>
      <div className="nb-ai-float-foot">
        <button
          type="button"
          className="nb-plain-btn"
          onClick={() => {
            if (!window.confirm('清除此筆記本的 AI 對話紀錄？')) return
            clearNbAiThread(bookId)
            setLines([])
          }}
        >
          清除對話
        </button>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return panel
  return createPortal(panel, document.body)
}

function AiModeBar({
  mode,
  onMode,
  onQuick,
}: {
  mode: NotebookAiMode
  onMode: (m: NotebookAiMode) => void
  onQuick: (label: string, text: string) => void
}) {
  const items: [NotebookAiMode, string, string][] = [
    ['explain', '解釋', '請解釋這頁筆記的重點與推論。'],
    ['summarize', '整理', '請整理成考前複習用的重點條列。'],
    ['quiz', '出題', '請依這頁出 3 題小測驗並附答案。'],
    ['clean', '清稿', '請把內容整理成乾淨的段落。'],
  ]
  return (
    <div className="nb-ai-modes">
      {items.map(([id, label, text]) => (
        <button
          key={id}
          type="button"
          className={mode === id ? 'on' : ''}
          onClick={() => {
            onMode(id)
            onQuick(label, text)
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}