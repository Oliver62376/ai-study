import Foundation

enum WebLocalStorageBridge {
    /// 將原生設定注入 Web 教室用的 localStorage（與 Web App 鍵名一致）
    static func injectionScript() -> String {
        var lines = ["(function(){try{window.__AI_STUDY_EMBEDDED__=true;"]
        lines.append(jsSetB64("ai-study-provider-v1", providerJSON()))
        lines.append(jsSetB64("ai-study-prefs-v1", jsonString(AppPreferencesStore.preferences) ?? "{}"))
        lines.append(jsSetB64("ai-study-stylus-v1", jsonString(StylusPreferencesStore.preferences) ?? "{}"))
        lines.append(jsSetB64("ai-study-custom-prompts-v1", jsonString(CustomPromptsStore.prompts) ?? "{}"))
        if let memory = UserDefaults.standard.string(forKey: "ai-study-memory-v1"), !memory.isEmpty {
            lines.append(jsSetB64("ai-study-memory-v1", memory))
        }
        lines.append("localStorage.setItem('ai-study-grade-v1','\(GradeStore.grade.rawValue)');")
        lines.append("}catch(e){console.error('native storage bridge',e);}})();")
        return lines.joined()
    }

    static func bootScript(topic: String, fileText: String, lessonId: String, snapshotJSON: String?) -> String {
        var payload: [String: Any] = [
            "topic": topic,
            "fileText": fileText,
            "lessonId": lessonId,
        ]
        if let snapshotJSON,
           let data = snapshotJSON.data(using: .utf8),
           let snap = try? JSONSerialization.jsonObject(with: data) {
            payload["snapshot"] = snap
        }
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else {
            return ""
        }
        return "window.aiStudyNativeBoot = \(json);"
    }

    private static func jsSetB64(_ key: String, _ json: String) -> String {
        let b64 = Data(json.utf8).base64EncodedString()
        return "localStorage.setItem('\(key)',atob('\(b64)'));"
    }

    private static func providerJSON() -> String {
        let blob = ProviderSettingsStore.shared.blob
        guard let data = try? JSONEncoder().encode(blob),
              let str = String(data: data, encoding: .utf8) else {
            return "{}"
        }
        return str
    }

    private static func jsonString<T: Encodable>(_ value: T) -> String? {
        guard let data = try? JSONEncoder().encode(value) else { return nil }
        return String(data: data, encoding: .utf8)
    }
}