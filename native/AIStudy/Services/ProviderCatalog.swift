import Foundation

enum ProviderId: String, CaseIterable, Identifiable, Codable {
    case official, grok, openai, gemini, claude, deepseek, groq, mistral, lan

    var id: String { rawValue }

    var title: String {
        switch self {
        case .official: "官方 API"
        case .grok: "Grok"
        case .openai: "OpenAI"
        case .gemini: "Gemini"
        case .claude: "Claude"
        case .deepseek: "DeepSeek"
        case .groq: "Groq"
        case .mistral: "Mistral"
        case .lan: "局域網"
        }
    }

    var defaultModel: String {
        switch self {
        case .official: "gemini-2.5-flash"
        case .grok: "grok-4.7"
        case .openai: "gpt-4.1"
        case .gemini: "gemini-2.5-flash"
        case .claude: "claude-sonnet-4-5"
        case .deepseek: "deepseek-chat"
        case .groq: "llama-3.3-70b-versatile"
        case .mistral: "mistral-small-latest"
        case .lan: "qwen2.5"
        }
    }

    var defaultBase: String {
        switch self {
        case .official: GatewayConfig.baseURL
        case .grok: "https://api.x.ai/v1"
        case .openai: "https://api.openai.com/v1"
        case .gemini: "https://generativelanguage.googleapis.com/v1beta"
        case .claude: "https://api.anthropic.com/v1"
        case .deepseek: "https://api.deepseek.com/v1"
        case .groq: "https://api.groq.com/openai/v1"
        case .mistral: "https://api.mistral.ai/v1"
        case .lan: "http://127.0.0.1:11434/v1"
        }
    }

    var hint: String {
        switch self {
        case .official: "填入啟用碼即可，不需自備 API 金鑰。用量見「用量」分頁。"
        case .grok: "xAI。這個選項會一直留在設定裡。"
        case .lan: "區網 OpenAI 相容服務，例如 Ollama、LM Studio。填位址即可，金鑰可留空。"
        default: "填入 API 金鑰後，可從下拉選預設模型。"
        }
    }

    var isLocal: Bool { self == .lan }

    var isOfficial: Bool { self == .official }

    var isRequired: Bool { self == .grok }
}

struct AiSettingsBlob: Codable {
    var provider: ProviderId = .grok
    var keys: [String: String] = [:]
    var models: [String: String] = [:]
    var bases: [String: String] = [:]
}

@Observable
final class ProviderSettingsStore {
    static let shared = ProviderSettingsStore()
    private let key = "ai-study-provider-v1"

    var blob: AiSettingsBlob {
        didSet { persist() }
    }

    private init() {
        if let data = UserDefaults.standard.data(forKey: key),
           let decoded = try? JSONDecoder().decode(AiSettingsBlob.self, from: data) {
            blob = decoded
        } else {
            blob = AiSettingsBlob()
        }
    }

    func persist() {
        guard let data = try? JSONEncoder().encode(blob) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }

    var activeProvider: ProviderId {
        get { blob.provider }
        set { blob.provider = newValue }
    }

    func key(for provider: ProviderId) -> String {
        blob.keys[provider.rawValue] ?? ""
    }

    func setKey(_ value: String, for provider: ProviderId) {
        blob.keys[provider.rawValue] = value
        persist()
    }

    func model(for provider: ProviderId) -> String {
        blob.models[provider.rawValue] ?? provider.defaultModel
    }

    func setModel(_ value: String, for provider: ProviderId) {
        blob.models[provider.rawValue] = value
        persist()
    }

    func base(for provider: ProviderId) -> String {
        blob.bases[provider.rawValue] ?? provider.defaultBase
    }

    func setBase(_ value: String, for provider: ProviderId) {
        blob.bases[provider.rawValue] = value
        persist()
    }

    var isConnected: Bool {
        isConnected(for: activeProvider)
    }

    func activationCode() -> String {
        key(for: .official).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    func isConnected(for provider: ProviderId) -> Bool {
        if provider.isOfficial {
            return GatewayConfig.ready(activationCode: activationCode())
        }
        if provider.isLocal {
            return !base(for: provider).trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
        return !key(for: provider).trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}