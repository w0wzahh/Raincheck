import {weatherInfo} from '../core/config.js?v=10.0.0';

const PERIODS = [
  ['Morning', 6, 11, 'sunrise'],
  ['Afternoon', 12, 16, 'sun'],
  ['Evening', 17, 20, 'moon'],
  ['Night', 21, 5, 'moon']
];

const inPeriod = (hour, start, end) =>
  start <= end ? hour >= start && hour <= end : hour >= start || hour <= end;

export function dayTimeline(data) {
  const h = data?.hourly;
  if (!h?.time?.length) return [];
  const rows = h.time.map((time, i) => ({
    time: new Date(time),
    temp: h.temperature_2m?.[i],
    rain: h.precipitation_probability?.[i] ?? 0,
    precip: h.precipitation?.[i] ?? 0,
    wind: h.wind_speed_10m?.[i] ?? 0,
    code: h.weather_code?.[i]
  })).filter(x => x.time.getTime() >= Date.now() - 30 * 60e3);

  return PERIODS.map(([label, start, end, icon]) => {
    const matches = rows.filter(x => inPeriod(x.time.getHours(), start, end)).slice(0, 8);
    if (!matches.length) return null;
    const rain = Math.max(...matches.map(x => x.rain));
    const temp = Math.round(matches.reduce((sum, x) => sum + (x.temp ?? 0), 0) / matches.length);
    const wind = Math.round(Math.max(...matches.map(x => x.wind)));
    const precip = matches.reduce((sum, x) => sum + (x.precip || 0), 0);
    const representative = matches.reduce((best, x) => (x.rain > best.rain ? x : best), matches[0]);
    return {label, icon, temp, rain, wind, precip, code: representative.code, condition: weatherInfo(representative.code)[0]};
  }).filter(Boolean);
}
