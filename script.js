// OpenWeatherMap API key - Replace with your own API key
const API_KEY = 'YOUR_API_KEY'; // You need to sign up at openweathermap.org to get an API key

let map;
let marker;
let heatLayer;
let cloudLayer;
let aqiLayer;
let currentLocation;
let userMarker;
let layerControl;

// Initialize map
function initMap() {
    map = L.map('map').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add layer control
    const baseMaps = {
        "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        })
    };

    const overlayMaps = {
        "Temperature": L.heatLayer([], {
            radius: 25,
            blur: 15,
            maxZoom: 10,
            max: 40,
            gradient: {
                0.4: 'blue',
                0.6: 'lime',
                0.8: 'yellow',
                1.0: 'red'
            }
        }),
        "Clouds": L.heatLayer([], {
            radius: 25,
            blur: 15,
            maxZoom: 10,
            max: 100,
            gradient: {
                0.4: 'rgba(255, 255, 255, 0.6)',
                0.6: 'rgba(200, 200, 200, 0.7)',
                0.8: 'rgba(150, 150, 150, 0.8)',
                1.0: 'rgba(100, 100, 100, 0.9)'
            }
        }),
        "Air Quality": L.heatLayer([], {
            radius: 25,
            blur: 15,
            maxZoom: 10,
            max: 50,
            gradient: {
                0.2: 'rgba(0, 255, 0, 0.6)',
                0.4: 'rgba(255, 255, 0, 0.7)',
                0.6: 'rgba(255, 165, 0, 0.8)',
                0.8: 'rgba(255, 0, 0, 0.9)',
                1.0: 'rgba(128, 0, 128, 1.0)'
            }
        })
    };

    layerControl = L.control.layers(baseMaps, overlayMaps, {
        position: 'topright',
        collapsed: false
    }).addTo(map);

    // Initialize layers
    heatLayer = overlayMaps["Temperature"];
    cloudLayer = overlayMaps["Clouds"];
    aqiLayer = overlayMaps["Air Quality"];
}

// Initialize the map when the page loads
initMap();

// Get user's current location
function getUserLocation() {
    // First check if geolocation is supported
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser. Please use a modern browser or enter your city manually.');
        return;
    }

    // Show loading state
    const locationBtn = document.querySelector('.location-btn');
    const originalIcon = locationBtn.innerHTML;
    locationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    locationBtn.disabled = true;

    // Try to get location with high accuracy
    const options = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
    };

    // First try to get a rough location quickly
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            try {
                console.log('Got position:', position);
                const { latitude, longitude } = position.coords;
                console.log('Coordinates:', latitude, longitude);
                
                currentLocation = { lat: latitude, lng: longitude };

                // Get location name using reverse geocoding with retry
                console.log('Fetching location name...');
                let geoData;
                try {
                    // Try Open-Meteo geocoding first
                    const geoResponse = await fetch(
                        `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=en`,
                        {
                            method: 'GET',
                            headers: {
                                'Accept': 'application/json'
                            },
                            timeout: 5000
                        }
                    );

                    if (!geoResponse.ok) {
                        throw new Error(`Geocoding API error: ${geoResponse.status}`);
                    }

                    geoData = await geoResponse.json();
                    console.log('Geocoding response:', geoData);

                    // If Open-Meteo fails or returns no results, try Nominatim
                    if (!geoData.results || geoData.results.length === 0) {
                        const nominatimResponse = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
                            {
                                method: 'GET',
                                headers: {
                                    'Accept': 'application/json',
                                    'User-Agent': 'WeatherApp/1.0'
                                },
                                timeout: 5000
                            }
                        );

                        if (nominatimResponse.ok) {
                            const nominatimData = await nominatimResponse.json();
                            console.log('Nominatim response:', nominatimData);
                            
                            // Use Nominatim data to create a location name
                            const address = nominatimData.address;
                            if (address) {
                                geoData = {
                                    results: [{
                                        name: address.city || address.town || address.village || address.suburb || 'Unknown Location',
                                        admin1: address.state || address.county,
                                        country: address.country
                                    }]
                                };
                            }
                        }
                    }
                } catch (geoError) {
                    console.error('Geocoding error:', geoError);
                    // Try Nominatim as fallback
                    try {
                        const nominatimResponse = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
                            {
                                method: 'GET',
                                headers: {
                                    'Accept': 'application/json',
                                    'User-Agent': 'WeatherApp/1.0'
                                },
                                timeout: 5000
                            }
                        );

                        if (nominatimResponse.ok) {
                            const nominatimData = await nominatimResponse.json();
                            console.log('Nominatim fallback response:', nominatimData);
                            
                            const address = nominatimData.address;
                            if (address) {
                                geoData = {
                                    results: [{
                                        name: address.city || address.town || address.village || address.suburb || 'Unknown Location',
                                        admin1: address.state || address.county,
                                        country: address.country
                                    }]
                                };
                            }
                        }
                    } catch (nominatimError) {
                        console.error('Nominatim fallback error:', nominatimError);
                        // Last resort: use coordinates
                        geoData = {
                            results: [{
                                name: 'Unknown Location'
                            }]
                        };
                    }
                }
                
                let locationName = 'Unknown Location';
                if (geoData.results && geoData.results.length > 0) {
                    locationName = geoData.results[0].name;
                    // If we have administrative areas, add them to the name
                    if (geoData.results[0].admin1) {
                        locationName += `, ${geoData.results[0].admin1}`;
                    }
                    if (geoData.results[0].country) {
                        locationName += `, ${geoData.results[0].country}`;
                    }
                }

                console.log('Location name:', locationName);

                // Get weather data for user's location with retry
                console.log('Fetching weather data...');
                let weatherData;
                try {
                    const weatherResponse = await fetch(
                        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,cloud_cover&timezone=auto`,
                        {
                            method: 'GET',
                            headers: {
                                'Accept': 'application/json'
                            },
                            timeout: 5000
                        }
                    );

                    if (!weatherResponse.ok) {
                        throw new Error(`Weather API error: ${weatherResponse.status}`);
                    }

                    weatherData = await weatherResponse.json();
                    console.log('Weather data:', weatherData);
                } catch (weatherError) {
                    console.error('Weather API error:', weatherError);
                    throw new Error('Unable to fetch weather data. Please try again later.');
                }

                if (!weatherData || !weatherData.current) {
                    throw new Error('Invalid weather data received');
                }

                updateWeatherUI(weatherData, { name: locationName });

                // Get air quality data with retry
                console.log('Fetching air quality data...');
                try {
                    const aqiResponse = await fetch(
                        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=pm2_5,pm10,ozone,nitrogen_dioxide`,
                        {
                            method: 'GET',
                            headers: {
                                'Accept': 'application/json'
                            },
                            timeout: 5000
                        }
                    );

                    if (aqiResponse.ok) {
                        const aqiData = await aqiResponse.json();
                        console.log('Air quality data:', aqiData);
                        if (aqiData && aqiData.current) {
                            updateAQIUI(aqiData);
                        }
                    }
                } catch (aqiError) {
                    console.error('Air quality API error:', aqiError);
                    // Don't throw error for AQI, as it's not critical
                }

                // Update input field with location name
                document.getElementById('city-input').value = locationName;
                
                // Show success message
                alert(`Successfully got weather for ${locationName}`);
            } catch (error) {
                console.error('Error in location process:', error);
                alert('Error getting weather data: ' + error.message + '\n\nPlease try again or enter a city name manually.');
            } finally {
                // Reset button state
                locationBtn.innerHTML = originalIcon;
                locationBtn.disabled = false;
            }
        },
        (error) => {
            console.error('Geolocation error:', error);
            let errorMessage = 'Error getting your location: ';
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Location access is denied. Please follow these steps:\n\n' +
                        '1. Click the lock/info icon in your browser\'s address bar\n' +
                        '2. Find "Location" or "Geolocation" in the permissions\n' +
                        '3. Change it to "Allow"\n' +
                        '4. Refresh the page and try again';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Location information is unavailable. Please check if:\n\n' +
                        '1. Your device\'s location services are turned on\n' +
                        '2. You have a working internet connection\n' +
                        '3. You\'re not in a location with poor GPS signal';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Location request timed out. Please try again.';
                    break;
                default:
                    errorMessage += error.message;
            }
            
            alert(errorMessage);
            // Reset button state
            locationBtn.innerHTML = originalIcon;
            locationBtn.disabled = false;
        },
        options
    );
}

// Add event listener for location button
document.querySelector('.location-btn').addEventListener('click', function() {
    // Check if browser supports geolocation
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser. Please use a modern browser or enter your city manually.');
        return;
    }

    // Check if we're on HTTPS or localhost
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        alert('Geolocation requires a secure connection (HTTPS) or localhost. Please use HTTPS or run the app locally.');
        return;
    }

    // Check if location permission is already granted
    navigator.permissions.query({ name: 'geolocation' }).then(function(permissionStatus) {
        console.log('Permission status:', permissionStatus.state);
        
        if (permissionStatus.state === 'denied') {
            alert('Location access is denied. Please follow these steps:\n\n' +
                '1. Click the lock/info icon in your browser\'s address bar\n' +
                '2. Find "Location" or "Geolocation" in the permissions\n' +
                '3. Change it to "Allow"\n' +
                '4. Refresh the page and try again');
            return;
        }
        
        getUserLocation();
    }).catch(error => {
        console.error('Error checking permissions:', error);
        // If permission query fails, try getting location anyway
        getUserLocation();
    });
});

async function getWeather() {
    const cityInput = document.getElementById('city-input');
    const city = cityInput.value;

    if (!city) {
        alert('Please enter a city name');
        return;
    }

    try {
        // First, get coordinates for the city using Open-Meteo's geocoding API
        const geoResponse = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1`
        );
        
        if (!geoResponse.ok) {
            throw new Error('Failed to find city coordinates');
        }

        const geoData = await geoResponse.json();
        
        if (!geoData.results || geoData.results.length === 0) {
            throw new Error('City not found');
        }

        const { latitude, longitude } = geoData.results[0];
        currentLocation = { lat: latitude, lng: longitude };

        // Get weather data
        const weatherResponse = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,cloud_cover&timezone=auto`
        );

        if (!weatherResponse.ok) {
            throw new Error('Failed to fetch weather data');
        }

        const weatherData = await weatherResponse.json();
        updateWeatherUI(weatherData, geoData.results[0]);

        // Get air quality data
        const aqiResponse = await fetch(
            `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=pm2_5,pm10,ozone,nitrogen_dioxide`
        );

        if (aqiResponse.ok) {
            const aqiData = await aqiResponse.json();
            updateAQIUI(aqiData);
        }
    } catch (error) {
        alert(error.message);
    }
}

function updateMap(lat, lng) {
    // Remove existing marker if any
    if (marker) {
        map.removeLayer(marker);
    }

    // Add new marker with custom icon
    marker = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'custom-marker',
            html: '<i class="fas fa-map-marker-alt"></i>',
            iconSize: [30, 30]
        })
    }).addTo(map);
    
    // Center map on the location
    map.setView([lat, lng], 10);
}

async function updateAllMapLayers(lat, lng) {
    const tempPoints = [];
    const cloudPoints = [];
    const aqiPoints = [];
    const radius = 0.5; // degrees
    const step = 0.1; // degrees

    for (let latOffset = -radius; latOffset <= radius; latOffset += step) {
        for (let lngOffset = -radius; lngOffset <= radius; lngOffset += step) {
            try {
                // Get temperature data
                const tempResponse = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${lat + latOffset}&longitude=${lng + lngOffset}&current=temperature_2m&timezone=auto`
                );
                const tempData = await tempResponse.json();
                if (tempData.current && tempData.current.temperature_2m) {
                    tempPoints.push([
                        lat + latOffset,
                        lng + lngOffset,
                        tempData.current.temperature_2m
                    ]);
                }

                // Get cloud data
                const cloudResponse = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${lat + latOffset}&longitude=${lng + lngOffset}&current=cloud_cover&timezone=auto`
                );
                const cloudData = await cloudResponse.json();
                if (cloudData.current && cloudData.current.cloud_cover) {
                    cloudPoints.push([
                        lat + latOffset,
                        lng + lngOffset,
                        cloudData.current.cloud_cover
                    ]);
                }

                // Get AQI data
                const aqiResponse = await fetch(
                    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat + latOffset}&longitude=${lng + lngOffset}&current=pm2_5`
                );
                const aqiData = await aqiResponse.json();
                if (aqiData.current && aqiData.current.pm2_5) {
                    aqiPoints.push([
                        lat + latOffset,
                        lng + lngOffset,
                        aqiData.current.pm2_5
                    ]);
                }
            } catch (error) {
                console.error('Error fetching map data:', error);
            }
        }
    }

    // Update layers with new data
    heatLayer.setLatLngs(tempPoints);
    cloudLayer.setLatLngs(cloudPoints);
    aqiLayer.setLatLngs(aqiPoints);

    // Add layers to map if not already added
    if (!map.hasLayer(heatLayer)) heatLayer.addTo(map);
    if (!map.hasLayer(cloudLayer)) cloudLayer.addTo(map);
    if (!map.hasLayer(aqiLayer)) aqiLayer.addTo(map);
}

function updateWeatherUI(weatherData, locationData) {
    document.getElementById('city-name').textContent = locationData.name;
    document.getElementById('temp').textContent = Math.round(weatherData.current.temperature_2m);
    
    const weatherDesc = getWeatherDescription(weatherData.current.weather_code);
    document.getElementById('weather-desc').textContent = weatherDesc;
    
    // Update weather icon
    const weatherIcon = document.querySelector('.weather-icon i');
    weatherIcon.className = getWeatherIcon(weatherData.current.weather_code);
    
    // Update weather animation
    updateWeatherAnimation(weatherData.current.weather_code);
    
    document.getElementById('humidity').textContent = `${weatherData.current.relative_humidity_2m}%`;
    document.getElementById('wind-speed').textContent = `${Math.round(weatherData.current.wind_speed_10m)} km/h`;
    document.getElementById('clouds').textContent = `${weatherData.current.cloud_cover}%`;
}

function getWeatherIcon(code) {
    const icons = {
        0: 'fas fa-sun', // Clear sky
        1: 'fas fa-cloud-sun', // Mainly clear
        2: 'fas fa-cloud-sun', // Partly cloudy
        3: 'fas fa-cloud', // Overcast
        45: 'fas fa-smog', // Foggy
        48: 'fas fa-smog', // Depositing rime fog
        51: 'fas fa-cloud-rain', // Light drizzle
        53: 'fas fa-cloud-rain', // Moderate drizzle
        55: 'fas fa-cloud-showers-heavy', // Dense drizzle
        61: 'fas fa-cloud-rain', // Slight rain
        63: 'fas fa-cloud-showers-heavy', // Moderate rain
        65: 'fas fa-cloud-showers-heavy', // Heavy rain
        71: 'fas fa-snowflake', // Slight snow
        73: 'fas fa-snowflake', // Moderate snow
        75: 'fas fa-snowflake', // Heavy snow
        77: 'fas fa-snowflake', // Snow grains
        80: 'fas fa-cloud-rain', // Slight rain showers
        81: 'fas fa-cloud-showers-heavy', // Moderate rain showers
        82: 'fas fa-cloud-showers-heavy', // Violent rain showers
        85: 'fas fa-snowflake', // Slight snow showers
        86: 'fas fa-snowflake', // Heavy snow showers
        95: 'fas fa-bolt', // Thunderstorm
        96: 'fas fa-bolt', // Thunderstorm with slight hail
        99: 'fas fa-bolt' // Thunderstorm with heavy hail
    };
    return icons[code] || 'fas fa-question';
}

function updateWeatherAnimation(code) {
    // Hide all animations first
    document.querySelector('.sun').style.display = 'none';
    document.querySelector('.clouds').style.display = 'none';
    document.querySelector('.rain').style.display = 'none';
    document.querySelector('.snow').style.display = 'none';
    document.querySelector('.thunder').style.display = 'none';
    document.querySelector('.fog').style.display = 'none';

    // Show appropriate animation based on weather code
    if (code >= 0 && code <= 3) {
        document.querySelector('.sun').style.display = 'block';
    } else if (code >= 45 && code <= 48) {
        document.querySelector('.fog').style.display = 'block';
    } else if (code >= 51 && code <= 55) {
        document.querySelector('.rain').style.display = 'block';
        createRaindrops();
    } else if (code >= 61 && code <= 65) {
        document.querySelector('.rain').style.display = 'block';
        createRaindrops();
    } else if (code >= 71 && code <= 77) {
        document.querySelector('.snow').style.display = 'block';
        createSnowflakes();
    } else if (code >= 80 && code <= 82) {
        document.querySelector('.rain').style.display = 'block';
        createRaindrops();
    } else if (code >= 85 && code <= 86) {
        document.querySelector('.snow').style.display = 'block';
        createSnowflakes();
    } else if (code >= 95 && code <= 99) {
        document.querySelector('.thunder').style.display = 'block';
        createLightning();
    }
}

function createRaindrops() {
    const rainContainer = document.querySelector('.rain');
    rainContainer.innerHTML = '';
    for (let i = 0; i < 50; i++) {
        const raindrop = document.createElement('div');
        raindrop.className = 'raindrop';
        raindrop.style.left = `${Math.random() * 100}%`;
        raindrop.style.animationDelay = `${Math.random() * 2}s`;
        rainContainer.appendChild(raindrop);
    }
}

function createSnowflakes() {
    const snowContainer = document.querySelector('.snow');
    snowContainer.innerHTML = '';
    for (let i = 0; i < 30; i++) {
        const snowflake = document.createElement('div');
        snowflake.className = 'snowflake';
        snowflake.innerHTML = '❄';
        snowflake.style.left = `${Math.random() * 100}%`;
        snowflake.style.animationDelay = `${Math.random() * 3}s`;
        snowContainer.appendChild(snowflake);
    }
}

function createLightning() {
    const thunderContainer = document.querySelector('.thunder');
    thunderContainer.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        const lightning = document.createElement('div');
        lightning.className = 'lightning';
        lightning.style.left = `${Math.random() * 100}%`;
        lightning.style.animationDelay = `${Math.random() * 4}s`;
        thunderContainer.appendChild(lightning);
    }
}

function updateAQIUI(aqiData) {
    const pm25 = aqiData.current.pm2_5;
    const pm10 = aqiData.current.pm10;
    const o3 = aqiData.current.ozone;
    const no2 = aqiData.current.nitrogen_dioxide;

    // Calculate AQI based on EPA standards
    const calculateAQI = (value, pollutant) => {
        const breakpoints = {
            pm25: [
                { min: 0, max: 12, aqiMin: 0, aqiMax: 50 },
                { min: 12.1, max: 35.4, aqiMin: 51, aqiMax: 100 },
                { min: 35.5, max: 55.4, aqiMin: 101, aqiMax: 150 },
                { min: 55.5, max: 150.4, aqiMin: 151, aqiMax: 200 },
                { min: 150.5, max: 250.4, aqiMin: 201, aqiMax: 300 },
                { min: 250.5, max: 500.4, aqiMin: 301, aqiMax: 500 }
            ],
            pm10: [
                { min: 0, max: 54, aqiMin: 0, aqiMax: 50 },
                { min: 55, max: 154, aqiMin: 51, aqiMax: 100 },
                { min: 155, max: 254, aqiMin: 101, aqiMax: 150 },
                { min: 255, max: 354, aqiMin: 151, aqiMax: 200 },
                { min: 355, max: 424, aqiMin: 201, aqiMax: 300 },
                { min: 425, max: 604, aqiMin: 301, aqiMax: 500 }
            ],
            o3: [
                { min: 0, max: 54, aqiMin: 0, aqiMax: 50 },
                { min: 55, max: 70, aqiMin: 51, aqiMax: 100 },
                { min: 71, max: 85, aqiMin: 101, aqiMax: 150 },
                { min: 86, max: 105, aqiMin: 151, aqiMax: 200 },
                { min: 106, max: 200, aqiMin: 201, aqiMax: 300 }
            ],
            no2: [
                { min: 0, max: 53, aqiMin: 0, aqiMax: 50 },
                { min: 54, max: 100, aqiMin: 51, aqiMax: 100 },
                { min: 101, max: 360, aqiMin: 101, aqiMax: 150 },
                { min: 361, max: 649, aqiMin: 151, aqiMax: 200 },
                { min: 650, max: 1249, aqiMin: 201, aqiMax: 300 },
                { min: 1250, max: 2049, aqiMin: 301, aqiMax: 500 }
            ]
        };

        const ranges = breakpoints[pollutant];
        for (const range of ranges) {
            if (value >= range.min && value <= range.max) {
                return Math.round(
                    ((range.aqiMax - range.aqiMin) / (range.max - range.min)) * 
                    (value - range.min) + range.aqiMin
                );
            }
        }
        return 0;
    };

    const aqiPM25 = calculateAQI(pm25, 'pm25');
    const aqiPM10 = calculateAQI(pm10, 'pm10');
    const aqiO3 = calculateAQI(o3, 'o3');
    const aqiNO2 = calculateAQI(no2, 'no2');

    // Get the highest AQI value
    const aqi = Math.max(aqiPM25, aqiPM10, aqiO3, aqiNO2);
    
    // Update UI with AQI and components
    document.getElementById('aqi').textContent = aqi;
    document.getElementById('pm25').textContent = Math.round(pm25);
    document.getElementById('pm10').textContent = Math.round(pm10);
    document.getElementById('o3').textContent = Math.round(o3);
    document.getElementById('no2').textContent = Math.round(no2);

    // Add AQI color coding
    const aqiElement = document.getElementById('aqi');
    aqiElement.className = ''; // Reset classes
    if (aqi <= 50) aqiElement.classList.add('aqi-good');
    else if (aqi <= 100) aqiElement.classList.add('aqi-moderate');
    else if (aqi <= 150) aqiElement.classList.add('aqi-unhealthy-sensitive');
    else if (aqi <= 200) aqiElement.classList.add('aqi-unhealthy');
    else if (aqi <= 300) aqiElement.classList.add('aqi-very-unhealthy');
    else aqiElement.classList.add('aqi-hazardous');
}

function getWeatherDescription(code) {
    const weatherCodes = {
        0: 'Clear sky',
        1: 'Mainly clear',
        2: 'Partly cloudy',
        3: 'Overcast',
        45: 'Foggy',
        48: 'Depositing rime fog',
        51: 'Light drizzle',
        53: 'Moderate drizzle',
        55: 'Dense drizzle',
        61: 'Slight rain',
        63: 'Moderate rain',
        65: 'Heavy rain',
        71: 'Slight snow',
        73: 'Moderate snow',
        75: 'Heavy snow',
        77: 'Snow grains',
        80: 'Slight rain showers',
        81: 'Moderate rain showers',
        82: 'Violent rain showers',
        85: 'Slight snow showers',
        86: 'Heavy snow showers',
        95: 'Thunderstorm',
        96: 'Thunderstorm with slight hail',
        99: 'Thunderstorm with heavy hail'
    };
    return weatherCodes[code] || 'Unknown weather';
}

// Add event listener for Enter key
document.getElementById('city-input').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        getWeather();
    }
}); 