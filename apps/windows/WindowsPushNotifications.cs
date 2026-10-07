using Microsoft.Windows.PushNotifications;

namespace PetManager_Windows;

internal static class WindowsPushNotifications
{
    // Set this to the Microsoft Entra service-principal Object ID after registration.
    // The matching Application (client) ID must also be added to Package.appxmanifest.
    private static readonly Guid RemoteIdentifier = Guid.Empty;

    public static async Task<string?> RequestChannelUriAsync()
    {
        if (RemoteIdentifier == Guid.Empty || !PushNotificationManager.IsSupported()) return null;

        try
        {
            var manager = PushNotificationManager.Default;
            manager.Register();
            var result = await manager.CreateChannelAsync(RemoteIdentifier);
            return result.Status == PushNotificationChannelStatus.CompletedSuccess
                ? result.Channel.Uri.ToString()
                : null;
        }
        catch (Exception)
        {
            return null;
        }
    }
}
