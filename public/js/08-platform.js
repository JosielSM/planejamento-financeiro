function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandaloneApp() {
  return window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
}

async function registerPwa() {
  if (isNativeRuntime() || !("serviceWorker" in navigator)) return;
  await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
}

window.addEventListener("load", () => registerPwa().catch(() => {}));

const downloadAppButton = document.querySelector("#downloadAppButton");
if (downloadAppButton) {
  if (isNativeRuntime() || isStandaloneApp()) {
    downloadAppButton.hidden = true;
  } else if (isIosDevice()) {
    downloadAppButton.href = "#instalar-no-iphone";
    downloadAppButton.setAttribute("aria-label", "Instalar aplicativo no iPhone");
    downloadAppButton.querySelector("span").textContent = "Instalar no iPhone";
    downloadAppButton.querySelector("[data-lucide]")?.setAttribute("data-lucide", "share-2");
    downloadAppButton.addEventListener("click", async (event) => {
      event.preventDefault();
      await showNotice(
        "No Safari, toque no botão Compartilhar (quadrado com seta para cima), escolha Adicionar à Tela de Início e confirme em Adicionar.",
        "Instalar no iPhone",
        "info",
      );
    });
    refreshIcons();
  }
}
