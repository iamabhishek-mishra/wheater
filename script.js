// --- Retro-Tech Weather App Script (Clean Version) ---

const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_API_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const AIR_QUALITY_API_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

let currentLocation = null;

// Format location name for display
function formatLocationName(geoData) {
    if (!geoData.results || geoData.results.length === 0) return 'Unknown Location';
    const result = geoData.results[0];
    const parts = [];
    if (result.name) parts.push(result.name);
    if (result.admin1) parts.push(result.admin1);
    if (result.country) parts.push(result.country);
    return parts.join(', ');
}

// Show loading state
function showLoading() {
    document.getElementById('city-name').textContent = 'LOADING...';
    document.getElementById('temp').textContent = '--';
    document.getElementById('weather-desc').textContent = 'LOADING...';
    document.getElementById('humidity').textContent = '--%';
    document.getElementById('wind-speed').textContent = '-- km/h';
    document.getElementById('clouds').textContent = '--%';
    document.getElementById('aqi').textContent = '--';
    document.getElementById('pm25').textContent = '--';
    document.getElementById('pm10').textContent = '--';
    document.getElementById('o3').textContent = '--';
    document.getElementById('no2').textContent = '--';
}

// Show error state
function showError(msg) {
    document.getElementById('city-name').textContent = 'ERROR';
    document.getElementById('temp').textContent = '--';
    document.getElementById('weather-desc').textContent = msg || 'Failed to load weather data';
    document.getElementById('humidity').textContent = '--%';
    document.getElementById('wind-speed').textContent = '-- km/h';
    document.getElementById('clouds').textContent = '--%';
    document.getElementById('aqi').textContent = '--';
    document.getElementById('pm25').textContent = '--';
    document.getElementById('pm10').textContent = '--';
    document.getElementById('o3').textContent = '--';
    document.getElementById('no2').textContent = '--';
}

// Fetch and display weather for a city name
async function getWeather(city) {
    if (!city) {
        showError('Please enter a city name');
        return;
    }
    showLoading();
    try {
        // Geocode city
        const geoResponse = await fetch(`${GEOCODING_API_URL}?name=${encodeURIComponent(city)}&count=1&language=en`);
        if (!geoResponse.ok) throw new Error('Failed to find city coordinates');
        const geoData = await geoResponse.json();
        if (!geoData.results || geoData.results.length === 0) throw new Error('City not found');
        const { latitude, longitude } = geoData.results[0];
        currentLocation = { lat: latitude, lng: longitude };
        const locationName = formatLocationName(geoData);
        // Weather
        const weatherResponse = await fetch(`${WEATHER_API_URL}?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,cloud_cover&timezone=auto`);
        if (!weatherResponse.ok) throw new Error('Failed to fetch weather data');
        const weatherData = await weatherResponse.json();
        if (!weatherData.current) throw new Error('Invalid weather data received');
        updateWeatherUI(weatherData, { name: locationName });
        // AQI
        try {
            const aqiResponse = await fetch(`${AIR_QUALITY_API_URL}?latitude=${latitude}&longitude=${longitude}&current=pm2_5,pm10,ozone,nitrogen_dioxide`);
            if (aqiResponse.ok) {
                const aqiData = await aqiResponse.json();
                if (aqiData.current) updateAQIUI(aqiData);
            }
        } catch {}
        // Update last update time
        document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
    } catch (error) {
        showError(error.message);
    }
}

// Fetch and display weather for coordinates (used for geolocation)
async function getWeatherForCoordinates(latitude, longitude) {
    showLoading();
    try {
        // Weather
        const weatherResponse = await fetch(`${WEATHER_API_URL}?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,cloud_cover&timezone=auto`);
        if (!weatherResponse.ok) throw new Error('Failed to fetch weather data');
        const weatherData = await weatherResponse.json();
        // Geocode
        const geoResponse = await fetch(`${GEOCODING_API_URL}?latitude=${latitude}&longitude=${longitude}&language=en`);
        let locationName = 'Unknown Location';
        if (geoResponse.ok) {
            const geoData = await geoResponse.json();
            locationName = formatLocationName(geoData);
        }
        updateWeatherUI(weatherData, { name: locationName });
        // AQI
        try {
            const aqiResponse = await fetch(`${AIR_QUALITY_API_URL}?latitude=${latitude}&longitude=${longitude}&current=pm2_5,pm10,ozone,nitrogen_dioxide`);
            if (aqiResponse.ok) {
                const aqiData = await aqiResponse.json();
                if (aqiData.current) updateAQIUI(aqiData);
            }
        } catch {}
        document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
        document.getElementById('city-input').value = locationName;
    } catch (error) {
        showError(error.message);
    }
}

// Update weather UI
function updateWeatherUI(weatherData, locationData) {
    document.getElementById('city-name').textContent = locationData.name;
    document.getElementById('temp').textContent = Math.round(weatherData.current.temperature_2m);
    document.getElementById('weather-desc').textContent = getWeatherDescription(weatherData.current.weather_code);
    // Icon
    const weatherIcon = document.querySelector('.weather-icon i');
    weatherIcon.className = getWeatherIcon(weatherData.current.weather_code);
    // Animation
    updateWeatherAnimation(weatherData.current.weather_code);
    // Details
    document.getElementById('humidity').textContent = `${weatherData.current.relative_humidity_2m}%`;
    document.getElementById('wind-speed').textContent = `${Math.round(weatherData.current.wind_speed_10m)} km/h`;
    document.getElementById('clouds').textContent = `${weatherData.current.cloud_cover}%`;
}

// Update AQI UI
function updateAQIUI(aqiData) {
    const current = aqiData.current;
    document.getElementById('pm25').textContent = Math.round(current.pm2_5);
    document.getElementById('pm10').textContent = Math.round(current.pm10);
    document.getElementById('o3').textContent = Math.round(current.ozone);
    document.getElementById('no2').textContent = Math.round(current.nitrogen_dioxide);
    const aqi = Math.round(current.pm2_5);
    const aqiElement = document.getElementById('aqi');
    aqiElement.textContent = aqi;
    aqiElement.className = 'aqi-value';
    if (aqi <= 50) aqiElement.classList.add('aqi-good');
    else if (aqi <= 100) aqiElement.classList.add('aqi-moderate');
    else if (aqi <= 150) aqiElement.classList.add('aqi-unhealthy-sensitive');
    else if (aqi <= 200) aqiElement.classList.add('aqi-unhealthy');
    else if (aqi <= 300) aqiElement.classList.add('aqi-very-unhealthy');
    else aqiElement.classList.add('aqi-hazardous');
}

// Weather code to description
function getWeatherDescription(code) {
    const weatherCodes = {
        0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
        45: 'Foggy', 48: 'Depositing rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
        61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain', 71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 77: 'Snow grains',
        80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers', 85: 'Slight snow showers', 86: 'Heavy snow showers',
        95: 'Thunderstorm', 96: 'Thunderstorm w/ slight hail', 99: 'Thunderstorm w/ heavy hail'
    };
    return weatherCodes[code] || 'Unknown weather';
}
// Weather code to icon
function getWeatherIcon(code) {
    const icons = {
        0: 'fas fa-sun', 1: 'fas fa-cloud-sun', 2: 'fas fa-cloud-sun', 3: 'fas fa-cloud',
        45: 'fas fa-smog', 48: 'fas fa-smog', 51: 'fas fa-cloud-rain', 53: 'fas fa-cloud-rain', 55: 'fas fa-cloud-showers-heavy',
        61: 'fas fa-cloud-rain', 63: 'fas fa-cloud-showers-heavy', 65: 'fas fa-cloud-showers-heavy', 71: 'fas fa-snowflake', 73: 'fas fa-snowflake', 75: 'fas fa-snowflake', 77: 'fas fa-snowflake',
        80: 'fas fa-cloud-rain', 81: 'fas fa-cloud-showers-heavy', 82: 'fas fa-cloud-showers-heavy', 85: 'fas fa-snowflake', 86: 'fas fa-snowflake',
        95: 'fas fa-bolt', 96: 'fas fa-bolt', 99: 'fas fa-bolt'
    };
    return icons[code] || 'fas fa-question';
}
// Weather animation for retro UI
function updateWeatherAnimation(code) {
    // Hide all animations first
    document.querySelector('.sun-animation').style.display = 'none';
    document.querySelector('.cloud-animation').style.display = 'none';
    document.querySelector('.rain-animation').style.display = 'none';
    document.querySelector('.snow-animation').style.display = 'none';
    document.querySelector('.thunder-animation').style.display = 'none';
    document.querySelector('.fog-animation').style.display = 'none';

    // Clear any existing raindrops or snowflakes
    const rainAnimation = document.querySelector('.rain-animation');
    const snowAnimation = document.querySelector('.snow-animation');
    const thunderAnimation = document.querySelector('.thunder-animation');
    rainAnimation.innerHTML = '';
    snowAnimation.innerHTML = '';
    thunderAnimation.innerHTML = '';

    // Show appropriate animation based on weather code
    if (code >= 0 && code <= 3) {
        // Clear sky to partly cloudy
        document.querySelector('.sun-animation').style.display = 'block';
        // Adjust sun intensity based on cloud cover
        const sunAnimation = document.querySelector('.sun-animation');
        if (code === 0) {
            // Clear sky - bright sun
            sunAnimation.style.boxShadow = '0 0 60px #ffd700';
            sunAnimation.style.animation = 'sun-pulse 2s infinite';
        } else if (code === 1) {
            // Mainly clear - slightly dimmed sun
            sunAnimation.style.boxShadow = '0 0 40px #ffd700';
            sunAnimation.style.animation = 'sun-pulse 3s infinite';
        } else if (code === 2) {
            // Partly cloudy - more dimmed sun
            sunAnimation.style.boxShadow = '0 0 30px #ffd700';
            sunAnimation.style.animation = 'sun-pulse 4s infinite';
        } else {
            // Overcast - very dim sun
            sunAnimation.style.boxShadow = '0 0 20px #ffd700';
            sunAnimation.style.animation = 'sun-pulse 5s infinite';
        }
        if (code >= 1) {
            document.querySelector('.cloud-animation').style.display = 'block';
        }
    } else if (code >= 45 && code <= 48) {
        // Foggy conditions
        document.querySelector('.fog-animation').style.display = 'block';
    } else if (code >= 51 && code <= 55) {
        // Drizzle
        document.querySelector('.rain-animation').style.display = 'block';
        createRaindrops(20); // Fewer raindrops for drizzle
    } else if (code >= 61 && code <= 65) {
        // Rain
        document.querySelector('.rain-animation').style.display = 'block';
        createRaindrops(40); // More raindrops for rain
    } else if (code >= 71 && code <= 77) {
        // Snow
        document.querySelector('.snow-animation').style.display = 'block';
        createSnowflakes(30);
    } else if (code >= 80 && code <= 82) {
        // Rain showers
        document.querySelector('.rain-animation').style.display = 'block';
        createRaindrops(50); // Many raindrops for heavy showers
    } else if (code >= 85 && code <= 86) {
        // Snow showers
        document.querySelector('.snow-animation').style.display = 'block';
        createSnowflakes(40);
    } else if (code >= 95 && code <= 99) {
        // Thunderstorm with different intensities
        document.querySelector('.thunder-animation').style.display = 'block';
        document.querySelector('.rain-animation').style.display = 'block';
        // Adjust thunderstorm intensity
        if (code === 95) {
            // Regular thunderstorm
            createRaindrops(60);
            createLightning(3, 4);
        } else if (code === 96) {
            // Thunderstorm with slight hail
            createRaindrops(70);
            createLightning(4, 3);
        } else if (code === 99) {
            // Thunderstorm with heavy hail
            createRaindrops(80);
            createLightning(5, 2);
        }
    }
}

function createRaindrops(count) {
    const rainAnimation = document.querySelector('.rain-animation');
    for (let i = 0; i < count; i++) {
        const raindrop = document.createElement('div');
        raindrop.className = 'raindrop';
        raindrop.style.left = `${Math.random() * 100}%`;
        raindrop.style.animationDelay = `${Math.random() * 2}s`;
        raindrop.style.height = `${15 + Math.random() * 10}px`;
        raindrop.style.opacity = `${0.5 + Math.random() * 0.5}`;
        rainAnimation.appendChild(raindrop);
    }
}

function createSnowflakes(count) {
    const snowAnimation = document.querySelector('.snow-animation');
    for (let i = 0; i < count; i++) {
        const snowflake = document.createElement('div');
        snowflake.className = 'snowflake';
        snowflake.innerHTML = '❄';
        snowflake.style.left = `${Math.random() * 100}%`;
        snowflake.style.animationDelay = `${Math.random() * 3}s`;
        snowflake.style.fontSize = `${Math.random() * 10 + 15}px`;
        snowAnimation.appendChild(snowflake);
    }
}

function createLightning(count = 3, intensity = 4) {
    const thunderAnimation = document.querySelector('.thunder-animation');
    for (let i = 0; i < count; i++) {
        const lightning = document.createElement('div');
        lightning.className = 'lightning';
        lightning.style.left = `${Math.random() * 100}%`;
        lightning.style.animationDelay = `${Math.random() * intensity}s`;
        lightning.style.height = `${30 + Math.random() * 20}px`;
        lightning.style.opacity = `${0.7 + Math.random() * 0.3}`;
        thunderAnimation.appendChild(lightning);
    }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Show weather for a default city
    getWeather('Delhi, India');
    // Search on Enter
    document.getElementById('city-input').addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            getWeather(this.value);
        }
    });
    // Location button
    document.querySelector('.location-btn').addEventListener('click', () => {
        if (!navigator.geolocation) {
            showError('Geolocation not supported');
            return;
        }
        showLoading();
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                getWeatherForCoordinates(pos.coords.latitude, pos.coords.longitude);
            },
            (err) => {
                showError('Location error: ' + err.message);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    });
}); 