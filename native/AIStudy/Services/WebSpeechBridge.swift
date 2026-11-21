import AVFoundation
import WebKit

/// WKWebView 內嵌 Web 教室：用系統 TTS 取代常失效的 speechSynthesis。
final class WebSpeechBridge: NSObject, WKScriptMessageHandler, AVSpeechSynthesizerDelegate {
    weak var webView: WKWebView?
    private let synth = AVSpeechSynthesizer()

    override init() {
        super.init()
        synth.delegate = self
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        switch message.name {
        case "aiStudyTTS":
            guard let body = message.body as? [String: Any],
                  let text = body["text"] as? String, !text.isEmpty else { return }
            let prefs = AppPreferencesStore.preferences
            let utterance = AVSpeechUtterance(string: text)
            utterance.rate = Float(prefs.ttsRate) * AVSpeechUtteranceDefaultSpeechRate
            utterance.pitchMultiplier = Float(prefs.ttsPitch)
            if !prefs.ttsVoice.isEmpty,
               let voice = AVSpeechSynthesisVoice(identifier: prefs.ttsVoice) {
                utterance.voice = voice
            } else if let zh = AVSpeechSynthesisVoice(language: "zh-TW") {
                utterance.voice = zh
            }
            synth.stopSpeaking(at: .immediate)
            synth.speak(utterance)
        case "aiStudyTTSStop":
            synth.stopSpeaking(at: .immediate)
        default:
            break
        }
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        webView?.evaluateJavaScript("window.__aiStudyTTSOnEnd && window.__aiStudyTTSOnEnd()")
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        webView?.evaluateJavaScript("window.__aiStudyTTSOnEnd && window.__aiStudyTTSOnEnd()")
    }
}