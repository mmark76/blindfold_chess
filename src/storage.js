export function getStoredValue(key, fallback = null) {
  try {
    return globalThis.localStorage?.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function setStoredValue(key, value) {
  try {
    globalThis.localStorage?.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}

export function getStoredBoolean(key, fallback) {
  const value = getStoredValue(key);
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export function getStoredEnum(key, allowedValues, fallback) {
  const value = getStoredValue(key);
  return allowedValues.includes(value) ? value : fallback;
}

export function getStoredInteger(key, allowedValues, fallback) {
  const value = Number(getStoredValue(key));
  return Number.isInteger(value) && allowedValues.includes(value) ? value : fallback;
}
