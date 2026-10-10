const BASE='https://archive-api.open-meteo.com/v1/archive';
export async function fetchHistoricalWeek(lat,lon){
  const end=new Date();end.setDate(end.getDate()-1);const start=new Date(end);start.setDate(start.getDate()-6);const iso=d=>d.toISOString().slice(0,10);
  const u=new URL(BASE);u.searchParams.set('latitude',lat);u.searchParams.set('longitude',lon);u.searchParams.set('start_date',iso(start));u.searchParams.set('end_date',iso(end));u.searchParams.set('timezone','auto');u.searchParams.set('hourly','temperature_2m,precipitation,wind_speed_10m,weather_code');u.searchParams.set('daily','temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max');
  const r=await fetch(u);if(!r.ok)throw new Error('Historical data unavailable');const d=await r.json();if(d.error)throw new Error(d.reason||'Historical data unavailable');return d;
}
