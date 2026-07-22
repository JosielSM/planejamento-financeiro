async function removeLegacyPwa() {
  if (isNativeRuntime() || !("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("planejamento-financeiro-"))
        .map((key) => caches.delete(key)),
    );
  }
}

window.addEventListener("load", () => {
  removeLegacyPwa().catch(() => {});
});

const downloadAppButton = document.querySelector("#downloadAppButton");
if (downloadAppButton) downloadAppButton.hidden = isNativeRuntime();
