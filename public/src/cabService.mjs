import * as dataUtils from './utils/dataUtils.mjs';
import * as storageUtils from './utils/storageUtils.mjs';

// const API_URL = 'http://localhost:5001/velantrix/us-central1/api';
const API_URL = 'https://us-central1-velantrix.cloudfunctions.net/api';

// Changing this string would break progress for all users. So don't do that.
const USER_ID_STRING = 'your-progress-id';

const state = {
  userId: null,
  saveQueue: [],
};

const fetchJson = (url, opts = {}) =>
  fetch(url, {
    method: opts.method,
    headers: { 'Content-Type': 'application/json' },
    body: opts.body && JSON.stringify(opts.body),
  }).then(res => res.json());

/**
 * @param {AnswerHistory} answerHistory
 * @return {Promise<{[error]: string, [id]: string}>}
 */
const create = answerHistory =>
  fetchJson(API_URL, {
    method: 'POST',
    body: { answerHistory },
  });

/**
 * @typedef AnswerHistoryItem
 * @property {number} id - the feature ID
 * @property {number} lastScore - currently not used
 * @property {number} nextAskDate - date/time in milliseconds.
 * @property {number} lastAskDate - date/time in milliseconds.
 *    Used to calculate the nextAskDate once a question is answered
 */

/**
 * @typedef {Array<AnswerHistoryItem>} AnswerHistory - an array of answer
 * history items
 */

/**
 * @param {string} id
 * @return {Promise<{[error]: string, [data]: AnswerHistory}>}
 */
const read = id =>
  fetchJson(`${API_URL}/${id}`).then(response =>
    response.error ? response : { data: response.data.answerHistory }
  );

/**
 * Update an item in the data
 * @param {AnswerHistoryItem} answerHistoryItem
 * @return {Promise<{[error]: string, [success]: string}>}
 */
const upsert = answerHistoryItem =>
  fetchJson(`${API_URL}/${state.userId}`, {
    method: 'PATCH',
    body: {
      action: 'ARRAY_UPSERT',
      path: 'answerHistory',
      data: answerHistoryItem,
    },
  });

/**
 * sets/gets localStorage. Note that `answerHistory` is a top level key, (to
 * allow future properties to be added) but is not exposed in most places
 */
const lsAnswerHistory = {
  /**
   * @return {AnswerHistory}
   */
  get() {
    const data = storageUtils.get(state.userId);

    return data.answerHistory;
  },

  /**
   * @param {AnswerHistory} answerHistory
   */
  set(answerHistory) {
    storageUtils.set(state.userId, { answerHistory });
  },
};

/**
 * Creates a new record in the database, puts the new ID in the URL/LS
 * and returns the new, empty answer history
 *
 * @return {Promise<AnswerHistory>}
 */
const createNew = async () => {
  return create([]).then(response => {
    if (!response.error) {
      state.userId = response.id;

      // We've got a new ID, put it in the URL
      const url = new URL(document.location);
      url.searchParams.set(USER_ID_STRING, state.userId);
      window.history.replaceState('', null, url.href);

      storageUtils.set(USER_ID_STRING, state.userId);

      // LS must be in sync with the DB, so we set it here.
      lsAnswerHistory.set([]);

      return [];
    }

    throw Error('Something has gone terribly wrong');
  });
};

/**
 * Gets the userId and answerHistory for a user.
 * If none exists, creates a new record
 *
 * @return {Promise<AnswerHistory>}
 */
export const loadAnswerHistory = async () => {
  // Get the ID from the URL
  const url = new URL(document.location);
  state.userId = url.searchParams.get(USER_ID_STRING);

  // Or if none, try local storage
  if (!state.userId) {
    state.userId = storageUtils.get(USER_ID_STRING);

    // So, the ID wasn't in the URL but was in storage. So put it in the URL
    if (state.userId) {
      url.searchParams.set(USER_ID_STRING, state.userId);
      window.history.replaceState('', null, url.href);
    }
  } else {
    // If it was in the URL, put it in storage too
    storageUtils.set(USER_ID_STRING, state.userId);
  }

  if (state.userId) {
    const response = await read(state.userId);

    if (!response.error) {
      // LS must be in sync with the DB, so we set it here.
      lsAnswerHistory.set(response.data);

      return response.data;
    } else {
      console.error('Seems like that was a bad ID.', response.error);

      return await createNew();
    }
  }

  return await createNew();
};

/**
 * Save the answer to the database. If offline, the answer is queued
 *
 * @param {QuestionFeature} questionFeature
 */
export const saveAnswer = questionFeature => {
  const nextAnswer = {
    id: questionFeature.id,
    lastAskDate: questionFeature.properties.lastAskDate,
    lastScore: questionFeature.properties.lastScore,
    nextAskDate: questionFeature.properties.nextAskDate,
  };

  // We can trust that local storage has the most recent data, since
  // all incoming network requests save to LS before returning to the app
  lsAnswerHistory.set(dataUtils.upsert(lsAnswerHistory.get(), nextAnswer));

  if (navigator.onLine) {
    upsert(nextAnswer).then(response => {
      if (response.error) {
        console.error('Could not save:', response.error);
      }
    });
  } else {
    // TODO (davidg): this queue should be in LS for true offline ability
    state.saveQueue.push(nextAnswer);
  }
};

window.addEventListener('online', () => {
  if (state.saveQueue.length) {
    state.saveQueue.forEach(upsertPayload => {
      upsert(upsertPayload).then(response => {
        if (response.error) {
          console.error('Could not save:', response.error);
        }
      });
    });

    state.saveQueue.length = 0;
  }
});
