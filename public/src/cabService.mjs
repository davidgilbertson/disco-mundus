// const API_URL = 'http://localhost:5001/velantrix/us-central1/api';
const API_URL = 'https://us-central1-velantrix.cloudfunctions.net/api';

const fetchJson = (url, opts = {}) =>
  fetch(url, {
    method: opts.method,
    headers: { 'Content-Type': 'application/json' },
    body: opts.body && JSON.stringify(opts.body),
  }).then(res => res.json());

/**
 * @param {object} body
 * @return {Promise<{[error]: string, [id]: string}>}
 */
const create = body =>
  fetchJson(API_URL, {
    method: 'POST',
    body,
  });

/**
 * @param {string} id
 * @return {Promise<{[error]: string, [data]: object}>}
 */
const read = id => fetchJson(`${API_URL}/${id}`);

/**
 * @param {string} id
 * @param {object} body
 * @return {Promise<{[error]: string, [success]: string}>}
 */
const update = (id, body) =>
  fetchJson(`${API_URL}/${id}`, {
    method: 'PUT',
    body,
  });

/**
 * Gets the userId and answerHistory for a user.
 * If none exists, creates a new record
 * @returns {Promise<{userId: string, answerHistory: Array<AnswerHistoryItem>}>}
 */
export const loadAnswerHistory = async () => {
  // Changing this string would break progress for all users. So don't do that.
  const PROGRESS_ID_STRING = 'your-progress-id';

  // Get the ID from the URL
  const url = new URL(document.location);
  let userId = url.searchParams.get(PROGRESS_ID_STRING);

  // Or if none, try local storage
  if (!userId) {
    userId = localStorage.getItem(PROGRESS_ID_STRING);

    // So, the ID wasn't in the URL but was in storage. So put it in the URL
    if (userId) {
      url.searchParams.set(PROGRESS_ID_STRING, userId);
      window.history.replaceState('', null, url.href);
    }
  } else {
    // If it was in the URL, put it in storage too
    // We want this in LS because the 'installed' version of the site
    // won't have the URL param
    localStorage.setItem(PROGRESS_ID_STRING, userId);
  }

  if (userId) {
    const response = await read(userId);

    if (!response.error) {
      return {
        answerHistory: response.data.answerHistory,
        userId,
      };
    }

    console.error('Seems like that was a bad ID.', response.error);
  }

  // There was no ID, or a bad ID, so create a new session
  const response = await create({ answerHistory: [] });

  if (!response.error) {
    // We've got a new ID, put it in the URL
    url.searchParams.set(PROGRESS_ID_STRING, response.id);
    window.history.replaceState('', null, url.href);

    // And LS too, for good measure
    localStorage.setItem(PROGRESS_ID_STRING, response.id);

    return {
      answerHistory: [],
      userId: response.id,
    };
  }

  console.error('Could not create a new session.', response.error);

  throw Error('Something has gone terribly wrong');
};

/**
 *
 * @param {string} userId
 * @param {Array<QuestionFeature>} questionFeatures
 */
export const saveAnswerHistory = (userId, questionFeatures) => {
  /** @type {Array<AnswerHistoryItem>} */
  const answerHistory = questionFeatures
    .filter(questionFeature => questionFeature.properties.nextAskDate)
    .map(questionFeature => ({
      id: questionFeature.id,
      lastAskDate: questionFeature.properties.lastAskDate,
      lastScore: questionFeature.properties.lastScore,
      nextAskDate: questionFeature.properties.nextAskDate,
    }));

  update(userId, { answerHistory }).then(response => {
    if (response.error) {
      console.error('Could not save progress:', response.error);
    }
  });
};
