import React, { useState, useEffect } from 'react';
import HourlyTemperatureChart from './HourlyTemperatureChart';
import HourlyPrecipitationChart from './HourlyPrecipitationChart';
import CountUp from './CountUp';

// Interfacce per l'API meteo di Google basate sulla documentazione ufficiale
interface GoogleWeatherCondition {
  iconBaseUri: string;
  description: {
    text: string;
    languageCode: string;
  };
  type: string;
}

interface GoogleTemperature {
  degrees: number;
  unit: string;
}

interface GoogleWind {
  direction: {
    degrees: number;
    cardinal: string;
  };
  speed: {
    value: number;
    unit: string;
  };
  gust?: {
    value: number;
    unit: string;
  };
}

interface GooglePrecipitation {
  probability: {
    percent: number;
    type: string;
  };
  qpf: {
    quantity: number;
    unit: string;
  };
}

interface GoogleCurrentConditionsHistory {
  temperatureChange: GoogleTemperature;
  maxTemperature: GoogleTemperature;
  minTemperature: GoogleTemperature;
  qpf: {
    quantity: number;
    unit: string;
  };
}

// Struttura corretta per le condizioni attuali dall'API Google Weather
interface GoogleCurrentConditions {
  currentTime: string;
  timeZone: {
    id: string;
  };
  isDaytime: boolean;
  weatherCondition: GoogleWeatherCondition;
  temperature: GoogleTemperature;
  feelsLikeTemperature: GoogleTemperature;
  dewPoint: GoogleTemperature;
  heatIndex: GoogleTemperature;
  windChill: GoogleTemperature;
  relativeHumidity: number;
  uvIndex: number;
  precipitation: GooglePrecipitation;
  thunderstormProbability: number;
  airPressure: {
    meanSeaLevelMillibars: number;
  };
  wind: GoogleWind;
  visibility: {
    distance: number;
    unit: string;
  };
  cloudCover: number;
  currentConditionsHistory: GoogleCurrentConditionsHistory;
}

interface GoogleForecastDay {
  interval: {
    startTime: string;
    endTime: string;
  };
  displayDate: {
    year: number;
    month: number;
    day: number;
  };
  daytimeForecast: {
    interval: {
      startTime: string;
      endTime: string;
    };
    weatherCondition: GoogleWeatherCondition;
    relativeHumidity: number;
    uvIndex: number;
    precipitation: GooglePrecipitation;
    thunderstormProbability: number;
    wind: GoogleWind;
    cloudCover: number;
  };
  nighttimeForecast: {
    interval: {
      startTime: string;
      endTime: string;
    };
    weatherCondition: GoogleWeatherCondition;
    relativeHumidity: number;
    uvIndex: number;
    precipitation: GooglePrecipitation;
    thunderstormProbability: number;
    wind: GoogleWind;
    cloudCover: number;
  };
  maxTemperature: GoogleTemperature;
  minTemperature: GoogleTemperature;
  feelsLikeMaxTemperature: GoogleTemperature;
  feelsLikeMinTemperature: GoogleTemperature;
  sunEvents: {
    sunriseTime: string;
    sunsetTime: string;
  };
  moonEvents: {
    moonPhase: string;
    moonriseTimes: string[];
    moonsetTimes: string[];
  };
  maxHeatIndex: GoogleTemperature;
  iceThickness: {
    thickness: number;
    unit: string;
  };
}

interface GoogleForecastData {
  forecastDays: GoogleForecastDay[];
}

// Interfaccia per i dati orari dall'API Google Weather
interface GoogleHourlyForecast {
  interval: {
    startTime: string;
    endTime: string;
  };
  displayDateTime: {
    year: number;
    month: number;
    day: number;
    hours: number;
    utcOffset: string;
  };
  isDaytime: boolean;
  weatherCondition: GoogleWeatherCondition;
  temperature: GoogleTemperature;
  feelsLikeTemperature: GoogleTemperature;
  dewPoint: GoogleTemperature;
  heatIndex: GoogleTemperature;
  windChill: GoogleTemperature;
  relativeHumidity: number;
  uvIndex: number;
  precipitation: GooglePrecipitation;
  thunderstormProbability: number;
  airPressure: {
    meanSeaLevelMillibars: number;
  };
  wind: GoogleWind;
  visibility: {
    distance: number;
    unit: string;
  };
  cloudCover: number;
}

interface GoogleHourlyData {
  forecastHours: GoogleHourlyForecast[];
  timeZone: {
    id: string;
  };
}

interface GoogleWeatherData {
  currentConditions: GoogleCurrentConditions;
  forecastDays: GoogleForecastDay[];
  hourlyData?: GoogleHourlyData;
}

interface WeatherWidgetProps {
  className?: string;
}

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ className = '' }) => {
  const [weather, setWeather] = useState<GoogleWeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Coordinate per Leonessa (vicino a Piedelpoggio)
  const LATITUDE = 42.5560;
  const LONGITUDE = 12.9941;
  const GOOGLE_API_KEY = import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY;

  const getWeatherIcon = (iconBaseUri: string, weatherType: string, isDark: boolean = false) => {
    // Utilizza direttamente l'iconBaseUri fornito da Google con l'estensione corretta
    if (iconBaseUri) {
      const theme = isDark ? '_dark' : '';
      return `${iconBaseUri}${theme}.svg`;
    }
    
    // Fallback: costruisce l'URL dell'icona basandosi sul tipo di condizione
    const typeToIconMap: { [key: string]: string } = {
      // Condizioni di base
      'CLEAR': 'sunny',
      'MOSTLY_CLEAR': 'partly_clear',
      'PARTLY_CLOUDY': 'partly_cloudy',
      'MOSTLY_CLOUDY': 'cloudy',
      'CLOUDY': 'cloudy',
      'OVERCAST': 'cloudy',
      
      // Vento
      'WINDY': 'windy',
      'WIND_AND_RAIN': 'wind_and_rain',
      
      // Pioggia leggera e rovesci
      'LIGHT_RAIN_SHOWERS': 'light_rain_showers',
      'CHANCE_OF_SHOWERS': 'chance_of_showers',
      'SCATTERED_SHOWERS': 'scattered_showers',
      'RAIN_SHOWERS': 'showers',
      'HEAVY_RAIN_SHOWERS': 'heavy_rain_showers',
      
      // Pioggia
      'LIGHT_TO_MODERATE_RAIN': 'drizzle',
      'MODERATE_TO_HEAVY_RAIN': 'showers',
      'RAIN': 'showers',
      'LIGHT_RAIN': 'drizzle',
      'HEAVY_RAIN': 'heavy_rain',
      'RAIN_PERIODICALLY_HEAVY': 'heavy_rain',
      
      // Neve leggera e rovesci
      'LIGHT_SNOW_SHOWERS': 'light_snow_showers',
      'CHANCE_OF_SNOW_SHOWERS': 'chance_of_snow_showers',
      'SCATTERED_SNOW_SHOWERS': 'scattered_snow_showers',
      'SNOW_SHOWERS': 'snow_showers',
      'HEAVY_SNOW_SHOWERS': 'heavy_snow_showers',
      
      // Neve
      'LIGHT_TO_MODERATE_SNOW': 'snow',
      'MODERATE_TO_HEAVY_SNOW': 'heavy_snow',
      'SNOW': 'snow',
      'LIGHT_SNOW': 'light_snow',
      'HEAVY_SNOW': 'heavy_snow',
      'SNOWSTORM': 'snowstorm',
      'SNOW_PERIODICALLY_HEAVY': 'heavy_snow',
      'HEAVY_SNOW_STORM': 'heavy_snow_storm',
      'BLOWING_SNOW': 'blowing_snow',
      
      // Condizioni miste
      'RAIN_AND_SNOW': 'rain_and_snow',
      'HAIL': 'hail',
      'HAIL_SHOWERS': 'hail_showers',
      
      // Temporali
      'THUNDERSTORM': 'thunderstorm',
      'THUNDERSHOWER': 'thundershower',
      'LIGHT_THUNDERSTORM_RAIN': 'light_thunderstorm_rain',
      'SCATTERED_THUNDERSTORMS': 'scattered_thunderstorms',
      'HEAVY_THUNDERSTORM': 'heavy_thunderstorm',
      
      // Nebbia (aggiunto per completezza)
      'FOG': 'fog',
      
      // Compatibilità con i vecchi tipi
      'DRIZZLE': 'drizzle'
    };

    const iconName = typeToIconMap[weatherType] || 'sunny';
    const theme = isDark ? '_dark' : '';
    return `https://maps.gstatic.com/weather/v1/${iconName}${theme}.svg`;
  };

  // Funzione di fallback per dati simulati (solo in caso di errore API)
  const generateHourlyData = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const temperatureData = [];
    const precipitationData = [];
    
    // Genera 24 ore di dati (6 ore passate + ora corrente + 17 ore future)
    for (let i = -6; i <= 17; i++) {
      const hour = new Date(now);
      hour.setHours(currentHour + i, 0, 0, 0);
      
      const isPast = i < 0;
      const baseTemp = weather?.currentConditions?.temperature?.degrees || 15;
      
      // Simula variazioni di temperatura durante il giorno con un ciclo più realistico
      const hourOfDay = hour.getHours();
      let tempVariation = 0;
      
      // Ciclo di temperatura più realistico: minimo alle 6:00, massimo alle 15:00
      if (hourOfDay >= 0 && hourOfDay < 6) {
        // Notte tarda/mattino presto: temperatura in calo verso il minimo
        tempVariation = -6 + (6 - hourOfDay) * 0.5;
      } else if (hourOfDay >= 6 && hourOfDay < 15) {
        // Mattino/pomeriggio: temperatura in aumento verso il massimo
        tempVariation = -6 + (hourOfDay - 6) * 1.5;
      } else if (hourOfDay >= 15 && hourOfDay < 21) {
        // Pomeriggio/sera: temperatura in calo graduale
        tempVariation = 7.5 - (hourOfDay - 15) * 1.2;
      } else {
        // Sera/notte: temperatura in calo verso il minimo
        tempVariation = 0.3 - (hourOfDay - 21) * 2;
      }
      
      temperatureData.push({
        time: hour.toISOString(),
        temperature: baseTemp + tempVariation + (Math.random() - 0.5) * 2,
        isPast
      });
      
      // Simula dati precipitazioni
      const precipProb = weather?.currentConditions?.precipitation?.probability?.percent || 0;
      precipitationData.push({
        time: hour.toISOString(),
        probability: Math.max(0, precipProb + (Math.random() - 0.5) * 40),
        quantity: Math.random() * 2,
        isPast
      });
    }
    
    return { temperatureData, precipitationData };
  };

  // Funzione per ottenere dati orari reali dall'API Google Weather
  const fetchHourlyData = async (): Promise<{ temperatureData: any[], precipitationData: any[] }> => {
    try {
      const response = await fetch(
        `https://weather.googleapis.com/v1/forecast/hours:lookup?key=${GOOGLE_API_KEY}&location.latitude=${LATITUDE}&location.longitude=${LONGITUDE}&hours=24&languageCode=it`
      );
      
      if (!response.ok) {
        throw new Error('Errore nel caricamento dei dati orari');
      }
      
      const hourlyData: GoogleHourlyData = await response.json();
      
      const now = new Date();
      const currentTime = now.getTime();
      
      const temperatureData = hourlyData.forecastHours.map((hour) => {
        const hourTime = new Date(hour.interval.startTime);
        const isPast = hourTime.getTime() < currentTime;
        
        return {
          time: hour.interval.startTime,
          temperature: hour.temperature.degrees,
          isPast
        };
      });
      
      const precipitationData = hourlyData.forecastHours.map((hour) => {
        const hourTime = new Date(hour.interval.startTime);
        const isPast = hourTime.getTime() < currentTime;
        
        return {
          time: hour.interval.startTime,
          probability: hour.precipitation.probability.percent,
          quantity: hour.precipitation.qpf.quantity,
          isPast
        };
      });
      
      return { temperatureData, precipitationData };
    } catch (error) {
      console.error('Errore nel caricamento dei dati orari:', error);
      // Fallback ai dati simulati in caso di errore
      return generateHourlyData();
    }
  };

  const getWeatherDescription = (description: string, weatherType: string) => {
    // Traduzioni italiane per le condizioni meteo
    const translations: { [key: string]: string } = {
      'Clear': 'Sereno',
      'Mostly clear': 'Prevalentemente sereno',
      'Partly cloudy': 'Parzialmente nuvoloso',
      'Mostly cloudy': 'Prevalentemente nuvoloso',
      'Overcast': 'Coperto',
      'Fog': 'Nebbia',
      'Light rain': 'Pioggia leggera',
      'Moderate rain': 'Pioggia moderata',
      'Heavy rain': 'Pioggia intensa',
      'Light snow': 'Neve leggera',
      'Moderate snow': 'Neve moderata',
      'Heavy snow': 'Neve intensa',
      'Thunderstorm': 'Temporale',
      'Drizzle': 'Pioggerella',
      'Rain showers': 'Rovesci',
      'Snow showers': 'Rovesci di neve'
    };

    return translations[description] || description || 'Condizioni variabili';
  };

  // Stato per i dati orari
  const [hourlyData, setHourlyData] = useState<{ temperatureData: any[], precipitationData: any[] }>({ temperatureData: [], precipitationData: [] });

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setLoading(true);
        
        // Fetch current conditions
        const currentResponse = await fetch(
          `https://weather.googleapis.com/v1/currentConditions:lookup?key=${GOOGLE_API_KEY}&location.latitude=${LATITUDE}&location.longitude=${LONGITUDE}&languageCode=it`
        );
        
        if (!currentResponse.ok) {
          throw new Error('Errore nel caricamento delle condizioni attuali');
        }
        
        const currentData = await currentResponse.json();
        
        // Fetch forecast
        const forecastResponse = await fetch(
          `https://weather.googleapis.com/v1/forecast/days:lookup?key=${GOOGLE_API_KEY}&location.latitude=${LATITUDE}&location.longitude=${LONGITUDE}&days=5&languageCode=it`
        );
        
        if (!forecastResponse.ok) {
          throw new Error('Errore nel caricamento delle previsioni');
        }
        
        const forecastData = await forecastResponse.json();
        
        // Fetch hourly data
        const hourlyDataResult = await fetchHourlyData();
        setHourlyData(hourlyDataResult);
        
        // Combina i dati
        const combinedData: GoogleWeatherData = {
          currentConditions: currentData,
          forecastDays: forecastData.forecastDays || []
        };
        
        setWeather(combinedData);
        setError(null);
      } catch (err) {
        console.error('WeatherWidget: Errore API Google Weather:', err);
        setError(err instanceof Error ? err.message : 'Errore sconosciuto');
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    // Aggiorna ogni 10 minuti
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    console.log('WeatherWidget: Rendering stato loading');
    return (
      <div className={`w-full ${className}`}>
        <div className="animate-pulse flex items-center gap-6">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-200 rounded-full"></div>
          <div className="flex-1">
            <div className="h-6 bg-blue-200 rounded w-32 mb-2"></div>
            <div className="h-4 bg-blue-200 rounded w-24"></div>
          </div>
          <div className="flex gap-3">
            <div className="w-12 h-12 bg-blue-200 rounded-lg"></div>
            <div className="w-12 h-12 bg-blue-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !weather) {
    console.log('WeatherWidget: Rendering stato errore', { error, weather });
    return (
      <div className={`w-full ${className}`}>
        <div className="flex items-center gap-4">
          <div className="text-5xl">🌡️</div>
          <div>
            <p className="text-red-600 font-semibold">Meteo non disponibile</p>
            <p className="text-red-500 text-sm">Riprova più tardi</p>
          </div>
        </div>
      </div>
    );
  }

  console.log('WeatherWidget: Rendering dati meteo', weather);

  const currentTemp = Math.round(weather.currentConditions.temperature.degrees);
  const currentIcon = getWeatherIcon(
    weather.currentConditions.weatherCondition.iconBaseUri, 
    weather.currentConditions.weatherCondition.type
  );
  const currentDescription = getWeatherDescription(
    weather.currentConditions.weatherCondition.description.text,
    weather.currentConditions.weatherCondition.type
  );

  return (
    <div className={`w-full ${className}`}>
      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6  rounded-xl p-3 sm:p-2 border border-gray-200">
        {/* Icona meteo principale - MOLTO PIÀ GRANDE */}
        <div className="flex-shrink-0">
          <div className="w-12 h-12 sm:w-16 sm:h-16 sm:w-20 sm:h-20 transform hover:scale-110 transition-transform duration-300 drop-shadow-lg">
            <img 
              src={currentIcon} 
              alt={currentDescription}
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Informazioni principali */}
        <div className="flex-1 min-w-0 text-center sm:text-left">
          {/* Layout mobile ottimizzato: temperatura al centro, altitudine e stato meteo sotto */}
          <div className="flex flex-col items-center sm:items-start gap-2 mb-2">
            {/* Temperatura principale */}
            <span className="text-3xl sm:text-3xl font-bold text-gray-800">{currentTemp}°C</span>
            
            {/* Altitudine e località su mobile - più prominenti */}
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
              <span className="text-blue-600 font-medium text-sm">Piedelpoggio</span>
              <div className="flex items-center gap-1 text-sm">
                <CountUp 
                  to={927} 
                  separator="," 
                  direction="up" 
                  duration={1.5} 
                  className="font-bold text-blue-700" 
                />
                <span className="text-blue-500 font-medium">m s.l.m.</span>
              </div>
            </div>
            
            {/* Stato meteo sotto l'altitudine su mobile */}
            <div className="text-blue-700 font-medium text-sm text-center sm:text-left">
              {currentDescription}
            </div>
          </div>
          
          {/* Dettagli compatti - visibili anche su mobile ma più compatti */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-4 text-xs text-gray-600 mt-2">
            <div className="flex items-center gap-1">
              <span className="text-blue-500 font-medium">Umidità:</span>
              <span>{weather.currentConditions.relativeHumidity}%</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-blue-500 font-medium">Vento:</span>
              <span>{Math.round(weather.currentConditions.wind.speed.value)} km/h</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-blue-500 font-medium">Precipitazioni:</span>
              <span>{weather.currentConditions.precipitation?.probability?.percent || 0}%</span>
            </div>
          </div>
        </div>




        
        {/* Previsioni 5 giorni - eleganti */}
        <div className="flex gap-1.5 sm:gap-2 flex-shrink-0 overflow-x-auto">
          {weather.forecastDays.filter(forecast => {
            const date = new Date(forecast.displayDate.year, forecast.displayDate.month - 1, forecast.displayDate.day);
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Reset ore per confronto solo data
            date.setHours(0, 0, 0, 0);
            return date >= today; // Solo oggi e giorni futuri
          }).slice(0, 5).map((forecast, index) => {
            const date = new Date(forecast.displayDate.year, forecast.displayDate.month - 1, forecast.displayDate.day);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            date.setHours(0, 0, 0, 0);
            const isToday = date.getTime() === today.getTime();
            const dayName = isToday ? 'Oggi' : date.toLocaleDateString('it-IT', { weekday: 'short' });
            
            // Usa le temperature max/min dalla nuova struttura API
            const maxTemp = forecast.maxTemperature ? Math.round(forecast.maxTemperature.degrees) : 0;
            const minTemp = forecast.minTemperature ? Math.round(forecast.minTemperature.degrees) : 0;
            
            const icon = getWeatherIcon(
              forecast.daytimeForecast.weatherCondition.iconBaseUri,
              forecast.daytimeForecast.weatherCondition.type
            );
            
            return (
              <div key={index} className="bg-white/70 backdrop-blur-sm rounded-xl p-2 sm:p-2.5 border border-gray-200 text-center min-w-[45px] sm:min-w-[55px] hover:bg-white/80 hover:shadow-sm transition-all duration-200
">
                <div className="text-[10px] sm:text-xs text-gray-600 font-medium mb-1 capitalize truncate">
                  {dayName}
                </div>
                <div className="w-6 h-6 sm:w-7 sm:h-7 mb-1.5 mx-auto transform hover:scale-110 transition-transform duration-200">
                  <img 
                    src={icon} 
                    alt={forecast.daytimeForecast.weatherCondition.description.text}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="text-[10px] sm:text-xs space-y-0.5">
                  <div className="font-bold text-gray-800">{maxTemp}°</div>
                  <div className="text-gray-500 font-medium">{minTemp}°</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grafici orari - spaziatura migliorata per mobile */}
      {weather && (
        <div className="mt-6 space-y-6 sm:space-y-4 sm:mt-4">
          <div className="bg-white/50 rounded-xl p-3 sm:p-2 border border-gray-200">
            <HourlyTemperatureChart 
              data={hourlyData.temperatureData} 
              currentTime={weather.currentConditions.currentTime} 
            />
          </div>
          <div className="bg-white/50 rounded-xl p-3 sm:p-2 border border-gray-200">
            <HourlyPrecipitationChart 
              data={hourlyData.precipitationData} 
              currentTime={weather.currentConditions.currentTime} 
            />
          </div>
        </div>
      )}

      {/* Link ai siti meteo esterni */}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <a 
          href="https://www.3bmeteo.com/meteo/leonessa" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-3 py-1 text-xs md:text-sm font-medium.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 hover:text-blue-700 text-xs font-medium rounded-lg border border-blue-200/50 hover:border-blue-300/50 transition-all duration-200"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
          </svg>
          3B Meteo
        </a>
        <a 
          href="https://www.ilmeteo.it/meteo/leonessa" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-3 py-1 text-xs md:text-sm font-medium.5 bg-green-500/10 hover:bg-green-500/20 text-green-600 hover:text-green-700 text-xs font-medium rounded-lg border border-green-200/50 hover:border-green-300/50 transition-all duration-200"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
          </svg>
          Il Meteo
        </a>
        <a 
          href="https://www.meteoam.it/it/meteo-citta/leonessa" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-3 py-1 text-xs md:text-sm font-medium.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 hover:text-purple-700 text-xs font-medium rounded-lg border border-purple-200/50 hover:border-purple-300/50 transition-all duration-200"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
          </svg>
          Meteo AM
        </a>
        <a 
          href="https://www.accuweather.com/it/it/piedelpoggio/1547795/daily-weather-forecast/1547795" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-3 py-1 text-xs md:text-sm font-medium.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 hover:text-orange-700 text-xs font-medium rounded-lg border border-orange-200/50 hover:border-orange-300/50 transition-all duration-200"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
          </svg>
          AccuWeather
        </a>
        <a 
          href="https://www.google.com/search?q=meteo+piedelpoggio" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-3 py-1 text-xs md:text-sm font-medium.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 hover:text-red-700 text-xs font-medium rounded-lg border border-red-200/50 hover:border-red-300/50 transition-all duration-200"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          Google
        </a>
        <a 
          href="https://www.meteoblue.com/it/tempo/previsioni/multimodel/piedelpoggio_italia_3170854" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-3 py-1 text-xs md:text-sm font-medium.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 hover:text-indigo-700 text-xs font-medium rounded-lg border border-indigo-200/50 hover:border-indigo-300/50 transition-all duration-200"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
          Multimodello
        </a>
      </div>

      {/* Informazioni geografiche */}
      <div className="mt-5 pt-4 border-t border-blue-200/50">
        <div className="bg-gradient-to-r from-blue-50/60 to-indigo-50/60 backdrop-blur-sm rounded-xl p-4 border border-gray-200
">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <h3 className="text-sm font-semibold text-blue-800">Informazioni Geografiche</h3>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-blue-100/30">
              <div className="text-blue-600 font-medium mb-1">Regione</div>
              <div className="text-gray-800 font-semibold">Lazio</div>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-blue-100/30">
              <div className="text-blue-600 font-medium mb-1">Provincia</div>
              <div className="text-gray-800 font-semibold">Rieti</div>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-blue-100/30">
              <div className="text-blue-600 font-medium mb-1">Comune</div>
              <div className="text-gray-800 font-semibold">Leonessa</div>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-blue-100/30">
              <div className="text-blue-600 font-medium mb-1">Abitanti</div>
              <div className="text-gray-800 font-semibold">61 (2001)</div>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-blue-100/30">
              <div className="text-blue-600 font-medium mb-1">Coordinate</div>
              <div className="text-gray-800 font-semibold">42°33′N 13°00′E</div>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-blue-100/30">
              <div className="text-blue-600 font-medium mb-1">CAP</div>
              <div className="text-gray-800 font-semibold">02010</div>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-blue-100/30">
              <div className="text-blue-600 font-medium mb-1">Prefisso</div>
              <div className="text-gray-800 font-semibold">0746</div>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-blue-100/30">
              <div className="text-blue-600 font-medium mb-1">Fuso orario</div>
              <div className="text-gray-800 font-semibold">UTC+1</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sezione Webcam e Territorio */}
      <div className="mt-5 pt-4 border-t border-gray-200/50">
        <div className="flex gap-2">
          <a 
            href="/info/webcam" 
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 hover:from-blue-500/20 hover:to-cyan-500/20 text-blue-600 hover:text-blue-700 text-sm font-medium rounded-lg border border-blue-200/50 hover:border-blue-300/50 transition-all duration-200 group"
          >
            <svg className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
            </svg>
            Webcam Live
            <svg className="w-3 h-3 group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
            </svg>
          </a>
          <a 
            href="/info/montagna-sentieri" 
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500/10 to-emerald-500/10 hover:from-green-500/20 hover:to-emerald-500/20 text-green-600 hover:text-green-700 text-sm font-medium rounded-lg border border-green-200/50 hover:border-green-300/50 transition-all duration-200 group"
          >
            <svg className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 20l4-8 3 4 2-4 3 6 2-3 4 5H3z"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12l2-4 3 2 2-3 1 2"/>
            </svg>
            Sentieri e Territorio
            <svg className="w-3 h-3 group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
};

export default WeatherWidget;
