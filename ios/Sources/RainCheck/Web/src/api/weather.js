const BASE='https://api.open-meteo.com/v1/forecast';
const AQI='https://air-quality-api.open-meteo.com/v1/air-quality';
const request=async(url,{timeout=12000}={})=>{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  try{const r=await fetch(url,{signal:controller.signal});if(!r.ok)throw new Error(`Weather request failed (${r.status})`);const data=await r.json();if(data.error)throw new Error(data.reason||'Weather provider returned an error');return data}
  finally{clearTimeout(timer)}
};
export async function fetchWeather(lat,lon){
  if(!Number.isFinite(lat)||!Number.isFinite(lon))throw new Error('Invalid location coordinates');
  const u=new URL(BASE);u.searchParams.set('latitude',lat);u.searchParams.set('longitude',lon);u.searchParams.set('timezone','auto');u.searchParams.set('forecast_days','10');u.searchParams.set('past_days','1');
  u.searchParams.set('current','temperature_2m,relative_humidity_2m,apparent_temperature,dew_point_2m,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m');
  u.searchParams.set('hourly','temperature_2m,relative_humidity_2m,apparent_temperature,dew_point_2m,precipitation_probability,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,visibility,uv_index');
  u.searchParams.set('daily','weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,precipitation_sum,uv_index_max,wind_speed_10m_max,wind_gusts_10m_max');
  return request(u);
}
export async function fetchAirQuality(lat,lon){
  const u=new URL(AQI);u.searchParams.set('latitude',lat);u.searchParams.set('longitude',lon);u.searchParams.set('timezone','auto');u.searchParams.set('forecast_days','2');u.searchParams.set('hourly','us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone');
  return request(u,{timeout:9000});
}
