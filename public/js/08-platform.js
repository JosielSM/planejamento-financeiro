function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandaloneApp() {
  return window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
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
