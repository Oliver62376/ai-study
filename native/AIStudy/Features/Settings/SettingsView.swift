import SwiftUI

struct SettingsView: View {
    @Bindable private var providers = ProviderSettingsStore.shared
    @State private var trashDays = TrashRetentionStore.retentionDays
    @State private var expandedProvider: ProviderId?

    var body: some View {
        Form {
            Section("AI 供應商") {
                Picker("使用中", selection: $providers.blob.provider) {
                    ForEach(ProviderId.allCases) { provider in
                        Text(provider.title).tag(provider)
                    }
                }
                LabeledContent("狀態", value: providers.isConnected ? "已連線" : "未設定")
                ForEach(ProviderId.allCases) { provider in
                    DisclosureGroup(provider.title, isExpanded: Binding(
                        get: { expandedProvider == provider },
                        set: { expandedProvider = $0 ? provider : nil }
                    )) {
                        Text(provider.hint)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        SecureField("API 金鑰", text: bindingKey(provider))
                        TextField("Base URL", text: bindingBase(provider))
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        TextField("模型", text: bindingModel(provider))
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }
                }
            }

            Section("回收桶") {
                Stepper(value: $trashDays, in: 1 ... 365) {
                    Text("保留 \(trashDays) 天")
                }
                Text("超過天數的筆記會在開啟筆記庫時自動永久刪除。")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section("Apple Pencil") {
                Text("雙擊工具列可換底色；筆／橡皮二次點擊調粗細。")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section("關於") {
                LabeledContent("版本", value: "0.2.5-beta")
                LabeledContent("平台", value: "iPadOS 17+")
            }
        }
        .navigationTitle("設定")
        .onDisappear {
            TrashRetentionStore.retentionDays = trashDays
        }
    }

    private func bindingKey(_ provider: ProviderId) -> Binding<String> {
        Binding(
            get: { providers.key(for: provider) },
            set: { providers.setKey($0, for: provider) }
        )
    }

    private func bindingModel(_ provider: ProviderId) -> Binding<String> {
        Binding(
            get: { providers.model(for: provider) },
            set: { providers.setModel($0, for: provider) }
        )
    }

    private func bindingBase(_ provider: ProviderId) -> Binding<String> {
        Binding(
            get: { providers.base(for: provider) },
            set: { providers.setBase($0, for: provider) }
        )
    }
}