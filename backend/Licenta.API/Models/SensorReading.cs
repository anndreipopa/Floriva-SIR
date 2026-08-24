namespace Licenta.API.Models;

public class SensorReading
{
    public int Id { get; set; }
    public DateTime ReceivedAtUtc { get; set; }
    public float Temperature { get; set; }
    public float Humidity {get; set; }
    public float Lux{ get; set; }
}