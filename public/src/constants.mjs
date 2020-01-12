export const MAP_LAYERS = {
  SUBURBS: 'SUBURBS',
  SUBURBS_LINE: 'SUBURBS_LINE',
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
