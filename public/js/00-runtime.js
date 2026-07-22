const REMOTE_API_ORIGIN = "https://planejamento-financeiro-0b29.onrender.com";
const APP_VERSION = "1.3.0";

function isNativeRuntime() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

function apiUrl(path) {
  return `${isNativeRuntime() ? REMOTE_API_ORIGIN : ""}${path}`;
}
