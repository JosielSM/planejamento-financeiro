const installAppButton = document.querySelector("#installAppButton");
let deferredInstallPrompt = null;

function isAppInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function updateInstallButton() {
  installAppButton.hidden = isAppInstalled();
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallButton();
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installAppButton.hidden = true;
  showToast("Aplicativo instalado com sucesso.");
});

installAppButton.addEventListener("click", async () => {
  if (isAppInstalled()) {
    installAppButton.hidden = true;
    return;
  }

  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    showToast(
      outcome === "accepted" ? "Instalacao do aplicativo iniciada." : "Instalacao cancelada.",
      outcome === "accepted" ? "success" : "info",
    );
    return;
  }

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  await showSystemDialog({
    title: isIOS ? "Instalar no iPhone ou iPad" : "Instalar aplicativo",
    message: isIOS
      ? "No navegador, toque em Compartilhar e depois em Adicionar a Tela de Inicio. Confirme em Adicionar para instalar."
      : "Abra o menu do navegador e escolha Instalar aplicativo ou Adicionar a tela inicial.",
    confirmLabel: "Entendi",
    showCancel: false,
    tone: "info",
  });
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            showToast("Uma nova versao do aplicativo esta disponivel. Reabra para atualizar.", "info", 5000);
          }
        });
      });
    } catch {
      showToast("O modo aplicativo nao pode ser preparado neste navegador.", "warning", 5000);
    }
  });
}

updateInstallButton();
