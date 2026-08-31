using Licenta.API.Models;

namespace Licenta.API.Services;
/// <summary>
/// Holds the latest MQTT reading in memory for API and persistence access.
/// This state is lost whenever the app restarts
/// </summary>
public class SensorReadingStore
{
    //MQTT and HTTP/background operations can access the value at the same time
    private readonly object _lock = new();
    private SensorReading? _latest;

    public void SetLatest(SensorReading reading)
    {
        lock (_lock)
        {
            _latest = reading;
        }
    }

    public SensorReading? GetLatest()
    {
        lock (_lock)
        {
            return _latest;
        }
    }

}
