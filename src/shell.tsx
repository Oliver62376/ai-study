import { useState, type ReactNode } from 'react'
import { readUploads } from './files'
import { gradeLabel, gradeOptions, loadGrade, saveGrade, type GradeId } from './profile'
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

function AppTopBar({ children, onBack }: { children?: ReactNode; onBack?: () => void }) {
  return (
    <header className="os-topbar">
      <div className="os-topbar-start">
        {onBack ? (
          <button type="button" className="os-back" onClick={onBack}>
            返回
          </button>
        ) : (
          <span className="os-brand">AI 智慧教學</span>
        )}
      </div>
      <div className="os-topbar-end">{children}</div>
    </header>
  )
}

function GradeMenu({ grade, onChange }: { grade: GradeId; onChange: (id: GradeId) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="os-menu-wrap">
      <button type="button" className="os-pill" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {gradeLabel(grade)}
      </button>
      {open && (
        <ul className="os-menu" role="listbox">
          {gradeOptions.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={grade === item.id}
                onClick={() => {
                  onChange(item.id)
                  saveGrade(item.id)
                  setOpen(false)
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function HomeScreen({
  courseTitle,
  finished,
  stepLabel,
  connected,
  planning,
  planError,
  onEnter,
  onStart,
  onSettings,
}: {
  courseTitle: string
  finished: boolean
  stepLabel: string
  connected: boolean
  planning: boolean
  planError: string
  onEnter: () => void
  onStart: (topic: string, fileText: string) => void
  onSettings: () => void
}) {
  const [topic, setTopic] = useState('')
  const [fileText, setFileText] = useState('')
  const [reading, setReading] = useState(false)
  const [fileNote, setFileNote] = useState('')
  const [grade, setGrade] = useState<GradeId>(() => loadGrade())
  const providerName = optionFor(loadSettings().provider).name
  const canStart = topic.trim().length > 0 || fileText.trim().length > 0

  return (
    <div className="os-home">
      <AppTopBar>
        <GradeMenu grade={grade} onChange={setGrade} />
        <button type="button" className="os-pill" onClick={onSettings}>
          模型{connected ? ` · ${providerName}` : ''}
        </button>
      </AppTopBar>

      <div className="os-home-body">
        <aside className="os-lessons" aria-label="已上過的課">
          <h2>我的課</h2>
          {courseTitle ? (
            <button type="button" className="os-lesson current" onClick={onEnter}>
              <span className="os-lesson-title">{courseTitle}</span>
              <span className="os-lesson-meta">{stepLabel}</span>
              <span className="os-lesson-cta">{finished ? '打開白板' : '繼續上課'}</span>
            </button>
          ) : (
            <p className="os-empty">上過的課會留在這裡，點一下就能回到白板。</p>
          )}
        </aside>

        <section className="os-start">
          <p className="os-kicker">想學什麼，直接告訴老師</p>
          <label className="os-topic-field">
            <span className="visually-hidden">想學的主題</span>
            <input
              className="os-topic-input"
              value={topic}
              placeholder="教我二元一次方程式"
              disabled={planning}
              onChange={(event) => setTopic(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && canStart && !planning && connected) onStart(topic.trim(), fileText.trim())
              }}
            />
          </label>

          <div className="os-start-actions">
            <button
              type="button"
              className="os-primary"
              disabled={planning || !canStart}
              onClick={() => {
                if (!connected) {
                  onSettings()
                  return
                }
                onStart(topic.trim(), fileText.trim())
              }}
            >
              {planning ? '備課中…' : connected ? '開始上課' : '先接上模型'}
            </button>

            <label className="os-file">
              {reading ? '正在讀檔案…' : '改用我的檔案'}
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
                      setFileText((current) => (current.trim() ? `${current.trim()}\n\n${text}` : text))
                      setFileNote(list.map((file) => file.name).join('、'))
                    })
                    .catch((error: unknown) => {
                      setFileNote(error instanceof Error ? error.message : '這個檔案沒讀成')
                    })
                    .finally(() => setReading(false))
                }}
              />
            </label>
          </div>

          {fileNote && <p className="os-note">已讀入 {fileNote}</p>}
          {planError && <p className="os-error">{planError}</p>}
        </section>
      </div>
    </div>
  )
}

export function SettingsScreen({ onBack }: { onBack: () => void }) {
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
    <div className="os-page">
      <AppTopBar onBack={onBack} />
      <div className="os-page-body">
        <h1 className="os-page-title">模型</h1>
        <p className="os-muted">目前年級：{gradeLabel()}。在首頁右上角可改。金鑰只留在這台裝置。Grok 會一直留在名單裡。</p>
        <div className="provider-list os-providers">
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
        <p className="os-muted">{current.hint}</p>
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
          className="os-primary"
          onClick={() => {
            saveSettings(settings)
            setSaved(true)
          }}
        >
          儲存
        </button>
        {saved && (
          <p className="os-muted">
            已儲存。現在用 {current.name}
            {isConnected(settings) ? '，已可呼叫。' : '，還沒接上。'}
          </p>
        )}
      </div>
    </div>
  )
}

export function ShellPage({ onBack, title, children }: { onBack: () => void; title: string; children: ReactNode }) {
  return (
    <div className="os-page">
      <AppTopBar onBack={onBack} />
      <div className="os-page-body">
        <h1 className="os-page-title">{title}</h1>
        {children}
      </div>
    </div>
  )
}