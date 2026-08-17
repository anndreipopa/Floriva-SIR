using Licenta.API.Models;

namespace Licenta.API.Services;

public class SensorReadingStore
{
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
