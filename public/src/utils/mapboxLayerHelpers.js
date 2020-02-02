const equals = (value1, value2) => ['==', value1, value2];

export const literal = value => ['literal', value];

export const has = value => ['has', value];

export const all = (...filters) => ['all', ...filters];

export const prop = (value, fallback) => {
  let result;

  if (fallback) {
    result = ['coalesce', ['get', value], fallback];
  } else {
    result = ['get', value];
  }

  result.isTrue = () => equals(result, true);
  result.isFalse = () => equals(result, false);
  result.equals = otherValue => equals(result, otherValue);

  return result;
};

export const state = value => {
  const result = ['feature-state', value];

  result.isTrue = () => equals(result, true);
  result.isFalse = () => equals(result, false);
  result.equals = otherValue => equals(result, otherValue);

  return result;
};

/**
 * @typedef {object} IfThenStop
 * @property {string} if
 * @property {number|string} then
 */

/**
 * @typedef {object} ElseStop
 * @property {number|string} else
 */

/**
 * @typedef {object} MatchProps
 * @property {string} [prop]
 * @property {string} [state]
 * @property {Array<IfThenStop|ElseStop>} cases
 */

/**
 * @see https://docs.mapbox.com/mapbox-gl-js/style-spec/expressions/#match
 * @param {MatchProps} props
 * @return {[string, (*)]}
 */
export const match = props => {
  const result = ['match', props.prop ? prop(props.prop) : state(props.state)];

  props.cases.forEach(thisCase => {
    if (thisCase.if) {
      result.push(thisCase.if, thisCase.then);
    } else {
      result.push(thisCase.else);
    }
  });

  return result;
};

export const cases = conditions => {
  const result = ['case'];

  conditions.forEach(condition => {
    if (condition.if) {
      result.push(condition.if, condition.then);
    } else {
      result.push(condition.else);
    }
  });

  return result;
};

/**
 * @typedef {object} InterpolateProps
 * @property {Array<string>} [type]
 * @property {string} [prop]
 * @property {Array<IfThenStop>} stops
 */

/**
 * @see https://docs.mapbox.com/mapbox-gl-js/style-spec/expressions/#interpolate
 * @param {InterpolateProps} props
 * @return {[*]}
 */
export const interpolate = props => {
  /** @type {Array<string|Array<string>>} */
  const result = ['interpolate'];

  result.push(props.type || ['linear']);
  result.push([props.prop || 'zoom']);

  props.stops.forEach(stop => {
    result.push(stop.if, stop.then);
  });

  return result;
};

/**
 *
 * @param {number} num
 * @return {[string, number]}
 */
interpolate.exponential = num => ['exponential', num];

export const stops = props => {
  const result = ['step', prop(props.prop)];

  props.stops.forEach(stop => {
    if (stop.ifLessThan) {
      result.push(stop.then);
      result.push(stop.ifLessThan);
    } else {
      result.push(stop.else);
    }
  });

  return result;
};

export const coalesce = values => {
  const result = ['coalesce'];

  values.forEach(value => {
    result.push(value);
  });

  return result;
};
