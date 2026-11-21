import SwiftUI

struct NotebookAIPanel: View {
    let notebookId: String
    let pageTitle: String
    var pageImageJPEG: Data?
    var onNeedSettings: () -> Void
    var onClose: () -> Void

    @State private var panelOrigin = CGPoint(x: 24, y: 120)
    @State private var dragStart: CGPoint?
    @State private var mode: NotebookAiMode = .explain
    @State private var lines: [NbAiLine] = []
    @State private var draft = ""
    @State private var busy = false
    @State private var attachImage = true

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Divider()
            modeRow
            Divider()
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 10) {
                    if lines.isEmpty {
                        Text("針對目前頁面提問，可附頁面截圖。")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    ForEach(lines) { line in
                        bubble(line)
                    }
                    if busy {
                        ProgressView().padding(.vertical, 8)
                    }
                }
                .padding(12)
            }
            .frame(height: 260)
            Divider()
            footer
        }
        .frame(width: 360)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.2), radius: 16, y: 8)
        .position(x: panelOrigin.x + 180, y: panelOrigin.y + 200)
        .gesture(
            DragGesture()
                .onChanged { value in
                    if dragStart == nil {
                        dragStart = panelOrigin
                    }
                    if let start = dragStart {
                        panelOrigin = CGPoint(x: start.x + value.translation.width, y: start.y + value.translation.height)
                    }
                }
                .onEnded { _ in dragStart = nil }
        )
        .onAppear {
            lines = AISettingsStore.shared.loadThread(notebookId: notebookId)
        }
    }

    private var header: some View {
        HStack {
            Text("筆記 AI")
                .font(.headline)
            Spacer()
            Button(action: onClose) {
                Image(systemName: "xmark.circle.fill")
                    .symbolRenderingMode(.hierarchical)
                    .font(.title3)
            }
            .buttonStyle(.plain)
        }
        .padding(12)
    }

    private var modeRow: some View {
        Picker("模式", selection: $mode) {
            ForEach(NotebookAiMode.allCases) { m in
                Text(m.title).tag(m)
            }
        }
        .pickerStyle(.segmented)
        .padding(12)
    }

    private var footer: some View {
        VStack(alignment: .leading, spacing: 8) {
            Toggle("附頁面圖", isOn: $attachImage)
                .font(.footnote)
            HStack(alignment: .bottom) {
                TextField("輸入問題…", text: $draft, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(1 ... 4)
                Button("送出") { Task { await send() } }
                    .buttonStyle(.borderedProminent)
                    .disabled(busy || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            Button("清除對話", role: .destructive) {
                lines = []
                AISettingsStore.shared.saveThread(notebookId: notebookId, lines: [])
            }
            .font(.footnote)
        }
        .padding(12)
    }

    private func bubble(_ line: NbAiLine) -> some View {
        let mine = line.role == "user"
        return HStack {
            if mine { Spacer(minLength: 24) }
            Text(line.text)
                .font(.subheadline)
                .padding(10)
                .background(mine ? Color.accentColor.opacity(0.2) : Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            if !mine { Spacer(minLength: 24) }
        }
    }

    private func send() async {
        let message = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !message.isEmpty, !busy else { return }
        guard AISettingsStore.shared.isConnected else {
            onNeedSettings()
            return
        }
        draft = ""
        busy = true
        let user = NbAiLine(id: "u-\(Date().timeIntervalSince1970)", role: "user", text: message, at: Date().timeIntervalSince1970)
        let prior = lines
        let snapshot = prior + [user]
        lines = snapshot
        AISettingsStore.shared.saveThread(notebookId: notebookId, lines: snapshot)
        do {
            let jpeg = attachImage ? pageImageJPEG : nil
            let answer = try await NotebookAIService.ask(
                userMessage: message,
                mode: mode,
                pageTitle: pageTitle,
                history: prior,
                pageImageJPEG: jpeg
            )
            let assistant = NbAiLine(
                id: "a-\(Date().timeIntervalSince1970)",
                role: "assistant",
                text: answer,
                at: Date().timeIntervalSince1970
            )
            let next = snapshot + [assistant]
            lines = next
            AISettingsStore.shared.saveThread(notebookId: notebookId, lines: next)
        } catch {
            let assistant = NbAiLine(
                id: "a-\(Date().timeIntervalSince1970)",
                role: "assistant",
                text: error.localizedDescription,
                at: Date().timeIntervalSince1970
            )
            let next = snapshot + [assistant]
            lines = next
            AISettingsStore.shared.saveThread(notebookId: notebookId, lines: next)
        }
        busy = false
    }
}