import { type ReactNode, useState } from 'react'
import type { NotePage, Notebook } from './notebook'

export function NotebookPageManager({
  book,
  currentPageId,
  onClose,
  onApply,
  onCapturePreview,
}: {
  book: Notebook
  currentPageId: string
  onClose: () => void
  onApply: (pages: NotePage[]) => void
  onCapturePreview: (pageId: string) => Promise<string | undefined>
}) {
  const [pages, setPages] = useState(() => [...book.pages])
  const [busy, setBusy] = useState(false)

  function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= pages.length) return
    setPages((list) => {
      const next = [...list]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return next
    })
  }

  function remove(id: string) {
    if (pages.length < 2) return
    if (!window.confirm('刪除此頁？')) return
    setPages((list) => list.filter((item) => item.id !== id))
  }

  function rename(id: string, title: string) {
    setPages((list) => list.map((item) => (item.id === id ? { ...item, title } : item)))
  }

  async function refreshThumb(id: string) {
    setBusy(true)
    try {
      const preview = await onCapturePreview(id)
      if (!preview) return
      setPages((list) => list.map((item) => (item.id === id ? { ...item, preview } : item)))
    } finally {
      setBusy(false)
    }
  }

  function save() {
    const titled = pages.map((item, index) => ({
      ...item,
      title: /^第 \d+ 頁$/.test(item.title) ? `第 ${index + 1} 頁` : item.title,
      updatedAt: Date.now(),
    }))
    onApply(titled)
    onClose()
  }

  return (
    <div className="nb-page-mgr-backdrop" role="presentation" onClick={onClose}>
      <MotionDialog onClick={(event) => event.stopPropagation()}>
        <header className="nb-page-mgr-head">
          <h2>頁面管理</h2>
          <button type="button" className="nb-ai-float-x" aria-label="關閉" onClick={onClose}>
            ×
          </button>
        </header>
        <p className="os-muted">調整順序、刪除頁面，或更新縮圖。目前共 {pages.length} 頁。</p>
        <div className="nb-page-mgr-grid">
          {pages.map((item, index) => (
            <article key={item.id} className={`nb-page-mgr-card${item.id === currentPageId ? ' on' : ''}`}>
              <div className="nb-page-mgr-thumb">
                {item.preview ? <img src={item.preview} alt="" /> : <span>{item.title}</span>}
              </div>
              <input
                className="nb-lib-title selectable"
                value={item.title}
                aria-label="頁面名稱"
                onChange={(event) => rename(item.id, event.target.value)}
              />
              <div className="nb-page-mgr-actions">
                <button type="button" disabled={index === 0} onClick={() => move(index, -1)}>
                  ↑
                </button>
                <button type="button" disabled={index >= pages.length - 1} onClick={() => move(index, 1)}>
                  ↓
                </button>
                <button type="button" disabled={busy} onClick={() => void refreshThumb(item.id)}>
                  縮圖
                </button>
                <button type="button" className="danger" disabled={pages.length < 2} onClick={() => remove(item.id)}>
                  刪除
                </button>
              </div>
            </article>
          ))}
        </div>
        <footer className="nb-page-mgr-foot">
          <button type="button" className="nb-plain-btn" onClick={onClose}>
            取消
          </button>
          <button type="button" className="os-primary" onClick={save}>
            套用變更
          </button>
        </footer>
      </MotionDialog>
    </div>
  )
}

function MotionDialog({
  children,
  onClick,
}: {
  children: ReactNode
  onClick: (event: React.MouseEvent) => void
}) {
  return (
    <div className="nb-page-mgr glass-panel" role="dialog" aria-label="頁面管理" onClick={onClick}>
      {children}
    </div>
  )
}
