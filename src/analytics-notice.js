import { getStoredBoolean, setStoredValue } from "./storage.js";

export const ANALYTICS_NOTICE_DISMISSED_KEY = "blindfold-analytics-notice-dismissed.v1";

export function shouldShowAnalyticsNotice() {
  return !getStoredBoolean(ANALYTICS_NOTICE_DISMISSED_KEY, false);
}

export function dismissAnalyticsNotice() {
  return setStoredValue(ANALYTICS_NOTICE_DISMISSED_KEY, true);
}
