namespace Licenta.API.Mqtt;

public class MqttOptions
{
    public string Host {get; set; } = string.Empty;
    public int Port { get; set; }
    public string Username{ get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Topic { get; set; } = string.Empty;
    public bool UseTls { get; set; }
}