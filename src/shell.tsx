import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { readUploads, type UploadChip } from './files'
import type { LessonRecord } from './lessons'
import type { VisionPage } from './ocr'
import {
  IconAttach,
  IconBack,
  IconBook,
  IconBtn,
  IconPlay,
  IconRefresh,
  IconSave,
  IconSend,
  IconSettings,
  IconTrash,
} from './icons'
import {
  loadPreferences,
  savePreferences,
  uploadModeLabels,
  type AppPreferences,
  type HomeMode,
  type UploadMode,
  type NotebookPageNav,
} from './preferences'
import {
  defaultCustomPrompts,
  downloadTextFile,
  loadCustomPrompts,
  promptSlotLabels,
  readmePromptText,
  saveCustomPrompts,
  templateBody,
  type CustomPrompts,
  type PromptSlot,
} from './custom-prompts'
import {
  defaultStylusPreferences,
  loadStylusPreferences,
  saveStylusPreferences,
  stylusActionLabels,
  type StylusAction,
  type StylusPreferences,
} from './stylus-prefs'

import { NotebookHomeSection } from './notebook-hub'
import { APP_VERSION } from './custom-prompts'
import { gradeLabel, gradeOptions, loadGrade, saveGrade, type GradeId } from './profile'
import {
  baseFor,
  isConnected,
  keyFor,
  listProviderModels,
  listVoicesForSettings,
  loadSettings,
  loadTokenTotals,
  modelFor,
  resetTokenTotals,
  optionFor,
  providerOptions,
  saveSettings,
  type AiSettings,
  type ProviderId,
} from './settings'

function AppTopBar({ children, onBack, title }: { children?: ReactNode; onBack?: () => void; title?: string }) {
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
        {title && <span className="os-topbar-title">{title}</span>}
      </div>
      <div className="os-topbar-end">{children}</div>
    </header>
  )
}

function ModeSwitch({ mode, onChange }: { mode: HomeMode; onChange: (mode: HomeMode) => void }) {
  return (
    <div className="mode-switch" role="tablist" aria-label="上課模式">
      <button type="button" role="tab" aria-selected={mode === 'board'} className={mode === 'board' ? 'on' : ''} onClick={() => onChange('board')}>
        白板
      </button>
      <button type="button" role="tab" aria-selected={mode === 'chat'} className={mode === 'chat' ? 'on' : ''} onClick={() => onChange('chat')}>
        Chat
      </button>
    </div>
  )
}

export function HomeScreen({
  lessons,
  activeLessonId,
  connected,
  planning,
  planError,
  onEnterLesson,
  onOpenLesson,
  onDeleteLesson,
  onStartBoard,
  onStartChat,
  onSettings,
  onNotebook,
  onOpenNotebook,
  onManageNotebooks,
}: {
  lessons: LessonRecord[]
  activeLessonId: string
  connected: boolean
  planning: boolean
  planError: string
  onEnterLesson: () => void
  onOpenLesson: (id: string) => void
  onDeleteLesson: (id: string) => void
  onStartBoard: (topic: string, fileText: string, vision: VisionPage[]) => void
  onStartChat: (topic: string, fileText: string, vision: VisionPage[]) => void
  onSettings: () => void
  onNotebook: () => void
  onOpenNotebook: (bookId: string) => void
  onManageNotebooks: () => void
}) {
  const [topic, setTopic] = useState('')
  const [fileText, setFileText] = useState('')
  const [visionPages, setVisionPages] = useState<VisionPage[]>([])
  const [chips, setChips] = useState<UploadChip[]>([])
  const [reading, setReading] = useState(false)
  const [mode, setMode] = useState<HomeMode>(() => loadPreferences().homeMode)
  const canStart = topic.trim().length > 0 || fileText.trim().length > 0 || chips.some((chip) => chip.kind === 'image' || chip.kind === 'text')

  function setHomeMode(next: HomeMode) {
    setMode(next)
    const prefs = loadPreferences()
    savePreferences({ ...prefs, homeMode: next })
  }

  function removeChip(id: string) {
    setChips((list) => list.filter((item) => item.id !== id))
    if (chips.length <= 1) {
      setFileText('')
      setVisionPages([])
    }
  }

  return (
    <div className="os-home os-home-gpt">
      <div className="os-aurora" aria-hidden />
      <AppTopBar>
        <IconBtn label="筆記本" onClick={onNotebook}>
          <IconBook />
        </IconBtn>
        <IconBtn label={connected ? '模型已連線' : '設定'} className={connected ? 'online' : ''} onClick={onSettings}>
          <IconSettings />
        </IconBtn>
      </AppTopBar>

      <div className="os-chat-stage">
        <aside className="os-lessons-rail glass-rail" aria-label="我的課">
          <p className="rail-title">我的課</p>
          {lessons.length === 0 && <p className="os-empty-rail">開課後會出現在這裡</p>}
          {lessons.map((lesson) => {
            const current = lesson.id === activeLessonId
            const stepLabel = lesson.snapshot.finished
              ? '已講完'
              : lesson.snapshot.reveals.length
                ? '有板書'
                : '備課中'
            return (
              <div key={lesson.id} className="lesson-row">
                <button
                  type="button"
                  className={`os-lesson-chip glass-card${current ? ' active' : ''}`}
                  onClick={() => onOpenLesson(lesson.id)}
                  title={lesson.title}
                >
                  <span className="os-lesson-chip-title">{lesson.title}</span>
                  <span className="os-lesson-chip-meta">{stepLabel}</span>
                  <span className="os-lesson-play" aria-hidden>
                    <IconPlay />
                  </span>
                </button>
                <IconBtn label={`刪除 ${lesson.title}`} onClick={() => onDeleteLesson(lesson.id)}>
                  <IconTrash />
                </IconBtn>
              </div>
            )
          })}
          {activeLessonId && (
            <button type="button" className="os-link-btn" onClick={onEnterLesson}>
              回到現在這堂課
            </button>
          )}
        </aside>

        <main className="os-chat-main">
          <div className="os-hero">
            <h1 className="os-hero-title">今天想學什麼？</h1>
            <p className="os-hero-sub">{mode === 'board' ? '白板模式：備課後用視覺化方式上課。' : 'Chat 模式：一般問答，不寫白板。'}</p>
          </div>

          <ModeSwitch mode={mode} onChange={setHomeMode} />

          <div className="os-composer glass-composer">
            {chips.length > 0 && (
              <p className="upload-chips" aria-label="已上傳檔案">
                {chips.map((chip) => (
                  <span key={chip.id} className={`file-chip${chip.kind === 'error' ? ' error' : ''}${chip.kind === 'loading' ? ' loading' : ''}`}>
                    <span className="file-chip-name">{chip.name}</span>
                    {chip.detail && <span className="file-chip-meta">{chip.detail}</span>}
                    {chip.kind !== 'loading' && (
                      <button type="button" className="file-chip-x" aria-label={`移除 ${chip.name}`} onClick={() => removeChip(chip.id)}>
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </p>
            )}
            <textarea
              className="os-composer-input"
              value={topic}
              rows={1}
              placeholder="詢問任何科目"
              disabled={planning}
              onChange={(event) => setTopic(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && canStart && !planning) {
                  event.preventDefault()
                  if (!connected) onSettings()
                  else if (mode === 'chat') onStartChat(topic.trim(), fileText.trim(), visionPages)
                  else onStartBoard(topic.trim(), fileText.trim(), visionPages)
                }
              }}
            />
            <div className="os-composer-bar">
              <label className="os-attach-hit">
                <span className="icon-tool ghost" title={reading ? '讀取中' : '附加檔案'} aria-hidden>
                  <IconAttach />
                </span>
                <span className="visually-hidden">附加檔案</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.pptx,.txt,.md,image/*,application/pdf,text/plain"
                  multiple
                  disabled={reading || planning}
                  onChange={(event) => {
                    const list = [...(event.target.files ?? [])]
                    event.target.value = ''
                    if (!list.length) return
                    setReading(true)
                    void readUploads(list)
                      .then((result) => {
                        setChips((current) => [...current, ...result.chips])
                        setFileText((current) => (current.trim() ? `${current.trim()}\n\n${result.text}` : result.text))
                        setVisionPages((current) => [...current, ...result.visionPages])
                      })
                      .catch((error: unknown) => {
                        setChips((current) => [
                          ...current,
                          {
                            id: `err-${Date.now()}`,
                            name: list[0]?.name ?? '檔案',
                            kind: 'error',
                            detail: error instanceof Error ? error.message : '讀取失敗',
                          },
                        ])
                      })
                      .finally(() => setReading(false))
                  }}
                />
              </label>
              <span className="os-composer-spacer" />
              <IconBtn
                label={planning ? '處理中' : connected ? '傳送' : '先設定模型'}
                className="send"
                disabled={planning || !canStart}
                onClick={() => {
                  if (!connected) {
                    onSettings()
                    return
                  }
                  if (mode === 'chat') onStartChat(topic.trim(), fileText.trim(), visionPages)
                  else onStartBoard(topic.trim(), fileText.trim(), visionPages)
                }}
              >
                <IconSend />
              </IconBtn>
            </div>
          </div>

          {planError && <p className="os-error">{planError}</p>}
          <NotebookHomeSection onOpen={onOpenNotebook} onManage={onManageNotebooks} />
        </main>
      </div>
    </div>
  )
}

export function ChatHome({
  connected,
  onSettings,
  onBack,
}: {
  connected: boolean
  onSettings: () => void
  onBack: () => void
}) {
  return (
    <div className="os-page os-page-glass">
      <AppTopBar onBack={onBack} title="Chat" />
      <p className="os-muted">{connected ? '在對話頁輸入問題。' : '請先到設定接上模型。'}</p>
      {!connected && (
        <button type="button" className="os-primary" onClick={onSettings}>
          開啟設定
        </button>
      )}
    </div>
  )
}

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [settings, setSettings] = useState<AiSettings>(() => loadSettings())
  const [prefs, setPrefs] = useState<AppPreferences>(() => loadPreferences())
  const [grade, setGrade] = useState<GradeId>(() => loadGrade())
  const [saved, setSaved] = useState(false)
  const [modelChoices, setModelChoices] = useState<string[]>(() => [modelFor(loadSettings())])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsNote, setModelsNote] = useState('')
  const [voices, setVoices] = useState(() => listVoicesForSettings())
  const [tokenTotals, setTokenTotals] = useState(() => loadTokenTotals())
  const [stylus, setStylus] = useState<StylusPreferences>(() => loadStylusPreferences())
  const [customPrompts, setCustomPrompts] = useState<CustomPrompts>(() => loadCustomPrompts())
  const [settingsTab, setSettingsTab] = useState<'general' | 'model' | 'voice' | 'notebook' | 'pencil' | 'prompts'>('general')
  const current = optionFor(settings.provider)
  const provider = settings.provider
  const apiBase = settings.bases[provider]?.trim() ?? optionFor(provider).base ?? ''

  useEffect(() => {
    setTokenTotals(loadTokenTotals())
    const refresh = () => setVoices(listVoicesForSettings())
    refresh()
    if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = refresh
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = null
    }
  }, [])

  const refreshModels = useCallback(async (draft: AiSettings) => {
    if (!isConnected(draft)) {
      setModelChoices([modelFor(draft)])
      setModelsNote('先填好金鑰或局域網位址。')
      return
    }
    setModelsLoading(true)
    setModelsNote('')
    try {
      setModelChoices(await listProviderModels(draft))
    } catch {
      setModelChoices([modelFor(draft)])
      setModelsNote('未取得模型清單。')
    } finally {
      setModelsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshModels(settings)
  }, [provider, apiBase, refreshModels])

  function choose(id: ProviderId) {
    setSaved(false)
    setSettings((value) => ({ ...value, provider: id }))
  }

  function patch(partial: Partial<AiSettings> | ((value: AiSettings) => AiSettings)) {
    setSaved(false)
    setSettings((value) => (typeof partial === 'function' ? partial(value) : { ...value, ...partial }))
  }

  function saveAll() {
    saveSettings(settings)
    savePreferences(prefs)
    saveGrade(grade)
    saveStylusPreferences(stylus)
    saveCustomPrompts(customPrompts)
    setTokenTotals(loadTokenTotals())
    setSaved(true)
  }

  function patchPrompt(slot: PromptSlot, text: string) {
    setCustomPrompts((value) => ({ ...value, [slot]: text }))
    setSaved(false)
  }

  async function importPromptTxt(slot: PromptSlot, file: File) {
    const text = (await file.text()).trim()
    patchPrompt(slot, text)
  }

  function exportPromptTemplates() {
    downloadTextFile('README-提示詞說明.txt', readmePromptText(APP_VERSION))
    ;(['plan', 'chat', 'notebook', 'quiz', 'teach'] as PromptSlot[]).forEach((slot) => {
      const name =
        slot === 'plan'
          ? '備課-自訂提示詞.txt'
          : slot === 'chat'
            ? 'Chat-自訂提示詞.txt'
            : slot === 'notebook'
              ? '筆記AI-自訂提示詞.txt'
              : slot === 'quiz'
                ? '測驗-自訂提示詞.txt'
                : '講課風格-自訂提示詞.txt'
      downloadTextFile(name, customPrompts[slot].trim() || templateBody(slot))
    })
  }

  function stylusSelect(
    label: string,
    value: StylusAction,
    onChange: (action: StylusAction) => void,
  ) {
    return (
      <label className="field">
        {label}
        <select className="model-select" value={value} onChange={(event) => onChange(event.target.value as StylusAction)}>
          {(Object.keys(stylusActionLabels) as StylusAction[]).map((key) => (
            <option key={key} value={key}>
              {stylusActionLabels[key]}
            </option>
          ))}
        </select>
      </label>
    )
  }

  return (
    <div className="os-page os-page-glass">
      <div className="os-aurora" aria-hidden />
      <AppTopBar onBack={onBack} title="設定" />
      <div className="os-page-body glass-panel settings-stack">
        <div className="settings-tabs" role="tablist" aria-label="設定分類">
          {(
            [
              ['general', '一般'],
              ['model', '模型'],
              ['voice', '語音'],
              ['notebook', '筆記'],
              ['pencil', 'Pencil'],
              ['prompts', '提示詞'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={settingsTab === id}
              className={settingsTab === id ? 'on' : ''}
              onClick={() => setSettingsTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {settingsTab === 'general' && (
        <section>
          <h2>年級／程度</h2>
          <select className="model-select" value={grade} onChange={(event) => setGrade(event.target.value as GradeId)}>
            {gradeOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </section>
        )}

        {settingsTab === 'prompts' && (
        <section>
          <h2>提示詞（可匯入 txt）</h2>
          <p className="os-muted">
            白板 JSON 工具格式永遠由 App 內建，不需寫在這裡。版本 {APP_VERSION}
          </p>
          {(['plan', 'chat', 'notebook', 'quiz', 'teach'] as PromptSlot[]).map((slot) => (
            <label key={slot} className="field prompt-field">
              {promptSlotLabels[slot]}
              <textarea
                className="prompt-area"
                rows={4}
                value={customPrompts[slot]}
                placeholder="留空則只用內建規則"
                onChange={(event) => patchPrompt(slot, event.target.value)}
              />
              <label className="nb-import-pdf prompt-import">
                匯入 .txt
                <input
                  type="file"
                  accept=".txt,text/plain"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) void importPromptTxt(slot, file)
                  }}
                />
              </label>
            </label>
          ))}
          <button type="button" className="nb-plain-btn" onClick={() => setCustomPrompts(defaultCustomPrompts())}>
            清空自訂提示詞
          </button>
          <button type="button" className="nb-plain-btn" onClick={exportPromptTemplates}>
            下載範本 txt（瀏覽器）
          </button>
        </section>
        )}

        {settingsTab === 'general' && (
        <section>
          <h2>檔案上傳</h2>
          <select
            className="model-select"
            value={prefs.uploadMode}
            onChange={(event) => setPrefs({ ...prefs, uploadMode: event.target.value as UploadMode })}
          >
            {(Object.keys(uploadModeLabels) as UploadMode[]).map((key) => (
              <option key={key} value={key}>
                {uploadModeLabels[key]}
              </option>
            ))}
          </select>
        </section>
        )}

        {settingsTab === 'notebook' && (
        <section>
          <h2>筆記換頁方式</h2>
          <label className="field">
            捲動換頁
            <select
              className="model-select"
              value={prefs.notebookPageNav}
              onChange={(event) => setPrefs({ ...prefs, notebookPageNav: event.target.value as NotebookPageNav })}
            >
              <option value="vertical">上下連續捲動（預設）</option>
              <option value="horizontal">左右／按鈕換頁</option>
            </select>
          </label>
        </section>
        )}

        {settingsTab === 'pencil' && (
        <section>
          <h2>Apple Pencil 與防手掌</h2>
          <p className="os-muted">筆記本與白板螢光筆模式適用。Pencil 透過 pointerType「pen」識別。</p>
          <label className="field checkbox-line">
            <input
              type="checkbox"
              checked={stylus.palmRejection}
              onChange={(event) => setStylus({ ...stylus, palmRejection: event.target.checked })}
            />
            防手掌誤觸（書寫中忽略大面積觸控）
          </label>
          <label className="field">
            筆離開後保護 {stylus.palmRejectionMs} ms
            <input
              type="range"
              min={200}
              max={1200}
              step={50}
              value={stylus.palmRejectionMs}
              disabled={!stylus.palmRejection}
              onChange={(event) => setStylus({ ...stylus, palmRejectionMs: Number(event.target.value) })}
            />
          </label>
          <label className="field checkbox-line">
            <input
              type="checkbox"
              checked={stylus.pencilOnly}
              onChange={(event) => setStylus({ ...stylus, pencilOnly: event.target.checked })}
            />
            僅 Apple Pencil 可書寫（手指不能畫線）
          </label>
          <label className="field checkbox-line">
            <input
              type="checkbox"
              checked={stylus.pressure}
              onChange={(event) => setStylus({ ...stylus, pressure: event.target.checked })}
            />
            依壓感調整筆粗
          </label>
          {stylusSelect('側鍵 1', stylus.barrelButton1, (barrelButton1) => setStylus({ ...stylus, barrelButton1 }))}
          {stylusSelect('側鍵 2', stylus.barrelButton2, (barrelButton2) => setStylus({ ...stylus, barrelButton2 }))}
          {stylusSelect('輕點兩下（若系統有送事件）', stylus.doubleTap, (doubleTap) => setStylus({ ...stylus, doubleTap }))}
          {stylusSelect('筆尾橡皮擦', stylus.eraserEnd, (eraserEnd) => setStylus({ ...stylus, eraserEnd }))}
          <button type="button" className="nb-plain-btn" onClick={() => setStylus(defaultStylusPreferences())}>
            還原 Pencil 預設
          </button>
        </section>
        )}

        {settingsTab === 'voice' && (
        <section>
          <h2>語音</h2>
          <label className="field">
            語速 {prefs.ttsRate.toFixed(2)}
            <input
              type="range"
              min={0.7}
              max={1.2}
              step={0.02}
              value={prefs.ttsRate}
              onChange={(event) => setPrefs({ ...prefs, ttsRate: Number(event.target.value) })}
            />
          </label>
          <label className="field">
            音調 {prefs.ttsPitch.toFixed(2)}
            <input
              type="range"
              min={0.8}
              max={1.2}
              step={0.02}
              value={prefs.ttsPitch}
              onChange={(event) => setPrefs({ ...prefs, ttsPitch: Number(event.target.value) })}
            />
          </label>
          <label className="field">
            音色
            <select className="model-select" value={prefs.ttsVoice} onChange={(event) => setPrefs({ ...prefs, ttsVoice: event.target.value })}>
              <option value="">系統預設</option>
              {voices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.label}
                </option>
              ))}
            </select>
          </label>
        </section>
        )}

        {settingsTab === 'general' && (
        <section>
          <h2>Token 用量（本機累計）</h2>
          <p className="os-muted">
            輸入（prompt）<strong>{tokenTotals.prompt.toLocaleString()}</strong> · 輸出（completion）
            <strong> {tokenTotals.completion.toLocaleString()}</strong> · 共 {tokenTotals.calls} 次呼叫
          </p>
          <p className="os-muted">有回傳 usage 時用 API 數字；否則以字數估算。</p>
          <button
            type="button"
            className="nb-plain-btn"
            onClick={() => {
              resetTokenTotals()
              setTokenTotals(loadTokenTotals())
            }}
          >
            歸零統計
          </button>
        </section>
        )}

        {settingsTab === 'model' && (
        <section>
          <h2>模型與 API</h2>
          <p className="os-muted">金鑰只留在本機 · Grok 必留</p>
          <div className="provider-list os-providers">
            {providerOptions.map((option) => (
              <label key={option.id} className={option.id === settings.provider ? 'provider selected' : 'provider'}>
                <input type="radio" name="provider" checked={option.id === settings.provider} onChange={() => choose(option.id)} />
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
                onBlur={() => void refreshModels(settings)}
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
              onBlur={() => void refreshModels(settings)}
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
              <IconBtn label="重新取得模型" disabled={modelsLoading || !isConnected(settings)} onClick={() => void refreshModels(settings)}>
                <IconRefresh />
              </IconBtn>
            </div>
          </label>
          {modelsLoading && <p className="os-muted">正在取得模型…</p>}
          {modelsNote && <p className="os-muted">{modelsNote}</p>}
        </section>
        )}

        <IconBtn label="儲存設定" className="save-wide" onClick={saveAll}>
          <IconSave />
        </IconBtn>
        {saved && (
          <p className="os-muted">
            已儲存 · 年級 {gradeLabel(grade)} · {current.name}
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
      <AppTopBar onBack={onBack} title={title} />
      <div className="os-page-body glass-panel">
        <h1 className="os-page-title">{title}</h1>
        {children}
      </div>
    </div>
  )
}