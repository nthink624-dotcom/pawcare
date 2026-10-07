using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.Web.WebView2.Core;
using System.Text.Json;
using Windows.ApplicationModel;
using Windows.System;
using Windows.Storage;

namespace PetManager_Windows;

public sealed partial class MainPage : Page
{
    private const string OwnerUrl = "https://www.petmanager.co.kr/owner";
    private static readonly HashSet<string> InAppHosts = new(StringComparer.OrdinalIgnoreCase)
    {
        "www.petmanager.co.kr",
    };

    private bool _webViewReady;
    private string? _windowsPushChannelUri;

    public MainPage()
    {
        InitializeComponent();
        Loaded += MainPage_Loaded;
    }

    private async void MainPage_Loaded(object sender, RoutedEventArgs e)
    {
        if (_webViewReady) return;
        try
        {
            await PetManagerWebView.EnsureCoreWebView2Async();
            var core = PetManagerWebView.CoreWebView2;
            core.Settings.AreDefaultContextMenusEnabled = true;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.AreDevToolsEnabled = false;
            core.NavigationStarting += CoreWebView2_NavigationStarting;
            core.NewWindowRequested += CoreWebView2_NewWindowRequested;
            core.NavigationCompleted += CoreWebView2_NavigationCompleted;
            core.WebMessageReceived += CoreWebView2_WebMessageReceived;
            _webViewReady = true;
            PetManagerWebView.Source = new Uri(OwnerUrl);
            if (ApplicationData.Current.LocalSettings.Values["windowsPushNotificationsEnabled"] is true)
            {
                _windowsPushChannelUri = await WindowsPushNotifications.RequestChannelUriAsync();
                if (_windowsPushChannelUri is not null) PushButton.Content = "예약 알림 끄기";
            }
        }
        catch (Exception)
        {
            PageDescription.Text = "화면을 열지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.";
        }
    }

    private void RefreshButton_Click(object sender, RoutedEventArgs e)
    {
        if (_webViewReady) PetManagerWebView.CoreWebView2.Reload();
    }

    private async void PushButton_Click(object sender, RoutedEventArgs e)
    {
        PushButton.IsEnabled = false;
        try
        {
            if (ApplicationData.Current.LocalSettings.Values["windowsPushNotificationsEnabled"] is true)
            {
                await DisableWindowsPushNotificationsAsync();
                return;
            }

            _windowsPushChannelUri = await WindowsPushNotifications.RequestChannelUriAsync();
            if (_windowsPushChannelUri is null)
            {
                PageDescription.Text = "Windows 알림 연결을 아직 준비하고 있습니다.";
                return;
            }

            ApplicationData.Current.LocalSettings.Values["windowsPushNotificationsEnabled"] = true;
            PushButton.Content = "예약 알림 끄기";
            await DeliverPushChannelToOwnerPageAsync();
            PageDescription.Text = "알림 연결 요청을 보냈습니다. 매장 계정으로 로그인해 주세요.";
        }
        finally
        {
            PushButton.IsEnabled = true;
        }
    }

    private async void CoreWebView2_NavigationStarting(CoreWebView2 sender, CoreWebView2NavigationStartingEventArgs args)
    {
        if (!Uri.TryCreate(args.Uri, UriKind.Absolute, out var uri) ||
            uri.Scheme != Uri.UriSchemeHttps || !InAppHosts.Contains(uri.Host))
        {
            args.Cancel = true;
            await OpenExternalAsync(args.Uri);
        }
    }

    private async void CoreWebView2_NewWindowRequested(CoreWebView2 sender, CoreWebView2NewWindowRequestedEventArgs args)
    {
        args.Handled = true;
        await OpenExternalAsync(args.Uri);
    }

    private async void CoreWebView2_NavigationCompleted(CoreWebView2 sender, CoreWebView2NavigationCompletedEventArgs args)
    {
        if (args.IsSuccess) await DeliverPushChannelToOwnerPageAsync();
    }

    private async Task DeliverPushChannelToOwnerPageAsync()
    {
        if (!_webViewReady || string.IsNullOrWhiteSpace(_windowsPushChannelUri)) return;
        if (!IsOwnerPage(PetManagerWebView.Source)) return;

        var channelJson = JsonSerializer.Serialize(_windowsPushChannelUri);
        var deviceIdJson = JsonSerializer.Serialize(GetWindowsPushDeviceId());
        var script = $"window.__petManagerWindowsPushChannelUri={channelJson};window.__petManagerWindowsPushDeviceId={deviceIdJson};window.dispatchEvent(new CustomEvent('petmanager:windows-push-channel',{{detail:{{channelUri:window.__petManagerWindowsPushChannelUri,deviceId:window.__petManagerWindowsPushDeviceId}}}}));";
        await PetManagerWebView.CoreWebView2.ExecuteScriptAsync(script);
    }

    private async Task DisableWindowsPushNotificationsAsync()
    {
        if (!_webViewReady || !IsOwnerPage(PetManagerWebView.Source))
        {
            PageDescription.Text = "알림을 해제하려면 매장 관리 화면에서 로그인해 주세요.";
            if (_webViewReady) PetManagerWebView.Source = new Uri(OwnerUrl);
            return;
        }

        var deviceIdJson = JsonSerializer.Serialize(GetWindowsPushDeviceId());
        await PetManagerWebView.CoreWebView2.ExecuteScriptAsync(
            $"window.dispatchEvent(new CustomEvent('petmanager:windows-push-disable',{{detail:{{deviceId:{deviceIdJson}}}}}));");
        PageDescription.Text = "매장 계정에서 알림 해제를 확인하고 있습니다.";
    }

    private void CoreWebView2_WebMessageReceived(CoreWebView2 sender, CoreWebView2WebMessageReceivedEventArgs args)
    {
        try
        {
            using var message = JsonDocument.Parse(args.WebMessageAsJson);
            var root = message.RootElement;
            if (!root.TryGetProperty("kind", out var kind) || kind.GetString() != "windows-push-disabled") return;
            if (!root.TryGetProperty("ok", out var ok) || !ok.GetBoolean())
            {
                PageDescription.Text = "알림 해제를 완료하지 못했습니다. 로그인 상태를 확인해 주세요.";
                return;
            }

            ApplicationData.Current.LocalSettings.Values["windowsPushNotificationsEnabled"] = false;
            _windowsPushChannelUri = null;
            PushButton.Content = "예약 알림 켜기";
            PageDescription.Text = "새 예약 알림을 껐습니다.";
        }
        catch (JsonException)
        {
            // Ignore web messages not owned by the notification flow.
        }
    }

    private static bool IsOwnerPage(Uri? uri) =>
        uri is not null && uri.Host.Equals("www.petmanager.co.kr", StringComparison.OrdinalIgnoreCase) &&
        (uri.AbsolutePath.Equals("/owner", StringComparison.OrdinalIgnoreCase) ||
         uri.AbsolutePath.StartsWith("/owner/", StringComparison.OrdinalIgnoreCase));

    private static string GetWindowsPushDeviceId()
    {
        const string settingKey = "windowsPushDeviceId";
        var values = ApplicationData.Current.LocalSettings.Values;
        if (values[settingKey] is string existing && Guid.TryParse(existing, out _)) return existing;
        var created = Guid.NewGuid().ToString("N");
        values[settingKey] = created;
        return created;
    }

    private static async Task OpenExternalAsync(string url)
    {
        if (Uri.TryCreate(url, UriKind.Absolute, out var uri) && uri.Scheme is "https" or "http")
            await Launcher.LaunchUriAsync(uri);
    }
}
