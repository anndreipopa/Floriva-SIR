using Licenta.API.DTOs;
namespace Licenta.API.Services.Interfaces;

public interface IWeatherService
{
    Task<WeatherResponseDto> GetWeatherAsync(CancellationToken cancellationToken = default);
}