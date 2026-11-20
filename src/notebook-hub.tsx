import { useMemo, useState } from 'react'
import { IconBack, IconBtn, IconBook, IconTrash } from './icons'
import { createFolder, loadFolders, type NotebookFolder } from './notebook-folders'
import {
  deleteNotebook,
  emptyPage,
  loadNotebooks,
  newId,
  upsertNotebook,
  type Notebook,
} from './notebook'

export function NotebookHomeSection({ onOpen, onManage }: { onOpen: (bookId: string) => void; onManage: () => void }) {
  const books = useMemo(() => loadNotebooks().slice(0, 6), [])
  if (!books.length) {
    return (
      <section className="nb-home-section glass-card" aria-label="筆記">
        <div className="nb-home-head">
          <h2>筆記</h2>
          <button type="button" className="os-link-btn" onClick={onManage}>
            管理
          </button>
        </div>
        <p className="os-muted">還沒有筆記，建立第一本開始手寫與 AI 整理。</p>
        <button type="button" className="os-primary" onClick={onManage}>
          前往筆記庫
        </button>
      </section>
    )
  }
  return (
    <section className="nb-home-section glass-card" aria-label="筆記">
      <div className="nb-home-head">
        <h2>筆記</h2>
        <button type="button" className="os-link-btn" onClick={onManage}>
          查看全部
        </button>
      </div>
      <div className="nb-home-grid">
        {books.map((book) => (
          <button key={book.id} type="button" className="nb-home-card" onClick={() => onOpen(book.id)}>
            {book.pages[0]?.preview ? (
              <img src={book.pages[0].preview} alt="" />
            ) : (
              <span className="nb-home-placeholder">
                <IconBook />
              </span>
            )}
            <span className="nb-home-card-title">{book.title}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

export function NotebookLibrary({
  onBack,
  onOpen,
}: {
  onBack: () => void
  onOpen: (bookId: string) => void
}) {
  const [books, setBooks] = useState(() => loadNotebooks())
  const [folders, setFolders] = useState<NotebookFolder[]>(() => loadFolders())
  const [folderId, setFolderId] = useState<string>('all')

  const visible = useMemo(() => {
    if (folderId === 'all') return books
    if (folderId === 'none') return books.filter((book) => !book.folderId)
    return books.filter((book) => book.folderId === folderId)
  }, [books, folderId])

  function refresh() {
    setBooks(loadNotebooks())
    setFolders(loadFolders())
  }

  function createBook() {
    const nb: Notebook = { id: newId('B'), title: '新筆記本', pages: [emptyPage('第 1 頁')], updatedAt: Date.now() }
    if (folderId !== 'all' && folderId !== 'none') nb.folderId = folderId
    upsertNotebook(nb)
    refresh()
    onOpen(nb.id)
  }

  return (
    <div className="os-page os-page-glass nb-library">
      <div className="os-aurora" aria-hidden />
      <header className="os-topbar glass-bar">
        <IconBtn label="返回" onClick={onBack}>
          <IconBack />
        </IconBtn>
        <span className="os-topbar-title">筆記庫</span>
        <button type="button" className="os-primary nb-lib-new" onClick={createBook}>
          ＋ 新筆記本
        </button>
      </header>
      <div className="nb-library-body">
        <aside className="nb-library-folders glass-rail">
          <p className="rail-title">資料夾</p>
          <button type="button" className={folderId === 'all' ? 'on' : ''} onClick={() => setFolderId('all')}>
            全部
          </button>
          <button type="button" className={folderId === 'none' ? 'on' : ''} onClick={() => setFolderId('none')}>
            未分類
          </button>
          {folders.map((folder) => (
            <button key={folder.id} type="button" className={folderId === folder.id ? 'on' : ''} onClick={() => setFolderId(folder.id)}>
              {folder.name}
            </button>
          ))}
          <button
            type="button"
            className="os-link-btn"
            onClick={() => {
              const name = window.prompt('資料夾名稱', '新資料夾')
              if (name) {
                createFolder(name)
                refresh()
              }
            }}
          >
            ＋ 資料夾
          </button>
        </aside>
        <main className="nb-library-main">
          {visible.length === 0 && <p className="os-muted">這個資料夾尚無筆記。</p>}
          <div className="nb-library-grid">
            {visible.map((book) => (
              <article key={book.id} className="nb-lib-card glass-card">
                <button type="button" className="nb-lib-thumb" onClick={() => onOpen(book.id)}>
                  {book.pages[0]?.preview ? <img src={book.pages[0].preview} alt="" /> : <span>{book.pages[0]?.title ?? '第 1 頁'}</span>}
                </button>
                <input
                  className="nb-lib-title"
                  value={book.title}
                  aria-label="筆記本名稱"
                  onChange={(event) => {
                    upsertNotebook({ ...book, title: event.target.value, updatedAt: Date.now() })
                    refresh()
                  }}
                />
                <LibCardActions book={book} folders={folders} onRefresh={refresh} onOpen={() => onOpen(book.id)} />
              </article>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}

function LibCardActions({
  book,
  folders,
  onRefresh,
  onOpen,
}: {
  book: Notebook
  folders: NotebookFolder[]
  onRefresh: () => void
  onOpen: () => void
}) {
  return (
    <div className="nb-lib-actions">
      <button type="button" onClick={onOpen}>
        開啟
      </button>
      <select
        value={book.folderId ?? ''}
        aria-label="移到資料夾"
        onChange={(event) => {
          const value = event.target.value
          upsertNotebook({ ...book, folderId: value || undefined, updatedAt: Date.now() })
          onRefresh()
        }}
      >
        <option value="">未分類</option>
        {folders.map((folder) => (
          <option key={folder.id} value={folder.id}>
            {folder.name}
          </option>
        ))}
      </select>
      <IconBtn
        label="刪除筆記本"
        onClick={() => {
          if (!window.confirm(`刪除「${book.title}」？`)) return
          deleteNotebook(book.id)
          onRefresh()
        }}
      >
        <IconTrash />
      </IconBtn>
    </div>
  )
}
