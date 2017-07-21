import {div, input} from '@cycle/dom'
import xs from 'xstream'
import _ from 'lodash'

// FIXME - Find out how to inject env vars in cycle-scripts
// const weatherbitApiKey = process.env.WEATHERBIT_API_KEY;
const weatherbitApiKey = '6a243e77dc2947109a44774a1efe8ceb';

export function App (sources) {
  const locationInput$ = sources.DOM.select('.location-input')
    .events('input')
    .map(ev => ev.target.value)
    .startWith(null);

  const getCityData$ = locationInput$
    .map(value => ({
      url: '',
      category: 'weatherData',
      method: 'GET'
    }))
    .startWith({
      url: `https://api.weatherbit.io/v1.0/current/ip?ip=auto&units=I&key=${weatherbitApiKey}`,
      category: 'cityData',
      method: 'GET'
    });

  const getForecastData$ = locationInput$
    .map(value => ({
      url: '',
      category: 'weatherData',
      method: 'GET'
    }))
    .startWith({
      url: `https://api.weatherbit.io/v1.0/forecast/3hourly/ip?ip=auto&days=1&units=I&key=${weatherbitApiKey}`,
      category: 'forecastData',
      method: 'GET'
    });

  const getWeatherData$ = xs.merge(getCityData$, getForecastData$)

  const cityData$ = sources.HTTP.select('cityData')
    .flatten()
    .map(res => res.body.data[0])
    .map(cityData => ({
      location: cityData.city_name,
      temperature: cityData.temp,
      weather: cityData.weather.description
    }))
    .startWith(null);
    // .startWith({
    //   location: 'ERMAGERD',
    //   temperature: 'COLD AS BALLS',
    //   weather: 'IT GONE RAIN'
    // });

  const forecastData$ = sources.HTTP.select('forecastData')
    .flatten()
    .map(res => res.body.data)
    .map(forecastData => _.map(forecastData, timeData => ({
      time: timeData.datetime,
      temperature: timeData.temp,
      weather: timeData.weather.description
    })))
    .startWith(null);

  // const weatherData$ = xs.of({
  //   location: 'ERMAGERD',
  //   forecast: [
  //     {
  //       temperature: 66,
  //       weather: 'dude'
  //     },
  //     {
  //       temperature: 77,
  //       weather: 'bro'
  //     }
  //   ]
  // });

  const state$ = xs.combine(locationInput$, cityData$, forecastData$)
    .map(([locationInput, cityData, forecastData]) => ({
      locationInput: locationInput,
      weatherData: {
        location: cityData && cityData.location || 'Loading...',
        temperature: cityData && cityData.temperature || 'Loading...',
        weather: cityData && cityData.weather || 'Loading...',
        forecast: forecastData || []
      }
    }));

  const vdom$ = state$.map(({weatherData, locationInput}) =>
    div('.widget-container', [
      weatherData.location,
      weatherData.temperature,
      weatherData.weather,
      input('.location-input', {
        value: locationInput
      }),
      div('.forecast-container', _.map(weatherData.forecast, dayData => div('.forecast-day', [
        dayData.time,
        dayData.temperature,
        dayData.weather
      ])))
    ])
  );

  const sinks = {
    DOM: vdom$,
    HTTP: getWeatherData$
  }
  return sinks
}