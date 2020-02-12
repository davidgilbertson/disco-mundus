import mapboxgl, { Expression } from 'mapbox-gl';

const equals = (value1: any, value2: any): Expression => ['==', value1, value2];

export const literal = (value: any): Expression => ['literal', value];

export const has = (value: any): Expression => ['has', value];

export const all = (...filters: any[]): Expression => ['all', ...filters];

type EnhancedExpression = Expression & {
  isTrue?: () => Expression;
  isFalse?: () => Expression;
  equals?: (value: any) => Expression;
};

export const prop = (value: string, fallback?: string): EnhancedExpression => {
  let result: EnhancedExpression;

  if (fallback) {
    result = ['coalesce', ['get', value], fallback];
  } else {
    result = ['get', value];
  }

  result.isTrue = () => equals(result, true);
  result.isFalse = () => equals(result, false);
  result.equals = (otherValue) => equals(result, otherValue);

  return result;
};

export const state = (value: any): EnhancedExpression => {
  const result = <EnhancedExpression>['feature-state', value];

  result.isTrue = () => equals(result, true);
  result.isFalse = () => equals(result, false);
  result.equals = (otherValue) => equals(result, otherValue);

  return result;
};

type IfThenStop = {
  if: number | string;
  then: number | string;
};

type IfLessThanStop = {
  ifLessThan: number | string;
  then: number | string;
};

type ElseStop = {
  else: number | string;
};

type Cases = (IfThenStop | ElseStop)[];

type MatchProps = {
  prop?: string;
  state?: string;
  cases: Cases;
};

/**
 * @see https://docs.mapbox.com/mapbox-gl-js/style-spec/expressions/#match
 */
export const match = (props: MatchProps) => {
  const result: mapboxgl.Expression = [
    'match',
    props.prop ? prop(props.prop) : state(props.state),
  ];

  props.cases.forEach((thisCase) => {
    if ('if' in thisCase) {
      result.push(thisCase.if, thisCase.then);
    } else {
      result.push(thisCase.else);
    }
  });

  return result;
};

export const cases = (caseArray: Cases) => {
  const result: Expression = ['case'];

  caseArray.forEach((caseItem) => {
    if ('if' in caseItem) {
      result.push(caseItem.if, caseItem.then);
    } else {
      result.push(caseItem.else);
    }
  });

  return result;
};

type InterpolateProps = {
  type?: (string | number)[];
  prop?: string;
  stops: IfThenStop[];
};

/**
 * @see https://docs.mapbox.com/mapbox-gl-js/style-spec/expressions/#interpolate
 */
export const interpolate = (props: InterpolateProps): Expression => {
  const result: Expression = ['interpolate'];

  result.push(props.type || ['linear']);
  result.push([props.prop || 'zoom']);

  props.stops.forEach((stop) => {
    result.push(stop.if, stop.then);
  });

  return result;
};

interpolate.exponential = (num: number): (string | number)[] => [
  'exponential',
  num,
];

type StopsProps = {
  type?: (string | number)[];
  prop: string;
  stops: (IfLessThanStop | ElseStop)[];
};

export const stops = (props: StopsProps): Expression => {
  const result: Expression = ['step', prop(props.prop)];

  props.stops.forEach((stop) => {
    if ('ifLessThan' in stop) {
      result.push(stop.then);
      result.push(stop.ifLessThan);
    } else {
      result.push(stop.else);
    }
  });

  return result;
};

export const coalesce = (values: string[]): Expression => {
  const result: Expression = ['coalesce'];

  values.forEach((value) => {
    result.push(value);
  });

  return result;
};
