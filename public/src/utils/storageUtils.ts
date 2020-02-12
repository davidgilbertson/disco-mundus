export const get = (key: string) => {
  const data = localStorage.getItem(key);
  if (!data) return data;

  try {
    return JSON.parse(data);
  } catch (err) {
    // So we return whatever we've got on a failure
    // E.g. the data could be a plain string, which errors on JSON.parse.
    return data;
  }
};

export const set = (key: string, data: any) => {
  try {
    const string = typeof data === 'string' ? data : JSON.stringify(data);

    return localStorage.setItem(key, string);
  } catch (err) {
    return undefined;
  }
};
