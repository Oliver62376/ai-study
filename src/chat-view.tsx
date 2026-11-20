import { useEffect, useRef, useState } from 'react'
import { gradeLabel } from './profile'
import { chatSystem, loadChat, saveChat, type ChatLine } from './chat'
import { askProvider, isConnected, loadSettings } from './settings'
import type { VisionPage } from './ocr'
import { IconBtn, IconSend } from './icons'

export function ChatView({
  seed,
  context,
  vision,
  onSettings,
}: {
  seed: string
  context: string
  vision: VisionPage[]
  onSettings: () => void
}) {
  const [lines, setLines] = useState<ChatLine[]>(() => loadChat())
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const booted = useRef(false)

  async function send(text: string) {
    const message = text.trim()
    if (!message || busy) return
    const settings = loadSettings()
    if (!isConnected(settings)) {
      onSettings()
      return
    }
    const user: ChatLine = { id: `u-${Date.now()}`, role: 'user', text: message }
    const next = [...lines, user]
    setLines(next)
    setDraft('')
    setBusy(true)
    try {
      const raw = await askProvider(settings, message, context || seed, chatSystem(gradeLabel()), vision)
      const answer = (raw ?? '這次沒有收到回覆。').trim()
      const assistant: ChatLine = { id: `a-${Date.now()}`, role: 'assistant', text: answer }
      const done = [...next, assistant]
      setLines(done)
      saveChat(done)
    } catch {
      const assistant: ChatLine = { id: `a-${Date.now()}`, role: 'assistant', text: '連線失敗，請檢查設定與網路。' }
      const done = [...next, assistant]
      setLines(done)
      saveChat(done)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (booted.current || !seed.trim()) return
    booted.current = true
    void send(seed)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot bootstrap question
  }, [seed])

  return (
    <div className="chat-panel">
      <div className="chat-log" role="log" aria-live="polite">
        {lines.length === 0 && <p className="os-muted">像 ChatGPT 一樣提問，不會寫白板。</p>}
        {lines.map((line) => (
          <div key={line.id} className={line.role === 'user' ? 'chat-bubble user' : 'chat-bubble assistant'}>
            {line.text}
          </div>
        ))}
        {busy && <p className="chat-thinking">AI 思考中…</p>}
      </div>
      <form
        className="chat-composer glass-composer"
        onSubmit={(event) => {
          event.preventDefault()
          void send(draft)
        }}
      >
        <input value={draft} placeholder="繼續提問" onChange={(event) => setDraft(event.target.value)} disabled={busy} />
        <IconBtn label="送出" className="send" disabled={busy || !draft.trim()} onClick={() => void send(draft)}>
          <IconSend />
        </IconBtn>
      </form>
    </div>
  )
}