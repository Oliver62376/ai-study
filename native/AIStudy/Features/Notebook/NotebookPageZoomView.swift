import SwiftUI
import UIKit

/// 以 UIScrollView 原生捏合縮放頁面，比 `scaleEffect` 流暢。
struct NotebookPageZoomView<Content: View>: UIViewRepresentable {
    let contentSize: CGSize
  var isActive: Bool
    let content: Content

    func makeCoordinator() -> Coordinator {
        Coordinator(contentSize: contentSize)
    }

    func makeUIView(context: Context) -> UIScrollView {
        let scroll = UIScrollView()
        scroll.delegate = context.coordinator
        scroll.minimumZoomScale = 0.78
        scroll.maximumZoomScale = 3.25
        scroll.bouncesZoom = true
        scroll.showsVerticalScrollIndicator = false
        scroll.showsHorizontalScrollIndicator = false
        scroll.backgroundColor = .clear
        scroll.delaysContentTouches = false
        scroll.canCancelContentTouches = true

        let host = UIHostingController(rootView: content)
        host.view.backgroundColor = .clear
        host.view.frame = CGRect(origin: .zero, size: contentSize)
        scroll.addSubview(host.view)
        scroll.contentSize = contentSize

        context.coordinator.hosting = host
        context.coordinator.scrollView = scroll
        return scroll
    }

    func updateUIView(_ scroll: UIScrollView, context: Context) {
        context.coordinator.hosting?.rootView = content
        if !isActive, scroll.zoomScale != 1 {
            scroll.setZoomScale(1, animated: false)
        }
        let size = contentSize
        scroll.contentSize = size
        context.coordinator.hosting?.view.frame = CGRect(origin: .zero, size: size)
    }

    final class Coordinator: NSObject, UIScrollViewDelegate {
        let contentSize: CGSize
        var hosting: UIHostingController<Content>?
        weak var scrollView: UIScrollView?

        init(contentSize: CGSize) {
            self.contentSize = contentSize
        }

        func viewForZooming(in scrollView: UIScrollView) -> UIView? {
            hosting?.view
        }
    }
}