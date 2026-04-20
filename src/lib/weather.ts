export interface WeatherData {
  location: string;
  tempF: number;
  feelsLikeF: number;
  condition: string;
  conditionCode: number;
  precipChance: number;
  windMph: number;
  humidity: number;
  forecast: { day: string; high: number; low: number; precipChance: number; code: number }[];
}

// WMO weather code → human label
function conditionLabel(code: number): string {
  if (code === 0)            return "Clear sky";
  if (code <= 2)             return "Partly cloudy";
  if (code === 3)            return "Overcast";
  if (code <= 49)            return "Foggy";
  if (code <= 57)            return "Drizzle";
  if (code <= 67)            return "Rainy";
  if (code <= 77)            return "Snow";
  if (code <= 82)            return "Rain showers";
  if (code <= 86)            return "Snow showers";
  if (code >= 95)            return "Thunderstorms";
  return "Cloudy";
}

const LOCATIONS = {
  orlando:     { lat: 28.5383, lon: -81.3792, name: "Orlando" },
  tallahassee: { lat: 30.4383, lon: -84.2807, name: "Tallahassee" },
};

export async function fetchWeather(location: keyof typeof LOCATIONS = "orlando"): Promise<WeatherData> {
  const { lat, lon, name } = LOCATIONS[location];

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat.toString());
  url.searchParams.set("longitude", lon.toString());
  url.searchParams.set("current", "temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,weather_code,relative_humidity_2m");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("timezone", "America/New_York");
  url.searchParams.set("forecast_days", "5");

  const res = await fetch(url.toString(), { next: { revalidate: 900 } });
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);

  const d = await res.json();
  const c = d.current;
  const daily = d.daily;

  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return {
    location: name,
    tempF: Math.round(c.temperature_2m),
    feelsLikeF: Math.round(c.apparent_temperature),
    condition: conditionLabel(c.weather_code),
    conditionCode: c.weather_code,
    precipChance: c.precipitation_probability ?? 0,
    windMph: Math.round(c.wind_speed_10m),
    humidity: c.relative_humidity_2m ?? 0,
    forecast: (daily.time as string[]).slice(0, 5).map((dateStr: string, i: number) => ({
      day: i === 0 ? "Today" : DAYS[new Date(dateStr + "T12:00:00").getDay()],
      high: Math.round(daily.temperature_2m_max[i]),
      low: Math.round(daily.temperature_2m_min[i]),
      precipChance: daily.precipitation_probability_max[i] ?? 0,
      code: daily.weather_code[i],
    })),
  };
}
