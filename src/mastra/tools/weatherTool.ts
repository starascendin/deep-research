import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

type GeoResult = {
  results?: Array<{
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
    admin1?: string;
  }>;
};

type WeatherResult = {
  latitude: number;
  longitude: number;
  current?: {
    time?: string;
    temperature_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  current_units?: {
    temperature_2m?: string;
    wind_speed_10m?: string;
  };
};

// Simple mapper for WMO weather codes to descriptions
const WEATHER_CODE_MAP: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snow fall',
  73: 'Moderate snow fall',
  75: 'Heavy snow fall',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

export const weatherTool = createTool({
  id: 'weather',
  description: 'Get current weather for a city using Open-Meteo (no API key required).',
  inputSchema: z.object({
    city: z.string().min(1).describe('City name, e.g. "San Francisco"'),
    unit: z
      .enum(['celsius', 'fahrenheit'])
      .default('celsius')
      .describe('Temperature unit'),
  }),
  execute: async ({ context }) => {
    const { city, unit } = context as { city: string; unit: 'celsius' | 'fahrenheit' };

    try {
      // 1) Geocode city → lat/lon
      const geoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
      geoUrl.searchParams.set('name', city);
      geoUrl.searchParams.set('count', '1');

      const geoRes = await fetch(geoUrl.toString());
      if (!geoRes.ok) throw new Error(`Geocoding failed (${geoRes.status})`);
      const geo: GeoResult = await geoRes.json();
      const loc = geo.results?.[0];
      if (!loc) {
        return { error: `No location found for "${city}"`, results: [] };
      }

      // 2) Fetch current weather
      const isF = unit === 'fahrenheit';
      const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
      weatherUrl.searchParams.set('latitude', String(loc.latitude));
      weatherUrl.searchParams.set('longitude', String(loc.longitude));
      weatherUrl.searchParams.set('current', 'temperature_2m,weather_code,wind_speed_10m');
      weatherUrl.searchParams.set('temperature_unit', isF ? 'fahrenheit' : 'celsius');
      weatherUrl.searchParams.set('wind_speed_unit', 'mph');

      const wxRes = await fetch(weatherUrl.toString());
      if (!wxRes.ok) throw new Error(`Weather fetch failed (${wxRes.status})`);
      const wx: WeatherResult = await wxRes.json();

      const temp = wx.current?.temperature_2m;
      const code = wx.current?.weather_code ?? undefined;
      const wind = wx.current?.wind_speed_10m;
      const unitStr = wx.current_units?.temperature_2m || (isF ? '°F' : '°C');
      const windUnit = wx.current_units?.wind_speed_10m || 'mph';

      const description = code != null ? WEATHER_CODE_MAP[code] || `Code ${code}` : 'Unknown conditions';

      return {
        location: {
          city: loc.name,
          country: loc.country,
          region: loc.admin1,
          latitude: loc.latitude,
          longitude: loc.longitude,
        },
        current: {
          temperature: temp,
          temperature_unit: unitStr,
          conditions: description,
          wind_speed: wind,
          wind_unit: windUnit,
          time: wx.current?.time,
        },
      };
    } catch (error: any) {
      return { error: error?.message || 'Weather tool failed' };
    }
  },
});

