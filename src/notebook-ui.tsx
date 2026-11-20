import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { toPng } from 'html-to-image'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { renderPdfPage } from './ocr'
import { loadPreferences } from './preferences'
import { NotebookToolbar } from './notebook-toolbar'
import { boardPdf, sharePdf } from './pdf'

GlobalWorkerOptions.workerSrc = workerUrl
import { IconBack, IconBtn, IconShare, IconSettings } from './icons'
import { NotebookCanvas, templateLabel, type EraserMode, type NbTool, type ShapeKind } from './notebook-canvas'
import { NotebookAiPanel } from './notebook-ai-panel'
import { NotebookPageManager } from './notebook-page-manager'
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
  initialBookId,
}: {
  onBack: () => void
  onAttach: (text: string, imageDataUrl: string | null) => void
  onSettings: () => void
  initialBookId?: string
}) {
  const [books, setBooks] = useState(() => loadNotebooks())
  const [bookId, setBookId] = useState(() => books[0]?.id ?? '')
  const book = useMemo(() => books.find((item) => item.id === bookId) ?? books[0], [books, bookId])
  const [pageId, setPageId] = useState(() => book?.pages[0]?.id ?? '')
  const page = useMemo(() => book?.pages.find((item) => item.id === pageId) ?? book?.pages[0], [book, pageId])

  const [tool, setTool] = useState<NbTool>('pen')
  const [color, setColor] = useState(PALETTE[0])
  const [width, setWidth] = useState(3)
  const [shapeKind, setShapeKind] = useState<ShapeKind>('line')
  const [eraserMode, setEraserMode] = useState<EraserMode>('stroke')
  const [eraserSize, setEraserSize] = useState(20)
  const pageNav = loadPreferences().notebookPageNav
  const [lassoIds, setLassoIds] = useState<Set<string>>(() => new Set())
  const [undoStack, setUndoStack] = useState<ReturnType<typeof snapshotPage>[]>([])
  const [redoStack, setRedoStack] = useState<ReturnType<typeof snapshotPage>[]>([])
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [aiPreview, setAiPreview] = useState<string | null>(null)
  const [railOpen, setRailOpen] = useState(false)
  const [pageMgrOpen, setPageMgrOpen] = useState(false)
  const [savingExit, setSavingExit] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const lastTool = useRef<NbTool>('pen')
  const captureRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (!initialBookId) return
    if (books.some((item) => item.id === initialBookId)) setBookId(initialBookId)
  }, [initialBookId, books])

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

  const patchPageById = useCallback(
    (targetPageId: string, patch: Partial<NotePage>) => {
      if (!book) return
      const target = book.pages.find((item) => item.id === targetPageId)
      if (!target) return
      if (targetPageId === page?.id) pushUndo()
      const nextPage = { ...target, ...patch, updatedAt: Date.now() }
      const nextBook: Notebook = {
        ...book,
        pages: book.pages.map((item) => (item.id === targetPageId ? nextPage : item)),
        updatedAt: Date.now(),
      }
      upsertNotebook(nextBook)
      setBooks(loadNotebooks())
    },
    [book, page?.id, pushUndo],
  )

  const scrollToPage = useCallback((id: string) => {
    pageRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setPageId(id)
    setLassoIds(new Set())
  }, [])

  useEffect(() => {
    if (pageNav !== 'vertical' || !book || !scrollRef.current) return
    const root = scrollRef.current
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        const id = hit?.target.getAttribute('data-page-id')
        if (id) setPageId(id)
      },
      { root, threshold: [0.35, 0.55, 0.75] },
    )
    for (const item of book.pages) {
      const node = pageRefs.current[item.id]
      if (node) observer.observe(node)
    }
    return () => observer.disconnect()
  }, [book, pageNav, book?.pages.length])

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
        openAi: () => setAiPanelOpen(true),
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

  async function capturePreviewFor(pageId: string, data?: NotePage) {
    const target = data ?? book?.pages.find((item) => item.id === pageId)
    if (!target) return undefined
    const selector =
      pageNav === 'vertical' ? `.nb-page-block[data-page-id="${pageId}"] .nb-sheet` : '.nb-sheet'
    const node = captureRef.current?.querySelector(selector)
    if (!(node instanceof HTMLElement)) return target.preview
    const bg = target.paperColor ?? '#fbfaf7'
    return toPng(node, { pixelRatio: 1.5, backgroundColor: bg })
  }

  async function capturePreview() {
    if (!page) return undefined
    return capturePreviewFor(page.id, page)
  }

  async function persistAllPages() {
    if (!book) return
    const current = pageId
    const nextPages: NotePage[] = []
    for (const item of book.pages) {
      if (item.id !== current) flushSync(() => setPageId(item.id))
      await new Promise((resolve) => window.setTimeout(resolve, 90))
      const preview = (await capturePreviewFor(item.id, item)) ?? item.preview
      nextPages.push({ ...item, preview, updatedAt: Date.now() })
    }
    flushSync(() => setPageId(current))
    const nextBook: Notebook = { ...book, pages: nextPages, updatedAt: Date.now() }
    upsertNotebook(nextBook)
    setBooks(loadNotebooks())
  }

  useEffect(() => {
    if (!aiPanelOpen || !page) return
    void capturePreview().then((shot) => setAiPreview(shot ?? page.preview ?? null))
  }, [aiPanelOpen, page?.id, page?.updatedAt])

  async function exitNotebook() {
    if (savingExit) return
    setSavingExit(true)
    try {
      await persistAllPages()
    } finally {
      setSavingExit(false)
      onBack()
    }
  }

  async function importPdf(file: File) {
    if (!book) return
    setImporting(true)
    try {
      const data = new Uint8Array(await file.arrayBuffer())
      const pdf = await getDocument({ data: data.slice() }).promise
      const added = []
      const max = Math.min(pdf.numPages, 32)
      const base = file.name.replace(/\.pdf$/i, '') || 'PDF'
      for (let index = 1; index <= max; index += 1) {
        const jpeg = await renderPdfPage(pdf, index, 1.5)
        added.push({
          ...emptyPage(`${base} 第 ${index} 頁`, 'blank'),
          background: jpeg,
        })
      }
      const next: Notebook = { ...book, pages: [...book.pages, ...added], updatedAt: Date.now() }
      upsertNotebook(next)
      setBooks(loadNotebooks())
      if (added[0]) setPageId(added[0].id)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'PDF 匯入失敗')
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

  if (!book || !page) return null

  const pageAiContext = [page.caption, ...page.texts.map((t) => t.text)].filter(Boolean).join('\n')

  return (
    <div className="nb-app nb-gn-app">
      <header className="nb-gn-header">
        <IconBtn label={savingExit ? '儲存中' : '返回'} disabled={savingExit} onClick={() => void exitNotebook()}>
          <IconBack />
        </IconBtn>
        <input
          className="nb-gn-title selectable"
          value={book.title}
          aria-label="筆記本名稱"
          onChange={(event) => {
            const next = { ...book, title: event.target.value }
            upsertNotebook(next)
            setBooks(loadNotebooks())
          }}
        />
        <HeaderNotebookActions
          importing={importing}
          exporting={exporting}
          onImport={(file) => void importPdf(file)}
          onShare={() => void exportPdfBook()}
          onPageMgr={() => setPageMgrOpen(true)}
          onRail={() => setRailOpen((v) => !v)}
          onSettings={onSettings}
        />
      </header>

      <div className="nb-gn-stage">
        <div className="nb-gn-toolbar-slot">
          <NotebookToolbar
            tool={tool}
            color={color}
            width={width}
            shapeKind={shapeKind}
            eraserMode={eraserMode}
            eraserSize={eraserSize}
            onTool={setTool}
            onColor={setColor}
            onWidth={setWidth}
            onShapeKind={setShapeKind}
            onEraserMode={setEraserMode}
            onEraserSize={setEraserSize}
            onUndo={undo}
            onRedo={redo}
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
        </div>

        <div className="nb-body nb-body-gn">
        <aside className={`nb-sidebar nb-sidebar-drawer${railOpen ? ' open' : ''}`}>
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
                onClick={() => (pageNav === 'vertical' ? scrollToPage(item.id) : setPageId(item.id))}
              >
                {item.preview ? <img src={item.preview} alt="" /> : <span>{item.title}</span>}
              </button>
            ))}
          </div>
          <button type="button" className="os-primary nb-page-mgr-open" onClick={() => setPageMgrOpen(true)}>
            頁面管理
          </button>
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
          <label className="nb-select nb-color-wheel">
            背景色
            <input
              type="color"
              value={page.paperColor ?? '#fbfaf7'}
              onChange={(event) => patchPage({ paperColor: event.target.value })}
            />
          </label>

          <label className="notebook-caption">
            本頁重點（給 AI）
            <input value={page.caption} onChange={(event) => patchPage({ caption: event.target.value })} />
          </label>
        </aside>

        <div className="nb-main nb-main-gn no-select">
          {pageNav === 'horizontal' && (
            <div className="nb-page-nav">
              <button
                type="button"
                disabled={book.pages.findIndex((item) => item.id === pageId) <= 0}
                onClick={() => {
                  const index = book.pages.findIndex((item) => item.id === pageId)
                  if (index > 0) setPageId(book.pages[index - 1].id)
                }}
              >
                上一頁
              </button>
              <span>
                {book.pages.findIndex((item) => item.id === pageId) + 1} / {book.pages.length}
              </span>
              <button
                type="button"
                disabled={book.pages.findIndex((item) => item.id === pageId) >= book.pages.length - 1}
                onClick={() => {
                  const index = book.pages.findIndex((item) => item.id === pageId)
                  if (index < book.pages.length - 1) setPageId(book.pages[index + 1].id)
                }}
              >
                下一頁
              </button>
            </div>
          )}
          <div
            className={`nb-pages-scroll nb-nav-${pageNav}`}
            ref={(node) => {
              captureRef.current = node
              scrollRef.current = node
            }}
          >
            {pageNav === 'vertical'
              ? book.pages.map((item) => (
                  <div
                    key={item.id}
                    className={`nb-page-block${item.id === pageId ? ' active' : ''}`}
                    data-page-id={item.id}
                    ref={(node) => {
                      pageRefs.current[item.id] = node
                    }}
                  >
                    <NotebookCanvas
                      page={item}
                      tool={tool}
                      color={color}
                      baseWidth={width}
                      shapeKind={shapeKind}
                      eraserMode={eraserMode}
                      eraserSize={eraserSize}
                      lassoIds={item.id === pageId ? lassoIds : new Set()}
                      onLasso={item.id === pageId ? setLassoIds : () => {}}
                      onChange={(patch) => patchPageById(item.id, patch)}
                      onPencilShortcut={(slot) => {
                        if (item.id !== pageId) {
                          scrollToPage(item.id)
                          return
                        }
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
                          openAi: () => setAiPanelOpen(true),
                          toggleTool: () =>
                            setTool((current) => (current === 'pen' ? 'highlighter' : current === 'highlighter' ? 'eraser' : 'pen')),
                        })
                      }}
                    />
                  </div>
                ))
              : (
                  <NotebookCanvas
                    page={page}
                    tool={tool}
                    color={color}
                    baseWidth={width}
                    shapeKind={shapeKind}
                    eraserMode={eraserMode}
                    eraserSize={eraserSize}
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
                        openAi: () => setAiPanelOpen(true),
                        toggleTool: () =>
                          setTool((current) => (current === 'pen' ? 'highlighter' : current === 'highlighter' ? 'eraser' : 'pen')),
                      })
                    }}
                  />
                )}
          </div>
        </div>
        </div>

        {!aiPanelOpen && (
          <button type="button" className="nb-ai-fab" aria-label="開啟筆記 AI" onClick={() => setAiPanelOpen(true)}>
            AI
          </button>
        )}
        {aiPanelOpen && (
          <NotebookAiPanel
            bookId={book.id}
            pageTitle={page.title}
            pageContext={pageAiContext}
            pagePreview={aiPreview ?? page.preview ?? null}
            onClose={() => setAiPanelOpen(false)}
            onSettings={onSettings}
          />
        )}
        {pageMgrOpen && (
          <NotebookPageManager
            book={book}
            currentPageId={pageId}
            onClose={() => setPageMgrOpen(false)}
            onApply={(pages) => {
              const next = { ...book, pages, updatedAt: Date.now() }
              upsertNotebook(next)
              setBooks(loadNotebooks())
              if (!pages.some((item) => item.id === pageId)) setPageId(pages[0]?.id ?? '')
            }}
            onCapturePreview={async (id) => {
              const previous = pageId
              if (id !== previous) flushSync(() => setPageId(id))
              await new Promise((resolve) => window.setTimeout(resolve, 100))
              const shot = await capturePreviewFor(id)
              if (id !== previous) flushSync(() => setPageId(previous))
              return shot
            }}
          />
        )}
      </div>
    </div>
  )
}

function HeaderNotebookActions({
  importing,
  exporting,
  onImport,
  onShare,
  onPageMgr,
  onRail,
  onSettings,
}: {
  importing: boolean
  exporting: boolean
  onImport: (file: File) => void
  onShare: () => void
  onPageMgr: () => void
  onRail: () => void
  onSettings: () => void
}) {
  return (
    <div className="nb-gn-header-end">
      <label className="nb-gn-icon-hit" title={importing ? '匯入中' : '匯入 PDF'}>
        <span className="nb-gn-icon-label">PDF</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          disabled={importing || exporting}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) onImport(file)
          }}
        />
      </label>
      <IconBtn label={exporting ? '分享中' : '分享 PDF'} disabled={exporting || importing} onClick={onShare}>
        <IconShare />
      </IconBtn>
      <button type="button" className="nb-gn-text-btn" onClick={onPageMgr}>
        頁面
      </button>
      <button type="button" className="nb-gn-text-btn" onClick={onRail}>
        側欄
      </button>
      <IconBtn label="設定" onClick={onSettings}>
        <IconSettings />
      </IconBtn>
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