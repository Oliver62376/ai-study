type PartialResults = { matches?: string[] }

export function speak(text: string, onend: () => void, fast: boolean) {
  if (fast || typeof window === 'undefined' || !('speechSynthesis' in window)) {
    const timer = window.setTimeout(onend, fast ? 40 : 700)
    return () => window.clearTimeout(timer)
  }

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-TW'
  utterance.rate = 0.96
  let settled = false
  const timer = window.setTimeout(finish, Math.min(18000, 2400 + text.length * 120))

  function finish() {
    if (settled) return
    settled = true
    window.clearTimeout(timer)
    onend()
  }

  utterance.onend = finish
  utterance.onerror = finish
  window.speechSynthesis.cancel()
  window.speechSynthesis.resume()
  window.speechSynthesis.speak(utterance)

  return () => {
    settled = true
    window.clearTimeout(timer)
    window.speechSynthesis.cancel()
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
  rec.continuous = false
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
