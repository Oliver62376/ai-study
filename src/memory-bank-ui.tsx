import { useState } from 'react'
import {
  addMemory,
  deleteMemory,
  loadMemoryBank,
  memoryKindLabels,
  type MemoryKind,
  updateMemory,
} from './memory-bank'

export function MemoryBankPanel() {
  const [items, setItems] = useState(() => loadMemoryBank())
  const [kind, setKind] = useState<MemoryKind>('profile')
  const [text, setText] = useState('')

  function refresh() {
    setItems(loadMemoryBank())
  }

  function onAdd() {
    if (!text.trim()) return
    addMemory({ kind, text, tags: [], source: 'user' })
    setText('')
    refresh()
  }

  return (
    <section className="memory-bank">
      <h2>AI 記憶庫</h2>
      <p className="os-muted">
        備課、講課、Chat 會自動讀取這裡的條目（本機儲存）。上課時會自動累積「上過的課」、學生問答與 SVG 教學意圖。
      </p>
      <label className="field">
        類型
        <select className="model-select" value={kind} onChange={(event) => setKind(event.target.value as MemoryKind)}>
          {(Object.keys(memoryKindLabels) as MemoryKind[]).map((key) => (
            <option key={key} value={key}>
              {memoryKindLabels[key]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        新增記憶
        <textarea className="prompt-area" rows={3} value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      <button type="button" className="nb-plain-btn" onClick={onAdd}>
        加入記憶庫
      </button>

      <ul className="memory-list">
        {items.map((item) => (
          <li key={item.id} className="memory-row glass-card">
            <span className="memory-kind">{memoryKindLabels[item.kind]}</span>
            <textarea
              className="memory-text"
              rows={2}
              value={item.text}
              onChange={(event) => updateMemory(item.id, { text: event.target.value })}
              onBlur={refresh}
            />
            <div className="memory-actions">
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={Boolean(item.pinned)}
                  onChange={(event) => {
                    updateMemory(item.id, { pinned: event.target.checked })
                    refresh()
                  }}
                />
                置頂
              </label>
              <button
                type="button"
                className="nb-plain-btn danger"
                onClick={() => {
                  deleteMemory(item.id)
                  refresh()
                }}
              >
                刪除
              </button>
            </div>
          </li>
        ))}
      </ul>
      {items.length === 0 && <p className="os-empty-rail">尚無記憶。上課後會自動增加，也可手動新增學習者背景。</p>}
    </section>
  )
}