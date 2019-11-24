mapboxgl.accessToken = 'pk.eyJ1IjoiZGF2aWRnNzA3IiwiYSI6ImNqZWVxaGtnazF2czAyeXFlcDlvY2kwZDQifQ.WSmiQO0ccl85_FvEDTsBmw';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11',
  center: {
    lng: 151.09599472830712,
    lat: -33.856237652995084,
  },
  zoom: 11,
});

(() => {
  let currentSuburbIndex = 0;
  let suburbs;

  let selectedFeatureId = null;
  let hoveredFeatureId = null;
  const popups = [];
  const hintEl = document.getElementById('hint');

  const storageGet = key => {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return undefined;
    }
  };

  const storageSet = (key, data) => {
    try {
      return localStorage.setItem(key, JSON.stringify(data));
    } catch {
      return undefined;
    }
  };

  const daysToMs = days => days * 24 * 60 * 60 * 1000;

  const resetFill = featureId => {
    if (!featureId) return;

    map.setFeatureState(
      {source: 'suburbs', id: featureId},
      {fillState: 'none'}
    );
  };

  const select = featureId => {
    map.setFeatureState(
      {source: 'suburbs', id: featureId},
      {fillState: 'selected'}
    );
  };

  const hover = featureId => {
    map.setFeatureState(
      {source: 'suburbs', id: featureId},
      {fillState: 'hovered'}
    );
  };

  const askNextQuestion = () => {
    const suburb = suburbs[currentSuburbIndex];
    document.getElementById('suburb-name').textContent = `Where is ${suburb.name}?`;
  };

  const answerQuestion = answer => {
    const correctAnswer = suburbs[currentSuburbIndex];
    let score; // from 0 to 1

    if (!answer) {
      popups.forEach(popup => popup.remove());
      score = 0;
    } else if (answer.name === correctAnswer.name) {
      score = 1;
    } else {
      const answerPoint = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [answer.lngLat.lng, answer.lngLat.lat]
        },
      };
      const correctAnswerPoint = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [correctAnswer.center.lng, correctAnswer.center.lat]
        },
      };
      const distance = turf.distance(answerPoint, correctAnswerPoint);
      score = (10 - Math.min(distance, 10)) / 10; // you get some points for being close
    }

    if (score !== 1) {
      resetFill(selectedFeatureId);
      selectedFeatureId = correctAnswer.id;
      select(selectedFeatureId);

      popups.push(
        new mapboxgl.Popup()
          .setLngLat(correctAnswer.center)
          .setHTML(correctAnswer.name)
          .addTo(map)
      );
    }

    currentSuburbIndex++;
    askNextQuestion();
    const nextIntervalDays = (correctAnswer.lastIntervalDays * 2) * score + 1;
    correctAnswer.nextAskDate = Date.now() + daysToMs(nextIntervalDays);
    correctAnswer.lastIntervalDays = nextIntervalDays;

    storageSet('suburbs', suburbs);
  };

  document.getElementById('no-idea-button').addEventListener('click', () => {
      answerQuestion(null);
  });

  map.on('load', async () => {
    // map.setPaintProperty('settlement-label', 'text-opacity', 0); // big places
    // map.setPaintProperty('settlement-subdivision-label', 'text-opacity', 0); // suburbs

    const data = await fetch('suburbBoundaries.json').then(response => response.json());

    suburbs = storageGet('suburbs');

    if (!suburbs) {
      suburbs = data.features.map(feature => ({
        id: feature.id,
        name: feature.properties.name,
        center: feature.properties.center,
        lastIntervalDays: 2,
        nextAskDate: null,
      }));

      storageSet('suburbs', suburbs);
    }

    const now = Date.now();
    suburbs = suburbs.filter(suburb => !suburb.nextAskDate || suburb.nextAskDate < now);
    suburbs.sort((a, b) => {
      if (!a.nextAskDate) return 1;
      if (!b.nextAskDate) return -1;
      return a.nextAskDate - b.nextAskDate;
    });

    document.getElementById('question-wrapper').hidden = false;

    askNextQuestion();

    map.addLayer({
      id: 'suburbs',
      type: 'fill',
      source: {
        type: 'geojson',
        data,
      },
      paint: {
        'fill-color': [
          'match',
          ['feature-state', 'fillState'],
          'selected', 'rgba(0, 0, 200, 0.3)',
          'hovered', 'rgba(0, 0, 200, 0.1)',
          'rgba(0, 0, 0, 0)'
        ],
        'fill-outline-color': 'rgba(0, 0, 0, 0.4)',
      },
    });

    map.on('mousemove', 'suburbs', e => {
      if (e.features.length > 0) {
        // If the mouse is still on the same hovered feature, bail
        if (hoveredFeatureId && e.features[0].id === hoveredFeatureId) return;

        // This is a new feature, so reset the previously hovered feature
        // If the previously hovered feature is not selected, un-hover it
        if (hoveredFeatureId !== selectedFeatureId) {
          resetFill(hoveredFeatureId);
          hoveredFeatureId = null;
        }

        hintEl.textContent = e.features[0].properties.name;
        // If the hovered feature is already selected, bail
        if (selectedFeatureId && e.features[0].id === selectedFeatureId) return;

        hoveredFeatureId = e.features[0].id;
        hover(hoveredFeatureId);
      }
    });

    // When the mouse leaves the layer (not just a feature)
    map.on('mouseleave', 'suburbs', () => {
      if (hoveredFeatureId && hoveredFeatureId === selectedFeatureId) return;

      resetFill(hoveredFeatureId);
      hoveredFeatureId = null;
      hintEl.textContent = '';
    });

    map.on('click', 'suburbs', e => {
      if (e.features.length > 0) {
        const clickedFeature = e.features[0];
        // If something was already selected, deselect it
        if (selectedFeatureId) {
          resetFill(selectedFeatureId);

          // If this is a click on the previously-selected feature,
          // leave it un-selected, and hover
          if (selectedFeatureId === clickedFeature.id) {
            selectedFeatureId = null;
            hoveredFeatureId = clickedFeature.id;
            hover(hoveredFeatureId);
            return;
          }
        }

        selectedFeatureId = clickedFeature.id;
        select(selectedFeatureId);

        popups.forEach(popup => popup.remove());
        popups.push(
          new mapboxgl.Popup()
           .setLngLat(JSON.parse(clickedFeature.properties.center))
            .setHTML(clickedFeature.properties.name)
            .addTo(map)
        );

        answerQuestion({
          name: clickedFeature.properties.name,
          lngLat: e.lngLat,
        });

      }
    });

    window.addEventListener('keyup', e => {
      if (e.code === 'Escape') {
        resetFill(selectedFeatureId);

        selectedFeatureId = null;

        popups.forEach(popup => popup.remove());
      }
    });
  });
})();
