import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { toPng } from 'html-to-image'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { pdfPageToJpeg } from './ocr'
import { boardPdf, sharePdf } from './pdf'

GlobalWorkerOptions.workerSrc = workerUrl
import { IconBack, IconBtn, IconSave } from './icons'
import { NotebookCanvas, templateLabel, type NbTool } from './notebook-canvas'
import { runNotebookAi, type NotebookAiMode } from './notebook-ai'
import {
  applySnapshot,
  deleteNotebook,
  emptyPage,
  loadNotebooks,
  newId,
  pageToTeachingBundle,
  snapshotPage,
  upsertNotebook,
  type NotePage,
  type Notebook,
} from './notebook'
import { loadStylusPreferences, runStylusAction, type StylusAction } from './stylus-prefs'
import type { PageTemplate } from './stylus-prefs'

const PALETTE = ['#1c1c1e', '#1b4fd8', '#c41e1e', '#17803d', '#6b3fa0', '#f4a100']

export function NotebookScreen({
  onBack,
  onAttach,
  onSettings,
}: {
  onBack: () => void
  onAttach: (text: string, imageDataUrl: string | null) => void
  onSettings: () => void
}) {
  const [books, setBooks] = useState(() => loadNotebooks())
  const [bookId, setBookId] = useState(() => books[0]?.id ?? '')
  const book = useMemo(() => books.find((item) => item.id === bookId) ?? books[0], [books, bookId])
  const [pageId, setPageId] = useState(() => book?.pages[0]?.id ?? '')
  const page = useMemo(() => book?.pages.find((item) => item.id === pageId) ?? book?.pages[0], [book, pageId])

  const [tool, setTool] = useState<NbTool>('pen')
  const [color, setColor] = useState(PALETTE[0])
  const [width, setWidth] = useState(3)
  const [lassoIds, setLassoIds] = useState<Set<string>>(() => new Set())
  const [undoStack, setUndoStack] = useState<ReturnType<typeof snapshotPage>[]>([])
  const [redoStack, setRedoStack] = useState<ReturnType<typeof snapshotPage>[]>([])
  const [aiOpen, setAiOpen] = useState(false)
  const [aiMode, setAiMode] = useState<NotebookAiMode>('explain')
  const [aiOut, setAiOut] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const lastTool = useRef<NbTool>('pen')
  const captureRef = useRef<HTMLDivElement>(null)

  const pushUndo = useCallback(() => {
    if (!page) return
    setUndoStack((stack) => [...stack.slice(-40), snapshotPage(page)])
    setRedoStack([])
  }, [page])

  const patchPage = useCallback(
    (patch: Partial<NotePage>) => {
      if (!book || !page) return
      pushUndo()
      const nextPage = { ...page, ...patch, updatedAt: Date.now() }
      const nextBook: Notebook = {
        ...book,
        pages: book.pages.map((item) => (item.id === page.id ? nextPage : item)),
        updatedAt: Date.now(),
      }
      upsertNotebook(nextBook)
      setBooks(loadNotebooks())
    },
    [book, page, pushUndo],
  )

  function undo() {
    if (!page || !undoStack.length) return
    const prev = undoStack[undoStack.length - 1]
    setUndoStack((stack) => stack.slice(0, -1))
    setRedoStack((stack) => [...stack, snapshotPage(page)])
    const restored = applySnapshot(page, prev)
    if (!book) return
    const nextBook = { ...book, pages: book.pages.map((p) => (p.id === page.id ? restored : p)) }
    upsertNotebook(nextBook)
    setBooks(loadNotebooks())
  }

  function redo() {
    if (!page || !redoStack.length) return
    const next = redoStack[redoStack.length - 1]
    setRedoStack((stack) => stack.slice(0, -1))
    setUndoStack((stack) => [...stack, snapshotPage(page)])
    const restored = applySnapshot(page, next)
    if (!book) return
    const nextBook = { ...book, pages: book.pages.map((p) => (p.id === page.id ? restored : p)) }
    upsertNotebook(nextBook)
    setBooks(loadNotebooks())
  }

  useEffect(() => {
    const prefs = loadStylusPreferences()
    const onStylus = (event: Event) => {
      const slot = (event as CustomEvent<{ slot: 'barrel1' | 'barrel2' | 'doubleTap' | 'eraser' }>).detail?.slot
      const action: StylusAction =
        slot === 'barrel1'
          ? prefs.barrelButton1
          : slot === 'barrel2'
            ? prefs.barrelButton2
            : slot === 'doubleTap'
              ? prefs.doubleTap
              : slot === 'eraser'
                ? prefs.eraserEnd
                : 'none'
      runStylusAction(action, {
        setTool: (t) => {
          lastTool.current = tool === 'pen' || tool === 'fountain' || tool === 'highlighter' ? tool : lastTool.current
          setTool(t)
        },
        undo,
        redo,
        openAi: () => setAiOpen(true),
        toggleTool: () => {
          const next = tool === 'pen' ? 'highlighter' : tool === 'highlighter' ? 'eraser' : 'pen'
          setTool(next)
        },
      })
    }
    window.addEventListener('notebook-stylus', onStylus)
    window.addEventListener('study-stylus', onStylus)
    return () => {
      window.removeEventListener('notebook-stylus', onStylus)
      window.removeEventListener('study-stylus', onStylus)
    }
  }, [tool])

  async function capturePreview() {
    const node = captureRef.current?.querySelector('.nb-sheet')
    if (!(node instanceof HTMLElement) || !page) return page.preview
    return toPng(node, { pixelRatio: 1.5, backgroundColor: '#fbfaf7' })
  }

  async function persistPage() {
    if (!book || !page) return
    const preview = await capturePreview()
    patchPage({ preview })
  }

  async function importPdf(file: File) {
    if (!book) return
    setImporting(true)
    try {
      const data = new Uint8Array(await file.arrayBuffer())
      const pdf = await getDocument({ data }).promise
      const added = []
      const max = Math.min(pdf.numPages, 32)
      for (let index = 1; index <= max; index += 1) {
        const jpeg = await pdfPageToJpeg(data, index, 1.5)
        added.push({
          ...emptyPage(file.name.replace(/\.pdf$/i, '') + ` 第 ${index} 頁`, 'blank'),
          background: jpeg,
        })
      }
      const next: Notebook = { ...book, pages: [...book.pages, ...added], updatedAt: Date.now() }
      upsertNotebook(next)
      setBooks(loadNotebooks())
      if (added[0]) setPageId(added[0].id)
    } finally {
      setImporting(false)
    }
  }

  async function exportPdfBook() {
    if (!book) return
    setExporting(true)
    const current = pageId
    try {
      const images: string[] = []
      for (const item of book.pages) {
        flushSync(() => setPageId(item.id))
        await new Promise((resolve) => window.setTimeout(resolve, 120))
        const shot = await capturePreview()
        if (shot) images.push(shot)
      }
      flushSync(() => setPageId(current))
      if (!images.length) throw new Error('沒有頁面可匯出')
      const blob = await boardPdf(images)
      await sharePdf(blob, `${book.title.replace(/[\\/:*?"<>|]/g, '') || '筆記'}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  function addPage(template: PageTemplate = 'ruled') {
    if (!book) return
    const created = emptyPage(`第 ${book.pages.length + 1} 頁`, template)
    const next = { ...book, pages: [...book.pages, created] }
    upsertNotebook(next)
    setBooks(loadNotebooks())
    setPageId(created.id)
  }

  function duplicatePage() {
    if (!book || !page) return
    const copy = { ...structuredClone(page), id: newId('P'), title: `${page.title} 副本`, updatedAt: Date.now() }
    const next = { ...book, pages: [...book.pages, copy] }
    upsertNotebook(next)
    setBooks(loadNotebooks())
    setPageId(copy.id)
  }

  function deletePage() {
    if (!book || !page || book.pages.length < 2) return
    const next = { ...book, pages: book.pages.filter((item) => item.id !== page.id) }
    upsertNotebook(next)
    setBooks(loadNotebooks())
    setPageId(next.pages[0]?.id ?? '')
  }

  async function runAi() {
    if (!page || !book) return
    setAiBusy(true)
    setAiOut('')
    try {
      const preview = (await capturePreview()) ?? page.preview ?? null
      const context = [page.caption, ...page.texts.map((t) => t.text)].filter(Boolean).join('\n')
      const answer = await runNotebookAi(aiMode, context, preview)
      setAiOut(answer)
    } catch (error) {
      setAiOut(error instanceof Error ? error.message : 'AI 失敗')
    } finally {
      setAiBusy(false)
    }
  }

  if (!book || !page) return null

  return (
    <div className="nb-app os-page">
      <header className="os-topbar glass-bar">
        <IconBtn label="返回" onClick={onBack}>
          <IconBack />
        </IconBtn>
        <input
          className="nb-book-title"
          value={book.title}
          aria-label="筆記本名稱"
          onChange={(event) => {
            const next = { ...book, title: event.target.value }
            upsertNotebook(next)
            setBooks(loadNotebooks())
          }}
        />
        <div className="os-topbar-end">
          <label className="nb-import-pdf">
            {importing ? '匯入中' : '匯入 PDF'}
            <input
              type="file"
              accept="application/pdf,.pdf"
              disabled={importing || exporting}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void importPdf(file)
              }}
            />
          </label>
          <button type="button" className="nb-plain-btn" disabled={exporting || importing} onClick={() => void exportPdfBook()}>
            {exporting ? '匯出中' : '匯出 PDF'}
          </button>
          <IconBtn label="設定（觸控筆）" onClick={onSettings}>
            <span className="nb-tool">設定</span>
          </IconBtn>
          <IconBtn label="儲存" onClick={() => void persistPage()}>
            <IconSave />
          </IconBtn>
        </div>
      </header>

      <div className="nb-body">
        <aside className="nb-sidebar glass-rail">
          <label className="nb-select">
            筆記本
            <select value={bookId} onChange={(event) => setBookId(event.target.value)}>
              {books.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="os-link-btn"
            onClick={() => {
              const nb = { id: newId('B'), title: '新筆記本', pages: [emptyPage('第 1 頁')], updatedAt: Date.now() }
              upsertNotebook(nb)
              setBooks(loadNotebooks())
              setBookId(nb.id)
              setPageId(nb.pages[0].id)
            }}
          >
            ＋ 新筆記本
          </button>
          {books.length > 1 && (
            <button type="button" className="os-link-btn danger" onClick={() => { deleteNotebook(bookId); setBooks(loadNotebooks()); setBookId(loadNotebooks()[0]?.id ?? '') }}>
              刪除此本
            </button>
          )}

          <p className="rail-title">頁面</p>
          <div className="nb-thumbs">
            {book.pages.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`nb-thumb${item.id === pageId ? ' on' : ''}`}
                onClick={() => setPageId(item.id)}
              >
                {item.preview ? <img src={item.preview} alt="" /> : <span>{item.title}</span>}
              </button>
            ))}
          </div>
          <div className="nb-page-actions">
            <button type="button" onClick={() => addPage(page.template)}>
              ＋頁
            </button>
            <button type="button" onClick={duplicatePage}>
              複製
            </button>
            <button type="button" onClick={deletePage}>
              刪頁
            </button>
          </div>

          <label className="nb-select">
            紙張
            <select
              value={page.template}
              onChange={(event) => patchPage({ template: event.target.value as PageTemplate })}
            >
              {(['blank', 'ruled', 'grid', 'dot'] as const).map((item) => (
                <option key={item} value={item}>
                  {templateLabel(item)}
                </option>
              ))}
            </select>
          </label>

          <label className="notebook-caption">
            本頁重點（給 AI）
            <input value={page.caption} onChange={(event) => patchPage({ caption: event.target.value })} />
          </label>
        </aside>

        <div className="nb-main">
          <NotebookToolBar
            tool={tool}
            color={color}
            width={width}
            onTool={setTool}
            onColor={setColor}
            onWidth={setWidth}
            onUndo={undo}
            onRedo={redo}
            onAi={() => setAiOpen(true)}
            onInsertImage={async (file) => {
              const dataUrl = await readImage(file)
              patchPage({
                stickers: [
                  ...page.stickers,
                  { id: newId('I'), x: 80, y: 120, w: 240, h: 180, dataUrl },
                ],
              })
            }}
            onAttach={() => {
              void capturePreview().then((preview) => {
                const bundle = pageToTeachingBundle({ ...page, preview }, book.title)
                onAttach(bundle.text, bundle.imageDataUrl)
              })
            }}
          />

          <div ref={captureRef}>
            <NotebookCanvas
              page={page}
              tool={tool}
              color={color}
              baseWidth={width}
              lassoIds={lassoIds}
              onLasso={setLassoIds}
              onChange={(patch) => patchPage(patch)}
              onPencilShortcut={(slot) => {
                const prefs = loadStylusPreferences()
                const action: StylusAction =
                  slot === 'barrel1'
                    ? prefs.barrelButton1
                    : slot === 'barrel2'
                      ? prefs.barrelButton2
                      : slot === 'doubleTap'
                        ? prefs.doubleTap
                        : prefs.eraserEnd
                runStylusAction(action, {
                  setTool: (t) => setTool(t),
                  undo,
                  redo,
                  openAi: () => setAiOpen(true),
                  toggleTool: () => setTool((current) => (current === 'pen' ? 'highlighter' : current === 'highlighter' ? 'eraser' : 'pen')),
                })
              }}
            />
          </div>
        </div>

        {aiOpen && (
          <aside className="nb-ai-panel glass-panel">
            <h2>筆記 AI</h2>
            <div className="nb-ai-modes">
              {(
                [
                  ['explain', '解釋'],
                  ['summarize', '整理'],
                  ['quiz', '出題'],
                  ['clean', '清稿'],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" className={aiMode === id ? 'on' : ''} onClick={() => setAiMode(id)}>
                  {label}
                </button>
              ))}
            </div>
            <button type="button" className="os-primary" disabled={aiBusy} onClick={() => void runAi()}>
              {aiBusy ? '處理中…' : '執行'}
            </button>
            {aiOut && <div className="nb-ai-out">{aiOut}</div>}
            <button type="button" onClick={() => setAiOpen(false)}>
              關閉
            </button>
          </aside>
        )}
      </div>
    </div>
  )
}

function NotebookToolBar({
  tool,
  color,
  width,
  onTool,
  onColor,
  onWidth,
  onUndo,
  onRedo,
  onAi,
  onInsertImage,
  onAttach,
}: {
  tool: NbTool
  color: string
  width: number
  onTool: (t: NbTool) => void
  onColor: (c: string) => void
  onWidth: (n: number) => void
  onUndo: () => void
  onRedo: () => void
  onAi: () => void
  onInsertImage: (file: File) => void
  onAttach: () => void
}) {
  const tools: [NbTool, string][] = [
    ['pen', '筆'],
    ['fountain', '鋼筆'],
    ['highlighter', '螢光'],
    ['eraser', '橡皮'],
    ['lasso', '套索'],
    ['line', '直線'],
    ['rect', '方框'],
    ['ellipse', '圓'],
    ['text', '文字'],
    ['pan', '移動'],
  ]
  return (
    <div className="nb-toolbar">
      {tools.map(([id, label]) => (
        <button key={id} type="button" className={tool === id ? 'on' : ''} aria-pressed={tool === id} onClick={() => onTool(id)}>
          {label}
        </button>
      ))}
      <span className="nb-toolbar-sep" />
      {PALETTE.map((swatch) => (
        <button key={swatch} type="button" className="swatch" style={{ background: swatch }} aria-pressed={color === swatch} onClick={() => onColor(swatch)} />
      ))}
      <label className="nb-width">
        粗細 {width}
        <input type="range" min={1} max={10} value={width} onChange={(event) => onWidth(Number(event.target.value))} />
      </label>
      <button type="button" onClick={onUndo}>
        復原
      </button>
      <button type="button" onClick={onRedo}>
        重做
      </button>
      <button type="button" onClick={onAi}>
        AI
      </button>
      <label className="nb-insert-image">
        圖片
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void onInsertImage(file)
          }}
        />
      </label>
      <button type="button" onClick={onAttach}>
        教材
      </button>
    </div>
  )
}

async function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}