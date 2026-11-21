import SwiftUI
import UniformTypeIdentifiers

struct HomeScreenView: View {
    var onNotebook: () -> Void

    @Bindable private var providers = ProviderSettingsStore.shared
    @State private var mode: HomeMode = HomePreferencesStore.homeMode
    @State private var topic = ""
    @State private var fileContext = ""
    @State private var attachedNames: [String] = []
    @State private var importStatus = ""
    @State private var importBusy = false
    @State private var importFiles = false
    @State private var showSettings = false
    @State private var showPomodoro = false
    @State private var showModelSheet = false
    @State private var path = NavigationPath()
    @State private var busy = false
    @State private var lessons = LessonStore.load()
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    private var connected: Bool { providers.isConnected }
    private var canStart: Bool {
        !topic.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !fileContext.isEmpty
    }

    private var heroSubtitle: String {
        mode == .board ? "白板模式：備課後用視覺化方式上課。" : "Chat 模式：一般問答，不寫白板。"
    }

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                HomeAuroraBackground()
                HStack(alignment: .top, spacing: 16) {
                    if horizontalSizeClass == .regular {
                        LessonsRailView(
                            lessons: lessons,
                            onOpen: reopenLesson,
                            onDelete: { lesson in
                                LessonStore.delete(id: lesson.id)
                                lessons = LessonStore.load()
                            }
                        )
                        .padding(.leading, 16)
                        .padding(.top, 8)
                    }
                    VStack(spacing: 0) {
                        topBar
                        Spacer(minLength: 24)
                        hero
                        modeSwitch
                            .padding(.bottom, 12)
                        glassComposer
                            .padding(.horizontal, 20)
                        if horizontalSizeClass != .regular {
                            lessonsInlineStrip
                        }
                        notebookStrip
                            .padding(.top, 12)
                        Spacer(minLength: 24)
                    }
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: HomeRoute.self) { route in
                switch route {
                case let .chat(seed, context):
                    ChatView(seed: seed, context: context)
                case let .board(seed, context):
                    ClassBoardView(seedTopic: seed, context: context)
                }
            }
            .onAppear { lessons = LessonStore.load() }
        }
        .sheet(isPresented: $showSettings) {
            NavigationStack { SettingsView() }
        }
        .sheet(isPresented: $showPomodoro) {
            PomodoroView()
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
        .fileImporter(
            isPresented: $importFiles,
            allowedContentTypes: [.pdf, .plainText, .utf8PlainText, .text],
            allowsMultipleSelection: true
        ) { result in
            handleImport(result)
        }
    }

    private var topBar: some View {
        HStack(spacing: 12) {
            Button(action: onNotebook) {
                Image(systemName: "book.closed.fill")
                    .font(.body.weight(.semibold))
                    .frame(width: 44, height: 44)
                    .liquidGlassBar(cornerRadius: 14)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("筆記本")

            Spacer()

            PomodoroToolbarButton { showPomodoro = true }

            Button {
                showSettings = true
            } label: {
                Image(systemName: "gearshape.fill")
                    .font(.body.weight(.semibold))
                    .frame(width: 44, height: 44)
                    .liquidGlassBar(cornerRadius: 14)
                    .overlay {
                        if connected {
                            RoundedRectangle(cornerRadius: 14)
                                .stroke(Color.green.opacity(0.5), lineWidth: 2)
                        }
                    }
            }
            .buttonStyle(.plain)
            .accessibilityLabel(connected ? "模型已連線" : "設定")
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    private var hero: some View {
        VStack(spacing: 12) {
            Text("今天想學什麼？")
                .font(.system(size: 42, weight: .semibold))
                .tracking(-0.5)
                .multilineTextAlignment(.center)
            Text(heroSubtitle)
                .font(.system(size: 17))
                .foregroundStyle(Color(white: 0.45))
                .multilineTextAlignment(.center)
                .frame(maxWidth: 420)
        }
        .padding(.horizontal, 24)
    }

    private var modeSwitch: some View {
        HStack(spacing: 4) {
            modeButton("白板", active: mode == .board) { setMode(.board) }
            modeButton("Chat", active: mode == .chat) { setMode(.chat) }
        }
        .padding(4)
        .background(Color.white.opacity(0.35))
        .clipShape(Capsule())
        .overlay { Capsule().stroke(Color.white.opacity(0.45), lineWidth: 1) }
    }

    private func modeButton(_ title: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(active ? Color.white : Color(white: 0.35))
                .padding(.horizontal, 18)
                .padding(.vertical, 8)
                .background(active ? Color(white: 0.12).opacity(0.92) : Color.clear)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    private var glassComposer: some View {
        VStack(alignment: .leading, spacing: 6) {
            TextField("詢問任何科目", text: $topic, axis: .vertical)
                .lineLimit(1 ... 6)
                .font(.system(size: 17))
                .textFieldStyle(.plain)
                .padding(.horizontal, 4)

            if !attachedNames.isEmpty || !importStatus.isEmpty {
                attachmentStatusStrip
            }

            HStack(spacing: 8) {
                Button { importFiles = true } label: {
                    Image(systemName: "paperclip")
                        .font(.body.weight(.medium))
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("附加檔案")

                Spacer()

                Button { showModelSheet = true } label: {
                    HStack(spacing: 4) {
                        Text(providers.activeProvider.title)
                            .font(.caption.weight(.semibold))
                        Text("·")
                        Text(shortModel)
                            .font(.caption)
                            .lineLimit(1)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .liquidGlassBar(cornerRadius: 999)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("可以換模型")

                Button(action: start) {
                    Image(systemName: "arrow.up")
                        .font(.body.weight(.bold))
                        .foregroundStyle(.white)
                        .frame(width: 40, height: 40)
                        .background(canStart && !busy ? Color(white: 0.12) : Color.gray.opacity(0.35))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .disabled(!canStart || busy)
                .accessibilityLabel(connected ? "傳送" : "先設定模型")
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: 760)
        .liquidGlassComposer(cornerRadius: 26)
    }

    private var shortModel: String {
        let name = providers.model(for: providers.activeProvider)
        if name.count > 18 { return String(name.prefix(16)) + "…" }
        return name
    }

    private var notebookStrip: some View {
        Button(action: onNotebook) {
            HStack {
                Image(systemName: "book.closed")
                Text("我的筆記本")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .frame(maxWidth: 520)
            .liquidGlassBar(cornerRadius: 16)
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 20)
    }

    private var providerBinding: Binding<ProviderId> {
        Binding(
            get: { providers.activeProvider },
            set: { providers.activeProvider = $0 }
        )
    }

    private func setMode(_ next: HomeMode) {
        mode = next
        HomePreferencesStore.homeMode = next
    }

    private func start() {
        let seed = topic.trimmingCharacters(in: .whitespacesAndNewlines)
        let context = fileContext.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !seed.isEmpty || !context.isEmpty else { return }
        guard connected else {
            showSettings = true
            return
        }
        busy = true
        let question = seed.isEmpty ? "請根據附件內容回答。" : seed
        LessonStore.upsert(title: question, topic: context, mode: mode)
        lessons = LessonStore.load()
        switch mode {
        case .chat:
            path.append(HomeRoute.chat(seed: question, context: context))
        case .board:
            path.append(HomeRoute.board(seed: question, context: context))
        }
        topic = ""
        fileContext = ""
        attachedNames = []
        importStatus = ""
        busy = false
    }

    private var attachmentStatusStrip: some View {
        VStack(alignment: .leading, spacing: 6) {
            if !attachedNames.isEmpty {
                FlowLayout(spacing: 6) {
                    ForEach(attachedNames, id: \.self) { name in
                        Text(name)
                            .font(.caption2.weight(.semibold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.black.opacity(0.06))
                            .clipShape(Capsule())
                    }
                }
            }
            if !importStatus.isEmpty {
                HStack(spacing: 8) {
                    if importBusy {
                        ProgressView()
                            .controlSize(.small)
                    }
                    Text(importStatus)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.horizontal, 4)
        .padding(.top, 2)
    }

    private var lessonsInlineStrip: some View {
        Group {
            if !lessons.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(lessons.prefix(8)) { lesson in
                            Button(lesson.title) { reopenLesson(lesson) }
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .liquidGlassBar(cornerRadius: 999)
                                .lineLimit(1)
                        }
                    }
                    .padding(.horizontal, 20)
                }
                .padding(.top, 8)
            }
        }
    }

    private func reopenLesson(_ lesson: NativeLessonRecord) {
        switch lesson.mode {
        case .chat:
            path.append(HomeRoute.chat(seed: lesson.title, context: lesson.topic))
        case .board:
            path.append(HomeRoute.board(seed: lesson.title, context: lesson.topic))
        }
    }

    private func handleImport(_ result: Result<[URL], Error>) {
        switch result {
        case let .success(urls):
            guard !urls.isEmpty else { return }
            let names = urls.map(\.lastPathComponent)
            attachedNames.append(contentsOf: names)
            importBusy = true
            importStatus = "已加入 \(names.count) 個檔案…"
            Task {
                let ingest = await UploadIngestService.ingest(urls: urls) { status in
                    importStatus = status
                }
                fileContext = ingest.text
                importBusy = false
                if fileContext.isEmpty {
                    importStatus = "沒有讀到可用內容，請換檔案或調整設定中的上傳模式。"
                } else {
                    importStatus = "附件就緒，可以開始提問。"
                }
            }
        case let .failure(error):
            importStatus = "讀檔失敗：\(error.localizedDescription)"
            importBusy = false
        }
    }
}

/// 簡易橫向換行 chip 列
private struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = arrange(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(proposal: proposal, subviews: subviews)
        for (index, point) in result.positions.enumerated() where index < subviews.count {
            subviews[index].place(at: CGPoint(x: bounds.minX + point.x, y: bounds.minY + point.y), proposal: .unspecified)
        }
    }

    private func arrange(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, positions: [CGPoint]) {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var positions: [CGPoint] = []
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            positions.append(CGPoint(x: x, y: y))
            rowHeight = max(rowHeight, size.height)
            x += size.width + spacing
        }
        return (CGSize(width: maxWidth, height: y + rowHeight), positions)
    }
}