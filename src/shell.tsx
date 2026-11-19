import { useState, type ReactNode } from 'react'
import { readUploads } from './files'
import {
  baseFor,
  isConnected,
  keyFor,
  loadSettings,
  modelFor,
  optionFor,
  providerOptions,
  saveSettings,
  type AiSettings,
  type ProviderId,
} from './settings'

export function IpadFrame({
  section,
  onSection,
  children,
}: {
  section: 'class' | 'quiz' | 'settings'
  onSection: (id: 'class' | 'quiz' | 'settings') => void
  children: ReactNode
}) {
  const items = [
    ['class', '上課'],
    ['quiz', '測驗'],
    ['settings', '模型'],
  ] as const
  return (
    <div className="ipad-app">
      <nav className="ipad-side" aria-label="主選單">
        <p className="ipad-mark">AI 智慧教學</p>
        {items.map(([id, label]) => (
          <button key={id} type="button" aria-current={section === id ? 'page' : undefined} onClick={() => onSection(id)}>
            {label}
          </button>
        ))}
      </nav>
      <div className="ipad-main">{children}</div>
    </div>
  )
}

export function HomeScreen({
  title,
  finished,
  stepLabel,
  providerName,
  model,
  connected,
  sections,
  planning,
  planError,
  onEnter,
  onPlan,
  onQuiz,
  onSettings,
}: {
  title: string
  finished: boolean
  stepLabel: string
  providerName: string
  model: string
  connected: boolean
  sections: { id: string; title: string }[]
  planning: boolean
  planError: string
  onEnter: () => void
  onPlan: (source: string, audience: string) => void
  onQuiz: () => void
  onSettings: () => void
}) {
  const [source, setSource] = useState('')
  const [audience, setAudience] = useState('')
  const [reading, setReading] = useState(false)
  const [fileNote, setFileNote] = useState('')
  return (
    <IpadFrame
      section="class"
      onSection={(id) => {
        if (id === 'quiz') onQuiz()
        if (id === 'settings') onSettings()
      }}
    >
      <header className="ipad-title">
        <p>{connected ? `${providerName} · ${model}` : '還沒接上模型'}</p>
        <h1>{title || '新的一課'}</h1>
      </header>
      <div className="home-grid">
        <article className="glass-card hero">
          <h2>{title ? (finished ? '這堂已經講完' : '備好了') : '先把教材交給老師'}</h2>
          <p className="fine">{stepLabel}</p>
          {title && (
            <button type="button" className="primary" onClick={onEnter}>
              {finished ? '打開白板' : '開始上課'}
            </button>
          )}
        </article>
        <article className="glass-card">
          <h2>測驗</h2>
          <p>另一面白板。題目由模型依照這堂課的教材出，檢討不寫回上課的板。</p>
          <button type="button" onClick={onQuiz} disabled={!title}>出題</button>
        </article>
        <article className="glass-card wide">
          <h2>{title ? '換一份教材' : '備課'}</h2>
          <label className="upload">
            {reading ? '正在讀檔案' : '上傳檔案'}
            <input
              type="file"
              accept=".pdf,.docx,.pptx,.txt,.md,application/pdf,text/plain"
              multiple
              disabled={reading || planning}
              onChange={(event) => {
                const list = [...(event.target.files ?? [])]
                event.target.value = ''
                if (!list.length) return
                setReading(true)
                setFileNote('')
                void readUploads(list)
                  .then((text) => {
                    setSource((current) => (current.trim() ? `${current.trim()}\n\n${text}` : text))
                    setFileNote(list.map((file) => file.name).join('、'))
                  })
                  .catch((error: unknown) => {
                    setFileNote(error instanceof Error ? error.message : '這個檔案沒讀成')
                  })
                  .finally(() => setReading(false))
              }}
            />
          </label>
          {fileNote && <p className="fine">{fileNote}</p>}
          <label className="field">
            教材或主題
            <textarea
              value={source}
              placeholder="貼上講義、上傳 PDF／Word／PowerPoint，或寫下要學的主題"
              onChange={(event) => setSource(event.target.value)}
            />
          </label>
          <label className="field">
            教學對象，可以不填
            <input value={audience} placeholder="例如高一、自學" onChange={(event) => setAudience(event.target.value)} />
          </label>
          {planError && <p className="fine">{planError}</p>}
          <button type="button" className="primary" disabled={planning || !source.trim()} onClick={() => onPlan(source.trim(), audience)}>
            {planning ? '備課中' : connected ? '讓模型備課' : '先接上模型才能備課'}
          </button>
          {!connected && (
            <button type="button" onClick={onSettings}>前往模型</button>
          )}
        </article>
        {sections.length > 0 && (
          <article className="glass-card wide">
            <h2>這堂課的教材</h2>
            <ol>
              {sections.map((section) => (
                <li key={section.id}>{section.title}</li>
              ))}
            </ol>
          </article>
        )}
      </div>
    </IpadFrame>
  )
}

export function SettingsScreen({ onBack, onQuiz }: { onBack: () => void; onQuiz: () => void }) {
  const [settings, setSettings] = useState<AiSettings>(() => loadSettings())
  const [saved, setSaved] = useState(false)
  const current = optionFor(settings.provider)

  function choose(id: ProviderId) {
    setSaved(false)
    setSettings((value) => ({ ...value, provider: id }))
  }

  function patch(partial: Partial<AiSettings> | ((value: AiSettings) => AiSettings)) {
    setSaved(false)
    setSettings((value) => (typeof partial === 'function' ? partial(value) : { ...value, ...partial }))
  }

  return (
    <IpadFrame
      section="settings"
      onSection={(id) => {
        if (id === 'class') onBack()
        if (id === 'quiz') onQuiz()
      }}
    >
      <header className="ipad-title">
        <p>設定</p>
        <h1>模型</h1>
      </header>
      <section className="glass-card settings-card">
        <p className="fine">金鑰只留在這台裝置。局域網服務填位址即可，金鑰可以空著。Grok 會一直留在名單裡。</p>
        <div className="provider-list">
          {providerOptions.map((option) => (
            <label key={option.id} className={option.id === settings.provider ? 'provider selected' : 'provider'}>
              <input
                type="radio"
                name="provider"
                checked={option.id === settings.provider}
                onChange={() => choose(option.id)}
              />
              <span>
                <strong>{option.name}</strong>
                {option.required && <em>必備</em>}
              </span>
            </label>
          ))}
        </div>
        <p className="fine">{current.hint}</p>
        {current.local && (
          <label className="field">
            服務位址
            <input
              value={baseFor(settings)}
              placeholder="http://192.168.1.10:11434/v1"
              onChange={(event) =>
                patch((value) => ({
                  ...value,
                  bases: { ...value.bases, [value.provider]: event.target.value },
                }))
              }
            />
          </label>
        )}
        <label className="field">
          {current.local ? 'API 金鑰（可留空）' : 'API 金鑰'}
          <input
            type="password"
            autoComplete="off"
            value={keyFor(settings)}
            onChange={(event) =>
              patch((value) => ({
                ...value,
                keys: { ...value.keys, [value.provider]: event.target.value },
              }))
            }
          />
        </label>
        <label className="field">
          模型
          <input
            value={modelFor(settings)}
            onChange={(event) =>
              patch((value) => ({
                ...value,
                models: { ...value.models, [value.provider]: event.target.value },
              }))
            }
          />
        </label>
        <button
          type="button"
          className="primary"
          onClick={() => {
            saveSettings(settings)
            setSaved(true)
          }}
        >
          儲存
        </button>
        {saved && <p className="fine">已儲存。現在用 {current.name}{isConnected(settings) ? '，已可呼叫。' : '，還沒接上。'}</p>}
      </section>
    </IpadFrame>
  )
}
