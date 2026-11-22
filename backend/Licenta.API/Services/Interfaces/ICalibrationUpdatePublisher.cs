using Licenta.API.DTOs;

namespace Licenta.API.Services.Interfaces;

public interface ICalibrationUpdatePublisher
{
    Task CalibrationUpdatedAsync(CalibrationDto calibration, CancellationToken cancellationToken);
}
