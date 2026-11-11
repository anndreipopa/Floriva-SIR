using Licenta.API.DTOs;

namespace Licenta.API.Services.Interfaces;

public interface IWeightUpdatePublisher
{
    Task WeightReadingReceivedAsync(
        WeightReadingDto reading,
        CancellationToken cancellationToken);
}
