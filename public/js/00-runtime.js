const REMOTE_API_ORIGIN = "https://planejamento-financeiro.santosjosiel2003.workers.dev";
const APP_VERSION = "2.0.1";

function isNativeRuntime() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

function apiUrl(path) {
  return `${isNativeRuntime() ? REMOTE_API_ORIGIN : ""}${path}`;
}
