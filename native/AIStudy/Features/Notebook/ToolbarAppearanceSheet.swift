import SwiftUI

struct ToolbarAppearanceSheet: View {
    @Bindable var appearance: ToolbarAppearanceStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("工具列底色") {
                    ColorPicker("背景顏色", selection: $appearance.toolbarBackground, supportsOpacity: true)
                    RoundedRectangle(cornerRadius: 12)
                        .fill(appearance.toolbarBackground)
                        .frame(height: 52)
                        .overlay {
                            Text("預覽")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                }
                Section {
                    Button("還原為白底") {
                        appearance.toolbarBackground = Color.white.opacity(0.97)
                    }
                }
            }
            .navigationTitle("編輯工具列")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") {
                        appearance.persist()
                        dismiss()
                    }
                }
            }
        }
    }
}