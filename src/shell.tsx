import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { readUploads } from './files'
import {
  IconAttach,
  IconBack,
  IconBook,
  IconBtn,
  IconGrade,
  IconPlay,
  IconRefresh,
  IconSave,
  IconSend,
  IconSettings,
} from './icons'
import { gradeLabel, gradeOptions, loadGrade, saveGrade, type GradeId } from './profile'
import {
  baseFor,
  isConnected,
  keyFor,
  listProviderModels,
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
    <header className="os-topbar glass-bar">
      <div className="os-topbar-start">
        {onBack ? (
          <IconBtn label="返回" onClick={onBack}>
            <IconBack />
          </IconBtn>
        ) : (
          <span className="os-brand-mark" aria-hidden />
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
      <IconBtn label={`年級：${gradeLabel(grade)}`} className={open ? 'active' : ''} onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <IconGrade />
      </IconBtn>
      {open && (
        <ul className="os-menu glass-pop" role="listbox">
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
  const canStart = topic.trim().length > 0 || fileText.trim().length > 0

  return (
    <div className="os-home os-home-gpt">
      <div className="os-aurora" aria-hidden />
      <AppTopBar>
        <GradeMenu grade={grade} onChange={setGrade} />
        <IconBtn label={connected ? '模型已連線' : '模型設定'} className={connected ? 'online' : ''} onClick={onSettings}>
          <IconSettings />
        </IconBtn>
      </AppTopBar>

      <div className="os-chat-stage">
        <aside className="os-lessons-rail glass-rail" aria-label="已上過的課">
          <IconBook />
          {courseTitle ? (
            <button type="button" className="os-lesson-chip glass-card" onClick={onEnter} title={courseTitle} aria-label={`${courseTitle}，${finished ? '打開白板' : '繼續上課'}`}>
              <span className="os-lesson-chip-title">{courseTitle}</span>
              <span className="os-lesson-chip-meta">{stepLabel}</span>
              <span className="os-lesson-play" aria-hidden>
                <IconPlay />
              </span>
            </button>
          ) : (
            <p className="os-empty-rail">課程會出現在這裡</p>
          )}
        </aside>

        <main className="os-chat-main">
          <div className="os-hero">
            <h1 className="os-hero-title">今天想學什麼？</h1>
            <p className="os-hero-sub">像跟老師說話一樣，輸入主題就能開始。</p>
          </div>

          <div className="os-composer glass-composer">
            <textarea
              className="os-composer-input"
              value={topic}
              rows={1}
              placeholder="教我二元一次方程式"
              disabled={planning}
              onChange={(event) => setTopic(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && canStart && !planning) {
                  event.preventDefault()
                  if (!connected) onSettings()
                  else onStart(topic.trim(), fileText.trim())
                }
              }}
            />
            <div className="os-composer-bar">
              <label className="os-attach-hit">
                <span className="icon-tool ghost" title={reading ? '正在讀檔案' : '上傳檔案'} aria-hidden>
                  <IconAttach />
                </span>
                <span className="visually-hidden">{reading ? '正在讀檔案' : '上傳檔案'}</span>
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
              <span className="os-composer-spacer" />
              <IconBtn
                label={planning ? '備課中' : connected ? '開始上課' : '先接上模型'}
                className="send"
                disabled={planning || !canStart}
                onClick={() => {
                  if (!connected) {
                    onSettings()
                    return
                  }
                  onStart(topic.trim(), fileText.trim())
                }}
              >
                <IconSend />
              </IconBtn>
            </div>
          </div>

          {fileNote && <p className="os-note glass-hint">已讀入 {fileNote}</p>}
          {planError && <p className="os-error">{planError}</p>}
        </main>
      </div>
    </div>
  )
}

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [settings, setSettings] = useState<AiSettings>(() => loadSettings())
  const [saved, setSaved] = useState(false)
  const [modelChoices, setModelChoices] = useState<string[]>(() => [modelFor(loadSettings())])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsNote, setModelsNote] = useState('')
  const current = optionFor(settings.provider)
  const provider = settings.provider
  const apiBase = settings.bases[provider]?.trim() ?? optionFor(provider).base ?? ''

  const refreshModels = useCallback(async (draft: AiSettings) => {
    if (!isConnected(draft)) {
      setModelChoices([modelFor(draft)])
      setModelsNote('先填好金鑰或局域網位址，再取得模型清單。')
      return
    }
    setModelsLoading(true)
    setModelsNote('')
    try {
      setModelChoices(await listProviderModels(draft))
    } catch {
      setModelChoices([modelFor(draft)])
      setModelsNote('這次沒抓到模型清單，請確認金鑰與網路。')
    } finally {
      setModelsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshModels(settings)
  }, [provider, apiBase])

  function choose(id: ProviderId) {
    setSaved(false)
    setSettings((value) => ({ ...value, provider: id }))
  }

  function patch(partial: Partial<AiSettings> | ((value: AiSettings) => AiSettings)) {
    setSaved(false)
    setSettings((value) => (typeof partial === 'function' ? partial(value) : { ...value, ...partial }))
  }

  return (
    <div className="os-page os-page-glass">
      <div className="os-aurora" aria-hidden />
      <AppTopBar onBack={onBack} />
      <div className="os-page-body glass-panel">
        <h1 className="os-page-title">模型</h1>
        <p className="os-muted">年級 {gradeLabel()} · 金鑰只留在本機 · Grok 必留</p>
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
              onBlur={() => {
                window.setTimeout(() => {
                  setSettings((value) => {
                    void refreshModels(value)
                    return value
                  })
                }, 0)
              }}
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
            onBlur={() => {
              window.setTimeout(() => {
                setSettings((value) => {
                  void refreshModels(value)
                  return value
                })
              }, 0)
            }}
          />
        </label>
        <label className="field">
          模型
          <div className="model-row">
            <select
              className="model-select"
              value={modelFor(settings)}
              disabled={modelsLoading || modelChoices.length === 0}
              onChange={(event) =>
                patch((value) => ({
                  ...value,
                  models: { ...value.models, [value.provider]: event.target.value },
                }))
              }
            >
              {modelChoices.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <IconBtn
              label="重新取得模型"
              disabled={modelsLoading || !isConnected(settings)}
              onClick={() => void refreshModels(settings)}
            >
              <IconRefresh />
            </IconBtn>
          </div>
        </label>
        {modelsLoading && <p className="os-muted">正在取得模型…</p>}
        {modelsNote && <p className="os-muted">{modelsNote}</p>}
        <IconBtn
          label="儲存"
          className="save-wide"
          onClick={() => {
            saveSettings(settings)
            setSaved(true)
          }}
        >
          <IconSave />
        </IconBtn>
        {saved && (
          <p className="os-muted">
            已儲存 · {current.name}
            {isConnected(settings) ? ' · 已連線' : ' · 尚未連線'}
          </p>
        )}
      </div>
    </div>
  )
}

export function ShellPage({ onBack, title, children }: { onBack: () => void; title: string; children: ReactNode }) {
  return (
    <div className="os-page os-page-glass">
      <div className="os-aurora" aria-hidden />
      <AppTopBar onBack={onBack} />
      <div className="os-page-body glass-panel">
        <h1 className="os-page-title">{title}</h1>
        {children}
      </div>
    </div>
  )
}
