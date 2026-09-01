using Licenta.API.DTOs;

namespace Licenta.API.Services.Interfaces;

public interface IEnvironmentUpdatePublisher
{
    Task ReadingReceivedAsync(
        EnvironmentReadingDto reading,
        CancellationToken cancellationToken
    );
}