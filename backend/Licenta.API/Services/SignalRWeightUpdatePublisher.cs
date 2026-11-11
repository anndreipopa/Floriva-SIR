using Licenta.API.DTOs;
using Licenta.API.Hubs;
using Licenta.API.Services.Interfaces;
using Microsoft.AspNetCore.SignalR;

namespace Licenta.API.Services;

public sealed class SignalRWeightUpdatePublisher : IWeightUpdatePublisher
{
    public const string WeightReadingReceivedEvent = "WeightReadingReceived";
    private readonly IHubContext<ScaleHub> _hubContext;

    public SignalRWeightUpdatePublisher(IHubContext<ScaleHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public Task WeightReadingReceivedAsync(
        WeightReadingDto reading,
        CancellationToken cancellationToken)
    {
        return _hubContext.Clients.All.SendAsync(
            WeightReadingReceivedEvent,
            reading,
            cancellationToken);
    }
}
