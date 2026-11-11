using Microsoft.AspNetCore.SignalR;

namespace Licenta.API.Hubs;

/// <summary>
/// SignalR endpoint used to deliver live weight readings to the Scale page.
/// </summary>
public sealed class ScaleHub : Hub
{
}
