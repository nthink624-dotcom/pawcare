import Capacitor
import UIKit

@objc(OwnerSocialLoginPlugin)
public final class OwnerSocialLoginPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OwnerSocialLoginPlugin"
    public let jsName = "OwnerSocialLogin"
    public let pluginMethods = [CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)]

    private let projectHosts = ["ysxykikqnneuhypybjry.supabase.co", "qefxdtmdtvnzgupmjlom.supabase.co"]

    @objc public func open(_ call: CAPPluginCall) {
        guard let value = call.getString("url"), let parts = URLComponents(string: value),
              parts.scheme == "https", let host = parts.host, projectHosts.contains(host),
              parts.port == nil, parts.user == nil, parts.password == nil, parts.fragment == nil,
              parts.percentEncodedPath == "/auth/v1/authorize", let url = parts.url else {
            call.reject("Unexpected social login URL")
            return
        }
        guard let callback = parts.queryItems?.first(where: { $0.name == "redirect_to" })?.value,
              callback.range(of: #"\Akr\.petmanager\.owner://auth/auth/social/callback/[a-f0-9]{32}\z"#, options: .regularExpression) != nil else {
            call.reject("Unexpected social login return URL")
            return
        }
        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:]) { opened in
                if opened { call.resolve() } else { call.reject("System browser unavailable") }
            }
        }
    }
}
