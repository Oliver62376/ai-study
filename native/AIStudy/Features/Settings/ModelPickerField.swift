import SwiftUI

struct ModelPickerField: View {
    @Bindable var providers: ProviderSettingsStore
    var provider: ProviderId

    @State private var choices: [String] = []
    @State private var loading = false
    @State private var note = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if loading {
                ProgressView("正在取得模型…")
            }
            Picker("模型", selection: bindingModel) {
                ForEach(choices, id: \.self) { name in
                    Text(name).tag(name)
                }
            }
            .disabled(loading || choices.isEmpty)

            HStack {
                Button("重新取得模型") {
                    Task { await refresh() }
                }
                .disabled(loading || !providers.isConnected(for: provider))
            }
            .font(.footnote)

            if !note.isEmpty {
                Text(note)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .task(id: provider) {
            await refresh()
        }
    }

    private var bindingModel: Binding<String> {
        Binding(
            get: { providers.model(for: provider) },
            set: { providers.setModel($0, for: provider) }
        )
    }

    private func refresh() async {
        if !providers.isConnected(for: provider) {
            choices = [providers.model(for: provider)]
            note = provider.isLocal ? "先填服務位址。" : "先填 API 金鑰。"
            return
        }
        loading = true
        note = ""
        choices = await ProviderModelService.listModels(for: provider, store: providers)
        let current = providers.model(for: provider)
        if !choices.contains(current), let first = choices.first {
            providers.setModel(first, for: provider)
        }
        if choices.count <= 1 {
            note = "未取得遠端清單，使用預設模型。"
        }
        loading = false
    }
}