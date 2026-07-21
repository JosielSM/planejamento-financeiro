const TRANSACTIONS_KEY = "planejamento-financeiro-v1";
const SETTINGS_KEY = "planejamento-financeiro-settings-v1";
const SAVINGS_GOALS_KEY = "planejamento-financeiro-savings-goals-v1";
const THEME_KEY = "planejamento-financeiro-theme-v1";

function preferredTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

document.documentElement.dataset.theme = preferredTheme();

const categories = {
  income: ["Trabalho", "Freelance", "Venda", "Extra", "Outro ganho"],
  expense: ["Aluguel", "Luz", "Agua", "Wifi", "Comida", "Mercado", "Transporte", "Saude", "Lazer", "Outro gasto"],
};

const frequencyLabels = {
  daily: "Diário",
  monthly: "Mensal fixa",
  occasional: "Eventual",
};

const api = {
  enabled: true,
  async request(path, options = {}) {
    if (!this.enabled) throw new Error("API desativada");
    const idToken = firebaseAuth?.currentUser
      ? await firebaseAuth.currentUser.getIdToken()
      : null;
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      if (response.status === 503) this.enabled = false;
      const data = await response.json().catch(() => ({}));
      const error = new Error(data.error || `Erro ${response.status}`);
      error.status = response.status;
      throw error;
    }

    if (response.status === 204) return null;
    return response.json();
  },
};

const form = document.querySelector("#transactionForm");
const goalForm = document.querySelector("#goalForm");
const goalToggleButton = document.querySelector("#goalToggleButton");
const savingsGoalForm = document.querySelector("#savingsGoalForm");
const savingsGoalModal = document.querySelector("#savingsGoalModal");
const savingsGoalModalTitle = document.querySelector("#savingsGoalModalTitle");
const savingsGoalToggleButton = document.querySelector("#savingsGoalToggleButton");
const savingsGoalSubmitButton = document.querySelector("#savingsGoalSubmitButton");
const savingsGoalCancelButton = document.querySelector("#savingsGoalCancelButton");
const categorySelect = document.querySelector("#category");
const newCategoryButton = document.querySelector("#newCategoryButton");
const manageCategoriesButton = document.querySelector("#manageCategoriesButton");
const categoryManager = document.querySelector("#categoryManager");
const categoryManagerTitle = document.querySelector("#categoryManagerTitle");
const customCategoryName = document.querySelector("#customCategoryName");
const customCategoryList = document.querySelector("#customCategoryList");
const saveCategoryButton = document.querySelector("#saveCategoryButton");
const cancelCategoryEditButton = document.querySelector("#cancelCategoryEditButton");
const closeCategoryManagerButton = document.querySelector("#closeCategoryManagerButton");
const monthFilter = document.querySelector("#monthFilter");
const typeFilter = document.querySelector("#typeFilter");
const frequencyFilter = document.querySelector("#frequencyFilter");
const recordsBody = document.querySelector("#recordsBody");
const emptyState = document.querySelector("#emptyState");
const dailyGoalInput = document.querySelector("#dailyGoal");
const savingsGoalsList = document.querySelector("#savingsGoalsList");
const savingsEmptyState = document.querySelector("#savingsEmptyState");
const completedGoalsSection = document.querySelector("#completedGoalsSection");
const completedGoalsList = document.querySelector("#completedGoalsList");
const completedGoalsCount = document.querySelector("#completedGoalsCount");
const reserveChart = document.querySelector("#reserveChart");
const reserveChartPercent = document.querySelector("#reserveChartPercent");
const reserveChartMessage = document.querySelector("#reserveChartMessage");
const goalsMonthBalance = document.querySelector("#goalsMonthBalance");
const goalsReservedAmount = document.querySelector("#goalsReservedAmount");
const goalsAvailableBalance = document.querySelector("#goalsAvailableBalance");
const overallGoalsPercent = document.querySelector("#overallGoalsPercent");
const overallGoalsProgressBar = document.querySelector("#overallGoalsProgressBar");
const overallGoalsCaption = document.querySelector("#overallGoalsCaption");
const tabTriggers = document.querySelectorAll("[data-tab-target]");
const tabButtons = document.querySelectorAll(".tab-button");
const tabPanels = document.querySelectorAll("[data-tab-panel]");
const transactionModal = document.querySelector("#transactionModal");
const transactionTypeInput = document.querySelector("#transactionType");
const transactionModalTitle = document.querySelector("#transactionModalTitle");
const transactionSubmitButton = document.querySelector("#transactionSubmitButton");
const transactionTypeButtons = document.querySelectorAll("[data-transaction-type]");
const pdfSummaryButton = document.querySelector("#pdfSummaryButton");
const pdfSummaryModal = document.querySelector("#pdfSummaryModal");
const pdfSummaryForm = document.querySelector("#pdfSummaryForm");
const pdfMonthField = document.querySelector("#pdfMonthField");
const pdfMonthInput = document.querySelector("#pdfMonthInput");
const systemDialog = document.querySelector("#systemDialog");
const systemDialogTitle = document.querySelector("#systemDialogTitle");
const systemDialogMessage = document.querySelector("#systemDialogMessage");
const systemDialogConfirmButton = document.querySelector("#systemDialogConfirmButton");
const systemDialogCancelButton = document.querySelector("#systemDialogCancelButton");
const appShell = document.querySelector("#appShell");
const authScreen = document.querySelector("#authScreen");
const authError = document.querySelector("#authError");
const loginForm = document.querySelector("#loginForm");
const signupForm = document.querySelector("#signupForm");
const signupPassword = document.querySelector("#signupPassword");
const signupPasswordConfirmation = document.querySelector("#signupPasswordConfirmation");
const passwordStrengthLabel = document.querySelector("#passwordStrengthLabel");
const passwordStrengthBar = document.querySelector("#passwordStrengthBar");
const passwordMatchStatus = document.querySelector("#passwordMatchStatus");
const passwordRuleItems = document.querySelectorAll("[data-password-rule]");
const passwordVisibilityButtons = document.querySelectorAll("[data-password-toggle]");
const authTitle = document.querySelector("#authTitle");
const showSignupButton = document.querySelector("#showSignupButton");
const showLoginButton = document.querySelector("#showLoginButton");
const showForgotPasswordButton = document.querySelector("#showForgotPasswordButton");
const forgotPasswordForm = document.querySelector("#forgotPasswordForm");
const backToLoginButton = document.querySelector("#backToLoginButton");
const verificationPanel = document.querySelector("#verificationPanel");
const verificationMessage = document.querySelector("#verificationMessage");
const checkVerificationButton = document.querySelector("#checkVerificationButton");
const resendVerificationButton = document.querySelector("#resendVerificationButton");
const verificationLogoutButton = document.querySelector("#verificationLogoutButton");
const profileButton = document.querySelector("#profileButton");
const profileModal = document.querySelector("#profileModal");
const closeProfileButton = document.querySelector("#closeProfileButton");
const accountName = document.querySelector("#accountName");
const accountEmail = document.querySelector("#accountEmail");
const googleLinkStatus = document.querySelector("#googleLinkStatus");
const passwordProviderStatus = document.querySelector("#passwordProviderStatus");
const profilePasswordResetButton = document.querySelector("#profilePasswordResetButton");
const includeSundaysToggle = document.querySelector("#includeSundaysToggle");
const linkGoogleButton = document.querySelector("#linkGoogleButton");
const logoutButton = document.querySelector("#logoutButton");
const googleSignInButtons = document.querySelectorAll("[data-google-signin]");
const themeToggleButton = document.querySelector("#themeToggleButton");
const themeToggleText = document.querySelector("#themeToggleText");
const toastRegion = document.querySelector("#toastRegion");

let transactions = [];
let settings = { dailyGoal: 0, includeSundays: false, ...loadJSON(SETTINGS_KEY, {}) };
let savingsGoals = [];
let customCategories = [];
let editingCategoryId = null;
let systemDialogResolver = null;
let systemDialogLastFocus = null;
let editingSavingsGoalId = null;
let authRequired = false;
let firebaseAuth = null;
let profileLastFocus = null;

function applyTheme(theme, savePreference = false) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  themeToggleButton.setAttribute("aria-pressed", String(isDark));
  themeToggleButton.setAttribute("aria-label", isDark ? "Ativar modo claro" : "Ativar modo escuro");
  themeToggleText.textContent = isDark ? "Modo claro" : "Modo escuro";
  themeToggleButton.querySelector("[data-lucide]")?.setAttribute("data-lucide", isDark ? "sun" : "moon");
  if (savePreference) localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
  refreshIcons();
}

function todayISO() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function money(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function monthName(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function selectedMonthRange() {
  return monthRange(monthFilter.value);
}

function monthRange(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  return {
    start: `${monthValue}-01`,
    end: new Date(year, month, 0).toISOString().slice(0, 10),
  };
}

function isInSelectedMonth(item) {
  return isInMonth(item, monthFilter.value);
}

function isInMonth(item, monthValue) {
  const range = monthRange(monthValue);
  if (item.frequency === "monthly") {
    return item.date <= range.end;
  }
  return item.date.startsWith(monthValue);
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseAmount(value) {
  return Number(String(value).replace(",", ".")) || 0;
}

function loadJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function syncModalOpenState() {
  document.body.classList.toggle(
    "modal-open",
    !transactionModal.hidden || !pdfSummaryModal.hidden || !savingsGoalModal.hidden || !profileModal.hidden || !systemDialog.hidden,
  );
}

function showToast(message, tone = "success", duration = 3200) {
  const icons = { success: "circle-check", error: "circle-alert", warning: "triangle-alert", info: "info" };
  const toast = document.createElement("div");
  toast.className = `app-toast ${tone}`;
  toast.setAttribute("role", tone === "error" ? "alert" : "status");
  toast.innerHTML = `
    <i data-lucide="${icons[tone] || icons.info}" aria-hidden="true"></i>
    <span>${escapeHTML(message)}</span>
    <button type="button" aria-label="Fechar aviso"><i data-lucide="x" aria-hidden="true"></i></button>
  `;

  const dismiss = () => {
    if (toast.classList.contains("leaving")) return;
    toast.classList.add("leaving");
    setTimeout(() => toast.remove(), 180);
  };

  toast.querySelector("button").addEventListener("click", dismiss);
  toastRegion.append(toast);
  while (toastRegion.children.length > 3) toastRegion.firstElementChild.remove();
  refreshIcons();
  setTimeout(dismiss, duration);
}

function openProfileModal() {
  profileLastFocus = document.activeElement;
  profileModal.hidden = false;
  syncModalOpenState();
  refreshIcons();
  setTimeout(() => closeProfileButton.focus(), 40);
}

function closeProfileModal() {
  if (profileModal.hidden) return;
  profileModal.hidden = true;
  syncModalOpenState();
  profileLastFocus?.focus?.();
  profileLastFocus = null;
}

function closeSystemDialog(result = false) {
  if (systemDialog.hidden) return;
  systemDialog.hidden = true;
  syncModalOpenState();
  const resolve = systemDialogResolver;
  systemDialogResolver = null;
  resolve?.(result);
  systemDialogLastFocus?.focus?.();
  systemDialogLastFocus = null;
}

function showSystemDialog({
  title,
  message,
  confirmLabel = "Entendi",
  cancelLabel = "",
  tone = "info",
}) {
  if (systemDialogResolver) closeSystemDialog(false);
  systemDialogLastFocus = document.activeElement;
  systemDialogTitle.textContent = title;
  systemDialogMessage.textContent = message;
  systemDialogConfirmButton.textContent = confirmLabel;
  systemDialogCancelButton.textContent = cancelLabel || "Cancelar";
  systemDialogCancelButton.hidden = !cancelLabel;
  systemDialog.className = `system-dialog ${tone}`;
  systemDialog.hidden = false;
  document.body.classList.add("modal-open");
  refreshIcons();
  setTimeout(() => (cancelLabel ? systemDialogCancelButton : systemDialogConfirmButton).focus(), 40);
  return new Promise((resolve) => {
    systemDialogResolver = resolve;
  });
}

function showNotice(message, title = "Aviso", tone = "info") {
  return showSystemDialog({ title, message, confirmLabel: "Entendi", tone });
}

function askConfirmation({ title, message, confirmLabel = "Confirmar", tone = "danger" }) {
  return showSystemDialog({ title, message, confirmLabel, cancelLabel: "Cancelar", tone });
}

function showAuth(message = "") {
  authRequired = true;
  appShell.hidden = true;
  authScreen.hidden = false;
  profileButton.hidden = true;
  closeProfileModal();
  setAuthMode("login");
  authError.textContent = message;
}

function showVerification(user, message = "") {
  appShell.hidden = true;
  authScreen.hidden = false;
  profileButton.hidden = true;
  closeProfileModal();
  loginForm.classList.remove("active");
  signupForm.classList.remove("active");
  forgotPasswordForm.classList.remove("active");
  verificationPanel.hidden = false;
  verificationPanel.classList.add("active");
  authTitle.textContent = "Verifique seu email";
  verificationMessage.textContent = message || `Enviamos um link de confirmacao para ${user.email}.`;
  authError.textContent = "";
}

function hasGoogleProvider(firebaseUser) {
  return firebaseUser?.providerData?.some((provider) => provider.providerId === "google.com");
}

function hasPasswordProvider(firebaseUser) {
  return firebaseUser?.providerData?.some((provider) => provider.providerId === "password");
}

function passwordRuleStatus(password) {
  return {
    length: password.length >= 10,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9\s]/.test(password),
  };
}

function isStrongPassword(password) {
  return Object.values(passwordRuleStatus(password)).every(Boolean);
}

function updatePasswordGuidance() {
  const password = signupPassword.value;
  const confirmation = signupPasswordConfirmation.value;
  const rules = passwordRuleStatus(password);
  const score = Object.values(rules).filter(Boolean).length;
  const strengthLabels = ["Muito fraca", "Muito fraca", "Fraca", "Razoável", "Boa", "Forte"];

  passwordRuleItems.forEach((item) => {
    const met = rules[item.dataset.passwordRule];
    item.classList.toggle("met", Boolean(met));
  });
  passwordStrengthLabel.textContent = strengthLabels[score];
  passwordStrengthLabel.className = `strength-${score}`;
  passwordStrengthBar.style.width = `${(score / 5) * 100}%`;
  passwordStrengthBar.className = `strength-${score}`;

  if (!confirmation) {
    passwordMatchStatus.textContent = "Digite novamente a mesma senha.";
    passwordMatchStatus.className = "password-match-status";
  } else if (password === confirmation) {
    passwordMatchStatus.textContent = "As senhas são iguais.";
    passwordMatchStatus.className = "password-match-status matched";
  } else {
    passwordMatchStatus.textContent = "As senhas ainda não são iguais.";
    passwordMatchStatus.className = "password-match-status mismatch";
  }
}

function showApp(user = null) {
  appShell.hidden = false;
  authScreen.hidden = true;
  profileButton.hidden = !user;
  accountName.textContent = user ? user.name : "";
  accountEmail.textContent = user?.email || firebaseAuth?.currentUser?.email || "";
  const googleLinked = hasGoogleProvider(firebaseAuth?.currentUser);
  const passwordLinked = hasPasswordProvider(firebaseAuth?.currentUser);
  googleLinkStatus.textContent = googleLinked ? "Vinculada" : "Não vinculada";
  googleLinkStatus.classList.toggle("linked", googleLinked);
  linkGoogleButton.hidden = !user || googleLinked;
  passwordProviderStatus.textContent = passwordLinked
    ? "Receba um link seguro no seu e-mail para definir uma nova senha."
    : "Sua senha é administrada pela Conta Google.";
  profilePasswordResetButton.hidden = !user || !passwordLinked;
  authError.textContent = "";
}

function firebaseErrorMessage(error) {
  const messages = {
    "auth/email-already-in-use": "Este email ja esta cadastrado.",
    "auth/invalid-credential": "Email ou senha invalidos.",
    "auth/invalid-email": "Informe um email valido.",
    "auth/missing-password": "Informe sua senha.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    "auth/weak-password": "A senha não atende à política de segurança. Complete todos os requisitos indicados.",
    "auth/network-request-failed": "Nao foi possivel conectar ao servico de autenticacao.",
    "auth/operation-not-allowed": "O login por email e senha ainda nao foi ativado no Firebase.",
    "auth/popup-closed-by-user": "A janela do Google foi fechada antes da conclusao.",
    "auth/popup-blocked": "O navegador bloqueou a janela do Google. Libere pop-ups e tente novamente.",
    "auth/cancelled-popup-request": "A tentativa anterior foi cancelada. Tente novamente.",
    "auth/account-exists-with-different-credential": "Este email ja usa outro modo de acesso. Entre com sua senha primeiro para preservar a mesma conta.",
    "auth/unauthorized-domain": "Este endereco ainda nao esta autorizado no Firebase.",
    "auth/web-storage-unsupported": "O navegador esta bloqueando o armazenamento necessario para o login.",
    "auth/internal-error": "O Firebase encontrou um erro interno ao concluir o login.",
  };
  return messages[error?.code]
    || `Nao foi possivel concluir a autenticacao. Codigo: ${error?.code || "desconhecido"}.`;
}

function setAuthMode(mode) {
  const isSignup = mode === "signup";
  const isForgotPassword = mode === "forgot";
  loginForm.classList.toggle("active", mode === "login");
  signupForm.classList.toggle("active", isSignup);
  forgotPasswordForm.classList.toggle("active", isForgotPassword);
  verificationPanel.classList.remove("active");
  verificationPanel.hidden = true;
  authTitle.textContent = isSignup
    ? "Criar cadastro"
    : isForgotPassword
      ? "Recuperar senha"
      : "Entrar na conta";
  authError.textContent = "";

  setTimeout(() => {
    document.querySelector(
      isSignup ? "#signupName" : isForgotPassword ? "#forgotPasswordEmail" : "#loginEmail",
    ).focus();
  }, 80);
}

async function initializeFirebase() {
  if (!window.firebase?.initializeApp) throw new Error("Biblioteca do Firebase nao carregada");
  const response = await fetch("/api/config/firebase", { headers: { Accept: "application/json" } });
  const config = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(config.error || "Firebase nao configurado");
  if (!window.firebase.apps.length) window.firebase.initializeApp(config);
  firebaseAuth = window.firebase.auth();
  firebaseAuth.languageCode = "pt-BR";
  return firebaseAuth;
}

async function loadAuthenticatedUser(firebaseUser) {
  if (!firebaseUser) {
    showAuth("Entre ou crie um cadastro para acessar seus dados.");
    return false;
  }
  await firebaseUser.reload();
  if (!firebaseUser.emailVerified) {
    showVerification(firebaseUser);
    return false;
  }

  await firebaseUser.getIdToken(true);
  const data = await api.request("/api/auth/me");
  showApp(data.user);
  await loadFromApi();
  render();
  refreshIcons();
  return true;
}
