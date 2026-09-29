import Capacitor
import UIKit
import WebKit

final class OwnerBridgeViewController: CAPBridgeViewController {
    private let safeAreaStyleElementID = "pm-ios-safe-area-style"
    private var lastAppliedSafeAreaInsets: UIEdgeInsets?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()

        // Keep Capacitor's default same-origin navigation inside the app.
        // External http(s) and tel links are intentionally handled by the system.
        // Future owner push-notification entry routing can be added here.
        webView?.allowsBackForwardNavigationGestures = false
        // The web owner surface owns its safe-area spacing. Avoid UIKit adding a
        // second scroll inset, then provide the measured iOS inset to the page.
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
        applySafeAreaInsets(force: true)

        // The production URL can finish its first navigation after the Capacitor
        // bridge callback. Re-apply once the remote document has mounted.
        DispatchQueue.main.async { [weak self] in
            self?.applySafeAreaInsets(force: true)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.75) { [weak self] in
            self?.applySafeAreaInsets(force: true)
        }
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        applySafeAreaInsets()
    }

    private func applySafeAreaInsets(force: Bool = false) {
        guard let webView else { return }

        let insets = view.safeAreaInsets
        guard force || lastAppliedSafeAreaInsets != insets else { return }
        lastAppliedSafeAreaInsets = insets

        let top = cssPixel(insets.top)
        let right = cssPixel(insets.right)
        let bottom = cssPixel(insets.bottom)
        let left = cssPixel(insets.left)
        let styleElementID = safeAreaStyleElementID

        let script = """
        (() => {
          const root = document.documentElement;
          if (!root) return;

          root.style.setProperty('--pm-native-safe-top', '\(top)px');
          root.style.setProperty('--pm-native-safe-right', '\(right)px');
          root.style.setProperty('--pm-native-safe-bottom', '\(bottom)px');
          root.style.setProperty('--pm-native-safe-left', '\(left)px');
          root.style.setProperty('--pm-safe-top', '\(top)px');
          root.style.setProperty('--pm-safe-right', '\(right)px');
          root.style.setProperty('--pm-safe-bottom', '\(bottom)px');
          root.style.setProperty('--pm-safe-left', '\(left)px');

          let style = document.getElementById('\(styleElementID)');
          if (!style) {
            style = document.createElement('style');
            style.id = '\(styleElementID)';
            (document.head || root).appendChild(style);
          }
          style.textContent = `
            .pm-mobile-owner > header {
              padding-top: calc(var(--pm-safe-top) + 12px) !important;
            }
            .pm-mobile-owner > nav {
              padding-bottom: calc(var(--pm-safe-bottom) + 2px) !important;
            }
          `;
        })();
        """

        webView.evaluateJavaScript(script, completionHandler: nil)
    }

    private func cssPixel(_ value: CGFloat) -> String {
        String(format: "%.2f", locale: Locale(identifier: "en_US_POSIX"), value)
    }
}
