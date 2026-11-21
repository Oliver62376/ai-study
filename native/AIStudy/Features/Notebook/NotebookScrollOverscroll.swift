import SwiftUI
import UIKit

/// Tracks how far the user has pulled past the bottom of a `ScrollView` (rubber-band overscroll).
struct NotebookScrollOverscroll: UIViewRepresentable {
    @Binding var overscroll: CGFloat

    func makeCoordinator() -> Coordinator {
        Coordinator(overscroll: $overscroll)
    }

    func makeUIView(context: Context) -> UIView {
        let probe = UIView(frame: .zero)
        probe.isUserInteractionEnabled = false
        probe.isHidden = true
        DispatchQueue.main.async {
            context.coordinator.attach(to: probe)
        }
        return probe
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        DispatchQueue.main.async {
            context.coordinator.attach(to: uiView)
        }
    }

    final class Coordinator: NSObject, UIScrollViewDelegate {
        @Binding var overscroll: CGFloat
        weak var scrollView: UIScrollView?

        init(overscroll: Binding<CGFloat>) {
            _overscroll = overscroll
        }

        func attach(to view: UIView) {
            guard let scroll = view.enclosingScrollView(), scroll !== scrollView else { return }
            scrollView?.delegate = nil
            scroll.delegate = self
            scrollView = scroll
        }

        func scrollViewDidScroll(_ scrollView: UIScrollView) {
            let extra = scrollView.contentOffset.y
                + scrollView.adjustedContentInset.top
                + scrollView.bounds.height
                - scrollView.contentSize.height
                - scrollView.adjustedContentInset.bottom
            overscroll = max(0, extra)
        }
    }
}

private extension UIView {
    func enclosingScrollView() -> UIScrollView? {
        var node: UIView? = superview
        while let current = node {
            if let scroll = current as? UIScrollView { return scroll }
            node = current.superview
        }
        return nil
    }
}