import SwiftUI

struct TextFormatFloatingBar: View {
    @Bindable var page: NotePage
    @Binding var editingTextId: UUID?
    var onPersist: () -> Void

    private var index: Int? {
        guard let id = editingTextId else { return nil }
        return page.overlays.texts.firstIndex { $0.id == id }
    }

    var body: some View {
        if let index {
            let block = page.overlays.texts[index]
            VStack(alignment: .leading, spacing: 12) {
                Text("文字格式").font(.caption.weight(.semibold)).foregroundStyle(.secondary)

                Picker("字體", selection: binding(at: index, keyPath: \.fontDesign)) {
                    Text("預設").tag(TextFontDesign.system)
                    Text("圓體").tag(TextFontDesign.rounded)
                    Text("襯線").tag(TextFontDesign.serif)
                }
                .pickerStyle(.segmented)

                HStack(spacing: 10) {
                    Toggle(isOn: binding(at: index, keyPath: \.isBold)) {
                        Text("粗體").font(.subheadline.weight(.semibold))
                    }
                    .toggleStyle(.button)
                    Toggle(isOn: binding(at: index, keyPath: \.isItalic)) {
                        Text("斜體").font(.subheadline.italic())
                    }
                    .toggleStyle(.button)
                }

                HStack {
                    Text("字級")
                    Slider(
                        value: bindingCGFloat(at: index, keyPath: \.fontSize),
                        in: 12 ... 48,
                        step: 1
                    )
                    Text("\(Int(block.fontSize))")
                        .font(.caption.monospacedDigit())
                        .frame(width: 28, alignment: .trailing)
                }

                ColorPicker(
                    "文字顏色",
                    selection: bindingColor(at: index, keyPath: \.colorHex),
                    supportsOpacity: false
                )

                ColorPicker(
                    "背景色",
                    selection: bindingOptionalColor(at: index, keyPath: \.backgroundHex),
                    supportsOpacity: false
                )
            }
            .padding(14)
            .frame(width: 280)
            .background(.regularMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .shadow(radius: 12)
        }
    }

    private func binding<T>(at index: Int, keyPath: WritableKeyPath<TextAnnotation, T>) -> Binding<T> {
        Binding(
            get: { page.overlays.texts[index][keyPath: keyPath] },
            set: { new in
                var next = page.overlays
                next.texts[index][keyPath: keyPath] = new
                page.overlays = next
                onPersist()
            }
        )
    }

    private func bindingCGFloat(at index: Int, keyPath: WritableKeyPath<TextAnnotation, Double>) -> Binding<Double> {
        binding(at: index, keyPath: keyPath)
    }

    private func bindingColor(at index: Int, keyPath: WritableKeyPath<TextAnnotation, String>) -> Binding<Color> {
        Binding(
            get: { Color(hex: page.overlays.texts[index][keyPath: keyPath]) },
            set: { color in
                var next = page.overlays
                next.texts[index][keyPath: keyPath] = color.hexString
                page.overlays = next
                onPersist()
            }
        )
    }

    private func bindingOptionalColor(at index: Int, keyPath: WritableKeyPath<TextAnnotation, String?>) -> Binding<Color> {
        Binding(
            get: {
                let hex = page.overlays.texts[index][keyPath: keyPath] ?? "#ffffff"
                return Color(hex: hex)
            },
            set: { color in
                var next = page.overlays
                let hex = color.hexString
                next.texts[index][keyPath: keyPath] = hex == "#ffffff" ? nil : hex
                page.overlays = next
                onPersist()
            }
        )
    }
}