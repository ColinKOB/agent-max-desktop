/**
 * WeatherWidget - Renders weather data as a polished card
 * Design: "List Rows" with hero current conditions + forecast rows with temp bars
 */
import React from 'react';
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  Wind,
} from 'lucide-react';

function getConditionIcon(condition) {
  const normalized = condition?.toLowerCase() || '';
  if (normalized.includes('partly')) return CloudSun;
  if (normalized.includes('sunny') || normalized.includes('clear')) return Sun;
  if (normalized.includes('storm') || normalized.includes('thunder')) return CloudLightning;
  if (normalized.includes('snow') || normalized.includes('sleet')) return CloudSnow;
  if (normalized.includes('rain') || normalized.includes('shower') || normalized.includes('drizzle')) return CloudRain;
  if (normalized.includes('fog') || normalized.includes('mist') || normalized.includes('haze')) return CloudFog;
  if (normalized.includes('wind')) return Wind;
  return Cloud;
}

const WeatherWidget = React.memo(function WeatherWidget({ data }) {
  if (!data) return null;

  const { location, current, forecast } = data;

  // Find the overall min/max across all forecast days for the temp bar scale
  let overallMin = current?.low ?? 999;
  let overallMax = current?.high ?? -999;
  if (forecast) {
    forecast.forEach(day => {
      if (day.low < overallMin) overallMin = day.low;
      if (day.high > overallMax) overallMax = day.high;
    });
  }
  const tempRange = overallMax - overallMin || 1;
  const CurrentConditionIcon = getConditionIcon(current?.condition);

  return (
    <div className="display-card rich-widget-weather">
      {/* Hero: Current conditions */}
      {current && (
        <div className="weather-hero">
          <div className="weather-hero-left">
            <div className="weather-location">{location || 'Weather'}</div>
            <div className="weather-current-temp">{current.temp}°</div>
            <div className="weather-condition">
              <CurrentConditionIcon size={15} strokeWidth={1.75} aria-hidden="true" />
              <span>{current.condition}</span>
            </div>
          </div>
          <div className="weather-hero-right">
            <span className="weather-hi-lo">H:{current.high}° L:{current.low}°</span>
          </div>
        </div>
      )}

      {/* Forecast rows */}
      {forecast && forecast.length > 0 && (
        <div className="weather-forecast">
          {forecast.map((day, i) => {
            const barLeft = ((day.low - overallMin) / tempRange) * 100;
            const barWidth = ((day.high - day.low) / tempRange) * 100;
            const ForecastConditionIcon = getConditionIcon(day.condition);
            return (
              <div key={i} className="weather-forecast-row">
                <span className="weather-day">{day.day}</span>
                <span className="weather-row-icon" title={day.condition}>
                  <ForecastConditionIcon size={14} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="weather-row-low">{day.low}°</span>
                <div className="weather-temp-bar-track">
                  <div
                    className="weather-temp-bar-fill"
                    style={{ left: `${barLeft}%`, width: `${Math.max(barWidth, 4)}%` }}
                  />
                </div>
                <span className="weather-row-high">{day.high}°</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default WeatherWidget;
