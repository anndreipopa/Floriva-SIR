using Licenta.API.DTOs;
using Licenta.API.Hubs;
using Licenta.API.Services.Interfaces;
using Microsoft.AspNetCore.SignalR;

namespace Licenta.API.Services;

/// <summary>
/// Pushes calibration changes on the scale hub. Same hub as the weight readings on purpose:
/// the calibration card needs both, so the browser keeps a single connection.
/// </summary>
public sealed class SignalRCalibrationUpdatePublisher : ICalibrationUpdatePublisher
{
    public const string CalibrationUpdatedEvent = "CalibrationUpdated";
    private readonly IHubContext<ScaleHub> _hubContext;

    public SignalRCalibrationUpdatePublisher(IHubContext<ScaleHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public Task CalibrationUpdatedAsync(CalibrationDto calibration, CancellationToken cancellationToken)
    {
        return _hubContext.Clients.All.SendAsync(
            CalibrationUpdatedEvent,
            calibration,
            cancellationToken);
    }
}
