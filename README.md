# RainCheck - Advanced Weather App

A comprehensive, modern weather application built with HTML, CSS, and JavaScript using the OpenWeatherMap API.

## Features

### 🌤️ Current Weather
- Real-time weather conditions
- Temperature with feels-like reading
- Humidity, pressure, and visibility
- Wind speed and direction
- UV Index
- Sunrise and sunset times
- Weather icons and descriptions

### 📅 Forecasting
- **24-Hour Forecast**: Hourly weather data for the next 24 hours
- **5-Day Forecast**: Daily weather predictions with high/low temperatures
- Detailed weather descriptions and conditions

### 🗺️ Interactive Features
- **City Search**: Search for any city worldwide with auto-suggestions
- **Geolocation**: Automatic location detection
- **Weather Maps**: Temperature, precipitation, wind, and cloud coverage maps
- **Unit Conversion**: Switch between Celsius and Fahrenheit

### 🎨 Modern UI/UX
- Responsive design for all devices
- Beautiful gradient backgrounds that change based on weather conditions
- Smooth animations and transitions
- Clean, intuitive interface
- Font Awesome icons
- Google Fonts (Poppins)

### 📱 Mobile Optimized
- Touch-friendly interface
- Swipe gestures support
- Responsive layout
- Optimized for mobile performance

### 🔧 Technical Features
- Service Worker for offline functionality
- Local storage for preferences
- Error handling and loading states
- Keyboard navigation support
- Accessibility features

## Setup Instructions

### Option 1: Simple Setup (Recommended)
1. **Clone or Download** the project files to your local machine
2. **Double-click** `start-server.bat` (Windows) or `start-server.sh` (Mac/Linux)
3. **Open** http://localhost:8000 in your browser
4. **Allow location access** when prompted for automatic weather detection

### Option 2: Direct File Access
1. **Open** `index.html` directly in a modern web browser
2. **Note**: Some features (ServiceWorker, full map functionality) require a web server
3. **Allow location access** when prompted for automatic weather detection

### Option 3: Manual Server
1. **Open terminal/command prompt** in the project folder
2. **Run**: `python -m http.server 8000` (Python 3) or `python -m SimpleHTTPServer 8000` (Python 2)
3. **Open** http://localhost:8000 in your browser

## API Configuration

The app uses the OpenWeatherMap API with the following endpoints:
- Current Weather Data
- 5-Day Weather Forecast
- Geocoding API for city search
- UV Index Data
- Weather Maps

API Key is already configured: `bd5e378503939ddaee76f12ad7a97608`

## File Structure

```
RainCheck/
├── index.html          # Main HTML file
├── styles.css          # CSS styles and responsive design
├── script.js           # JavaScript functionality
├── sw.js              # Service Worker for offline support
└── README.md          # This file
```

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Features in Detail

### Weather Data Display
- **Current Temperature**: Large, prominent display with unit conversion
- **Weather Description**: Clear, descriptive text with capitalization
- **Weather Details Grid**: Organized display of all weather metrics
- **Sun Times**: Beautiful sunrise/sunset display with icons

### Search Functionality
- **Auto-complete**: Real-time city suggestions as you type
- **Keyboard Navigation**: Arrow keys to navigate suggestions
- **Error Handling**: Clear error messages for invalid searches
- **Recent Searches**: (Can be implemented as enhancement)

### Responsive Design
- **Mobile First**: Optimized for mobile devices
- **Tablet Support**: Adapted layout for medium screens
- **Desktop Enhancement**: Full-featured desktop experience
- **Touch Gestures**: Swipe support for mobile interactions

### Weather Maps
- **Multiple Layers**: Temperature, precipitation, wind, clouds
- **Interactive Controls**: Easy switching between map types
- **Location-based**: Automatically centers on current location
- **High Quality**: Uses OpenWeatherMap's tile service

### Performance Optimizations
- **Lazy Loading**: Images and content loaded as needed
- **Caching**: Service Worker caches resources for offline use
- **Debounced Search**: Prevents excessive API calls during typing
- **Error Recovery**: Graceful handling of network issues

## Customization Options

### Themes
The app automatically changes its background theme based on weather conditions:
- **Sunny**: Warm yellow/orange gradients
- **Cloudy**: Cool purple/blue gradients
- **Rainy**: Blue gradients
- **Snowy**: Light gray/white gradients
- **Stormy**: Dark gray gradients

### Units
- **Temperature**: Celsius (°C) or Fahrenheit (°F)
- **Wind Speed**: km/h or mph (automatically switches with temperature unit)
- **Pressure**: hPa (hectopascals)
- **Visibility**: Kilometers

## Future Enhancements

Potential features that could be added:
- Weather alerts and notifications
- Historical weather data
- Weather radar animation
- Multiple location tracking
- Weather widgets
- Social sharing
- Voice search
- Dark/light mode toggle
- Weather-based recommendations

## Troubleshooting

### Common Issues

1. **Location not working**
   - Ensure location permissions are enabled in your browser
   - Try searching for your city manually

2. **Weather data not loading**
   - Check your internet connection
   - The API might be temporarily unavailable

3. **Maps not displaying**
   - Maps require an active internet connection
   - Some ad blockers might interfere with map loading

4. **Search suggestions not appearing**
   - Type at least 3 characters for suggestions to appear
   - Check your internet connection

## Credits

- **Weather Data**: OpenWeatherMap API
- **Icons**: Font Awesome
- **Fonts**: Google Fonts (Poppins)
- **Design**: Custom CSS with modern design principles

## License

This project is open source and available under the MIT License.

---

**RainCheck** - Your reliable weather companion! 🌦️