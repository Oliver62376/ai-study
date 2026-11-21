import PencilKit
import PhotosUI
import SwiftUI

struct NotebookInkToolbar: View {
    @Bindable var state: NotebookToolbarState
    @Bindable var appearance: ToolbarAppearanceStore
    var onUndo: () -> Void
    var onRedo: () -> Void
    var onPickImage: () -> Void
    var onAttachMaterial: () -> Void
    var onToolbarDoubleTap: () -> Void

    private let swatches: [Color] = [
        Color(hex: "#1c1c1e"), Color(hex: "#c41e1e"), Color(hex: "#1b4fd8"), Color(hex: "#17803d"),
        Color(hex: "#6b3fa0"), Color(hex: "#f4a100"), Color(hex: "#e91e8c"), Color(hex: "#0e8a8a"), Color(hex: "#ffffff"),
    ]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 4) {
                penTool(.pen, icon: .pen)
                penTool(.fountain, icon: .fountain)
                penTool(.highlighter, icon: .highlighter)

                colorRow

                toolIcon(.shapes) {
                    closePanels()
                    if state.inkKind == .shape {
                        state.showShapePanel.toggle()
                    } else {
                        state.inkKind = .shape
                        state.showShapePanel = true
                    }
                    state.showPenSizePanel = false
                    state.showEraserSizePanel = false
                }
                eraserTool

                toolIcon(.lasso) {
                    closePanels()
                    state.inkKind = .lasso
                }
                toolIcon(.text) {
                    closePanels()
                    state.inkKind = .text
                }

                Divider().frame(height: 36).padding(.horizontal, 4)

                toolIcon(.undo, label: false, action: onUndo)
                toolIcon(.redo, label: false, action: onRedo)
                toolIcon(.image) { closePanels(); onPickImage() }
                toolIcon(.materials) { closePanels(); onAttachMaterial() }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
        }
        .frame(height: 58)
        .background(appearance.toolbarBackground)
        .liquidGlassBar(cornerRadius: 14)
        .padding(.horizontal, 10)
        .onTapGesture(count: 2) {
            onToolbarDoubleTap()
        }
    }

    private func closePanels() {
        state.showPenSizePanel = false
        state.showEraserSizePanel = false
        state.showShapePanel = false
    }

    @ViewBuilder
    private func penTool(_ kind: InkToolKind, icon: NotebookIcons) -> some View {
        NotebookIconTool(icon: icon, active: state.inkKind == kind) {
            if state.inkKind == kind {
                state.showPenSizePanel.toggle()
                state.showEraserSizePanel = false
                state.showShapePanel = false
            } else {
                state.inkKind = kind
                state.showPenSizePanel = false
                state.showEraserSizePanel = false
                state.showShapePanel = false
            }
        }
    }

    private var eraserTool: some View {
        NotebookIconTool(icon: .eraser, active: state.inkKind == .eraser) {
            if state.inkKind == .eraser {
                state.showEraserSizePanel.toggle()
            } else {
                state.inkKind = .eraser
                state.showEraserSizePanel = false
                state.showPenSizePanel = false
                state.showShapePanel = false
            }
        }
    }

    private var colorRow: some View {
        HStack(spacing: 6) {
            ForEach(swatches.indices, id: \.self) { index in
                let swatch = swatches[index]
                Button {
                    state.inkColor = swatch
                    if state.inkKind == .eraser {
                        state.inkKind = .pen
                    }
                } label: {
                    Circle()
                        .fill(swatch)
                        .frame(width: 26, height: 26)
                        .overlay {
                            Circle().stroke(state.inkColor == swatch ? Color.accentColor : Color.gray.opacity(0.35), lineWidth: 2)
                        }
                }
                .buttonStyle(.plain)
            }
            ColorPicker("", selection: $state.inkColor)
                .labelsHidden()
                .frame(width: 30, height: 30)
        }
        .padding(.horizontal, 4)
    }

    private func toolIcon(_ icon: NotebookIcons, label: Bool = true, action: @escaping () -> Void) -> some View {
        Group {
            if label {
                NotebookIconTool(icon: icon, active: isActive(icon), action: action)
            } else {
                Button(action: action) {
                    NotebookGlyph(icon: icon)
                        .frame(width: 40, height: 40)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func isActive(_ icon: NotebookIcons) -> Bool {
        switch icon {
        case .shapes: state.inkKind == .shape
        case .lasso: state.inkKind == .lasso
        case .text: state.inkKind == .text
        default: false
        }
    }
}

/// 浮在筆記上層，不佔版面高度
struct InkToolFloatingPanels: View {
    @Bindable var state: NotebookToolbarState

    var body: some View {
        ZStack(alignment: .topLeading) {
            if state.showPenSizePanel, isPenFamily {
                ToolWidthPopover(
                    title: "筆畫粗細",
                    width: $state.inkWidth,
                    range: 1...20,
                    previewColor: state.inkColor
                )
                .background(.regularMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .shadow(radius: 12)
                .padding(.leading, 16)
                .padding(.top, 8)
            }

            if state.showEraserSizePanel {
                VStack(alignment: .leading, spacing: 10) {
                    Picker("模式", selection: $state.eraserStyle) {
                        Text("像素").tag(EraserStyle.bitmap)
                        Text("筆劃").tag(EraserStyle.stroke)
                    }
                    .pickerStyle(.segmented)
                    ToolWidthPopover(
                        title: "橡皮粗細",
                        width: $state.eraserWidth,
                        range: 4...48,
                        previewColor: .gray,
                        isEraser: true
                    )
                }
                .padding(12)
                .frame(width: 240)
                .background(.regularMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .shadow(radius: 12)
                .padding(.leading, 200)
                .padding(.top, 8)
            }

            if state.showShapePanel {
                ShapeToolFloatingBar(state: state)
                    .padding(.leading, 280)
                    .padding(.top, 8)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .allowsHitTesting(state.showPenSizePanel || state.showEraserSizePanel || state.showShapePanel)
    }

    private var isPenFamily: Bool {
        state.inkKind == .pen || state.inkKind == .fountain || state.inkKind == .highlighter
    }
}