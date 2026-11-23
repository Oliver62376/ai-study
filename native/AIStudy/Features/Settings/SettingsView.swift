import AVFAudio
import SwiftUI
import UniformTypeIdentifiers

private enum SettingsTab: String, CaseIterable, Identifiable {
    case general, model, usage, voice, notebook, pencil, prompts, memory

    var id: String { rawValue }

    var title: String {
        switch self {
        case .general: "一般"
        case .model: "模型"
        case .usage: "用量"
        case .voice: "語音"
        case .notebook: "筆記"
        case .pencil: "Pencil"
        case .prompts: "提示詞"
        case .memory: "記憶庫"
        }
    }
}

struct SettingsView: View {
    @Bindable private var providers = ProviderSettingsStore.shared
    @State private var tab: SettingsTab = .model
    @State private var trashDays = TrashRetentionStore.retentionDays
    @State private var savedFlash = false
    @State private var grade = GradeStore.grade
    @State private var pomodoro = PomodoroSettingsStore.settings
    @State private var prefs = AppPreferencesStore.preferences
    @State private var stylus = StylusPreferencesStore.preferences
    @State private var customPrompts = CustomPromptsStore.prompts
    @State private var showPomodoroSheet = false
    @State private var promptImportSlot: PromptSlot?
    @State private var showPromptImport = false

    private var current: ProviderId { providers.activeProvider }
    private var voices: [(id: String, label: String)] {
        AVSpeechSynthesisVoice.speechVoices()
            .filter { $0.language.hasPrefix("zh") || $0.language.hasPrefix("en") }
            .map { ($0.identifier, "\($0.name) · \($0.language)") }
            .sorted { $0.label < $1.label }
    }

    var body: some View {
        VStack(spacing: 0) {
            Picker("分類", selection: $tab) {
                ForEach(SettingsTab.allCases) { item in
                    Text(item.title).tag(item)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)
            .padding(.top, 8)
            .padding(.bottom, 4)

            List {
                switch tab {
                case .general:
                    generalTab
                case .model:
                    modelTab
                case .usage:
                    usageTab
                case .voice:
                    voiceTab
                case .notebook:
                    notebookTab
                case .pencil:
                    pencilTab
                case .prompts:
                    promptsTab
                case .memory:
                    memoryTab
                }
            }
            .listStyle(.insetGrouped)
        }
        .navigationTitle("設定")
        .navigationBarTitleDisplayMode(.inline)
        .onDisappear { persistAll() }
        .sheet(isPresented: $showPomodoroSheet) {
            PomodoroView()
        }
        .fileImporter(
            isPresented: $showPromptImport,
            allowedContentTypes: [.plainText, .utf8PlainText, .text],
            allowsMultipleSelection: false
        ) { result in
            guard let slot = promptImportSlot else { return }
            if case let .success(urls) = result, let url = urls.first,
               let text = try? String(contentsOf: url, encoding: .utf8) {
                customPrompts[slot] = text
            }
            promptImportSlot = nil
        }
    }

  private func persistAll() {
        TrashRetentionStore.retentionDays = trashDays
        GradeStore.grade = grade
        PomodoroSettingsStore.settings = pomodoro
        AppPreferencesStore.preferences = prefs
        StylusPreferencesStore.preferences = stylus
        CustomPromptsStore.prompts = customPrompts
    }

    @ViewBuilder
    private var generalTab: some View {
        Section("年級／程度") {
            Picker("年級", selection: $grade) {
                ForEach(GradeId.allCases) { item in
                    Text(item.label).tag(item)
                }
            }
        }
        Section("檔案上傳") {
            Picker("處理方式", selection: $prefs.uploadMode) {
                ForEach(UploadMode.allCases) { mode in
                    Text(mode.label).tag(mode)
                }
            }
        }
        Section("番茄鐘") {
            Stepper("專注 \(pomodoro.workMinutes) 分", value: $pomodoro.workMinutes, in: 5 ... 90, step: 5)
            Stepper("短休 \(pomodoro.shortBreakMinutes) 分", value: $pomodoro.shortBreakMinutes, in: 1 ... 30)
            Stepper("長休 \(pomodoro.longBreakMinutes) 分", value: $pomodoro.longBreakMinutes, in: 5 ... 45, step: 5)
            Toggle("專注結束自動休息", isOn: $pomodoro.autoStartBreaks)
            Button("開啟番茄鐘計時器") { showPomodoroSheet = true }
        }
        Section("回收桶") {
            Stepper(value: $trashDays, in: 1 ... 365) {
                Text("保留 \(trashDays) 天")
            }
        }
        Section("關於") {
            LabeledContent("版本", value: "0.3.9-beta")
            LabeledContent("平台", value: "iPadOS 17+ · 26+ 系統液態玻璃")
        }
    }

    @ViewBuilder
    private var modelTab: some View {
        Section {
            Text("金鑰只留在本機 · Grok 必留")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }

        Section("供應商") {
            Picker("使用中的供應商", selection: $providers.activeProvider) {
                ForEach(ProviderId.allCases) { provider in
                    Text(provider.title).tag(provider)
                }
            }
            ForEach(ProviderId.allCases) { provider in
                if provider.isRequired {
                    Label("\(provider.title) 為必備", systemImage: "exclamationmark.circle")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }

        Section(current.title) {
            Text(current.hint)
                .font(.footnote)
                .foregroundStyle(.secondary)

            if current.isLocal {
                TextField("服務位址", text: bindingBase(current))
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }

            if current.isOfficial {
                TextField("啟用碼", text: bindingKey(.official))
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            } else {
                SecureField(current.isLocal ? "API 金鑰（可留空）" : "API 金鑰", text: bindingKey(current))
                    .textContentType(.password)
            }

            ModelPickerField(providers: providers, provider: current)

            LabeledContent("連線", value: providers.isConnected(for: current) ? "可用" : "未設定")
        }

        Section {
            if savedFlash {
                Text("已儲存")
                    .foregroundStyle(.green)
            }
            Button("儲存模型設定") {
                providers.persist()
                savedFlash = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { savedFlash = false }
            }
        }
    }

    @ViewBuilder
    private var usageTab: some View {
        if providers.activeProvider.isOfficial {
            Section {
                Text("數字來自 Gateway 的 gateway_quota（每日 token、請求次數等）。")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            if let state = GatewayQuotaStore.load() {
                let quota = state.quota
                if quota.remaining_tokens >= 0 {
                    UsageQuotaRow(label: "今日剩餘 Token", remaining: quota.remaining_tokens, cap: state.caps.tokens_day)
                }
                if quota.remaining_requests_day >= 0 {
                    UsageQuotaRow(label: "今日剩餘請求", remaining: quota.remaining_requests_day, cap: state.caps.requests_day)
                }
                if quota.remaining_requests_minute >= 0 {
                    UsageQuotaRow(label: "本分鐘剩餘請求", remaining: quota.remaining_requests_minute, cap: state.caps.requests_minute)
                }
                Section {
                    Button("清除用量快取", role: .destructive) { GatewayQuotaStore.clear() }
                }
            } else {
                Section { Text("尚無資料。請先以啟用碼成功呼叫模型。").foregroundStyle(.secondary) }
            }
        } else {
            Section {
                Text("使用自備 API 時，Token 用量由 Web 教室設定頁的圖表顯示；原生 Chat／筆記 AI 也會累計 API usage。")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private var voiceTab: some View {
        Section {
            Text("語速、音調與 TTS 音色（與 Web 語音分頁對齊）。")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        Section("語音") {
            LabeledContent("語速", value: String(format: "%.2f", prefs.ttsRate))
            Slider(value: $prefs.ttsRate, in: 0.55 ... 1.1, step: 0.02)
            LabeledContent("音調", value: String(format: "%.2f", prefs.ttsPitch))
            Slider(value: $prefs.ttsPitch, in: 0.8 ... 1.2, step: 0.02)
            Picker("音色", selection: $prefs.ttsVoice) {
                Text("系統預設").tag("")
                ForEach(voices, id: \.id) { voice in
                    Text(voice.label).tag(voice.id)
                }
            }
            Toggle("語音辨識後自動送出", isOn: $prefs.voiceAutoSend)
        }
        Section("白板教室") {
            Toggle("雷射筆", isOn: $prefs.laserEnabled)
            Stepper("雷射大小 \(prefs.laserSizePx) px", value: $prefs.laserSizePx, in: 10 ... 42)
            Stepper("每句停頓 \(prefs.pauseAfterSentenceMs) ms", value: $prefs.pauseAfterSentenceMs, in: 0 ... 4000, step: 100)
            Stepper("換頁停頓 \(prefs.pauseOnPageTurnMs) ms", value: $prefs.pauseOnPageTurnMs, in: 0 ... 6000, step: 100)
            Picker("右側預設面板", selection: $prefs.materialPanel) {
                ForEach(MaterialPanelMode.allCases) { mode in
                    Text(mode.label).tag(mode)
                }
            }
        }
    }

    @ViewBuilder
    private var notebookTab: some View {
        Section {
            Text("筆記換頁與捲動偏好。")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        Section("筆記換頁方式") {
            Picker("捲動換頁", selection: $prefs.notebookPageNav) {
                ForEach(NotebookPageNav.allCases) { nav in
                    Text(nav.label).tag(nav)
                }
            }
        }
    }

    @ViewBuilder
    private var pencilTab: some View {
        Section {
            Text("筆記本與白板適用。Pencil 透過 pointerType「pen」識別。")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        Section("Apple Pencil 與防手掌") {
            Toggle("防手掌誤觸", isOn: $stylus.palmRejection)
            Stepper("筆離開後保護 \(stylus.palmRejectionMs) ms", value: $stylus.palmRejectionMs, in: 200 ... 1200, step: 50)
                .disabled(!stylus.palmRejection)
            Toggle("僅 Apple Pencil 可書寫", isOn: $stylus.pencilOnly)
            Toggle("依壓感調整筆粗", isOn: $stylus.pressure)
        }
        Section("側鍵與手勢") {
            stylusPicker("側鍵 1", selection: $stylus.barrelButton1)
            stylusPicker("側鍵 2", selection: $stylus.barrelButton2)
            stylusPicker("輕點兩下", selection: $stylus.doubleTap)
            stylusPicker("筆尾橡皮擦", selection: $stylus.eraserEnd)
            Button("還原 Pencil 預設") {
                stylus = .default
            }
        }
    }

    @ViewBuilder
    private func stylusPicker(_ title: String, selection: Binding<StylusAction>) -> some View {
        Picker(title, selection: selection) {
            ForEach(StylusAction.allCases) { action in
                Text(action.label).tag(action)
            }
        }
    }

    @ViewBuilder
    private var memoryTab: some View {
        Section {
            Text("記憶庫存在本機，備課／講課／Chat 會自動引用。在白板教室內可開「設定 → 記憶庫」編輯；上課後會自動累積課程、問答與 SVG 教學意圖。")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        Section("同步狀態") {
            let raw = UserDefaults.standard.string(forKey: "ai-study-memory-v1") ?? ""
            LabeledContent(
                "條目數",
                value: raw.isEmpty ? "尚無" : String(MemoryEntryCount.decode(from: raw))
            )
        }
    }

    @ViewBuilder
    private var promptsTab: some View {
        Section {
            Text("白板 JSON 工具格式永遠由 App 內建。留空則只用內建規則。")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        ForEach(PromptSlot.allCases) { slot in
            Section(slot.label) {
                TextEditor(text: bindingPrompt(slot))
                    .frame(minHeight: 88)
                Button("匯入 .txt") {
                    promptImportSlot = slot
                    showPromptImport = true
                }
            }
        }
        Section {
            Button("清空自訂提示詞", role: .destructive) {
                customPrompts = .default
            }
        }
    }

    private func bindingPrompt(_ slot: PromptSlot) -> Binding<String> {
        Binding(
            get: { customPrompts[slot] },
            set: { customPrompts[slot] = $0 }
        )
    }

    private func bindingKey(_ provider: ProviderId) -> Binding<String> {
        Binding(
            get: { providers.key(for: provider) },
            set: { providers.setKey($0, for: provider) }
        )
    }

    private func bindingBase(_ provider: ProviderId) -> Binding<String> {
        Binding(
            get: { providers.base(for: provider) },
            set: { providers.setBase($0, for: provider) }
        )
    }
}

private struct UsageQuotaRow: View {
    let label: String
    let remaining: Int
    let cap: Int?

    private var percentUsed: Int {
        guard let cap, cap > 0 else { return remaining <= 0 ? 100 : 0 }
        let used = max(0, cap - remaining)
        return min(100, Int((Double(used) / Double(cap)) * 100))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.footnote)
                .foregroundStyle(.secondary)
            Text("\(percentUsed)% 已使用")
                .font(.title2.weight(.semibold))
            ProgressView(value: Double(percentUsed), total: 100)
                .tint(.blue)
            if let cap, cap > 0 {
                Text("剩餘 \(remaining.formatted()) / 約 \(cap.formatted())")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                Text("剩餘 \(remaining.formatted())")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

private enum MemoryEntryCount {
    static func decode(from raw: String) -> Int {
        guard let data = raw.data(using: .utf8),
              let list = try? JSONDecoder().decode([MemoryRow].self, from: data) else { return 0 }
        return list.count
    }

    private struct MemoryRow: Decodable {
        var id: String?
    }
}