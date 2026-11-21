import { loadPreferences } from './preferences'

type PartialResults = { matches?: string[] }

declare global {
  interface Window {
    __AI_STUDY_EMBEDDED__?: boolean
    __aiStudyTTSOnEnd?: () => void
    webkit?: {
      messageHandlers?: {
        aiStudyTTS?: { postMessage: (body: unknown) => void }
        aiStudyTTSStop?: { postMessage: (body: unknown) => void }
      }
    }
  }
}

function isEmbeddedNativeWebView() {
  return Boolean(window.__AI_STUDY_EMBEDDED__ && window.webkit?.messageHandlers?.aiStudyTTS)
}

export function listVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return []
  return window.speechSynthesis.getVoices().filter((voice) => /zh|cmn|yue|tw|hk/i.test(`${voice.lang}${voice.name}`))
}

function splitSentences(text: string) {
  const parts = text.split(/(?<=[。！？；\n])/g).map((s) => s.trim()).filter(Boolean)
  return parts.length ? parts : [text]
}

function speakOnce(text: string, onend: () => void, fast: boolean) {
  if (fast) {
    const timer = window.setTimeout(onend, 80)
    return () => window.clearTimeout(timer)
  }

  let settled = false
  let cancel: () => void = () => {}

  const finish = () => {
    if (settled) return
    settled = true
    onend()
  }

  void (async () => {
    const prefs = loadPreferences()

    if (isEmbeddedNativeWebView()) {
      window.__aiStudyTTSOnEnd = finish
      window.webkit!.messageHandlers!.aiStudyTTS!.postMessage({
        text,
        rate: prefs.ttsRate,
        pitch: prefs.ttsPitch,
        voice: prefs.ttsVoice,
      })
      cancel = () => {
        settled = true
        window.webkit?.messageHandlers?.aiStudyTTSStop?.postMessage({})
      }
      return
    }

    const { Capacitor } = await import('@capacitor/core')
    if (Capacitor.isNativePlatform()) {
      try {
        const { TextToSpeech } = await import('@capacitor-community/text-to-speech')
        await TextToSpeech.stop()
        await TextToSpeech.speak({
          text,
          lang: 'zh-TW',
          rate: prefs.ttsRate,
          pitch: prefs.ttsPitch,
        })
        finish()
        cancel = () => void TextToSpeech.stop()
        return
      } catch {
        /* web fallback */
      }
    }

    if (typeof globalThis.window === 'undefined' || !('speechSynthesis' in globalThis.window)) {
      const timer = globalThis.setTimeout(finish, Math.min(12000, 900 + text.length * 130))
      cancel = () => globalThis.clearTimeout(timer)
      return
    }

    const bootVoices = () => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'zh-TW'
      utterance.rate = Math.min(1, Math.max(0.5, prefs.ttsRate))
      utterance.pitch = prefs.ttsPitch
      const voices = listVoices()
      const picked = voices.find((voice) => voice.voiceURI === prefs.ttsVoice) ?? voices[0]
      if (picked) utterance.voice = picked

      const fallback = window.setTimeout(finish, Math.min(90000, 5000 + text.length * 220))
      utterance.onend = () => {
        window.clearTimeout(fallback)
        finish()
      }
      utterance.onerror = () => {
        window.clearTimeout(fallback)
        finish()
      }
      window.speechSynthesis.cancel()
      window.speechSynthesis.resume()
      window.speechSynthesis.speak(utterance)
      cancel = () => {
        settled = true
        window.clearTimeout(fallback)
        window.speechSynthesis.cancel()
      }
    }

    const voices = window.speechSynthesis.getVoices()
    if (voices.length) bootVoices()
    else {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null
        bootVoices()
      }
      window.setTimeout(bootVoices, 120)
    }
  })()

  return () => {
    settled = true
    cancel()
  }
}

export function speak(text: string, onend: () => void, fast: boolean) {
  if (fast) return speakOnce(text, onend, true)

  const prefs = loadPreferences()
  const chunks = splitSentences(text)
  const gap = prefs.pauseAfterSentenceMs ?? 1500
  if (chunks.length <= 1) return speakOnce(text, onend, false)

  let index = 0
  let currentCancel = () => {}
  let closed = false

  const step = () => {
    if (closed) return
    if (index >= chunks.length) {
      onend()
      return
    }
    const chunk = chunks[index++]!
    currentCancel = speakOnce(chunk, () => {
      window.setTimeout(step, gap)
    }, false)
  }

  step()

  return () => {
    closed = true
    currentCancel()
  }
}

export async function listen(
  onText: (text: string) => void,
  options?: { onFinal?: (text: string) => void },
): Promise<() => void> {
  const prefs = loadPreferences()
  const { Capacitor } = await import('@capacitor/core')
  if (Capacitor.isNativePlatform()) {
    const { SpeechRecognition } = await import('@capacitor-community/speech-recognition')
    const permission = await SpeechRecognition.requestPermissions()
    if (permission.speechRecognition !== 'granted') {
      throw new Error('denied')
    }
    let last = ''
    const handle = await SpeechRecognition.addListener('partialResults', (data: PartialResults) => {
      const match = data.matches?.[0]
      if (match) {
        last = match
        onText(match)
      }
    })
    await SpeechRecognition.start({
      language: 'zh-TW',
      partialResults: true,
      popup: false,
      maxResults: 1,
    })
    return async () => {
      await SpeechRecognition.stop()
      await handle.remove()
      if (prefs.voiceAutoSend && last.trim()) options?.onFinal?.(last.trim())
    }
  }

  const w = window as Window & {
    SpeechRecognition?: new () => WebSpeech
    webkitSpeechRecognition?: new () => WebSpeech
  }
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!Ctor) throw new Error('unsupported')
  const rec = new Ctor()
  rec.lang = 'zh-TW'
  rec.interimResults = true
  rec.continuous = true
  rec.onresult = (event) => {
    const text = Array.from(event.results)
      .map((result) => result[0]?.transcript ?? '')
      .join('')
    if (text) onText(text)
    const last = event.results[event.results.length - 1]
    if (prefs.voiceAutoSend && last?.isFinal) {
      const finalText = last[0]?.transcript?.trim()
      if (finalText) options?.onFinal?.(finalText)
    }
  }
  rec.start()
  return () => rec.stop()
}

interface WebSpeechResult {
  0?: { transcript: string }
  isFinal?: boolean
}

interface WebSpeech {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: { results: ArrayLike<WebSpeechResult> }) => void) | null
  start: () => void
  stop: () => void
}