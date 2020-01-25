export const MAP_LAYERS = {
  LOCATION_HIGHLIGHT_FILL: 'LOCATION_HIGHLIGHT_FILL',
  LOCATION_HIGHLIGHT_LINE: 'LOCATION_HIGHLIGHT_LINE',
  LOCATION_BORDERS: 'LOCATION_BORDERS',
};

export const MAP_SOURCES = {
  SUBURBS: 'SUBURBS',
};

export const FEATURE_STATUS = {
  SELECTED: 'SELECTED',
  NONE: 'NONE',
  HOVERED: 'HOVERED',
  RIGHT: 'RIGHT',
  WRONG: 'WRONG',
};

// Disco Mundus Spaced Repetition constants
export const DMSR = {
  SCORE_FOR_NEIGHBOR: 0.8, // score for clicking a neighbor
  CLOSE_M: 4000, // in meters
  FIRST_TIME_MINS: 20, // default duration before the first review
  MIN_MINS: 1, // The shortest possible duration
  MULTIPLIER: 2,
  LOOKAHEAD_WINDOW_MINS: 5,
  SESSION_SIZE: 10, // How many new questions to learn at once
};
