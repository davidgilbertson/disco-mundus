import * as dataUtils from './utils/dataUtils';
import * as storageUtils from './utils/storageUtils';

// const API_URL = 'http://localhost:5001/velantrix/us-central1/api';
const API_URL = 'https://us-central1-velantrix.cloudfunctions.net/api';

// Changing this string would break progress for all users. So don't do that.
const USER_ID_STRING = 'your-progress-id';

type CabServiceState = {
  userId: string;
  saveQueue: AnswerHistoryItem[];
};

const state: CabServiceState = {
  userId: '',
  saveQueue: [],
};

type FetchOptions = {
  method?: 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: object;
};

type ErrorResponse = {
  error?: string;
};

type CreateResponse = ErrorResponse & {
  id: string;
};

type ReadResponse = ErrorResponse & {
  data: AnswerHistory;
};

type UpsertResponse = ErrorResponse & {
  success: string;
};

const fetchJson = (url: string, opts: FetchOptions = {}) =>
  fetch(url, {
    method: opts.method,
    headers: { 'Content-Type': 'application/json' },
    body: opts.body && JSON.stringify(opts.body),
  }).then((res) => res.json());

const create = (answerHistory: AnswerHistory): Promise<CreateResponse> =>
  fetchJson(API_URL, {
    method: 'POST',
    body: { answerHistory },
  });

const read = (id: string): Promise<ReadResponse> =>
  fetchJson(`${API_URL}/${id}`).then((response) =>
    response.error ? response : { data: response.data.answerHistory }
  );

const upsert = (
  answerHistoryItem: AnswerHistoryItem
): Promise<UpsertResponse> =>
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
  get(): AnswerHistory {
    const data = storageUtils.get(state.userId);

    return data.answerHistory;
  },
  set(answerHistory: AnswerHistory) {
    storageUtils.set(state.userId, { answerHistory });
  },
};

/**
 * Creates a new record in the database, puts the new ID in the URL/LS
 * and returns the new, empty answer history
 */
const createNew = async (): Promise<AnswerHistory> =>
  create([]).then((response) => {
    if (response.error) throw Error('Something has gone terribly wrong');

    state.userId = response.id;

    // We've got a new ID, put it in the URL
    const url = new URL(document.location.href);
    url.searchParams.set(USER_ID_STRING, state.userId);
    window.history.replaceState('', '', url.href);

    storageUtils.set(USER_ID_STRING, state.userId);

    // LS must be in sync with the DB, so we set it here.
    lsAnswerHistory.set([]);

    return [];
  });

/**
 * Gets the userId and answerHistory for a user.
 * If none exists, creates a new record
 */
export const loadAnswerHistory = async (): Promise<AnswerHistory> => {
  // Get the ID from the URL
  const url = new URL(document.location.href);
  state.userId = url.searchParams.get(USER_ID_STRING) || '';

  // Or if none, try local storage
  if (!state.userId) {
    state.userId = storageUtils.get(USER_ID_STRING);

    // So, the ID wasn't in the URL but was in storage. So put it in the URL
    if (state.userId) {
      url.searchParams.set(USER_ID_STRING, state.userId);
      window.history.replaceState('', '', url.href);
    }
  } else {
    // If it was in the URL, put it in storage too
    storageUtils.set(USER_ID_STRING, state.userId);
  }

  if (state.userId) {
    const response = await read(state.userId);

    if (response.error) {
      console.error('Seems like that was a bad ID.', response.error);

      return createNew();
    }

    // LS must be in sync with the DB, so we set it here.
    lsAnswerHistory.set(response.data);

    return response.data;
  }

  return createNew();
};

/**
 * Save the answer to the database. If offline, the answer is queued
 */
export const saveAnswer = (questionFeature: QuestionFeature) => {
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
    upsert(nextAnswer).then((response) => {
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
    state.saveQueue.forEach((upsertPayload) => {
      upsert(upsertPayload).then((response) => {
        if (response.error) {
          console.error('Could not save:', response.error);
        }
      });
    });

    state.saveQueue.length = 0;
  }
});
