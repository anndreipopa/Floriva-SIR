namespace Licenta.API.Models;
/// <summary>
/// Represents both an incoming environment readings and a persisted database row.
/// </summary>
public class SensorReading
{
    public int Id { get; set; }
    //Timestamp assigned by the backend when MQTT message is received
    public DateTime ReceivedAtUtc { get; set; }
    public float Temperature { get; set; }
    public float Humidity {get; set; }
    public float Lux{ get; set; }
}