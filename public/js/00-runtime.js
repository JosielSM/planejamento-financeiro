const REMOTE_API_ORIGIN = "https://planejamento-financeiro-0b29.onrender.com";

function isNativeRuntime() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

function apiUrl(path) {
  return `${isNativeRuntime() ? REMOTE_API_ORIGIN : ""}${path}`;
}
