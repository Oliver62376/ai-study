import SwiftUI

private enum SettingsTab: String, CaseIterable, Identifiable {
    case general, model, voice, notebook, pencil, prompts

    var id: String { rawValue }

    var title: String {
        switch self {
        case .general: "一般"
        case .model: "模型"
        case .voice: "語音"
        case .notebook: "筆記"
        case .pencil: "Pencil"
        case .prompts: "提示詞"
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
    @State private var showPomodoroSheet = false

    private var current: ProviderId { providers.activeProvider }

    var body: some View {
        VStack(spacing: 0) {
            Picker("分類", selection: $tab) {
                ForEach(SettingsTab.allCases) { item in
                    Text(item.title).tag(item)
                }
            }
            .pickerStyle(.segmented)
            .padding()

            Form {
                switch tab {
                case .general:
                    generalTab
                case .model:
                    modelTab
                case .voice:
                    placeholderTab("語音", "語速、音調與 TTS 音色（對齊 Web 語音分頁）。")
                case .notebook:
                    placeholderTab("筆記", "換頁方式與筆記相關偏好。")
                case .pencil:
                    placeholderTab("Apple Pencil", "防手掌、側鍵映射與筆壓選項。")
                case .prompts:
                    placeholderTab("提示詞", "可匯入 txt 的各場景自訂提示詞。")
                }
            }
        }
        .navigationTitle("設定")
        .onDisappear {
            TrashRetentionStore.retentionDays = trashDays
            GradeStore.grade = grade
            PomodoroSettingsStore.settings = pomodoro
        }
        .sheet(isPresented: $showPomodoroSheet) {
            PomodoroView()
        }
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
            LabeledContent("版本", value: "0.2.9-beta")
            LabeledContent("平台", value: "iPadOS 17+")
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
            ForEach(ProviderId.allCases) { provider in
                Button {
                    providers.activeProvider = provider
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 6) {
                                Text(provider.title)
                                    .font(.headline)
                                if provider.isRequired {
                                    Text("必備")
                                        .font(.caption2)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Color.orange.opacity(0.2))
                                        .clipShape(Capsule())
                                }
                            }
                            if providers.activeProvider == provider {
                                Text(provider.hint)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        if providers.activeProvider == provider {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(Color.accentColor)
                        }
                    }
                }
                .buttonStyle(.plain)
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

            SecureField(current.isLocal ? "API 金鑰（可留空）" : "API 金鑰", text: bindingKey(current))
                .textContentType(.password)

            ModelPickerField(providers: providers, provider: current)

            LabeledContent("連線", value: providers.isConnected(for: current) ? "可用" : "未設定")
        }

        Section {
            if savedFlash {
                Text("已儲存")
                    .foregroundStyle(.green)
            }
            Button("儲存設定") {
                providers.persist()
                savedFlash = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { savedFlash = false }
            }
        }
    }

    private func placeholderTab(_ title: String, _ detail: String) -> some View {
        Section(title) {
            Text(detail)
                .foregroundStyle(.secondary)
        }
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