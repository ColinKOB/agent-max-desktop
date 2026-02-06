/**
 * WeatherWidget - Renders weather data as a polished card
 * Design: "List Rows" with hero current conditions + forecast rows with temp bars
 */
import React from 'react';

const conditionEmoji = {
  'Clear': '☀️',
  'Sunny': '☀️',
  'Partly Cloudy': '⛅',
  'Cloudy': '☁️',
  'Overcast': '☁️',
  'Rain': '🌧️',
  'Drizzle': '🌦️',
  'Snow': '❄️',
  'Storms': '⛈️',
  'Thunderstorm': '⛈️',
  'Fog': '🌫️',
  'Windy': '💨',
  'Haze': '🌫️',
  'Sleet': '🌨️',
  'Showers': '🌦️',
};

function getEmoji(condition) {
  if (!condition) return '🌡️';
  // Try exact match first, then partial
  if (conditionEmoji[condition]) return conditionEmoji[condition];
  const lower = condition.toLowerCase();
  for (const [key, emoji] of Object.entries(conditionEmoji)) {
    if (lower.includes(key.toLowerCase())) return emoji;
  }
  return '🌡️';
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

  return (
    <div className="rich-widget rich-widget-weather">
      {/* Hero: Current conditions */}
      {current && (
        <div className="weather-hero">
          <div className="weather-hero-left">
            <div className="weather-location">{location || 'Weather'}</div>
            <div className="weather-current-temp">{current.temp}°</div>
            <div className="weather-condition">
              {getEmoji(current.condition)} {current.condition}
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
            return (
              <div key={i} className="weather-forecast-row">
                <span className="weather-day">{day.day}</span>
                <span className="weather-row-emoji">{getEmoji(day.condition)}</span>
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
