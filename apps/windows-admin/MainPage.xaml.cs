using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.Web.WebView2.Core;
using Windows.System;

namespace PetManager_Admin_Windows;

public sealed partial class MainPage : Page
{
    private const string AdminUrl = "https://www.petmanager.co.kr/admin";
    private static readonly HashSet<string> InAppHosts = new(StringComparer.OrdinalIgnoreCase)
    {
        "www.petmanager.co.kr",
    };

    private bool _webViewReady;

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
            _webViewReady = true;
            PetManagerWebView.Source = new Uri(AdminUrl);
        }
        catch (Exception)
        {
            PageDescription.Text = "관리자 페이지를 열지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.";
        }
    }

    private void RefreshButton_Click(object sender, RoutedEventArgs e)
    {
        if (_webViewReady) PetManagerWebView.CoreWebView2.Reload();
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

    private void CoreWebView2_NavigationCompleted(CoreWebView2 sender, CoreWebView2NavigationCompletedEventArgs args)
    {
        PageDescription.Text = args.IsSuccess
            ? "관리자 계정으로 로그인하세요."
            : "연결에 실패했습니다. 새로고침을 눌러 다시 시도해 주세요.";
    }

    private static async Task OpenExternalAsync(string url)
    {
        if (Uri.TryCreate(url, UriKind.Absolute, out var uri) && uri.Scheme is "https" or "http")
            await Launcher.LaunchUriAsync(uri);
    }
}
