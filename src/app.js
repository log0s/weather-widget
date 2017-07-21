import {div, input} from '@cycle/dom'
import xs from 'xstream'
import _ from 'lodash'

// FIXME - Find out how to inject env vars in cycle-scripts
// const weatherbitApiKey = process.env.WEATHERBIT_API_KEY;
const weatherbitApiKey = '6a243e77dc2947109a44774a1efe8ceb';

function constructWeatherbitUrl(requestType, input) {
  const rootUrl = 'https://api.weatherbit.io/v1.0';
  const rootParams = `&country=us&units=I&key=${weatherbitApiKey}`;

  if (input.type === 'ip') return `${rootUrl}/${requestType}/ip?ip=auto&units=I&key=${weatherbitApiKey}`;
  return input.type === 'zipcode' ? `${rootUrl}/${requestType}/postal?postal_code=${input.value}${rootParams}` : `${rootUrl}/${requestType}/geosearch?city=${input.value}${rootParams}`;
}

export function App (sources) {
  const locationInput$ = sources.DOM.select('.location-input')
    .events('input')
    .map(event => event.target.value)
    .startWith(null);

  const locationSubmit$ = sources.DOM.select('.location-input')
    .events('keydown')
    .map(event => event.key === 'Enter')
    .startWith(false);

  const parsedLocationSubmit$ = xs.combine(locationInput$, locationSubmit$)
    .map(([locationInput, locationSubmit]) => {
      if (_.isNull(locationInput) || !locationSubmit) return null;

      const parsed = parseInt(locationInput);

      return locationInput.length === 5 && _.isFinite(parsed) ? {
        type: 'zipcode',
        value: parsed
      } : {
        type: 'city',
        value: encodeURIComponent(locationInput)
      }
    });

  const getCityData$ = parsedLocationSubmit$
    .map(input => {
      if (!_.isNull(input)) return {
        url: constructWeatherbitUrl('current', input),
        category: 'cityData',
        method: 'GET'
      };
    })
    .startWith({
      url: constructWeatherbitUrl('current', {type:'ip'}),
      category: 'cityData',
      method: 'GET'
    });

  const getForecastData$ = parsedLocationSubmit$
    .map(input => {
      if (!_.isNull(input)) return {
        url: constructWeatherbitUrl('forecast/3hourly', input),
        category: 'forecastData',
        method: 'GET'
      };
    })
    .startWith({
      url: constructWeatherbitUrl('forecast/3hourly', {type: 'ip'}),
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
    // FIXME - Weird mapping due to janky AI returning different formats depending on type of search
    .map(res => res.body.count ? res.body.data[0].forecast : res.body.data)
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