const TRANSACTIONS_KEY = "planejamento-financeiro-v1";
const SETTINGS_KEY = "planejamento-financeiro-settings-v1";
const SAVINGS_GOALS_KEY = "planejamento-financeiro-savings-goals-v1";

const categories = {
  income: ["Trabalho", "Freelance", "Venda", "Extra", "Outro ganho"],
  expense: ["Aluguel", "Luz", "Agua", "Wifi", "Comida", "Mercado", "Transporte", "Saude", "Lazer", "Outro gasto"],
};

const frequencyLabels = {
  daily: "Do dia",
  monthly: "Mensal fixa",
  occasional: "Eventual",
};

const api = {
  enabled: true,
  async request(path, options = {}) {
    if (!this.enabled) throw new Error("API desativada");
    const response = await fetch(path, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });

    if (!response.ok) {
      if (response.status === 503) this.enabled = false;
      const error = new Error(`Erro ${response.status}`);
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
const savingsGoalToggleButton = document.querySelector("#savingsGoalToggleButton");
const savingsGoalSubmitButton = document.querySelector("#savingsGoalSubmitButton");
const savingsGoalCancelButton = document.querySelector("#savingsGoalCancelButton");
const categorySelect = document.querySelector("#category");
const monthFilter = document.querySelector("#monthFilter");
const typeFilter = document.querySelector("#typeFilter");
const frequencyFilter = document.querySelector("#frequencyFilter");
const recordsBody = document.querySelector("#recordsBody");
const emptyState = document.querySelector("#emptyState");
const dailyGoalInput = document.querySelector("#dailyGoal");
const savingsGoalsList = document.querySelector("#savingsGoalsList");
const savingsEmptyState = document.querySelector("#savingsEmptyState");
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
const appShell = document.querySelector("#appShell");
const authScreen = document.querySelector("#authScreen");
const authError = document.querySelector("#authError");
const loginForm = document.querySelector("#loginForm");
const signupForm = document.querySelector("#signupForm");
const authTitle = document.querySelector("#authTitle");
const showSignupButton = document.querySelector("#showSignupButton");
const showLoginButton = document.querySelector("#showLoginButton");
const accountBox = document.querySelector("#accountBox");
const accountName = document.querySelector("#accountName");
const logoutButton = document.querySelector("#logoutButton");

let transactions = [];
let settings = loadSettings();
let savingsGoals = [];
let editingSavingsGoalId = null;
let authRequired = false;

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

function showAuth(message = "") {
  authRequired = true;
  appShell.hidden = true;
  authScreen.hidden = false;
  accountBox.hidden = true;
  authError.textContent = message;
  setAuthMode("login");
}

function showApp(user = null) {
  appShell.hidden = false;
  authScreen.hidden = true;
  accountBox.hidden = !user;
  accountName.textContent = user ? user.name : "";
  authError.textContent = "";
}

async function submitAuth(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Nao foi possivel autenticar");
  }
  return data;
}

function setAuthMode(mode) {
  const isSignup = mode === "signup";
  loginForm.classList.toggle("active", !isSignup);
  signupForm.classList.toggle("active", isSignup);
  authTitle.textContent = isSignup ? "Criar cadastro" : "Entrar na conta";
  authError.textContent = "";

  setTimeout(() => {
    document.querySelector(isSignup ? "#signupName" : "#loginEmail").focus();
  }, 80);
}

function loadTransactions() {
  return loadJSON(TRANSACTIONS_KEY, []);
}

function saveTransactions() {
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
}

function loadSettings() {
  return loadJSON(SETTINGS_KEY, { dailyGoal: 0 });
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function loadSavingsGoals() {
  return loadJSON(SAVINGS_GOALS_KEY, []);
}

function saveSavingsGoals() {
  localStorage.setItem(SAVINGS_GOALS_KEY, JSON.stringify(savingsGoals));
}

function normalizeSavingsGoal(goal) {
  return {
    id: goal.id,
    name: goal.name,
    targetAmount: Number(goal.targetAmount),
    savedAmount: Number(goal.savedAmount || 0),
    note: goal.note || "",
    deposits: (goal.deposits || []).map((deposit) => ({
      id: deposit.id,
      amount: Number(deposit.amount),
      date: String(deposit.date).slice(0, 10),
    })),
  };
}

async function loadFromApi() {
  try {
    const [remoteTransactions, remoteSettings, remoteSavingsGoals] = await Promise.all([
      api.request("/api/transactions"),
      api.request("/api/settings"),
      api.request("/api/savings-goals"),
    ]);
    transactions = remoteTransactions;
    settings = {
      ...settings,
      dailyGoal: parseAmount(remoteSettings.dailyGoal || 0),
    };
    savingsGoals = remoteSavingsGoals.map(normalizeSavingsGoal);
    saveTransactions();
    saveSettings();
    saveSavingsGoals();
  } catch (error) {
    if (error.status === 401) {
      showAuth("Entre ou crie um cadastro para acessar seus dados.");
      return false;
    }
    transactions = loadTransactions();
    savingsGoals = loadSavingsGoals().map(normalizeSavingsGoal);
  }
  return true;
}

async function saveSetting(key, value) {
  settings[key] = value;
  saveSettings();
  try {
    await api.request(`/api/settings/${key}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    });
  } catch {
    api.enabled = false;
  }
}

async function createTransaction(transaction) {
  transactions.push(transaction);
  saveTransactions();
  render();

  try {
    const saved = await api.request("/api/transactions", {
      method: "POST",
      body: JSON.stringify(transaction),
    });
    transactions = transactions.map((item) => (item.id === transaction.id ? saved : item));
    saveTransactions();
    render();
  } catch {
    api.enabled = false;
  }
}

async function deleteTransaction(id) {
  transactions = transactions.filter((item) => item.id !== id);
  saveTransactions();
  render();

  try {
    await api.request(`/api/transactions/${id}`, { method: "DELETE" });
  } catch {
    api.enabled = false;
  }
}

async function createSavingsGoal(goal) {
  savingsGoals.unshift(goal);
  saveSavingsGoals();
  render();

  try {
    const saved = await api.request("/api/savings-goals", {
      method: "POST",
      body: JSON.stringify(goal),
    });
    savingsGoals = savingsGoals.map((item) => (item.id === goal.id ? normalizeSavingsGoal(saved) : item));
    saveSavingsGoals();
    render();
  } catch {
    api.enabled = false;
  }
}

async function updateSavingsGoal(id, updates) {
  savingsGoals = savingsGoals.map((goal) => (goal.id === id ? normalizeSavingsGoal({ ...goal, ...updates }) : goal));
  saveSavingsGoals();
  render();

  try {
    const saved = await api.request(`/api/savings-goals/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    savingsGoals = savingsGoals.map((goal) => (goal.id === id ? normalizeSavingsGoal(saved) : goal));
    saveSavingsGoals();
    render();
  } catch {
    api.enabled = false;
  }
}

async function addSavingsDeposit(goalId, amount) {
  const deposit = { id: crypto.randomUUID(), amount, date: todayISO() };
  savingsGoals = savingsGoals.map((goal) => {
    if (goal.id !== goalId) return goal;
    return {
      ...goal,
      savedAmount: Number(goal.savedAmount || 0) + amount,
      deposits: [deposit, ...(goal.deposits || [])],
    };
  });
  saveSavingsGoals();
  render();

  try {
    const saved = await api.request(`/api/savings-goals/${goalId}/deposits`, {
      method: "POST",
      body: JSON.stringify(deposit),
    });
    savingsGoals = savingsGoals.map((goal) => (goal.id === goalId ? normalizeSavingsGoal(saved) : goal));
    saveSavingsGoals();
    render();
  } catch {
    api.enabled = false;
  }
}

async function deleteSavingsGoal(id) {
  savingsGoals = savingsGoals.filter((goal) => goal.id !== id);
  saveSavingsGoals();
  render();

  try {
    await api.request(`/api/savings-goals/${id}`, { method: "DELETE" });
  } catch {
    api.enabled = false;
  }
}

function updateCategoryOptions() {
  const type = new FormData(form).get("type");
  categorySelect.innerHTML = "";
  categories[type].forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categorySelect.append(option);
  });
}

function getVisibleTransactions() {
  return transactions
    .filter(isInSelectedMonth)
    .filter((item) => typeFilter.value === "all" || item.type === typeFilter.value)
    .filter((item) => frequencyFilter.value === "all" || item.frequency === frequencyFilter.value)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function getMonthTransactions() {
  return transactions.filter(isInSelectedMonth);
}

function getTodayIncome() {
  const today = todayISO();
  return transactions
    .filter((item) => item.type === "income" && item.date === today)
    .reduce((sum, item) => sum + item.amount, 0);
}

function renderSummary() {
  const monthItems = getMonthTransactions();
  const income = monthItems.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expense = monthItems.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const balance = income - expense;
  const currentMonth = monthISO();
  const dayCount = monthFilter.value === currentMonth
    ? new Date().getDate()
    : new Date(Number(monthFilter.value.slice(0, 4)), Number(monthFilter.value.slice(5, 7)), 0).getDate();

  document.querySelector("#totalIncome").textContent = money(income);
  document.querySelector("#totalExpense").textContent = money(expense);
  document.querySelector("#balance").textContent = money(balance);
  document.querySelector("#dailyAverage").textContent = money(balance / Math.max(dayCount, 1));
  document.querySelector("#incomeDailyAverage").textContent = money(income / Math.max(dayCount, 1));
  renderIncomeExpenseChart(income, expense);
}

function renderIncomeExpenseChart(income, expense) {
  const total = income + expense;
  const incomePercent = total > 0 ? (income / total) * 100 : 0;
  const chart = document.querySelector("#incomeExpenseChart");

  chart.style.background = total > 0
    ? `conic-gradient(var(--green) 0 ${incomePercent}%, var(--red) ${incomePercent}% 100%)`
    : "#e8ece6";
  chart.setAttribute("aria-label", `Ganhos ${money(income)} e despesas ${money(expense)}`);
  document.querySelector("#chartIncomeValue").textContent = money(income);
  document.querySelector("#chartExpenseValue").textContent = money(expense);
  document.querySelector("#registerIncomeValue").textContent = money(income);
  document.querySelector("#registerExpenseValue").textContent = money(expense);
}

function renderGoal() {
  const goal = Number(settings.dailyGoal) || 0;
  const todayIncome = getTodayIncome();
  const percent = goal > 0 ? Math.min((todayIncome / goal) * 100, 100) : 0;
  const remaining = Math.max(goal - todayIncome, 0);

  dailyGoalInput.value = goal > 0 ? goal : "";
  document.querySelector("#todayIncome").textContent = `Hoje: ${money(todayIncome)}`;
  document.querySelector("#goalPercent").textContent = `${Math.round(percent)}%`;
  document.querySelector("#goalProgressBar").style.width = `${percent}%`;
  document.querySelector("#goalStatus").textContent = goal > 0
    ? remaining > 0
      ? `Faltam ${money(remaining)} para bater a meta de hoje.`
      : "Meta de hoje batida."
    : "Defina quanto voce quer ganhar por dia.";
}

function setGoalFormOpen(isOpen) {
  goalForm.hidden = !isOpen;
  goalToggleButton.querySelector("span").textContent = isOpen ? "Cancelar" : "Editar meta";
  goalToggleButton.setAttribute("aria-expanded", String(isOpen));

  if (isOpen) {
    setTimeout(() => dailyGoalInput.focus(), 80);
  }
}

function renderSavingsGoals() {
  savingsGoalsList.innerHTML = "";
  savingsEmptyState.style.display = savingsGoals.length ? "none" : "block";

  savingsGoals.forEach((goal) => {
    const savedAmount = Number(goal.savedAmount || 0);
    const targetAmount = Number(goal.targetAmount || 0);
    const remaining = Math.max(targetAmount - savedAmount, 0);
    const percent = targetAmount > 0 ? Math.min((savedAmount / targetAmount) * 100, 100) : 0;
    const status = remaining > 0 ? `Faltam ${money(remaining)}` : "Meta concluida";
    const card = document.createElement("article");
    card.className = "savings-card";
    card.innerHTML = `
      <header>
        <div>
          <h3>${escapeHTML(goal.name)}</h3>
          ${goal.note ? `<p class="muted">${escapeHTML(goal.note)}</p>` : ""}
        </div>
        <div class="goal-card-actions">
          <button class="secondary-button icon-text-button" type="button" data-goal-edit="${goal.id}" title="Editar meta" aria-label="Editar meta">
            <i data-lucide="pencil" aria-hidden="true"></i>
            <span>Editar</span>
          </button>
          <button class="delete-button" type="button" data-goal-delete="${goal.id}" title="Excluir meta" aria-label="Excluir meta">x</button>
        </div>
      </header>
      <div class="savings-values">
        <div><span>Guardado</span><strong>${money(savedAmount)}</strong></div>
        <div><span>Valor total</span><strong>${money(targetAmount)}</strong></div>
        <div><span>Status</span><strong>${Math.round(percent)}%</strong></div>
      </div>
      <div class="progress-track" aria-label="Progresso da meta ${escapeHTML(goal.name)}">
        <span style="width: ${percent}%"></span>
      </div>
      <footer>
        <span class="muted">${status}</span>
      </footer>
      <form class="deposit-form" data-goal-deposit="${goal.id}">
        <label>
          Depositar
          <input type="number" min="0.01" step="0.01" placeholder="0,00" required />
        </label>
        <button class="secondary-button" type="submit">Adicionar</button>
      </form>
    `;
    savingsGoalsList.append(card);
  });
}

function renderBreakdown() {
  const expenses = getMonthTransactions().filter((item) => item.type === "expense");
  const total = expenses.reduce((sum, item) => sum + item.amount, 0);
  const grouped = expenses.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.amount;
    return acc;
  }, {});

  const rows = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  const target = document.querySelector("#categoryBreakdown");
  target.innerHTML = "";

  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.style.display = "block";
    empty.textContent = "Cadastre despesas para ver o resumo.";
    target.append(empty);
    return;
  }

  rows.forEach(([category, value]) => {
    const percent = total > 0 ? (value / total) * 100 : 0;
    const row = document.createElement("div");
    row.className = "category-row";
    row.innerHTML = `
      <header>
        <strong>${escapeHTML(category)}</strong>
        <span>${money(value)} (${percent.toFixed(0)}%)</span>
      </header>
      <div class="bar"><span style="width: ${percent}%"></span></div>
    `;
    target.append(row);
  });
}

function renderRecords() {
  const rows = getVisibleTransactions();
  recordsBody.innerHTML = "";
  emptyState.style.display = rows.length ? "none" : "block";

  rows.forEach((item) => {
    const tr = document.createElement("tr");
    const dateLabel = item.frequency === "monthly"
      ? `Desde ${item.date.split("-").reverse().join("/")}`
      : item.date.split("-").reverse().join("/");
    tr.innerHTML = `
      <td data-label="Data">${dateLabel}</td>
      <td data-label="Descricao">
        <strong>${escapeHTML(item.description)}</strong>
        ${item.note ? `<div class="muted">${escapeHTML(item.note)}</div>` : ""}
      </td>
      <td data-label="Categoria">${escapeHTML(item.category)}</td>
      <td data-label="Frequencia"><span class="pill">${frequencyLabels[item.frequency]}</span></td>
      <td data-label="Valor" class="value ${item.type === "income" ? "positive" : "negative"}">${item.type === "income" ? "+" : "-"} ${money(item.amount)}</td>
      <td data-label="Acao"><button class="delete-button" type="button" data-id="${item.id}" title="Excluir" aria-label="Excluir">x</button></td>
    `;
    recordsBody.append(tr);
  });
}

function render() {
  renderSummary();
  renderGoal();
  renderSavingsGoals();
  renderBreakdown();
  renderRecords();
  refreshIcons();
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function setActiveTab(tabName) {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tabTarget === tabName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.tabPanel === tabName);
  });

  if (tabName === "novo") {
    setTimeout(() => document.querySelector("[data-transaction-type='income']").focus(), 80);
  }
}

function setTransactionType(type) {
  transactionTypeInput.value = type;
  const isIncome = type === "income";
  transactionModalTitle.textContent = isIncome ? "Registrar ganho" : "Registrar despesa";
  transactionSubmitButton.textContent = isIncome ? "Adicionar ganho" : "Adicionar despesa";
  document.querySelector("#description").placeholder = isIncome
    ? "Ex: diaria, freelance, venda"
    : "Ex: aluguel, comida, mercado";
  updateCategoryOptions();
}

function resetForm(type = transactionTypeInput.value || "income") {
  form.reset();
  transactionTypeInput.value = type;
  document.querySelector("#date").value = todayISO();
  setTransactionType(type);
}

function openTransactionModal(type) {
  resetForm(type);
  transactionModal.hidden = false;
  document.body.classList.add("modal-open");
  setTimeout(() => document.querySelector("#description").focus(), 80);
}

function closeTransactionModal() {
  transactionModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function openPdfSummaryModal() {
  pdfMonthInput.value = monthFilter.value || monthISO();
  pdfSummaryForm.elements.pdfMonthChoice.value = "current";
  pdfMonthField.hidden = true;
  pdfSummaryModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closePdfSummaryModal() {
  pdfSummaryModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function getMonthSummary(monthValue) {
  const monthItems = transactions.filter((item) => isInMonth(item, monthValue));
  const income = monthItems.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expense = monthItems.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const categoriesTotal = monthItems
    .filter((item) => item.type === "expense")
    .reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + item.amount;
      return acc;
    }, {});

  return {
    monthItems: [...monthItems].sort((a, b) => b.date.localeCompare(a.date)),
    income,
    expense,
    balance: income - expense,
    categories: Object.entries(categoriesTotal).sort((a, b) => b[1] - a[1]),
  };
}

function getReportDayCount(monthValue) {
  return monthValue === monthISO()
    ? new Date().getDate()
    : new Date(Number(monthValue.slice(0, 4)), Number(monthValue.slice(5, 7)), 0).getDate();
}

function getDailyReportData(summary) {
  const daily = summary.monthItems.reduce((acc, item) => {
    acc[item.date] ||= { income: 0, expense: 0 };
    acc[item.date][item.type] += item.amount;
    return acc;
  }, {});

  return Object.entries(daily)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, totals]) => ({ date, ...totals }));
}

function createBarChartDataUrl({ title, labels, datasets, width = 1000, height = 420 }) {
  const canvas = document.createElement("canvas");
  const ratio = 2;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const context = canvas.getContext("2d");
  context.scale(ratio, ratio);

  const colors = { text: "#243129", muted: "#68756d", line: "#dfe7e2", surface: "#ffffff" };
  const margin = { top: 60, right: 28, bottom: 76, left: 82 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(1, ...datasets.flatMap((dataset) => dataset.values));

  context.fillStyle = colors.surface;
  context.fillRect(0, 0, width, height);
  context.fillStyle = colors.text;
  context.font = "bold 22px Arial";
  context.fillText(title, margin.left, 32);

  context.font = "12px Arial";
  context.textAlign = "right";
  context.textBaseline = "middle";
  for (let step = 0; step <= 4; step += 1) {
    const value = (maxValue / 4) * step;
    const y = margin.top + chartHeight - (chartHeight * step) / 4;
    context.strokeStyle = colors.line;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(margin.left, y);
    context.lineTo(width - margin.right, y);
    context.stroke();
    context.fillStyle = colors.muted;
    context.fillText(money(value).replace(/\s/g, " "), margin.left - 10, y);
  }

  const groupWidth = chartWidth / Math.max(labels.length, 1);
  const barGap = 5;
  const barWidth = Math.max(8, Math.min(44, (groupWidth - 18) / Math.max(datasets.length, 1) - barGap));
  labels.forEach((label, labelIndex) => {
    const totalBarsWidth = datasets.length * (barWidth + barGap) - barGap;
    const groupStart = margin.left + labelIndex * groupWidth + (groupWidth - totalBarsWidth) / 2;

    datasets.forEach((dataset, datasetIndex) => {
      const value = dataset.values[labelIndex] || 0;
      const barHeight = (value / maxValue) * chartHeight;
      const x = groupStart + datasetIndex * (barWidth + barGap);
      const y = margin.top + chartHeight - barHeight;
      context.fillStyle = dataset.color;
      context.fillRect(x, y, barWidth, barHeight);
    });

    context.save();
    context.translate(margin.left + labelIndex * groupWidth + groupWidth / 2, margin.top + chartHeight + 12);
    context.rotate(labels.length > 8 ? -Math.PI / 4 : 0);
    context.fillStyle = colors.muted;
    context.font = "12px Arial";
    context.textAlign = labels.length > 8 ? "right" : "center";
    context.textBaseline = "top";
    context.fillText(String(label).slice(0, 18), 0, 0);
    context.restore();
  });

  let legendX = margin.left;
  datasets.forEach((dataset) => {
    context.fillStyle = dataset.color;
    context.fillRect(legendX, height - 24, 12, 12);
    context.fillStyle = colors.text;
    context.font = "12px Arial";
    context.textAlign = "left";
    context.fillText(dataset.label, legendX + 18, height - 18);
    legendX += context.measureText(dataset.label).width + 52;
  });

  return canvas.toDataURL("image/png");
}

function createReportCharts(summary) {
  const daily = getDailyReportData(summary);
  const dailyChart = createBarChartDataUrl({
    title: "Ganhos e despesas por dia",
    labels: daily.length ? daily.map((item) => item.date.slice(8, 10)) : ["Sem dados"],
    datasets: [
      { label: "Ganhos", color: "#17a65b", values: daily.length ? daily.map((item) => item.income) : [0] },
      { label: "Despesas", color: "#d9564a", values: daily.length ? daily.map((item) => item.expense) : [0] },
    ],
  });
  const categoryChart = createBarChartDataUrl({
    title: "Despesas por categoria",
    labels: summary.categories.length ? summary.categories.map(([category]) => category) : ["Sem despesas"],
    datasets: [
      { label: "Despesas", color: "#0b713f", values: summary.categories.length ? summary.categories.map(([, value]) => value) : [0] },
    ],
  });

  return { dailyChart, categoryChart };
}

function generateMonthlyPdf(monthValue) {
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) {
    alert("Nao foi possivel carregar o gerador de PDF. Tente novamente com internet ativa.");
    return;
  }

  const summary = getMonthSummary(monthValue);
  const charts = createReportCharts(summary);
  const dayCount = getReportDayCount(monthValue);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  if (typeof doc.autoTable !== "function") {
    alert("Nao foi possivel carregar as tabelas do PDF. Tente novamente com internet ativa.");
    return;
  }
  const pageWidth = doc.internal.pageSize.getWidth();
  const darkGreen = [5, 71, 39];
  const cardWidth = 62;
  const cardGap = 6;

  doc.setFillColor(...darkGreen);
  doc.rect(0, 0, pageWidth, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text("Planejamento Financeiro", 14, 11);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`${monthName(monthValue)} | Gerado em ${new Date().toLocaleDateString("pt-BR")}`, 14, 18);

  const cards = [
    ["Ganhos", summary.income, [229, 247, 237]],
    ["Despesas", summary.expense, [255, 239, 237]],
    ["Saldo", summary.balance, [233, 241, 251]],
    ["Lucro por dia", summary.balance / Math.max(dayCount, 1), [244, 239, 252]],
  ];
  cards.forEach(([label, value, color], index) => {
    const x = 14 + index * (cardWidth + cardGap);
    doc.setFillColor(...color);
    doc.roundedRect(x, 31, cardWidth, 22, 2, 2, "F");
    doc.setTextColor(75, 88, 80);
    doc.setFontSize(9);
    doc.text(label, x + 4, 38);
    doc.setTextColor(20, 45, 31);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(money(value), x + 4, 48);
    doc.setFont("helvetica", "normal");
  });

  doc.addImage(charts.dailyChart, "PNG", 14, 60, 130, 55);
  doc.addImage(charts.categoryChart, "PNG", 153, 60, 130, 55);

  doc.setTextColor(20, 45, 31);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Movimentacoes do mes", 14, 124);

  const rows = summary.monthItems.map((item) => [
    item.date.split("-").reverse().join("/"),
    item.type === "income" ? "Ganho" : "Despesa",
    item.description,
    item.category,
    frequencyLabels[item.frequency],
    `${item.type === "income" ? "+" : "-"} ${money(item.amount)}`,
    item.note || "",
  ]);

  doc.autoTable({
    startY: 129,
    head: [["Data", "Tipo", "Descricao", "Categoria", "Frequencia", "Valor", "Observacao"]],
    body: rows.length ? rows : [["-", "-", "Nenhum registro encontrado", "-", "-", "-", "-"]],
    theme: "striped",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2.2, textColor: [32, 48, 39] },
    headStyles: { fillColor: darkGreen, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [244, 247, 245] },
    columnStyles: { 5: { halign: "right" } },
    margin: { left: 14, right: 14, bottom: 12 },
    didDrawPage: ({ pageNumber }) => {
      doc.setFontSize(8);
      doc.setTextColor(105, 117, 109);
      doc.text(`Pagina ${pageNumber}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 6, { align: "right" });
    },
  });

  doc.save(`resumo-financeiro-${monthValue}.pdf`);
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function generateMonthlyExcel(monthValue) {
  if (!window.ExcelJS) {
    alert("Nao foi possivel carregar o gerador de Excel. Tente novamente com internet ativa.");
    return;
  }

  const summary = getMonthSummary(monthValue);
  const charts = createReportCharts(summary);
  const workbook = new window.ExcelJS.Workbook();
  workbook.creator = "Planejamento Financeiro";
  workbook.created = new Date();

  const dashboard = workbook.addWorksheet("Resumo", { views: [{ showGridLines: false }] });
  const movements = workbook.addWorksheet("Movimentacoes", { views: [{ state: "frozen", ySplit: 1 }] });
  const categoriesSheet = workbook.addWorksheet("Categorias", { views: [{ state: "frozen", ySplit: 1 }] });
  const darkGreen = "054727";
  const lightGreen = "E5F4EC";
  const currencyFormat = 'R$ #,##0.00;[Red]-R$ #,##0.00';

  movements.columns = [
    { header: "Data", key: "date", width: 13 },
    { header: "Tipo", key: "type", width: 13 },
    { header: "Descricao", key: "description", width: 30 },
    { header: "Categoria", key: "category", width: 20 },
    { header: "Frequencia", key: "frequency", width: 17 },
    { header: "Valor", key: "amount", width: 16 },
    { header: "Observacao", key: "note", width: 32 },
  ];
  summary.monthItems
    .slice()
    .reverse()
    .forEach((item) => movements.addRow({
      date: new Date(`${item.date}T12:00:00`),
      type: item.type === "income" ? "Ganho" : "Despesa",
      description: item.description,
      category: item.category,
      frequency: frequencyLabels[item.frequency],
      amount: item.amount,
      note: item.note || "",
    }));
  movements.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: darkGreen } };
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.alignment = { vertical: "middle" };
  });
  movements.getColumn("date").numFmt = "dd/mm/yyyy";
  movements.getColumn("amount").numFmt = currencyFormat;
  movements.autoFilter = { from: "A1", to: "G1" };
  movements.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F3F6F4" } };
    }
  });

  const lastMovementRow = Math.max(movements.rowCount, 2);
  dashboard.mergeCells("A1:H2");
  dashboard.getCell("A1").value = "PLANEJAMENTO FINANCEIRO";
  dashboard.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: darkGreen } };
  dashboard.getCell("A1").font = { bold: true, size: 22, color: { argb: "FFFFFF" } };
  dashboard.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
  dashboard.mergeCells("A3:H3");
  dashboard.getCell("A3").value = `Relatorio de ${monthName(monthValue)}`;
  dashboard.getCell("A3").font = { bold: true, size: 13, color: { argb: darkGreen } };
  dashboard.getCell("A3").alignment = { horizontal: "center" };

  const dashboardItems = [
    ["A5", "Ganhos", `=SUMIF('Movimentacoes'!$B$2:$B$${lastMovementRow},"Ganho",'Movimentacoes'!$F$2:$F$${lastMovementRow})`],
    ["C5", "Despesas", `=SUMIF('Movimentacoes'!$B$2:$B$${lastMovementRow},"Despesa",'Movimentacoes'!$F$2:$F$${lastMovementRow})`],
    ["E5", "Saldo", "=A6-C6"],
    ["G5", "Lucro por dia", `=E6/${Math.max(getReportDayCount(monthValue), 1)}`],
  ];
  dashboardItems.forEach(([labelCell, label, formula]) => {
    const labelColumn = dashboard.getCell(labelCell).col;
    const valueCell = dashboard.getCell(6, labelColumn);
    dashboard.mergeCells(5, labelColumn, 5, labelColumn + 1);
    dashboard.getCell(labelCell).value = label;
    dashboard.getCell(labelCell).fill = { type: "pattern", pattern: "solid", fgColor: { argb: lightGreen } };
    dashboard.getCell(labelCell).font = { bold: true, color: { argb: darkGreen } };
    dashboard.getCell(labelCell).alignment = { horizontal: "center" };
    dashboard.mergeCells(6, labelColumn, 6, labelColumn + 1);
    valueCell.value = { formula, result: label === "Ganhos" ? summary.income : label === "Despesas" ? summary.expense : label === "Saldo" ? summary.balance : summary.balance / Math.max(getReportDayCount(monthValue), 1) };
    valueCell.numFmt = currencyFormat;
    valueCell.font = { bold: true, size: 14, color: { argb: darkGreen } };
    valueCell.alignment = { horizontal: "center" };
  });

  dashboard.columns = Array.from({ length: 8 }, () => ({ width: 14 }));
  dashboard.getRow(1).height = 26;
  dashboard.getRow(2).height = 26;
  dashboard.getRow(6).height = 28;
  const dailyImageId = workbook.addImage({ base64: charts.dailyChart, extension: "png" });
  const categoryImageId = workbook.addImage({ base64: charts.categoryChart, extension: "png" });
  dashboard.addImage(dailyImageId, { tl: { col: 0, row: 7 }, ext: { width: 500, height: 230 } });
  dashboard.addImage(categoryImageId, { tl: { col: 4, row: 7 }, ext: { width: 500, height: 230 } });
  dashboard.mergeCells("A22:H23");
  dashboard.getCell("A22").value = "Os dados das abas Movimentacoes e Categorias sao editaveis. Os graficos representam o momento da exportacao.";
  dashboard.getCell("A22").alignment = { wrapText: true, vertical: "middle" };
  dashboard.getCell("A22").font = { italic: true, color: { argb: "68756D" } };

  categoriesSheet.columns = [
    { header: "Categoria", key: "category", width: 28 },
    { header: "Total", key: "total", width: 18 },
    { header: "% das despesas", key: "percent", width: 20 },
  ];
  summary.categories.forEach(([category, value], index) => {
    const rowNumber = index + 2;
    categoriesSheet.addRow({ category, total: value, percent: summary.expense > 0 ? value / summary.expense : 0 });
    categoriesSheet.getCell(`B${rowNumber}`).value = {
      formula: `=SUMIFS('Movimentacoes'!$F$2:$F$${lastMovementRow},'Movimentacoes'!$B$2:$B$${lastMovementRow},"Despesa",'Movimentacoes'!$D$2:$D$${lastMovementRow},A${rowNumber})`,
      result: value,
    };
    categoriesSheet.getCell(`C${rowNumber}`).value = { formula: `=IFERROR(B${rowNumber}/SUM(B$2:B$${Math.max(summary.categories.length + 1, 2)}),0)`, result: summary.expense > 0 ? value / summary.expense : 0 };
  });
  categoriesSheet.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: darkGreen } };
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
  });
  categoriesSheet.getColumn("total").numFmt = currencyFormat;
  categoriesSheet.getColumn("percent").numFmt = "0.0%";
  categoriesSheet.autoFilter = { from: "A1", to: "C1" };

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `planejamento-financeiro-${monthValue}.xlsx`,
  );
}

function resetSavingsGoalForm() {
  savingsGoalForm.reset();
  editingSavingsGoalId = null;
  savingsGoalSubmitButton.textContent = "Criar meta";
}

function setSavingsGoalFormOpen(isOpen, goal = null) {
  savingsGoalForm.hidden = !isOpen;
  savingsGoalToggleButton.querySelector("span").textContent = isOpen ? "Fechar" : "Nova meta";
  savingsGoalToggleButton.setAttribute("aria-expanded", String(isOpen));

  if (!isOpen) {
    resetSavingsGoalForm();
    return;
  }

  if (goal) {
    editingSavingsGoalId = goal.id;
    document.querySelector("#savingsGoalName").value = goal.name;
    document.querySelector("#savingsGoalTarget").value = goal.targetAmount;
    document.querySelector("#savingsGoalNote").value = goal.note || "";
    savingsGoalSubmitButton.textContent = "Salvar alteracoes";
  } else {
    resetSavingsGoalForm();
  }

  setTimeout(() => document.querySelector("#savingsGoalName").focus(), 80);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const transaction = {
    id: crypto.randomUUID(),
    type: data.get("type"),
    description: document.querySelector("#description").value.trim(),
    amount: parseAmount(document.querySelector("#amount").value),
    date: document.querySelector("#date").value,
    category: categorySelect.value,
    frequency: document.querySelector("#frequency").value,
    note: document.querySelector("#note").value.trim(),
  };

  if (!transaction.description || transaction.amount <= 0 || !transaction.date) {
    return;
  }

  await createTransaction(transaction);
  resetForm();
  closeTransactionModal();
});

goalForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveSetting("dailyGoal", parseAmount(dailyGoalInput.value));
  setGoalFormOpen(false);
  render();
});

goalToggleButton.addEventListener("click", () => {
  setGoalFormOpen(goalForm.hidden);
});

savingsGoalForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = document.querySelector("#savingsGoalName").value.trim();
  const targetAmount = parseAmount(document.querySelector("#savingsGoalTarget").value);
  const note = document.querySelector("#savingsGoalNote").value.trim();

  if (!name || targetAmount <= 0) return;

  if (editingSavingsGoalId) {
    await updateSavingsGoal(editingSavingsGoalId, { name, targetAmount, note });
  } else {
    await createSavingsGoal({
      id: crypto.randomUUID(),
      name,
      targetAmount,
      savedAmount: 0,
      note,
      deposits: [],
    });
  }

  setSavingsGoalFormOpen(false);
});

savingsGoalToggleButton.addEventListener("click", () => {
  setSavingsGoalFormOpen(savingsGoalForm.hidden);
});

savingsGoalCancelButton.addEventListener("click", () => {
  setSavingsGoalFormOpen(false);
});

savingsGoalsList.addEventListener("submit", async (event) => {
  const depositForm = event.target.closest("[data-goal-deposit]");
  if (!depositForm) return;
  event.preventDefault();
  const amount = parseAmount(depositForm.querySelector("input").value);
  if (amount <= 0) return;
  await addSavingsDeposit(depositForm.dataset.goalDeposit, amount);
});

savingsGoalsList.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-goal-edit]");
  if (editButton) {
    const goal = savingsGoals.find((item) => item.id === editButton.dataset.goalEdit);
    if (goal) setSavingsGoalFormOpen(true, goal);
    return;
  }

  const button = event.target.closest("[data-goal-delete]");
  if (!button) return;
  if (!confirm("Excluir esta meta e os depositos dela?")) return;
  await deleteSavingsGoal(button.dataset.goalDelete);
});

recordsBody.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-id]");
  if (!button) return;

  const transaction = transactions.find((item) => item.id === button.dataset.id);
  const transactionLabel = transaction
    ? `\"${transaction.description}\" no valor de ${money(transaction.amount)}`
    : "este registro";

  if (!confirm(`Tem certeza de que deseja excluir ${transactionLabel}?\n\nEssa acao nao pode ser desfeita.`)) return;
  await deleteTransaction(button.dataset.id);
});

monthFilter.addEventListener("change", render);
typeFilter.addEventListener("change", render);
frequencyFilter.addEventListener("change", render);

tabTriggers.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveTab(button.dataset.tabTarget);
  });
});

transactionTypeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    openTransactionModal(button.dataset.transactionType);
  });
});

transactionModal.addEventListener("click", (event) => {
  if (event.target.closest("[data-close-transaction-modal]")) {
    closeTransactionModal();
  }
});

pdfSummaryButton.addEventListener("click", openPdfSummaryModal);

pdfSummaryForm.addEventListener("change", (event) => {
  if (event.target.name === "pdfMonthChoice") {
    pdfMonthField.hidden = event.target.value !== "other";
    if (!pdfMonthField.hidden) {
      pdfMonthInput.focus();
    }
  }
});

pdfSummaryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const choice = pdfSummaryForm.elements.pdfMonthChoice.value;
  const selectedMonth = choice === "other" ? pdfMonthInput.value : monthISO();
  const exportFormat = event.submitter?.value || "pdf";

  if (!selectedMonth) {
    alert("Escolha um mes para gerar o relatorio.");
    return;
  }

  if (exportFormat === "xlsx") {
    await generateMonthlyExcel(selectedMonth);
  } else {
    generateMonthlyPdf(selectedMonth);
  }
  closePdfSummaryModal();
});

pdfSummaryModal.addEventListener("click", (event) => {
  if (event.target.closest("[data-close-pdf-summary]")) {
    closePdfSummaryModal();
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authError.textContent = "";
  try {
    const data = await submitAuth("/api/auth/login", {
      email: document.querySelector("#loginEmail").value,
      password: document.querySelector("#loginPassword").value,
    });
    showApp(data.user);
    await loadFromApi();
    render();
  } catch (error) {
    authError.textContent = error.message;
  }
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authError.textContent = "";
  try {
    const data = await submitAuth("/api/auth/signup", {
      name: document.querySelector("#signupName").value,
      email: document.querySelector("#signupEmail").value,
      password: document.querySelector("#signupPassword").value,
    });
    showApp(data.user);
    await loadFromApi();
    render();
  } catch (error) {
    authError.textContent = error.message;
  }
});

showSignupButton.addEventListener("click", () => {
  setAuthMode("signup");
});

showLoginButton.addEventListener("click", () => {
  setAuthMode("login");
});

logoutButton.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  transactions = [];
  savingsGoals = [];
  settings = loadSettings();
  showAuth("Voce saiu da conta.");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !transactionModal.hidden) {
    closeTransactionModal();
  }
  if (event.key === "Escape" && !pdfSummaryModal.hidden) {
    closePdfSummaryModal();
  }
});

async function start() {
  monthFilter.value = monthISO();
  resetForm();
  pdfMonthInput.value = monthISO();

  try {
    const health = await fetch("/api/health").then((response) => response.json());
    authRequired = health.database === "connected";
  } catch {
    authRequired = false;
  }

  if (authRequired) {
    try {
      const data = await api.request("/api/auth/me");
      showApp(data.user);
      await loadFromApi();
    } catch (error) {
      showAuth("Entre ou crie um cadastro para acessar seus dados.");
      refreshIcons();
      return;
    }
  } else {
    showApp(null);
    await loadFromApi();
  }

  render();
  refreshIcons();
}

start();
