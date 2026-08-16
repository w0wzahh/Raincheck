export const APP_VERSION = '10.0.0';
export const STORAGE_KEYS = {
  settings: 'raincheck_v7_settings',
  places: 'raincheck_v7_places',
  history: 'raincheck_v7_history',
  cache: 'raincheck_v7_weather_cache',
  radar: 'raincheck_v7_radar',
  lastLocation: 'raincheck_v7_last_location'
};

export const WEATHER = {
  0:['Clear','Clear sky','sun'],1:['Mostly clear','Mostly clear','sun'],2:['Partly cloudy','Partly cloudy','cloud-sun'],3:['Overcast','Overcast','cloud'],45:['Fog','Foggy','smog'],48:['Fog','Rime fog','smog'],51:['Drizzle','Light drizzle','cloud-rain'],53:['Drizzle','Drizzle','cloud-rain'],55:['Drizzle','Dense drizzle','cloud-rain'],56:['Freezing drizzle','Freezing drizzle','snowflake'],57:['Freezing drizzle','Dense freezing drizzle','snowflake'],61:['Rain','Light rain','cloud-rain'],63:['Rain','Moderate rain','cloud-rain'],65:['Heavy rain','Heavy rain','cloud-showers-heavy'],66:['Freezing rain','Freezing rain','snowflake'],67:['Freezing rain','Heavy freezing rain','snowflake'],71:['Snow','Light snow','snowflake'],73:['Snow','Moderate snow','snowflake'],75:['Snow','Heavy snow','snowflake'],77:['Snow grains','Snow grains','snowflake'],80:['Rain showers','Light showers','cloud-sun-rain'],81:['Rain showers','Moderate showers','cloud-showers-heavy'],82:['Rain showers','Heavy showers','cloud-showers-heavy'],85:['Snow showers','Light snow showers','snowflake'],86:['Snow showers','Heavy snow showers','snowflake'],95:['Thunderstorm','Thunderstorm','bolt'],96:['Thunderstorm','Thunderstorm with hail','bolt'],99:['Thunderstorm','Severe thunderstorm with hail','bolt']
};
export const weatherInfo = code => WEATHER[code] || ['Unknown','Weather conditions unavailable','cloud'];
export const DEFAULT_SETTINGS = {
  unit:'metric', theme:'auto', reducedMotion:false, notifications:false, defaultPlaceId:'',
  activityMode:'balanced', morningBriefing:true, eveningBriefing:true,
  notificationRainChance:60, notificationHeat:35, notificationWind:55,
  commuteMinutes:30, radarAutoplay:false, scheduledBriefing:false,
  performanceMode:'auto', performanceFps:60, reduceEffects:false, reduceBlur:false, pauseRadarWhenHidden:true
};
