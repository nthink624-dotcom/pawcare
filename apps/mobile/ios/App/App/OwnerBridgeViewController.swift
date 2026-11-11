import Capacitor
import OSLog
import UIKit
import WebKit

final class OwnerBridgeViewController: CAPBridgeViewController {
    private let safeAreaStyleElementID = "pm-ios-safe-area-style"
    private var lastAppliedSafeAreaInsets: UIEdgeInsets?
    private var identityPopupDelegate: OwnerIdentityPopupUIDelegate?

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        // KCP opens its window after the verification request has been prepared.
        // The UI delegate below checks trusted app/provider frames and entries.
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        return configuration
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()

        // The main web view keeps Capacitor's normal navigation policy; identity
        // popups use an isolated child so their opener and signup state survive.
        webView?.allowsBackForwardNavigationGestures = false
        // The web owner surface owns its safe-area spacing. Avoid UIKit adding a
        // second scroll inset, then provide the measured iOS inset to the page.
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
        if let webView, identityPopupDelegate == nil {
            let delegate = OwnerIdentityPopupUIDelegate(owner: self, webView: webView, fallback: webView.uiDelegate)
            identityPopupDelegate = delegate
            webView.uiDelegate = delegate
        }
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
              /* Lower the tabs by up to 12px while retaining at least 20px on
                 devices with a home gesture area. Preserve smaller insets. */
              padding-bottom: calc(max(min(var(--pm-safe-bottom), 20px), calc(var(--pm-safe-bottom) - 12px)) + 2px) !important;
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

// Preserve the opener and the in-memory signup form while KCP verifies the user.
// Capacitor's default popup handler opens a system URL and returns nil, which
// makes the identity SDK report POPUP_BLOCKED inside the native app.
private final class OwnerIdentityPopupUIDelegate: NSObject, WKUIDelegate, WKNavigationDelegate {
    private weak var owner: UIViewController?
    private weak var hostWebView: WKWebView?
    private let fallback: WKUIDelegate?
    private var surfaces: [ObjectIdentifier: OwnerIdentityPopupSurface] = [:]
    private let popupLog = Logger(subsystem: "kr.petmanager.owner", category: "IdentityPopup")

    init(owner: UIViewController, webView: WKWebView, fallback: WKUIDelegate?) {
        self.owner = owner
        self.hostWebView = webView
        self.fallback = fallback
        super.init()
    }

    private func isProviderHost(_ host: String) -> Bool {
        let host = host.lowercased()
        return ["kcp.co.kr", "portone.io", "iamport.kr", "iamport.co"].contains {
            host == $0 || host.hasSuffix("." + $0)
        }
    }

    private func isFirstPartyHost(_ host: String) -> Bool {
        ["app.petmanager.co.kr", "www.petmanager.co.kr", "petmanager.co.kr"].contains(host.lowercased())
    }

    private func isTrustedFrameURL(_ url: URL?) -> Bool {
        guard let url, url.scheme?.lowercased() == "https" else { return false }
        return isFirstPartyHost(url.host ?? "") || isProviderHost(url.host ?? "")
    }

    private func popupDecision(_ accepted: Bool, caller: String, entry: String) -> Bool {
        // Only fixed classification labels are logged. Never log URLs, query
        // strings, identity requests, form values or verification results.
        popupLog.notice("identity_popup accepted=\(accepted, privacy: .public) caller=\(caller, privacy: .public) entry=\(entry, privacy: .public)")
        return accepted
    }

    private func isIdentityPopup(_ webView: WKWebView, action: WKNavigationAction) -> Bool {
        guard webView === hostWebView, let page = webView.url,
              page.scheme?.lowercased() == "https",
              isFirstPartyHost(page.host ?? "") else {
            return popupDecision(false, caller: "not_primary_first_party", entry: "unchecked")
        }

        let source = action.sourceFrame.securityOrigin
        let sourceHost = source.host.lowercased()
        let caller: String
        if source.protocol.lowercased() == "https" && isFirstPartyHost(sourceHost) {
            caller = "first_party"
        } else if source.protocol.lowercased() == "https" && isProviderHost(sourceHost) {
            caller = "provider"
        } else if isTrustedFrameURL(action.sourceFrame.request.url) {
            caller = "trusted_frame_url"
        } else if action.sourceFrame.isMainFrame && sourceHost.isEmpty {
            caller = "main_frame"
        } else {
            return popupDecision(false, caller: "untrusted_frame", entry: "unchecked")
        }

        // The live PortOne SDK first calls window.open("", "PortOne", ...),
        // then assigns the provider URL. WebKit can represent this first request
        // as empty, about:blank, or the caller's own document URL. Match the
        // trusted origin rather than assuming one URL form or an SPA route.
        guard let url = action.request.url, !url.absoluteString.isEmpty else {
            return popupDecision(true, caller: caller, entry: "empty")
        }
        if url.scheme?.lowercased() == "about" && url.path == "blank" {
            return popupDecision(true, caller: caller, entry: "blank")
        }
        if url.scheme?.lowercased() == "https" && isFirstPartyHost(url.host ?? "") {
            return popupDecision(true, caller: caller, entry: "first_party_document")
        }
        if url.scheme?.lowercased() == "https" && isProviderHost(url.host ?? "") {
            return popupDecision(true, caller: caller, entry: "provider")
        }
        return popupDecision(false, caller: caller, entry: "unsupported_url")
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard isIdentityPopup(webView, action: navigationAction), let owner else {
            return fallback?.webView?(webView, createWebViewWith: configuration,
                                      for: navigationAction, windowFeatures: windowFeatures)
        }
        guard surfaces.isEmpty else {
            popupLog.notice("identity_popup accepted=false caller=primary entry=already_open")
            return nil
        }

        // Keep WebKit's supplied configuration so window.opener remains valid.
        // Registered scheme handlers cannot be unregistered with nil: WebKit
        // raises an Objective-C exception. Isolate native message handlers with
        // a fresh content controller; navigation policy blocks bridge schemes.
        configuration.userContentController = WKUserContentController()
        let popup = WKWebView(frame: .zero, configuration: configuration)
        popup.uiDelegate = self
        popup.navigationDelegate = self
        popup.allowsBackForwardNavigationGestures = false
        popup.accessibilityIdentifier = "owner.identity-verification.webview"

        let surface = OwnerIdentityPopupSurface(webView: popup)
        surface.onClose = { [weak self, weak popup] in
            guard let self, let popup else { return }
            popup.evaluateJavaScript("window.close()") { [weak self, weak popup] _, _ in
                guard let popup else { return }
                self?.removePopup(popup)
            }
        }
        surfaces[ObjectIdentifier(popup)] = surface
        owner.view.endEditing(true)
        owner.view.addSubview(surface)
        surface.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            surface.leadingAnchor.constraint(equalTo: owner.view.leadingAnchor),
            surface.trailingAnchor.constraint(equalTo: owner.view.trailingAnchor),
            surface.topAnchor.constraint(equalTo: owner.view.topAnchor),
            surface.bottomAnchor.constraint(equalTo: owner.view.bottomAnchor)
        ])
        popupLog.notice("identity_popup_surface_ready")
        UIAccessibility.post(notification: .screenChanged, argument: popup)
        return popup
    }

    private func removePopup(_ webView: WKWebView) {
        guard let surface = surfaces.removeValue(forKey: ObjectIdentifier(webView)) else { return }
        webView.stopLoading()
        webView.navigationDelegate = nil
        webView.uiDelegate = nil
        surface.removeFromSuperview()
        UIAccessibility.post(notification: .screenChanged, argument: hostWebView)
    }

    func webViewDidClose(_ webView: WKWebView) {
        removePopup(webView)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url, let scheme = url.scheme?.lowercased() else {
            decisionHandler(.cancel)
            return
        }
        if scheme == "https" || url.absoluteString == "about:blank" {
            decisionHandler(.allow)
            return
        }
        decisionHandler(.cancel)
        // Identity providers may hand control to a carrier's PASS application.
        // Local files, script URLs and the app's own bridge scheme stay blocked.
        let urlTypes = Bundle.main.object(forInfoDictionaryKey: "CFBundleURLTypes") as? [[String: Any]] ?? []
        let ownSchemes = urlTypes.flatMap { $0["CFBundleURLSchemes"] as? [String] ?? [] }
        guard !["http", "file", "javascript", "data", "capacitor", "capacitor-http", "capacitor-https"].contains(scheme),
              !ownSchemes.contains(where: { $0.lowercased() == scheme }) else { return }
        UIApplication.shared.open(url, options: [:], completionHandler: nil)
    }

    // Retain Capacitor's existing JavaScript-dialog behavior. The popup is a
    // view on the same controller, so its dialogs also have a visible presenter.
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        if let _ = fallback?.webView?(webView, runJavaScriptAlertPanelWithMessage: message,
                                      initiatedByFrame: frame, completionHandler: completionHandler) { return }
        completionHandler()
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        if let _ = fallback?.webView?(webView, runJavaScriptConfirmPanelWithMessage: message,
                                      initiatedByFrame: frame, completionHandler: completionHandler) { return }
        completionHandler(false)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (String?) -> Void) {
        if let _ = fallback?.webView?(webView, runJavaScriptTextInputPanelWithPrompt: prompt,
                                      defaultText: defaultText, initiatedByFrame: frame,
                                      completionHandler: completionHandler) { return }
        completionHandler(nil)
    }

    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        if webView === hostWebView,
           let _ = fallback?.webView?(webView, requestMediaCapturePermissionFor: origin,
                                       initiatedByFrame: frame, type: type, decisionHandler: decisionHandler) { return }
        decisionHandler(.deny)
    }

    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView, requestDeviceOrientationAndMotionPermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        if webView === hostWebView,
           let _ = fallback?.webView?(webView, requestDeviceOrientationAndMotionPermissionFor: origin,
                                       initiatedByFrame: frame, decisionHandler: decisionHandler) { return }
        decisionHandler(.deny)
    }
}

private final class OwnerIdentityPopupSurface: UIView {
    let webView: WKWebView
    var onClose: (() -> Void)?

    init(webView: WKWebView) {
        self.webView = webView
        super.init(frame: .zero)
        backgroundColor = .systemBackground
        accessibilityViewIsModal = true

        let title = UILabel()
        title.text = "본인인증"
        title.font = .preferredFont(forTextStyle: .headline)
        title.adjustsFontForContentSizeCategory = true
        let close = UIButton(type: .system)
        close.setTitle("닫기", for: .normal)
        close.accessibilityLabel = "본인인증 닫기"
        close.accessibilityIdentifier = "owner.identity-verification.close"
        close.addTarget(self, action: #selector(closeRequested), for: .touchUpInside)
        let contentViews: [UIView] = [title, close, webView]
        for view in contentViews {
            view.translatesAutoresizingMaskIntoConstraints = false
            addSubview(view)
        }
        NSLayoutConstraint.activate([
            close.topAnchor.constraint(equalTo: safeAreaLayoutGuide.topAnchor),
            close.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            close.widthAnchor.constraint(greaterThanOrEqualToConstant: 56),
            close.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
            title.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            title.centerYAnchor.constraint(equalTo: close.centerYAnchor),
            title.trailingAnchor.constraint(lessThanOrEqualTo: close.leadingAnchor, constant: -8),
            webView.leadingAnchor.constraint(equalTo: leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: trailingAnchor),
            webView.topAnchor.constraint(equalTo: close.bottomAnchor),
            webView.bottomAnchor.constraint(equalTo: safeAreaLayoutGuide.bottomAnchor)
        ])
    }

    required init?(coder: NSCoder) { return nil }

    @objc private func closeRequested() {
        onClose?()
    }
}
