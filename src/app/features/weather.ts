export interface DailyForecast {
  /** YYYY-MM-DD */
  date: string;
  /** WMO weather code */
  code: number;
  max: number;
  min: number;
  /** Highest chance of rain that day, % */
  rain: number;
  /** Strongest wind, km/h */
  wind: number;
}

/** Open-Meteo's daily block, as requested by WeatherService */
export interface OpenMeteoDaily {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_probability_max: (number | null)[];
  wind_speed_10m_max: number[];
}

export function toForecast(daily: OpenMeteoDaily): DailyForecast[] {
  return daily.time.map((date, i) => ({
    date,
    code: daily.weather_code[i],
    max: Math.round(daily.temperature_2m_max[i]),
    min: Math.round(daily.temperature_2m_min[i]),
    rain: daily.precipitation_probability_max[i] ?? 0,
    wind: Math.round(daily.wind_speed_10m_max[i]),
  }));
}

/** WMO code → short description and emoji */
export function describeWeather(code: number): { label: string; icon: string } {
  if (code === 0) return { label: 'Clear', icon: '☀️' };
  if (code <= 2) return { label: 'Partly cloudy', icon: '⛅' };
  if (code === 3) return { label: 'Cloudy', icon: '☁️' };
  if (code <= 48) return { label: 'Fog', icon: '🌫️' };
  if (code <= 57) return { label: 'Drizzle', icon: '🌦️' };
  if (code <= 67 || (code >= 80 && code <= 82)) return { label: 'Rain', icon: '🌧️' };
  if (code <= 77 || code === 85 || code === 86) return { label: 'Snow', icon: '🌨️' };
  return { label: 'Thunderstorms', icon: '⛈️' };
}

export function weatherWarnings(day: DailyForecast): string[] {
  const warnings: string[] = [];
  if (day.code >= 95) warnings.push('Thunderstorms');
  else if ((day.code >= 71 && day.code <= 77) || day.code === 85 || day.code === 86) warnings.push('Snow');
  if (day.rain >= 60) warnings.push(`Rain likely (${day.rain}%)`);
  if (day.wind >= 50) warnings.push(`Strong wind (${day.wind} km/h)`);
  if (day.max >= 30) warnings.push(`Hot (${day.max}°)`);
  if (day.min <= -5) warnings.push(`Freezing (${day.min}°)`);
  return warnings;
}
