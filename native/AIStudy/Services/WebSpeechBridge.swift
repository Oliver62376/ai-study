import AVFoundation
import WebKit

/// WKWebView 內嵌 Web 教室：用系統 TTS 取代常失效的 speechSynthesis。
final class WebSpeechBridge: NSObject, WKScriptMessageHandler, AVSpeechSynthesizerDelegate {
    weak var webView: WKWebView?
    private let synth = AVSpeechSynthesizer()
    private var notifyEndOnFinish = true

    override init() {
        super.init()
        synth.delegate = self
    }

    private func prepareAudioSession() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers, .defaultToSpeaker])
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            NSLog("WebSpeechBridge audio session: \(error.localizedDescription)")
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        switch message.name {
        case "aiStudyTTS":
            guard let body = message.body as? [String: Any],
                  let text = body["text"] as? String, !text.isEmpty else { return }
            prepareAudioSession()
            let prefs = AppPreferencesStore.preferences
            let utterance = AVSpeechUtterance(string: text)
            let rateFactor = Float(prefs.ttsRate)
            utterance.rate = min(
                AVSpeechUtteranceMaximumSpeechRate,
                max(AVSpeechUtteranceMinimumSpeechRate, AVSpeechUtteranceDefaultSpeechRate * rateFactor)
            )
            utterance.pitchMultiplier = Float(min(2, max(0.5, prefs.ttsPitch)))
            utterance.volume = 1
            utterance.prefersAssistiveTechnologySettings = false
            if !prefs.ttsVoice.isEmpty,
               let voice = AVSpeechSynthesisVoice(identifier: prefs.ttsVoice) {
                utterance.voice = voice
            } else if let zh = AVSpeechSynthesisVoice(language: "zh-TW")
                ?? AVSpeechSynthesisVoice(language: "zh-HK")
                ?? AVSpeechSynthesisVoice(language: "zh-CN") {
                utterance.voice = zh
            }
            notifyEndOnFinish = true
            if synth.isSpeaking {
                notifyEndOnFinish = false
                synth.stopSpeaking(at: .immediate)
            }
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                self.notifyEndOnFinish = true
                self.synth.speak(utterance)
            }
        case "aiStudyTTSStop":
            notifyEndOnFinish = false
            synth.stopSpeaking(at: .immediate)
            notifyWebSpeakEnded()
        default:
            break
        }
    }

    private func notifyWebSpeakEnded() {
        webView?.evaluateJavaScript("window.__aiStudyTTSOnEnd && window.__aiStudyTTSOnEnd()")
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        guard notifyEndOnFinish else { return }
        notifyWebSpeakEnded()
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        // stopSpeaking 會觸發 cancel；勿通知 Web，否則多句朗讀會亂序或無聲
    }
}