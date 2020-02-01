export const get = key => {
  const data = localStorage.getItem(key);

  try {
    return JSON.parse(data);
  } catch (err) {
    // So we return whatever we've got on a failure
    // E.g. the data could be a plain string, which errors on JSON.parse.
    return data;
  }
};

export const set = (key, data) => {
  try {
    const string = typeof data === 'string' ? data : JSON.stringify(data);

    return localStorage.setItem(key, string);
  } catch (err) {
    return undefined;
  }
};
