import SwiftUI

struct ChatLine: Identifiable, Codable, Hashable {
    var id: String
    var role: String
    var text: String
}

enum ChatThreadStore {
    private static let key = "native.chat.thread"

    static func load() -> [ChatLine] {
        guard let data = UserDefaults.standard.data(forKey: key),
              let lines = try? JSONDecoder().decode([ChatLine].self, from: data) else {
            return []
        }
        return lines
    }

    static func save(_ lines: [ChatLine]) {
        guard let data = try? JSONEncoder().encode(lines) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }
}

struct ChatView: View {
    var seed: String?
    var context: String

    @Bindable private var providers = ProviderSettingsStore.shared
    @State private var lines: [ChatLine] = []
    @State private var draft = ""
    @State private var busy = false
    @State private var showSettings = false
    @State private var showModelSheet = false
    @State private var didBootstrap = false

    init(seed: String? = nil, context: String = "") {
        self.seed = seed
        self.context = context
    }

    var body: some View {
        VStack(spacing: 0) {
            modelBar
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        if lines.isEmpty, !busy {
                            Text("像 ChatGPT 一樣提問；可在上方切換模型。")
                                .foregroundStyle(.secondary)
                                .padding(.top, 8)
                        }
                        ForEach(lines) { line in
                            chatBubble(line)
                                .id(line.id)
                        }
                        if busy {
                            ProgressView("AI 思考中…")
                        }
                    }
                    .padding()
                }
                .onChange(of: lines.count) { _, _ in
                    if let last = lines.last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }
            }

            composer
        }
        .navigationTitle("對話")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showSettings = true
                } label: {
                    Image(systemName: providers.isConnected ? "checkmark.circle" : "gearshape")
                }
            }
            ToolbarItem(placement: .topBarLeading) {
                Button("清除") { lines = []; ChatThreadStore.clear() }
                    .disabled(lines.isEmpty)
            }
        }
        .sheet(isPresented: $showSettings) {
            NavigationStack { SettingsView() }
        }
        .sheet(isPresented: $showModelSheet) {
            NavigationStack {
                Form {
                    Section("供應商") {
                        Picker("供應商", selection: providerBinding) {
                            ForEach(ProviderId.allCases) { p in
                                Text(p.title).tag(p)
                            }
                        }
                    }
                    Section("模型") {
                        ModelPickerField(providers: providers, provider: providers.activeProvider)
                    }
                }
                .navigationTitle("選擇模型")
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("完成") { showModelSheet = false }
                    }
                }
            }
        }
        .onAppear {
            lines = ChatThreadStore.load()
            bootstrapSeedIfNeeded()
        }
    }

    private func bootstrapSeedIfNeeded() {
        guard !didBootstrap, let seed, !seed.isEmpty else { return }
        didBootstrap = true
        Task {
            await send(with: seed, context: context)
        }
    }

    private var providerBinding: Binding<ProviderId> {
        Binding(
            get: { providers.activeProvider },
            set: { providers.activeProvider = $0 }
        )
    }

    private var modelBar: some View {
        HStack(spacing: 12) {
            Text(providers.activeProvider.title)
                .font(.subheadline.weight(.semibold))
            Text(providers.model(for: providers.activeProvider))
                .font(.caption)
                .lineLimit(1)
                .foregroundStyle(.secondary)
            Spacer()
            Button("換模型") { showModelSheet = true }
                .font(.subheadline.weight(.semibold))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .liquidGlassBar(cornerRadius: 0)
    }

    private func chatBubble(_ line: ChatLine) -> some View {
        let mine = line.role == "user"
        return HStack {
            if mine { Spacer(minLength: 40) }
            Text(line.text)
                .padding(12)
                .background(mine ? NotebookTheme.header.opacity(0.15) : Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            if !mine { Spacer(minLength: 40) }
        }
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 8) {
            TextField("繼續提問…", text: $draft, axis: .vertical)
                .lineLimit(1 ... 6)
                .textFieldStyle(.roundedBorder)
            Button {
                Task { await send() }
            } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.title2)
            }
            .disabled(busy || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .padding()
        .background(.ultraThinMaterial)
    }

    private func send() async {
        let message = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !message.isEmpty else { return }
        draft = ""
        await send(with: message, context: context)
    }

    private func send(with message: String, context: String) async {
        guard !message.isEmpty, !busy else { return }
        guard providers.isConnected else {
            showSettings = true
            return
        }
        busy = true
        let user = ChatLine(id: "u-\(Date().timeIntervalSince1970)", role: "user", text: message)
        let snapshot = lines + [user]
        lines = snapshot
        ChatThreadStore.save(snapshot)
        do {
            let answer = try await ProviderAIService.ask(question: message, context: context, store: providers)
            let assistant = ChatLine(id: "a-\(Date().timeIntervalSince1970)", role: "assistant", text: answer)
            let next = snapshot + [assistant]
            lines = next
            ChatThreadStore.save(next)
        } catch {
            let assistant = ChatLine(
                id: "a-\(Date().timeIntervalSince1970)",
                role: "assistant",
                text: error.localizedDescription
            )
            let next = snapshot + [assistant]
            lines = next
            ChatThreadStore.save(next)
        }
        busy = false
    }
}