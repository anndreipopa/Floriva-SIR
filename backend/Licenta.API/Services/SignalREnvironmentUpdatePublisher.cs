using Licenta.API.DTOs;
using Licenta.API.Hubs;
using Licenta.API.Services.Interfaces;
using Microsoft.AspNetCore.SignalR;

namespace Licenta.API.Services;

public sealed class SignalREnvironmentUpdatePublisher : IEnvironmentUpdatePublisher
{
    public const string ReadingReceivedEvent = "EnvironmentReadingReceived";
    private readonly IHubContext<EnvironmentHub> _hubContext;
    public SignalREnvironmentUpdatePublisher(
        IHubContext<EnvironmentHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public Task ReadingReceivedAsync(
        EnvironmentReadingDto reading,
        CancellationToken cancellationToken)
    {
        return _hubContext.Clients.All.SendAsync(
            ReadingReceivedEvent,
            reading,
            cancellationToken
        );
    }
}