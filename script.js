// ============================================
// RAINCHECK — Weather App
// ============================================

// ── Security & Anti-Tampering ──
(function() {
    // Console warning — large styled message
    const warnStyle = 'color:#e74c3c;font-size:20px;font-weight:900;text-shadow:1px 1px 2px rgba(0,0,0,.3)';
    const msgStyle = 'color:#2d3436;font-size:14px;font-weight:500';
    const smallStyle = 'color:#636e72;font-size:12px';
    console.log('%c⚠ STOP!', warnStyle);
    console.log('%cThis is a restricted area of the RainCheck application.', msgStyle);
    console.log('%cIf someone told you to copy-paste something here, it is a scam and will give them access to your data.', msgStyle);
    console.log('%cNo user should be tampering with the RainCheck website. Unauthorized inspection, modification, or reverse-engineering of this application is strictly prohibited.', msgStyle);
    console.log('%cFor security inquiries, contact the developer.', smallStyle);

    // Disable right-click context menu
    document.addEventListener('contextmenu', function(e) { e.preventDefault(); });

    // Block common dev tools shortcuts
    document.addEventListener('keydown', function(e) {
        // F12
        if (e.key === 'F12') { e.preventDefault(); return false; }
        // Ctrl+Shift+I (DevTools), Ctrl+Shift+J (Console), Ctrl+Shift+C (Inspector)
        if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
            e.preventDefault(); return false;
        }
        // Ctrl+U (View Source)
        if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) { e.preventDefault(); return false; }
    });

    // Detect DevTools open via debugger timing
    var _dtCheck = setInterval(function() {
        var start = performance.now();
        debugger;
        if (performance.now() - start > 100) {
            document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0984e3;color:#fff;font-family:Inter,sans-serif;text-align:center;padding:2rem"><div><h1 style="font-size:2rem;margin-bottom:1rem">⚠ Access Denied</h1><p style="font-size:1.1rem;opacity:.9;max-width:400px">Developer tools detected. Please close them and refresh the page to continue using RainCheck.</p></div></div>';
            clearInterval(_dtCheck);
        }
    }, 1000);

    // Disable text selection on the page (except inputs/textareas)
    document.addEventListener('selectstart', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
    });

    // Disable drag
    document.addEventListener('dragstart', function(e) { e.preventDefault(); });
})();

// Open-Meteo API Configuration
const BASE_URL = 'https://api.open-meteo.com/v1';
const GEO_URL = 'https://geocoding-api.open-meteo.com/v1';

// WMO Weather code to icon mapping
const WEATHER_ICONS = {
    0: '01', 1: '02', 2: '02', 3: '03',
    45: '50', 48: '50',
    51: '09', 53: '09', 55: '09',
    56: '13', 57: '13',
    61: '10', 63: '10', 65: '10',
    66: '13', 67: '13',
    71: '13', 73: '13', 75: '13', 77: '13',
    80: '09', 81: '09', 82: '09',
    85: '13', 86: '13',
    95: '11', 96: '11', 99: '11'
};

const WEATHER_DESCRIPTIONS = {
    0: { main: 'Clear', description: 'clear sky' },
    1: { main: 'Mainly Clear', description: 'mainly clear' },
    2: { main: 'Partly Cloudy', description: 'partly cloudy' },
    3: { main: 'Overcast', description: 'overcast' },
    45: { main: 'Fog', description: 'foggy' },
    48: { main: 'Fog', description: 'depositing rime fog' },
    51: { main: 'Drizzle', description: 'light drizzle' },
    53: { main: 'Drizzle', description: 'moderate drizzle' },
    55: { main: 'Drizzle', description: 'dense drizzle' },
    56: { main: 'Freezing Drizzle', description: 'light freezing drizzle' },
    57: { main: 'Freezing Drizzle', description: 'dense freezing drizzle' },
    61: { main: 'Rain', description: 'slight rain' },
    63: { main: 'Rain', description: 'moderate rain' },
    65: { main: 'Rain', description: 'heavy rain' },
    66: { main: 'Freezing Rain', description: 'light freezing rain' },
    67: { main: 'Freezing Rain', description: 'heavy freezing rain' },
    71: { main: 'Snow', description: 'slight snow fall' },
    73: { main: 'Snow', description: 'moderate snow fall' },
    75: { main: 'Snow', description: 'heavy snow fall' },
    77: { main: 'Snow', description: 'snow grains' },
    80: { main: 'Rain Showers', description: 'slight rain showers' },
    81: { main: 'Rain Showers', description: 'moderate rain showers' },
    82: { main: 'Rain Showers', description: 'violent rain showers' },
    85: { main: 'Snow Showers', description: 'slight snow showers' },
    86: { main: 'Snow Showers', description: 'heavy snow showers' },
    95: { main: 'Thunderstorm', description: 'thunderstorm' },
    96: { main: 'Thunderstorm', description: 'thunderstorm with slight hail' },
    99: { main: 'Thunderstorm', description: 'thunderstorm with heavy hail' }
};

function getWeatherIconUrl(iconCode) {
    return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
}

// ── Global State ──
let currentUnit = 'metric';
let currentWeatherData = null;
let currentLat = null;
let currentLon = null;
let currentCityName = null;
let currentCountry = null;
let currentTheme = 'auto';
let autoThemeInterval = null;
let lastApiCall = 0;
const API_CALL_DELAY = 2000;
const CACHE_DURATION = 10 * 60 * 1000;
let searchDebounceTimer = null;

// ── DOM References ──
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const locationBtn = document.getElementById('locationBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const weatherContent = document.getElementById('weatherContent');
const suggestions = document.getElementById('suggestions');
const celsiusBtn = document.getElementById('celsiusBtn');
const fahrenheitBtn = document.getElementById('fahrenheitBtn');
const currentCity = document.getElementById('currentCity');
const currentDate = document.getElementById('currentDate');
const currentTime = document.getElementById('currentTime');
const currentWeatherIcon = document.getElementById('currentWeatherIcon');
const currentTemp = document.getElementById('currentTemp');
const weatherMain = document.getElementById('weatherMain');
const weatherDescription = document.getElementById('weatherDescription');
const visibility = document.getElementById('visibility');
const humidity = document.getElementById('humidity');
const windSpeed = document.getElementById('windSpeed');
const feelsLike = document.getElementById('feelsLike');
const tempMin = document.getElementById('tempMin');
const tempMax = document.getElementById('tempMax');
const pressure = document.getElementById('pressure');
const seaLevel = document.getElementById('seaLevel');
const groundLevel = document.getElementById('groundLevel');
const windDirection = document.getElementById('windDirection');
const windGust = document.getElementById('windGust');
const uvIndex = document.getElementById('uvIndex');
const sunrise = document.getElementById('sunrise');
const sunset = document.getElementById('sunset');
const hourlyForecast = document.getElementById('hourlyForecast');
const forecastContainer = document.getElementById('forecastContainer');
const mapFrame = document.getElementById('mapFrame');
const creditsBtn = document.getElementById('creditsBtn');
const creditsModal = document.getElementById('creditsModal');
const closeCreditsBtn = document.getElementById('closeCreditsBtn');
const themeBtn = document.getElementById('themeBtn');
const themeModal = document.getElementById('themeModal');
const closeThemeBtn = document.getElementById('closeThemeBtn');
const themeRadios = document.querySelectorAll('input[name="theme"]');
const lastUpdatedEl = document.getElementById('lastUpdated');

// ── Initialize ──
document.addEventListener('DOMContentLoaded', function () {
    cleanupCorruptedCache();
    loadThemePreference();
    if (currentTheme === 'auto') startAutoTheme();
    setupEventListeners();
    updateDateTime();
    setInterval(updateDateTime, 1000);

    // Try geolocation or fall back to last city / default
    const lastCity = localStorage.getItem('raincheck_lastCity');
    if (window.isSecureContext && navigator.geolocation) {
        const geoSuccess = async (pos) => {
            currentLat = pos.coords.latitude;
            currentLon = pos.coords.longitude;
            // Reverse geocode
            try {
                const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${currentLat}&lon=${currentLon}&format=json&zoom=10&addressdetails=1`, {
                    headers: { 'Accept-Language': 'en' }
                });
                const geo = await resp.json();
                if (geo?.address) {
                    currentCityName = geo.address.city || geo.address.town || geo.address.village || geo.address.municipality || geo.address.county || null;
                    currentCountry = geo.address.country || null;
                }
            } catch (e) { /* fallback to timezone name */ }
            getWeatherByCoords(currentLat, currentLon);
        };
        const geoFallback = () => getWeatherByCity(lastCity || 'New York');
        navigator.geolocation.getCurrentPosition(
            geoSuccess,
            () => {
                // Retry with low accuracy before giving up
                navigator.geolocation.getCurrentPosition(
                    geoSuccess, geoFallback,
                    { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
                );
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
    } else {
        getWeatherByCity(lastCity || 'New York');
    }
});

function cleanupCorruptedCache() {
    try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('weather_') && !key.endsWith('_time')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (!data || !data.current || !data.current.sys || !data.current.main ||
                        !data.current.weather || !data.forecast || !data.forecast.list) {
                        localStorage.removeItem(key);
                        localStorage.removeItem(`${key}_time`);
                    }
                } catch (e) {
                    localStorage.removeItem(key);
                    localStorage.removeItem(`${key}_time`);
                }
            }
        });
    } catch (e) { /* ignore */ }
}

// ── Event Listeners ──
function setupEventListeners() {
    searchBtn.addEventListener('click', handleSearch);
    cityInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch(); });
    cityInput.addEventListener('input', handleCityInput);
    cityInput.addEventListener('focus', () => {
        if (cityInput.value.length > 2) {
            getCitySuggestions(cityInput.value);
        } else if (cityInput.value.length === 0) {
            showRecentSearches();
        }
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-section')) hideSuggestions();
    });
    locationBtn.addEventListener('click', getCurrentLocation);
    celsiusBtn.addEventListener('click', () => switchTemperatureUnit('metric'));
    fahrenheitBtn.addEventListener('click', () => switchTemperatureUnit('imperial'));

    // Map controls
    document.querySelectorAll('.map-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.map-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            updateWeatherMap(this.dataset.layer);
        });
    });

    // Theme modal
    themeBtn.addEventListener('click', () => openModal(themeModal));
    closeThemeBtn.addEventListener('click', () => closeModal(themeModal));
    themeRadios.forEach(radio => {
        radio.addEventListener('change', function () {
            if (this.checked) {
                changeTheme(this.value);
                closeModal(themeModal);
            }
        });
    });

    // Credits modal
    creditsBtn.addEventListener('click', () => openModal(creditsModal));
    closeCreditsBtn.addEventListener('click', () => closeModal(creditsModal));

    // Modal backdrop closes
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', () => {
            const modalId = backdrop.dataset.close;
            if (modalId) closeModal(document.getElementById(modalId));
            else closeModal(backdrop.closest('.modal'));
        });
    });

    // Escape key closes modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal:not(.hidden)').forEach(m => closeModal(m));
        }
        // Keyboard shortcut: / to focus search
        if (e.key === '/' && !e.target.closest('input') && !e.target.closest('textarea')) {
            e.preventDefault();
            cityInput.focus();
        }
    });

    // Keyboard navigation for suggestions
    document.addEventListener('keydown', handleSuggestionNav);
}

// ── Modal Helpers ──
function openModal(modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    if (modal === themeModal) {
        const radio = document.getElementById(currentTheme + 'Theme');
        if (radio) radio.checked = true;
    }
}
function closeModal(modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

// ── Search ──
function handleSearch() {
    const city = cityInput.value.trim();
    if (city) getWeatherByCity(city);
}

function handleCityInput() {
    const query = cityInput.value.trim();
    clearTimeout(searchDebounceTimer);
    if (query.length > 2) {
        searchDebounceTimer = setTimeout(() => getCitySuggestions(query), 300);
    } else if (query.length === 0) {
        showRecentSearches();
    } else {
        hideSuggestions();
    }
}

function getCurrentLocation() {
    if (!window.isSecureContext) {
        showToast('Location requires HTTPS — try searching for your city instead');
        return;
    }
    if (!navigator.geolocation) {
        showToast('Geolocation is not supported by this browser');
        return;
    }
    showLoading();

    const onSuccess = async (pos) => {
        currentLat = pos.coords.latitude;
        currentLon = pos.coords.longitude;
        // Reverse geocode to get actual city name
        try {
            const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${currentLat}&lon=${currentLon}&format=json&zoom=10&addressdetails=1`, {
                headers: { 'Accept-Language': 'en' }
            });
            const geo = await resp.json();
            if (geo?.address) {
                currentCityName = geo.address.city || geo.address.town || geo.address.village || geo.address.municipality || geo.address.county || null;
                currentCountry = geo.address.country || null;
            }
        } catch (e) {
            // Reverse geocoding failed — will fall back to timezone name
        }
        getWeatherByCoords(currentLat, currentLon);
    };

    const tryLowAccuracy = () => {
        navigator.geolocation.getCurrentPosition(
            onSuccess,
            (err) => {
                hideLoading();
                const messages = {
                    1: 'Location access denied — please allow location in your browser/app settings',
                    2: 'Could not determine your location — please search for a city',
                    3: 'Location request timed out — please check your GPS/network and try again'
                };
                showToast(messages[err.code] || 'Unable to get location');
            },
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
        );
    };

    navigator.geolocation.getCurrentPosition(
        onSuccess,
        () => tryLowAccuracy(),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
}

// ── API: Get Weather By City ──
async function getWeatherByCity(cityName) {
    try {
        showLoading();
        const geoResponse = await fetch(`${GEO_URL}/search?name=${encodeURIComponent(cityName)}&count=10&language=en&format=json`);
        const geoData = await geoResponse.json();

        if (!geoData.results || geoData.results.length === 0) {
            hideLoading();
            showError(`No results found for "${cityName}". Please try a different search.`);
            return;
        }

        // Auto-select if single result or exact name match
        const exactMatch = geoData.results.find(r => r.name.toLowerCase() === cityName.toLowerCase());
        if (geoData.results.length === 1 || exactMatch) {
            const result = exactMatch || geoData.results[0];
            currentCityName = result.name;
            currentCountry = result.country;
            await getWeatherByCoords(result.latitude, result.longitude);
        } else {
            hideLoading();
            displaySuggestions(geoData.results);
        }
    } catch (error) {
        hideLoading();
        showError(`Unable to find weather data for "${cityName}".`);
        console.error('getWeatherByCity error:', error);
    }
}

// ── API: Rate Limited Fetch ──
async function rateLimitedFetch(url) {
    const now = Date.now();
    const timeSince = now - lastApiCall;
    if (timeSince < API_CALL_DELAY) {
        await new Promise(r => setTimeout(r, API_CALL_DELAY - timeSince));
    }
    lastApiCall = Date.now();
    const response = await fetch(url);
    if (response.status === 429) throw new Error('Rate limit exceeded.');
    if (!response.ok) throw new Error(`API request failed: ${response.status}`);
    return response;
}

// ── Data Transformers ──
function transformCurrentWeather(data, lat, lon) {
    const current = data.current;
    const daily = data.daily;
    const weatherCode = current.weather_code || 0;
    const weather = WEATHER_DESCRIPTIONS[weatherCode] || { main: 'Unknown', description: 'unknown' };
    const iconCode = WEATHER_ICONS[weatherCode] || '01';
    const iconSuffix = current.is_day ? 'd' : 'n';

    return {
        name: currentCityName || data.timezone?.split('/').pop().replace(/_/g, ' ') || 'Location',
        sys: {
            country: currentCountry || data.timezone?.split('/')[0] || '',
            sunrise: new Date(daily.sunrise[0]).getTime() / 1000,
            sunset: new Date(daily.sunset[0]).getTime() / 1000
        },
        main: {
            temp: current.temperature_2m,
            feels_like: current.apparent_temperature,
            temp_min: daily.temperature_2m_min[0],
            temp_max: daily.temperature_2m_max[0],
            pressure: current.pressure_msl || current.surface_pressure,
            humidity: current.relative_humidity_2m,
            sea_level: current.pressure_msl,
            grnd_level: current.surface_pressure
        },
        weather: [{ main: weather.main, description: weather.description, icon: iconCode + iconSuffix }],
        wind: {
            speed: current.wind_speed_10m,
            deg: current.wind_direction_10m,
            gust: current.wind_gusts_10m
        },
        visibility: current.cloud_cover !== undefined ? Math.max(1, Math.round((100 - current.cloud_cover) / 10)) * 1000 : 10000,
        clouds: { all: current.cloud_cover },
        dt: Math.floor(new Date(current.time).getTime() / 1000),
        timezone: data.utc_offset_seconds
    };
}

function transformForecastData(data) {
    const hourly = data.hourly;
    const list = [];

    // Find the index of the current hour (skip past hours)
    const now = new Date();
    let startIndex = 0;
    for (let i = 0; i < hourly.time.length; i++) {
        const hourTime = new Date(hourly.time[i]);
        if (hourTime >= new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours())) {
            startIndex = i;
            break;
        }
    }

    // Take 24 hours from current hour
    for (let i = startIndex; i < Math.min(startIndex + 24, hourly.time.length); i++) {
        const weatherCode = hourly.weather_code[i] || 0;
        const iconCode = WEATHER_ICONS[weatherCode] || '01';
        const hour = new Date(hourly.time[i]).getHours();
        const iconSuffix = (hour >= 6 && hour < 20) ? 'd' : 'n';
        const weather = WEATHER_DESCRIPTIONS[weatherCode] || { main: 'Unknown', description: 'unknown' };
        list.push({
            dt: Math.floor(new Date(hourly.time[i]).getTime() / 1000),
            main: { temp: hourly.temperature_2m[i], temp_min: hourly.temperature_2m[i], temp_max: hourly.temperature_2m[i], humidity: hourly.relative_humidity_2m ? hourly.relative_humidity_2m[i] : data.current.relative_humidity_2m },
            weather: [{ main: weather.main, description: weather.description, icon: iconCode + iconSuffix }],
            wind: { speed: hourly.wind_speed_10m ? hourly.wind_speed_10m[i] : data.current.wind_speed_10m },
            pop: (hourly.precipitation_probability[i] || 0) / 100
        });
    }
    return { list };
}

function transformDailyForecast(data) {
    const daily = data.daily;
    const dailyList = [];
    for (let i = 1; i < Math.min(8, daily.time.length); i++) {
        const weatherCode = daily.weather_code[i] || 0;
        const iconCode = WEATHER_ICONS[weatherCode] || '01';
        const weather = WEATHER_DESCRIPTIONS[weatherCode] || { main: 'Unknown', description: 'unknown' };
        dailyList.push({
            dt: Math.floor(new Date(daily.time[i]).getTime() / 1000),
            temp: { max: daily.temperature_2m_max[i], min: daily.temperature_2m_min[i] },
            weather: [{ main: weather.main, description: weather.description, icon: iconCode + 'd' }],
            humidity: 0,
            wind: { speed: daily.wind_speed_10m_max[i] }
        });
    }
    return dailyList;
}

// ── API: Get Weather By Coordinates ──
async function getWeatherByCoords(lat, lon) {
    try {
        showLoading();
        currentLat = lat;
        currentLon = lon;

        // Check cache
        const cacheKey = `weather_${lat.toFixed(4)}_${lon.toFixed(4)}_${currentUnit}`;
        const cachedData = localStorage.getItem(cacheKey);
        const cacheTimestamp = localStorage.getItem(`${cacheKey}_time`);

        if (cachedData && cacheTimestamp) {
            const age = Date.now() - parseInt(cacheTimestamp);
            if (age < CACHE_DURATION) {
                try {
                    const parsed = JSON.parse(cachedData);
                    if (parsed?.current?.sys && parsed?.current?.main && parsed?.current?.weather && parsed?.forecast?.list) {
                        currentWeatherData = parsed;
                        displayWeatherData();
                        hideLoading();
                        return;
                    }
                } catch (e) { /* fall through */ }
                localStorage.removeItem(cacheKey);
                localStorage.removeItem(`${cacheKey}_time`);
            }
        }

        const tempUnit = currentUnit === 'metric' ? 'celsius' : 'fahrenheit';
        const windUnit = currentUnit === 'metric' ? 'kmh' : 'mph';

        const weatherUrl = `${BASE_URL}/forecast?latitude=${lat}&longitude=${lon}` +
            `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
            `&hourly=temperature_2m,weather_code,precipitation_probability,precipitation,wind_speed_10m,relative_humidity_2m` +
            `&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,uv_index_max,precipitation_sum,rain_sum,showers_sum,snowfall_sum,precipitation_hours,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant` +
            `&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}&precipitation_unit=mm&timezone=auto&forecast_days=7`;

        const weatherResponse = await rateLimitedFetch(weatherUrl);
        const weatherData = await weatherResponse.json();

        if (!weatherData?.current || !weatherData?.hourly || !weatherData?.daily) {
            throw new Error('Invalid weather data received');
        }

        // Fetch Air Quality data
        let aqiData = null;
        try {
            const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,us_aqi,pm10,pm2_5,nitrogen_dioxide,ozone&timezone=auto`;
            const aqiResp = await fetch(aqiUrl);
            aqiData = await aqiResp.json();
        } catch (e) { /* AQI optional */ }

        currentWeatherData = {
            current: transformCurrentWeather(weatherData, lat, lon),
            forecast: transformForecastData(weatherData),
            daily: transformDailyForecast(weatherData),
            uv: { value: weatherData.daily.uv_index_max[0] || null },
            timezone: weatherData.timezone,
            timezone_offset: weatherData.utc_offset_seconds,
            aqi: aqiData?.current || null,
            hourlyRaw: weatherData.hourly
        };

        try {
            localStorage.setItem(cacheKey, JSON.stringify(currentWeatherData));
            localStorage.setItem(`${cacheKey}_time`, Date.now().toString());
        } catch (e) { /* quota exceeded, ignore */ }

        displayWeatherData();
        hideLoading();
    } catch (error) {
        hideLoading();

        // Try cache fallback
        const cacheKey = `weather_${lat.toFixed(4)}_${lon.toFixed(4)}_${currentUnit}`;
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
            try {
                const parsed = JSON.parse(cachedData);
                if (parsed?.current?.sys && parsed?.current?.main && parsed?.current?.weather && parsed?.forecast?.list) {
                    currentWeatherData = parsed;
                    displayWeatherData();
                    showToast('Showing cached data — API temporarily unavailable');
                    return;
                }
            } catch (e) { /* fall through */ }
        }

        if (error.message.includes('Rate limit') || error.message.includes('429')) {
            showError('Rate limit exceeded. Please wait a moment and try again.');
        } else {
            showError('Unable to fetch weather data. Please try again later.');
        }
        console.error('Weather API Error:', error);
    }
}

// ── Display ──
function displayWeatherData() {
    if (!currentWeatherData?.current) return;
    const { current, forecast, uv } = currentWeatherData;
    updateCurrentWeather(current, uv);
    updateHourlyForecast(forecast.list.slice(0, 24));
    updateDailyForecast(currentWeatherData.daily);
    updateRainChance(forecast.list.slice(0, 12));
    updateAirQuality(currentWeatherData.aqi);
    updateFeelsLikeAdvice(current);
    updateWindCompass(current);

    const activeMapBtn = document.querySelector('.map-btn.active');
    const currentLayer = activeMapBtn ? activeMapBtn.dataset.layer : 'temp';
    createWeatherMap(currentLayer);

    weatherContent.classList.remove('hidden');
    weatherContent.classList.add('fade-in');

    // Update "last updated" timestamp
    if (lastUpdatedEl) {
        const now = new Date();
        lastUpdatedEl.textContent = `Updated ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // Save to recent searches
    if (currentCityName) {
        saveRecentSearch(currentCityName, currentCountry);
        localStorage.setItem('raincheck_lastCity', currentCityName);
    }

    if (currentTheme === 'auto') updateAutoTheme();
}

function updateCurrentWeather(data, uvData) {
    if (!data?.main || !data?.weather?.[0] || !data?.sys) return;

    currentCity.textContent = `${data.name}${data.sys.country ? ', ' + data.sys.country : ''}`;

    const iconCode = data.weather[0].icon;
    currentWeatherIcon.src = getWeatherIconUrl(iconCode);
    currentWeatherIcon.alt = data.weather[0].description;

    const temp = Math.round(data.main.temp);
    const unit = currentUnit === 'metric' ? '\u00b0C' : '\u00b0F';
    currentTemp.textContent = `${temp}${unit}`;

    weatherMain.textContent = data.weather[0].main;
    weatherDescription.textContent = data.weather[0].description;

    const visUnit = currentUnit === 'metric' ? 'km' : 'mi';
    const visVal = currentUnit === 'metric' 
        ? (data.visibility / 1000).toFixed(1) 
        : (data.visibility / 1609.34).toFixed(1);
    visibility.textContent = `${visVal} ${visUnit}`;
    humidity.textContent = `${data.main.humidity}%`;

    const windUnit = currentUnit === 'metric' ? 'km/h' : 'mph';
    windSpeed.textContent = `${data.wind.speed.toFixed(1)} ${windUnit}`;
    feelsLike.textContent = `${Math.round(data.main.feels_like)}${unit}`;
    tempMin.textContent = `${Math.round(data.main.temp_min)}${unit}`;
    tempMax.textContent = `${Math.round(data.main.temp_max)}${unit}`;
    pressure.textContent = `${data.main.pressure} hPa`;
    seaLevel.textContent = `${data.main.sea_level || data.main.pressure} hPa`;
    groundLevel.textContent = `${data.main.grnd_level || data.main.pressure} hPa`;

    if (data.wind.deg !== undefined) {
        windDirection.textContent = `${data.wind.deg}\u00b0 (${getWindDirection(data.wind.deg)})`;
    } else {
        windDirection.textContent = 'N/A';
    }

    if (data.wind.gust) {
        const gustUnit = currentUnit === 'metric' ? 'km/h' : 'mph';
        windGust.textContent = `${data.wind.gust.toFixed(1)} ${gustUnit}`;
    } else {
        windGust.textContent = 'No gusts';
    }

    uvIndex.textContent = uvData?.value !== undefined && uvData?.value !== null ? Math.round(uvData.value) : 'N/A';
    sunrise.textContent = formatTimeWithTimezone(data.sys.sunrise, data.timezone);
    sunset.textContent = formatTimeWithTimezone(data.sys.sunset, data.timezone);
}

function updateHourlyForecast(hourlyData) {
    hourlyForecast.innerHTML = '';
    const unit = currentUnit === 'metric' ? '\u00b0C' : '\u00b0F';
    hourlyData.forEach((hour, idx) => {
        const el = document.createElement('div');
        el.className = 'hourly-item' + (idx === 0 ? ' hourly-now' : '');
        const time = new Date(hour.dt * 1000);
        const timeLabel = idx === 0 ? 'Now' : formatTime(time);
        el.innerHTML = `
            <div class="hourly-time">${timeLabel}</div>
            <img class="hourly-icon" src="${getWeatherIconUrl(hour.weather[0].icon)}" alt="${hour.weather[0].description}">
            <div class="hourly-temp">${Math.round(hour.main.temp)}${unit}</div>
            <div class="hourly-pop"><i class="fas fa-droplet"></i> ${Math.round((hour.pop || 0) * 100)}%</div>
        `;
        hourlyForecast.appendChild(el);
    });
}

function updateDailyForecast(forecastData) {
    forecastContainer.innerHTML = '';
    const unit = currentUnit === 'metric' ? '\u00b0C' : '\u00b0F';
    forecastData.slice(0, 7).forEach(day => {
        const el = document.createElement('div');
        el.className = 'forecast-item';
        const date = new Date(day.dt * 1000);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dayDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const windUnit = currentUnit === 'metric' ? 'km/h' : 'mph';
        const windVal = `${day.wind.speed.toFixed(0)} ${windUnit}`;

        el.innerHTML = `
            <div class="forecast-day">
                <div class="forecast-date">
                    <div class="forecast-day-name">${dayName}</div>
                    <div class="forecast-day-date">${dayDate}</div>
                </div>
                <img class="forecast-icon" src="${getWeatherIconUrl(day.weather[0].icon)}" alt="${day.weather[0].description}">
                <div class="forecast-desc">
                    <div class="forecast-main">${day.weather[0].main}</div>
                    <div class="forecast-description">${day.weather[0].description}</div>
                </div>
            </div>
            <div class="forecast-temps">
                <span class="forecast-high">${Math.round(day.temp.max)}${unit}</span>
                <span class="forecast-low">${Math.round(day.temp.min)}${unit}</span>
            </div>
            <div class="forecast-details">
                <span><i class="fas fa-wind"></i> ${windVal}</span>
            </div>
        `;
        forecastContainer.appendChild(el);
    });
}

// ── Rain Probability Chart ──
function updateRainChance(hourlyData) {
    const container = document.getElementById('rainChanceContainer');
    if (!container) return;
    container.innerHTML = '';
    const maxBars = Math.min(12, hourlyData.length);
    for (let i = 0; i < maxBars; i++) {
        const hour = hourlyData[i];
        const time = new Date(hour.dt * 1000);
        const pct = Math.round((hour.pop || 0) * 100);
        const bar = document.createElement('div');
        bar.className = 'rain-bar-item';
        bar.innerHTML = `
            <div class="rain-bar-pct">${pct}%</div>
            <div class="rain-bar-track">
                <div class="rain-bar-fill" style="height:${Math.max(pct, 4)}%;${pct > 60 ? 'background:var(--accent);' : ''}"></div>
            </div>
            <div class="rain-bar-time">${time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })}</div>
        `;
        container.appendChild(bar);
    }
}

// ── Air Quality Index ──
function updateAirQuality(aqi) {
    const container = document.getElementById('aqiContainer');
    if (!container) return;
    if (!aqi) {
        container.innerHTML = '<div class="aqi-unavailable"><i class="fas fa-info-circle"></i> Air quality data not available for this location</div>';
        return;
    }
    const usAqi = aqi.us_aqi || aqi.european_aqi || 0;
    const { label, color, icon, advice } = getAqiInfo(usAqi);
    container.innerHTML = `
        <div class="aqi-main">
            <div class="aqi-gauge" style="--aqi-color:${color}">
                <div class="aqi-number">${usAqi}</div>
                <div class="aqi-label" style="color:${color}">${label}</div>
            </div>
            <div class="aqi-advice">
                <i class="fas ${icon}" style="color:${color}"></i>
                <span>${advice}</span>
            </div>
        </div>
        <div class="aqi-pollutants">
            ${aqi.pm2_5 !== undefined ? `<div class="pollutant"><span class="pollutant-name">PM2.5</span><span class="pollutant-value">${aqi.pm2_5.toFixed(1)}</span><span class="pollutant-unit">μg/m³</span></div>` : ''}
            ${aqi.pm10 !== undefined ? `<div class="pollutant"><span class="pollutant-name">PM10</span><span class="pollutant-value">${aqi.pm10.toFixed(1)}</span><span class="pollutant-unit">μg/m³</span></div>` : ''}
            ${aqi.nitrogen_dioxide !== undefined ? `<div class="pollutant"><span class="pollutant-name">NO₂</span><span class="pollutant-value">${aqi.nitrogen_dioxide.toFixed(1)}</span><span class="pollutant-unit">μg/m³</span></div>` : ''}
            ${aqi.ozone !== undefined ? `<div class="pollutant"><span class="pollutant-name">O₃</span><span class="pollutant-value">${aqi.ozone.toFixed(1)}</span><span class="pollutant-unit">μg/m³</span></div>` : ''}
        </div>
    `;
}

function getAqiInfo(aqi) {
    if (aqi <= 50) return { label: 'Good', color: '#52B788', icon: 'fa-face-smile', advice: 'Air quality is great. Enjoy outdoor activities!' };
    if (aqi <= 100) return { label: 'Moderate', color: '#FFB347', icon: 'fa-face-meh', advice: 'Acceptable. Sensitive individuals should limit prolonged outdoor exertion.' };
    if (aqi <= 150) return { label: 'Unhealthy (Sensitive)', color: '#FF8C42', icon: 'fa-triangle-exclamation', advice: 'Sensitive groups may experience health effects. Reduce outdoor activity.' };
    if (aqi <= 200) return { label: 'Unhealthy', color: '#E63946', icon: 'fa-heart-pulse', advice: 'Everyone may begin to experience health effects. Limit outdoor time.' };
    if (aqi <= 300) return { label: 'Very Unhealthy', color: '#9B59B6', icon: 'fa-skull-crossbones', advice: 'Health alert. Avoid outdoor activities.' };
    return { label: 'Hazardous', color: '#800020', icon: 'fa-biohazard', advice: 'Emergency conditions. Stay indoors.' };
}

// ── Feels Like Advice ──
function updateFeelsLikeAdvice(data) {
    const container = document.getElementById('feelsLikeAdvice');
    if (!container || !data?.main) return;
    const feelsTemp = data.main.feels_like;
    const isMetric = currentUnit === 'metric';
    const tempC = isMetric ? feelsTemp : (feelsTemp - 32) * 5 / 9;
    const { icon, advice, clothing } = getClothingAdvice(tempC);
    container.innerHTML = `
        <div class="advice-content">
            <div class="advice-icon"><i class="fas ${icon}"></i></div>
            <div class="advice-text">
                <div class="advice-main">${advice}</div>
                <div class="advice-clothing"><i class="fas fa-shirt"></i> ${clothing}</div>
            </div>
        </div>
    `;
}

function getClothingAdvice(tempC) {
    if (tempC >= 35) return { icon: 'fa-temperature-arrow-up', advice: 'Extreme heat — stay hydrated and seek shade', clothing: 'Light, breathable clothes. Sunscreen & hat essential.' };
    if (tempC >= 28) return { icon: 'fa-sun', advice: 'Hot and warm — perfect for summer activities', clothing: 'T-shirt, shorts, sunglasses. Apply sunscreen.' };
    if (tempC >= 20) return { icon: 'fa-cloud-sun', advice: 'Comfortable and pleasant weather', clothing: 'Light layers, T-shirt or light long-sleeve.' };
    if (tempC >= 14) return { icon: 'fa-cloud', advice: 'Mild but cool — a layered approach works best', clothing: 'Sweater or hoodie, light jacket recommended.' };
    if (tempC >= 6) return { icon: 'fa-wind', advice: 'Cool weather — bundle up when going out', clothing: 'Warm jacket, long pants. Consider scarf.' };
    if (tempC >= 0) return { icon: 'fa-snowflake', advice: 'Cold — dress warmly to avoid chill', clothing: 'Heavy coat, gloves, warm hat, layers underneath.' };
    return { icon: 'fa-icicles', advice: 'Freezing conditions — minimize time outdoors', clothing: 'Insulated coat, thermal layers, boots, gloves, scarf.' };
}

// ── Wind Compass ──
function updateWindCompass(data) {
    const container = document.getElementById('windCompass');
    if (!container || !data?.wind) return;
    const deg = data.wind.deg || 0;
    const speed = data.wind.speed || 0;
    const gust = data.wind.gust || 0;
    const unit = currentUnit === 'metric' ? 'km/h' : 'mph';
    const speedVal = speed.toFixed(1);
    const gustVal = gust.toFixed(1);
    const beaufort = getBeaufortScale(currentUnit === 'metric' ? speed : speed * 1.609);

    container.innerHTML = `
        <div class="compass-wrap">
            <div class="compass">
                <div class="compass-ring">
                    <span class="compass-dir compass-n">N</span>
                    <span class="compass-dir compass-e">E</span>
                    <span class="compass-dir compass-s">S</span>
                    <span class="compass-dir compass-w">W</span>
                </div>
                <div class="compass-needle" style="transform:rotate(${deg}deg)">
                    <div class="needle-point"></div>
                </div>
                <div class="compass-center">${Math.round(deg)}°</div>
            </div>
            <div class="wind-info-grid">
                <div class="wind-stat"><span class="wind-stat-label">Speed</span><span class="wind-stat-value">${speedVal} ${unit}</span></div>
                <div class="wind-stat"><span class="wind-stat-label">Gust</span><span class="wind-stat-value">${gustVal} ${unit}</span></div>
                <div class="wind-stat"><span class="wind-stat-label">Direction</span><span class="wind-stat-value">${getWindDirection(deg)}</span></div>
                <div class="wind-stat"><span class="wind-stat-label">Beaufort</span><span class="wind-stat-value">${beaufort}</span></div>
            </div>
        </div>
    `;
}

function getBeaufortScale(kmh) {
    if (kmh < 1) return '0 — Calm';
    if (kmh < 6) return '1 — Light Air';
    if (kmh < 12) return '2 — Light Breeze';
    if (kmh < 20) return '3 — Gentle Breeze';
    if (kmh < 29) return '4 — Moderate';
    if (kmh < 39) return '5 — Fresh';
    if (kmh < 50) return '6 — Strong';
    if (kmh < 62) return '7 — Near Gale';
    if (kmh < 75) return '8 — Gale';
    if (kmh < 89) return '9 — Strong Gale';
    if (kmh < 103) return '10 — Storm';
    if (kmh < 118) return '11 — Violent Storm';
    return '12 — Hurricane';
}

// ── Share Weather ──
function shareWeather() {
    if (!currentWeatherData?.current) {
        showToast('No weather data to share');
        return;
    }
    const d = currentWeatherData.current;
    const unit = currentUnit === 'metric' ? '°C' : '°F';
    const text = `🌤 Weather in ${d.name}: ${Math.round(d.main.temp)}${unit}, ${d.weather[0].description}. Feels like ${Math.round(d.main.feels_like)}${unit}. Humidity ${d.main.humidity}%.\n\nhttps://w0wzahhsraincheck.netlify.app`;

    // Try Web Share API first (works on most mobile browsers & some WebViews)
    if (navigator.share) {
        navigator.share({
            title: `Weather in ${d.name}`,
            text: text,
            url: 'https://w0wzahhsraincheck.netlify.app'
        }).catch(() => {
            // Share was cancelled or failed — fall back to clipboard
            copyToClipboard(text);
        });
        return;
    }

    // Fallback: copy to clipboard
    copyToClipboard(text);
}

function copyToClipboard(text) {
    // Modern clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => showToast('Weather copied to clipboard — paste it anywhere to share!'))
            .catch(() => fallbackCopy(text));
        return;
    }
    fallbackCopy(text);
}

function fallbackCopy(text) {
    // Legacy fallback for WebViews/older browsers that don't support clipboard API
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (success) {
            showToast('Weather copied to clipboard — paste it anywhere to share!');
        } else {
            showShareModal(text);
        }
    } catch (e) {
        showShareModal(text);
    }
}

function showShareModal(text) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'shareModal';
    modal.innerHTML = `
        <div class="modal-backdrop" onclick="this.closest('.modal').remove();document.body.style.overflow=''"></div>
        <div class="modal-panel">
            <div class="modal-head">
                <h2><i class="fas fa-share-nodes"></i> Share Weather</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove();document.body.style.overflow=''"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
                <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:12px">Long-press the text below to copy it:</p>
                <div class="share-text-box" style="background:var(--glass);border:1px solid var(--glass-border);border-radius:var(--radius-sm);padding:16px;font-size:0.9rem;color:var(--text);line-height:1.5;user-select:all;-webkit-user-select:all;white-space:pre-wrap">${escapeHtml(text)}</div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
}

// ── Suggestions ──
async function getCitySuggestions(query) {
    try {
        const response = await fetch(`${GEO_URL}/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`);
        const data = await response.json();
        displaySuggestions(data.results || []);
    } catch (e) { console.error('Suggestions error:', e); }
}

function displaySuggestions(cities) {
    suggestions.innerHTML = '';
    if (cities.length === 0) { hideSuggestions(); return; }

    cities.forEach(city => {
        const el = document.createElement('div');
        el.className = 'suggestion-item';
        const name = `${city.name}${city.admin1 ? ', ' + city.admin1 : ''}, ${city.country}`;
        el.textContent = name;
        el.addEventListener('click', () => {
            cityInput.value = name;
            currentLat = city.latitude;
            currentLon = city.longitude;
            currentCityName = city.name;
            currentCountry = city.country;
            getWeatherByCoords(city.latitude, city.longitude);
            hideSuggestions();
        });
        suggestions.appendChild(el);
    });
    suggestions.classList.remove('hidden');
    cityInput.focus();
}

function hideSuggestions() {
    suggestions.classList.add('hidden');
}

function handleSuggestionNav(e) {
    const items = document.querySelectorAll('.suggestion-item');
    if (items.length === 0) return;
    let idx = Array.from(items).findIndex(i => i.classList.contains('highlighted'));

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (idx >= 0) items[idx].classList.remove('highlighted');
        idx = Math.min(idx + 1, items.length - 1);
        items[idx].classList.add('highlighted');
        items[idx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (idx >= 0) items[idx].classList.remove('highlighted');
        idx = Math.max(idx - 1, 0);
        items[idx].classList.add('highlighted');
        items[idx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && idx >= 0) {
        e.preventDefault();
        items[idx].click();
    }
}

// ── Temperature Unit Toggle ──
function switchTemperatureUnit(unit) {
    if (currentUnit === unit) return;
    currentUnit = unit;
    celsiusBtn.classList.toggle('active', unit === 'metric');
    fahrenheitBtn.classList.toggle('active', unit === 'imperial');
    if (currentLat && currentLon) getWeatherByCoords(currentLat, currentLon);
}

// ── Weather Map ──
function updateWeatherMap(layer) {
    if (!currentLat || !currentLon) {
        mapFrame.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-family:var(--font)">
            <div style="text-align:center"><i class="fas fa-map-marked-alt" style="font-size:2rem;margin-bottom:10px;color:var(--accent)"></i><p>Search for a city first</p></div></div>`;
        return;
    }
    mapFrame.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-family:var(--font)">
        <div style="text-align:center"><div style="width:32px;height:32px;border:3px solid var(--glass-border);border-top:3px solid var(--accent);border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 12px"></div><p style="font-size:0.85rem">Loading map...</p></div></div>`;
    setTimeout(() => createWeatherMap(layer), 150);
}

async function createWeatherMap(layer) {
    if (!currentLat || !currentLon) return;

    try {
        const container = document.createElement('div');
        container.style.cssText = 'width:100%;height:100%;position:relative;background:var(--bg-primary);display:flex;flex-direction:column;overflow:hidden;border-radius:var(--radius-sm);';

        // Map tiles area
        const mapArea = document.createElement('div');
        mapArea.style.cssText = 'width:100%;flex:1;position:relative;overflow:hidden;min-height:0;';

        const zoom = 10;
        const centerX = Math.floor((currentLon + 180) / 360 * Math.pow(2, zoom));
        const centerY = Math.floor((1 - Math.log(Math.tan(currentLat * Math.PI / 180) + 1 / Math.cos(currentLat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));

        const grid = document.createElement('div');
        grid.style.cssText = 'width:100%;height:100%;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:0;';

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const tX = centerX + dx, tY = centerY + dy;
                const tile = document.createElement('img');
                tile.src = `https://tile.openstreetmap.org/${zoom}/${tX}/${tY}.png`;
                tile.style.cssText = 'width:100%;height:100%;object-fit:cover;';
                tile.alt = '';
                grid.appendChild(tile);
            }
        }
        mapArea.appendChild(grid);

        // Fetch current conditions for overlay
        const tempUnit = currentUnit === 'metric' ? 'celsius' : 'fahrenheit';
        const windUnit = currentUnit === 'metric' ? 'kmh' : 'mph';
        const dataUrl = `${BASE_URL}/forecast?latitude=${currentLat}&longitude=${currentLon}&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m,precipitation,cloud_cover&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}&timezone=auto`;
        const resp = await fetch(dataUrl);
        const mapData = await resp.json();
        const cur = mapData.current;

        // iOS-style weather overlay — always visible for the active layer
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;';

        // === TEMPERATURE LAYER ===
        if (layer === 'temp') {
            const temp = cur.temperature_2m;
            let heatColor, gradientStops;
            if (temp > 35) {
                heatColor = 'rgba(200,30,30,0.3)';
                gradientStops = 'radial-gradient(ellipse at 50% 50%, rgba(230,57,70,0.4) 0%, rgba(255,100,50,0.25) 40%, rgba(255,170,50,0.1) 70%, transparent 100%)';
            } else if (temp > 25) {
                heatColor = 'rgba(255,160,50,0.25)';
                gradientStops = 'radial-gradient(ellipse at 50% 50%, rgba(255,179,71,0.35) 0%, rgba(255,200,100,0.2) 40%, rgba(255,220,150,0.08) 70%, transparent 100%)';
            } else if (temp > 15) {
                heatColor = 'rgba(100,200,100,0.2)';
                gradientStops = 'radial-gradient(ellipse at 50% 50%, rgba(82,183,136,0.3) 0%, rgba(116,185,255,0.15) 50%, transparent 100%)';
            } else if (temp > 5) {
                heatColor = 'rgba(80,150,255,0.25)';
                gradientStops = 'radial-gradient(ellipse at 50% 50%, rgba(116,185,255,0.35) 0%, rgba(100,130,220,0.2) 50%, transparent 100%)';
            } else {
                heatColor = 'rgba(120,100,255,0.25)';
                gradientStops = 'radial-gradient(ellipse at 50% 50%, rgba(108,99,255,0.35) 0%, rgba(160,150,255,0.2) 50%, transparent 100%)';
            }
            overlay.style.background = heatColor;
            const heatspot = document.createElement('div');
            heatspot.style.cssText = `position:absolute;inset:0;background:${gradientStops};`;
            overlay.appendChild(heatspot);
            // Temp label
            const tempLabel = document.createElement('div');
            tempLabel.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-180%);background:rgba(0,0,0,0.65);color:#fff;padding:4px 10px;border-radius:20px;font-size:13px;font-weight:700;font-family:var(--font);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.15);white-space:nowrap;z-index:5;';
            tempLabel.textContent = `${Math.round(temp)}\u00b0`;
            overlay.appendChild(tempLabel);
        }

        // === WIND LAYER ===
        if (layer === 'wind') {
            const speed = cur.wind_speed_10m;
            const windOverlay = document.createElement('div');
            windOverlay.style.cssText = `position:absolute;inset:-20%;overflow:hidden;transform:rotate(${cur.wind_direction_10m - 90}deg);`;
            const lineCount = Math.max(6, Math.min(Math.floor(speed / 3) + 6, 18));
            const baseOpacity = Math.min(0.2 + speed / 60, 0.6);
            for (let i = 0; i < lineCount; i++) {
                const line = document.createElement('div');
                const yPos = (i / lineCount) * 100;
                const width = 25 + Math.random() * 35;
                const delay = Math.random() * 2.5;
                const duration = speed > 20 ? 0.8 + Math.random() * 0.5 : 1.5 + Math.random() * 1;
                const thickness = speed > 30 ? 3 : 2;
                line.style.cssText = `position:absolute;top:${yPos}%;left:-30%;width:${width}%;height:${thickness}px;background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,${baseOpacity}) 30%,rgba(255,255,255,${baseOpacity * 0.8}) 70%,transparent 100%);animation:windLine ${duration}s linear ${delay}s infinite;border-radius:1px;`;
                windOverlay.appendChild(line);
            }
            overlay.appendChild(windOverlay);
            overlay.style.background = speed > 40 ? 'rgba(230,57,70,0.15)' : speed > 20 ? 'rgba(255,179,71,0.1)' : 'rgba(116,185,255,0.08)';
            // Direction arrow
            const arrowWrap = document.createElement('div');
            arrowWrap.style.cssText = `position:absolute;bottom:12px;right:12px;width:44px;height:44px;background:rgba(0,0,0,0.6);border-radius:50%;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.15);z-index:5;`;
            arrowWrap.innerHTML = `<i class="fas fa-location-arrow" style="color:#fff;font-size:16px;transform:rotate(${cur.wind_direction_10m - 45}deg);"></i>`;
            overlay.appendChild(arrowWrap);
        }

        // === PRECIPITATION LAYER ===
        if (layer === 'precipitation') {
            const precip = cur.precipitation || 0;
            const rainOverlay = document.createElement('div');
            rainOverlay.style.cssText = 'position:absolute;inset:0;overflow:hidden;';
            const dropCount = precip > 0 ? Math.min(Math.floor(precip * 10) + 15, 40) : 12;
            const dropOpacity = precip > 0 ? 0.5 : 0.25;
            for (let i = 0; i < dropCount; i++) {
                const drop = document.createElement('div');
                const xPos = Math.random() * 100;
                const delay = Math.random() * 2;
                const size = 1 + Math.random() * 1.5;
                const speed = precip > 5 ? 0.4 + Math.random() * 0.3 : 0.7 + Math.random() * 0.5;
                drop.style.cssText = `position:absolute;left:${xPos}%;top:-5%;width:${size}px;height:${size * 8}px;background:linear-gradient(180deg,transparent,rgba(116,185,255,${dropOpacity}));border-radius:0 0 ${size}px ${size}px;animation:rainDrop ${speed}s linear ${delay}s infinite;`;
                rainOverlay.appendChild(drop);
            }
            overlay.appendChild(rainOverlay);
            overlay.style.background = precip > 5 ? 'rgba(50,100,200,0.25)' : precip > 0 ? 'rgba(80,140,220,0.18)' : 'rgba(116,185,255,0.08)';
            // Info badge
            const precipBadge = document.createElement('div');
            precipBadge.style.cssText = `position:absolute;bottom:12px;right:12px;background:${precip > 0 ? 'rgba(50,100,200,0.8)' : 'rgba(0,0,0,0.5)'};color:#fff;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:600;font-family:var(--font);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.12);z-index:5;`;
            precipBadge.textContent = precip > 0 ? `${precip}mm` : 'No precipitation';
            overlay.appendChild(precipBadge);
        }

        // === CLOUDS LAYER ===
        if (layer === 'clouds') {
            const cover = cur.cloud_cover;
            const cloudOverlay = document.createElement('div');
            cloudOverlay.style.cssText = 'position:absolute;inset:0;overflow:hidden;';
            const cloudCount = Math.max(3, Math.min(Math.floor(cover / 10) + 2, 12));
            const baseOpacity = 0.12 + (cover / 150);
            for (let i = 0; i < cloudCount; i++) {
                const cloud = document.createElement('div');
                const xPos = -10 + Math.random() * 100;
                const yPos = 5 + Math.random() * 75;
                const size = 60 + Math.random() * 100;
                const opacity = baseOpacity + Math.random() * 0.08;
                const drift = 6 + Math.random() * 8;
                cloud.style.cssText = `position:absolute;left:${xPos}%;top:${yPos}%;width:${size}px;height:${size * 0.45}px;background:radial-gradient(ellipse,rgba(220,225,235,${opacity}) 0%,rgba(200,210,225,${opacity * 0.6}) 40%,transparent 70%);border-radius:50%;animation:cloudDrift ${drift}s ease-in-out ${Math.random() * 4}s infinite alternate;filter:blur(${cover > 70 ? 2 : 0}px);`;
                cloudOverlay.appendChild(cloud);
            }
            overlay.appendChild(cloudOverlay);
            overlay.style.background = `rgba(160,170,190,${Math.min(cover / 250, 0.3)})`;
            // Coverage badge
            const coverBadge = document.createElement('div');
            coverBadge.style.cssText = 'position:absolute;bottom:12px;right:12px;background:rgba(0,0,0,0.55);color:#fff;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;font-family:var(--font);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.12);z-index:5;';
            coverBadge.textContent = `${cover}% coverage`;
            overlay.appendChild(coverBadge);
        }

        // Storm indicator (any layer)
        if (cur.weather_code >= 95) {
            const stormOverlay = document.createElement('div');
            stormOverlay.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.1);animation:stormFlash 3s ease-in-out infinite;z-index:3;';
            overlay.appendChild(stormOverlay);
        }

        mapArea.appendChild(overlay);

        // Location pin
        const pin = document.createElement('div');
        pin.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-100%);z-index:10;';
        pin.innerHTML = `<div style="width:14px;height:14px;background:#E63946;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(230,57,70,0.4);border:2px solid #fff;"></div><div style="width:6px;height:6px;background:rgba(0,0,0,0.2);border-radius:50%;margin:-2px auto 0;filter:blur(2px);"></div>`;
        mapArea.appendChild(pin);

        // Location badge
        const badge = document.createElement('div');
        badge.style.cssText = 'position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.6);color:#fff;padding:8px 12px;border-radius:10px;font-size:11px;backdrop-filter:blur(12px);z-index:20;font-family:var(--font);border:1px solid rgba(255,255,255,0.1);';
        badge.innerHTML = `<div style="font-weight:700;margin-bottom:2px">${escapeHtml(currentCityName || 'Location')}</div><div style="opacity:0.6;font-size:10px">${currentLat.toFixed(2)}\u00b0, ${currentLon.toFixed(2)}\u00b0</div>`;
        mapArea.appendChild(badge);

        // Bottom data strip
        const strip = document.createElement('div');
        strip.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--glass-border);flex-shrink:0;';
        const metrics = [
            { label: 'Temp', value: `${Math.round(cur.temperature_2m)}\u00b0`, icon: 'fa-temperature-half', active: layer === 'temp' },
            { label: 'Rain', value: `${cur.precipitation || 0}mm`, icon: 'fa-cloud-rain', active: layer === 'precipitation' },
            { label: 'Wind', value: `${Math.round(cur.wind_speed_10m)}${currentUnit === 'metric' ? 'km/h' : 'mph'}`, icon: 'fa-wind', active: layer === 'wind' },
            { label: 'Clouds', value: `${cur.cloud_cover}%`, icon: 'fa-cloud', active: layer === 'clouds' }
        ];
        metrics.forEach(m => {
            const cell = document.createElement('div');
            cell.style.cssText = `background:var(--map-panel-bg);padding:10px 6px;text-align:center;font-family:var(--font);${m.active ? 'border-top:2px solid var(--accent);' : ''}`;
            cell.innerHTML = `<i class="fas ${m.icon}" style="font-size:0.85rem;color:${m.active ? 'var(--accent)' : 'var(--text-muted)'};margin-bottom:3px;display:block"></i>
                <div style="font-size:10px;color:var(--text-muted);margin-bottom:1px">${m.label}</div>
                <div style="font-size:13px;font-weight:700;color:var(--text)">${m.value}</div>`;
            strip.appendChild(cell);
        });

        container.appendChild(mapArea);
        container.appendChild(strip);
        mapFrame.innerHTML = '';
        mapFrame.appendChild(container);
    } catch (error) {
        console.error('Map error:', error);
        mapFrame.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-family:var(--font)">
            <div style="text-align:center"><i class="fas fa-exclamation-triangle" style="font-size:2rem;margin-bottom:10px;color:var(--accent)"></i><p>Unable to load map</p></div></div>`;
    }
}

function getWeatherDescription(code) {
    const d = WEATHER_DESCRIPTIONS[code];
    return d ? d.main : 'Unknown';
}

// ── Utilities ──
function updateDateTime() {
    const now = new Date();
    currentDate.textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    currentTime.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatTime(date) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatTimeWithTimezone(timestamp, timezoneOffset) {
    const utcTime = timestamp * 1000;
    const localTime = utcTime + (timezoneOffset * 1000);
    const date = new Date(localTime);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' });
}

function getWindDirection(degrees) {
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round(degrees / 22.5) % 16];
}

function showLoading() {
    loadingSpinner.classList.remove('hidden');
    weatherContent.classList.add('hidden');
    errorMessage.classList.add('hidden');
}
function hideLoading() { loadingSpinner.classList.add('hidden'); }
function showError(message) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
    weatherContent.classList.add('hidden');
    loadingSpinner.classList.add('hidden');
}

// ── Toast Notification ──
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showToast(message, duration = 4000) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.cssText = `position:fixed;top:20px;right:20px;background:rgba(30,30,40,0.95);color:#fff;padding:14px 22px;border-radius:12px;font-size:0.85rem;font-family:var(--font);z-index:20000;backdrop-filter:blur(20px);border:1px solid var(--glass-border);box-shadow:0 8px 32px rgba(0,0,0,0.4);animation:slideDown 0.3s var(--ease);max-width:320px;`;
    const icon = document.createElement('i');
    icon.className = 'fas fa-info-circle';
    icon.style.cssText = 'color:var(--accent);margin-right:8px';
    const span = document.createElement('span');
    span.textContent = message;
    toast.appendChild(icon);
    toast.appendChild(span);
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(-8px)'; toast.style.transition = 'all 0.3s'; setTimeout(() => toast.remove(), 300); }, duration);
}

// ── Recent Searches (QoL) ──
function saveRecentSearch(city, country) {
    try {
        let recent = JSON.parse(localStorage.getItem('raincheck_recent') || '[]');
        const entry = `${city}, ${country}`;
        recent = recent.filter(r => r !== entry);
        recent.unshift(entry);
        recent = recent.slice(0, 5);
        localStorage.setItem('raincheck_recent', JSON.stringify(recent));
    } catch (e) { /* ignore */ }
}

// ── Theme System ──
function changeTheme(theme) {
    currentTheme = theme;
    localStorage.setItem('raincheck-theme', theme);

    // Clear all theme classes
    document.body.className = document.body.className.replace(/theme-\w+/g, '').trim();
    document.body.classList.remove('auto-theme', 'sunny', 'cloudy', 'rainy', 'snowy', 'stormy', 'time-morning', 'time-afternoon', 'time-evening', 'time-night');

    if (autoThemeInterval) { clearInterval(autoThemeInterval); autoThemeInterval = null; }

    if (theme === 'auto') {
        startAutoTheme();
    } else {
        document.body.classList.add('theme-' + theme);
    }
    updateThemeButtonIcon(theme);
}

function updateThemeButtonIcon(theme) {
    const icon = themeBtn.querySelector('i');
    const map = { auto: 'fas fa-magic', light: 'fas fa-sun', dark: 'fas fa-moon', sunrise: 'fas fa-sun', sunset: 'fas fa-cloud-sun', night: 'fas fa-star', ocean: 'fas fa-water', forest: 'fas fa-tree' };
    icon.className = map[theme] || 'fas fa-palette';
}

function loadThemePreference() {
    const saved = localStorage.getItem('raincheck-theme');
    if (saved) { currentTheme = saved; changeTheme(currentTheme); }
    else updateThemeButtonIcon('auto');
}

function startAutoTheme() {
    document.body.classList.add('auto-theme');
    updateAutoTheme();
    autoThemeInterval = setInterval(updateAutoTheme, 60000);
}

function updateAutoTheme() {
    if (currentTheme !== 'auto') return;
    const now = new Date();
    const hour = now.getHours();

    document.body.classList.remove('sunny', 'cloudy', 'rainy', 'snowy', 'stormy', 'time-morning', 'time-afternoon', 'time-evening', 'time-night');

    // Use actual sunrise/sunset from weather data if available
    let sunriseHour = 6, sunsetHour = 20;
    if (currentWeatherData?.current?.sys) {
        const tzOffset = currentWeatherData.timezone_offset || 0;
        const srTime = new Date((currentWeatherData.current.sys.sunrise * 1000) + (tzOffset * 1000));
        const ssTime = new Date((currentWeatherData.current.sys.sunset * 1000) + (tzOffset * 1000));
        sunriseHour = srTime.getUTCHours();
        sunsetHour = ssTime.getUTCHours();
    }

    // Determine time period based on sunrise/sunset
    let timeClass;
    if (hour >= sunriseHour && hour < sunriseHour + 3) {
        timeClass = 'time-morning';
    } else if (hour >= sunriseHour + 3 && hour < sunsetHour - 2) {
        timeClass = 'time-afternoon';
    } else if (hour >= sunsetHour - 2 && hour < sunsetHour + 1) {
        timeClass = 'time-evening';
    } else {
        timeClass = 'time-night';
    }

    // Weather condition override
    if (currentWeatherData?.current?.weather?.[0]) {
        const cond = currentWeatherData.current.weather[0].main.toLowerCase();
        const weatherMap = { clear: 'sunny', clouds: 'cloudy', rain: 'rainy', drizzle: 'rainy', snow: 'snowy', thunderstorm: 'stormy',
            'mainly clear': 'sunny', 'partly cloudy': 'cloudy', overcast: 'cloudy', fog: 'cloudy',
            'rain showers': 'rainy', 'snow showers': 'snowy', 'freezing rain': 'rainy', 'freezing drizzle': 'rainy' };
        const wClass = weatherMap[cond];
        if (wClass) {
            document.body.classList.add(wClass);
        }
    }

    document.body.classList.add(timeClass);
}

// ── Service Worker + Auto-Update System ──
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(reg => {


            // Check for updates every 60 seconds
            setInterval(() => { reg.update(); }, 60000);

            // When a new SW is found waiting
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                if (!newWorker) return;

                newWorker.addEventListener('statechange', () => {
                    // New SW is installed and ready — if there's already a controller, that means this is an UPDATE
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdateBanner();
                    }
                });
            });
        }).catch(() => {});

        // Listen for SW_UPDATED message from the service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data?.type === 'SW_UPDATED') {
                showUpdateBanner();
            }
        });

        // When the controlling SW changes (new one took over), reload for fresh content
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                window.location.reload();
            }
        });
    });
}

function showUpdateBanner() {
    // Don't show multiple banners
    if (document.querySelector('.update-banner')) return;

    const banner = document.createElement('div');
    banner.className = 'update-banner';
    banner.innerHTML = `
        <div class="update-banner-content">
            <i class="fas fa-arrow-up-from-bracket"></i>
            <span>A new version of RainCheck is available!</span>
            <button class="update-btn" onclick="applyUpdate()">Update Now</button>
            <button class="update-dismiss" onclick="this.closest('.update-banner').remove()"><i class="fas fa-times"></i></button>
        </div>
    `;
    document.body.appendChild(banner);

    // Auto-apply update after 8 seconds if user doesn't dismiss
    setTimeout(() => {
        if (document.querySelector('.update-banner')) {
            applyUpdate();
        }
    }, 8000);
}

function applyUpdate() {
    const banner = document.querySelector('.update-banner');
    if (banner) {
        banner.querySelector('.update-banner-content span').textContent = 'Updating...';
        banner.querySelector('.update-btn').disabled = true;
    }
    // Tell the waiting SW to activate immediately
    if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.ready.then(reg => {
            if (reg.waiting) {
                reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            } else {
                // No waiting SW — just reload
                window.location.reload();
            }
        });
    } else {
        window.location.reload();
    }
}

// ── Touch Swipe (refresh) ──
let touchStartY = 0;
document.addEventListener('touchstart', (e) => { touchStartY = e.changedTouches[0].screenY; }, { passive: true });
document.addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].screenY - touchStartY;
    if (diff > 120 && window.scrollY === 0 && currentLat && currentLon) {
        showToast('Refreshing...');
        getWeatherByCoords(currentLat, currentLon);
    }
}, { passive: true });

// ── Scroll to Top ──
const scrollTopBtn = document.getElementById('scrollTopBtn');
if (scrollTopBtn) {
    window.addEventListener('scroll', () => {
        scrollTopBtn.classList.toggle('hidden', window.scrollY < 400);
    }, { passive: true });
    scrollTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ── Offline/Online Indicator ──
const offlineBanner = document.getElementById('offlineBanner');
function updateOnlineStatus() {
    if (offlineBanner) {
        offlineBanner.classList.toggle('hidden', navigator.onLine);
    }
}
window.addEventListener('online', () => {
    updateOnlineStatus();
    showToast('Back online!');
    if (currentLat && currentLon) getWeatherByCoords(currentLat, currentLon);
});
window.addEventListener('offline', () => {
    updateOnlineStatus();
    showToast('You\'re offline — using cached data');
});
updateOnlineStatus();

// ── Recent Searches Dropdown ──
function showRecentSearches() {
    try {
        const recent = JSON.parse(localStorage.getItem('raincheck_recent') || '[]');
        if (recent.length === 0) { hideSuggestions(); return; }
        suggestions.innerHTML = '';
        const header = document.createElement('div');
        header.className = 'suggestion-header';
        header.innerHTML = '<i class="fas fa-clock"></i> Recent Searches';
        suggestions.appendChild(header);
        recent.forEach(entry => {
            const el = document.createElement('div');
            el.className = 'suggestion-item recent-item';
            const icon = document.createElement('i');
            icon.className = 'fas fa-clock-rotate-left';
            const text = document.createTextNode(' ' + entry);
            el.appendChild(icon);
            el.appendChild(text);
            el.addEventListener('click', () => {
                cityInput.value = entry;
                getWeatherByCity(entry.split(',')[0].trim());
                hideSuggestions();
            });
            suggestions.appendChild(el);
        });
        suggestions.classList.remove('hidden');
    } catch (e) { /* ignore */ }
}

// ── Export for testing ──
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { formatTime, getWindDirection };
}
