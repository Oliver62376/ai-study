import { loadPreferences } from './preferences'

type PartialResults = { matches?: string[] }

export function listVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return []
  return window.speechSynthesis.getVoices().filter((voice) => /zh|cmn|yue|tw|hk/i.test(`${voice.lang}${voice.name}`))
}

export function speak(text: string, onend: () => void, fast: boolean) {
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

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-TW'
    utterance.rate = prefs.ttsRate
    utterance.pitch = prefs.ttsPitch
    const voices = listVoices()
    const picked = voices.find((voice) => voice.voiceURI === prefs.ttsVoice) ?? voices[0]
    if (picked) utterance.voice = picked

    const fallback = window.setTimeout(finish, Math.min(90000, 5000 + text.length * 200))

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
  })()

  return () => {
    settled = true
    cancel()
  }
}

export async function listen(onText: (text: string) => void): Promise<() => void> {
  const { Capacitor } = await import('@capacitor/core')
  if (Capacitor.isNativePlatform()) {
    const { SpeechRecognition } = await import('@capacitor-community/speech-recognition')
    const permission = await SpeechRecognition.requestPermissions()
    if (permission.speechRecognition !== 'granted') {
      throw new Error('denied')
    }
    const handle = await SpeechRecognition.addListener('partialResults', (data: PartialResults) => {
      const match = data.matches?.[0]
      if (match) onText(match)
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
  }
  rec.start()
  return () => rec.stop()
}

interface WebSpeech {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  start: () => void
  stop: () => void
}