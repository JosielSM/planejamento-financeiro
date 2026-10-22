function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandaloneApp() {
  return window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
}

function isAndroidDevice() {
  return /Android/i.test(navigator.userAgent);
}

function compareVersions(left, right) {
  const leftParts = String(left).split(".").map(Number);
  const rightParts = String(right).split(".").map(Number);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

let androidUpdateCheckInProgress = false;
let lastAndroidUpdateCheck = 0;

async function checkAndroidUpdate({ force = false } = {}) {
  if (!isNativeRuntime() || androidUpdateCheckInProgress || !navigator.onLine) return;
  const now = Date.now();
  if (!force && now - lastAndroidUpdateCheck < 5 * 60 * 1000) return;
  androidUpdateCheckInProgress = true;
  lastAndroidUpdateCheck = now;
  try {
    const response = await fetch(apiUrl("/api/app-version"), {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return;
    const release = await response.json();
    if (compareVersions(release.version, APP_VERSION) <= 0) return;

    const dismissed = loadJSON("planejamento-financeiro-update-dismissed-v1", {});
    if (!force && dismissed.version === release.version && now - Number(dismissed.at || 0) < 6 * 60 * 60 * 1000) return;
    const accepted = await askConfirmation({
      title: `Nova versão ${release.version} disponível`,
      message: `Você está usando a versão ${APP_VERSION}. Atualize o aplicativo para receber as novas funcionalidades e correções. Seus dados permanecerão salvos na sua conta.`,
      confirmLabel: "Atualizar agora",
      tone: "info",
    });
    if (accepted) {
      const downloadUrl = `${apiUrl(release.downloadUrl)}?version=${encodeURIComponent(release.version)}`;
      window.open(downloadUrl, "_system");
    } else {
      localStorage.setItem("planejamento-financeiro-update-dismissed-v1", JSON.stringify({ version: release.version, at: now }));
    }
  } catch {
    setTimeout(() => checkAndroidUpdate({ force: true }), 30000);
  } finally {
    androidUpdateCheckInProgress = false;
  }
}

async function registerPwa() {
  if (isNativeRuntime() || !("serviceWorker" in navigator)) return;
  await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
}

window.addEventListener("load", () => registerPwa().catch(() => {}));
window.addEventListener("appready", () => checkAndroidUpdate());

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) checkAndroidUpdate();
});

const appVersionLabel = document.querySelector("#appVersionLabel");
if (appVersionLabel) appVersionLabel.textContent = `Versão ${APP_VERSION}`;

const downloadAppButton = document.querySelector("#downloadAppButton");
const downloadAppMenu = document.querySelector("#downloadAppMenu");
const downloadAppOptions = document.querySelector("#downloadAppOptions");
const downloadAndroidButton = document.querySelector("#downloadAndroidButton");
const installPwaButton = document.querySelector("#installPwaButton");

if (downloadAppButton && downloadAppMenu && downloadAppOptions && downloadAndroidButton && installPwaButton) {
  if (isNativeRuntime() || isStandaloneApp()) {
    downloadAppMenu.hidden = true;
  } else {
    let deferredInstallPrompt = null;

    const closeDownloadOptions = () => {
      downloadAppOptions.hidden = true;
      downloadAppButton.setAttribute("aria-expanded", "false");
    };

    downloadAppButton.addEventListener("click", () => {
      const willOpen = downloadAppOptions.hidden;
      downloadAppOptions.hidden = !willOpen;
      downloadAppButton.setAttribute("aria-expanded", String(willOpen));
      if (willOpen) downloadAndroidButton.focus();
    });

    document.addEventListener("click", (event) => {
      if (!downloadAppMenu.contains(event.target)) closeDownloadOptions();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !downloadAppOptions.hidden) {
        closeDownloadOptions();
        downloadAppButton.focus();
      }
    });

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
    });

    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      closeDownloadOptions();
      showToast("Aplicativo PWA instalado.", "success");
    });

    installPwaButton.addEventListener("click", async () => {
      closeDownloadOptions();
      if (deferredInstallPrompt) {
        await deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        return;
      }

      if (isIosDevice()) {
        await showNotice(
          "No Safari, toque no botão Compartilhar (quadrado com seta para cima), escolha Adicionar à Tela de Início e confirme em Adicionar.",
          "Instalar PWA no iPhone",
          "info",
        );
        return;
      }

      if (isAndroidDevice()) {
        await showNotice(
          "No Google Chrome, abra o menu de três pontos e escolha Instalar aplicativo ou Adicionar à tela inicial.",
          "Instalar PWA no Android",
          "info",
        );
        return;
      }

      await showNotice(
        "Use o Google Chrome ou Microsoft Edge. No menu do navegador, escolha Instalar Planejamento Financeiro ou Aplicativos > Instalar este site como aplicativo.",
        "Instalar PWA no computador",
        "info",
      );
    });
    refreshIcons();
  }
}
