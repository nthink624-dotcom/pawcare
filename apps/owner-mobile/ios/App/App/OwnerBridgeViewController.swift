import Capacitor
import WebKit

final class OwnerBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()

        // Keep Capacitor's default same-origin navigation inside the app.
        // External http(s) and tel links are intentionally handled by the system.
        // Future owner push-notification entry routing can be added here.
        webView?.allowsBackForwardNavigationGestures = false
    }
}
