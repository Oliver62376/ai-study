import SwiftUI

struct TextAnnotationSheet: View {
    @Environment(\.dismiss) private var dismiss
  var initialText: String = ""
    @Binding var text: String
    var onSave: () -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section("文字內容") {
                    TextField("輸入文字", text: $text, axis: .vertical)
                        .lineLimit(4 ... 12)
                }
            }
            .navigationTitle("文字方塊")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("加入") {
                        onSave()
                        dismiss()
                    }
                    .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .onAppear {
            if text.isEmpty { text = initialText }
        }
    }
}