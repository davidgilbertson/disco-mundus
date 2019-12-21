export const get = key => {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return undefined;
  }
};

export const set = (key, data) => {
  try {
    return localStorage.setItem(key, JSON.stringify(data));
  } catch {
    return undefined;
  }
};
