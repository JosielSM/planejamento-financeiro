const CATEGORIES_KEY = "planejamento-financeiro-categories-v1";
const SYNC_QUEUE_KEY = "planejamento-financeiro-sync-queue-v1";
let syncInProgress = false;

function userStorageKey(baseKey, uid = firebaseAuth?.currentUser?.uid) {
  return `${baseKey}:${uid || "anonymous"}`;
}

function loadTransactions() {
  return loadJSON(userStorageKey(TRANSACTIONS_KEY), []);
}

function saveTransactions() {
  localStorage.setItem(userStorageKey(TRANSACTIONS_KEY), JSON.stringify(transactions));
}

function loadSettings() {
  return { dailyGoal: 0, includeSundays: false, ...loadJSON(userStorageKey(SETTINGS_KEY), {}) };
}

function saveSettings() {
  localStorage.setItem(userStorageKey(SETTINGS_KEY), JSON.stringify(settings));
}

function loadSavingsGoals() {
  return loadJSON(userStorageKey(SAVINGS_GOALS_KEY), []);
}

function saveSavingsGoals() {
  localStorage.setItem(userStorageKey(SAVINGS_GOALS_KEY), JSON.stringify(savingsGoals));
}

function loadCategories() {
  return loadJSON(userStorageKey(CATEGORIES_KEY), []);
}

function saveCategories() {
  localStorage.setItem(userStorageKey(CATEGORIES_KEY), JSON.stringify(customCategories));
}

function loadLocalSnapshot() {
  transactions = loadTransactions();
  settings = loadSettings();
  savingsGoals = loadSavingsGoals().map(normalizeSavingsGoal);
  customCategories = loadCategories();
}

function showOfflineSession(firebaseUser) {
  if (!firebaseUser) {
    showAuth("Conecte-se a internet para entrar pela primeira vez neste aparelho.");
    return false;
  }
  if (!firebaseUser.emailVerified) {
    showAuth("Conecte-se a internet para confirmar seu email.");
    return false;
  }
  loadLocalSnapshot();
  showApp(loadCachedAccount(firebaseUser));
  render();
  refreshIcons();
  showToast("Modo offline: seus dados salvos continuam disponiveis.", "info", 5000);
  return true;
}

function loadSyncQueue() {
  return loadJSON(userStorageKey(SYNC_QUEUE_KEY), []);
}

function saveSyncQueue(queue) {
  localStorage.setItem(userStorageKey(SYNC_QUEUE_KEY), JSON.stringify(queue));
  updateSyncStatus();
}

function updateSyncStatus(state = "") {
  if (!syncStatusButton) return;
  const queue = loadSyncQueue();
  const failed = queue.some((item) => item.lastError && item.lastStatus && item.lastStatus < 500 && item.lastStatus !== 429);
  syncStatusButton.hidden = !firebaseAuth?.currentUser;
  syncStatusButton.classList.toggle("pending", queue.length > 0 && !failed);
  syncStatusButton.classList.toggle("error", failed);
  syncPendingCount.hidden = queue.length === 0;
  syncPendingCount.textContent = String(queue.length);
  syncStatusText.textContent = state === "syncing" ? "Sincronizando..." : failed ? "Ação necessária" : queue.length ? `${queue.length} pendente${queue.length > 1 ? "s" : ""}` : navigator.onLine ? "Sincronizado" : "Offline";
  syncStatusButton.querySelector("[data-lucide]")?.setAttribute("data-lucide", failed ? "cloud-alert" : queue.length ? "cloud-upload" : navigator.onLine ? "cloud-check" : "cloud-off");
  refreshIcons();
}

function isRetryableSyncError(error) {
  return !error?.status || error.status === 429 || error.status >= 500;
}

function queueMutation(path, options = {}) {
  const queue = loadSyncQueue();
  queue.push({
    id: crypto.randomUUID(),
    path,
    method: options.method || "POST",
    body: options.body || null,
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
  saveSyncQueue(queue);
  showToast("Alteracao salva no celular. A sincronizacao sera automatica.", "info", 4200);
}

async function requestOrQueue(path, options = {}) {
  try {
    return { data: await api.request(path, options), queued: false };
  } catch (error) {
    if (!isRetryableSyncError(error)) throw error;
    queueMutation(path, options);
    return { data: null, queued: true };
  }
}

async function flushSyncQueue() {
  if (syncInProgress || !firebaseAuth?.currentUser) return 0;
  syncInProgress = true;
  updateSyncStatus("syncing");
  let queue = loadSyncQueue();
  let synchronized = 0;
  try {
    while (queue.length) {
      const operation = queue[0];
      try {
        await api.request(operation.path, {
          method: operation.method,
          body: operation.body,
        });
        queue.shift();
        saveSyncQueue(queue);
        synchronized += 1;
      } catch (error) {
        if (error.status === 409) {
          queue.shift();
          saveSyncQueue(queue);
          synchronized += 1;
          continue;
        }
        operation.attempts = Number(operation.attempts || 0) + 1;
        operation.lastAttemptAt = new Date().toISOString();
        operation.lastStatus = error.status || 0;
        operation.lastError = error.message || "Falha desconhecida";
        saveSyncQueue(queue);
        break;
      }
    }
  } finally {
    syncInProgress = false;
    updateSyncStatus();
  }
  if (synchronized) showToast(`${synchronized} alteracao(oes) sincronizada(s) com o servidor.`);
  return synchronized;
}

function clearCurrentUserLocalData() {
  const uid = firebaseAuth?.currentUser?.uid;
  if (!uid) return;
  [TRANSACTIONS_KEY, SETTINGS_KEY, SAVINGS_GOALS_KEY, CATEGORIES_KEY, SYNC_QUEUE_KEY, ACCOUNT_KEY]
    .forEach((key) => localStorage.removeItem(userStorageKey(key, uid)));
}

function normalizeSavingsGoal(goal) {
  return {
    id: goal.id,
    name: goal.name,
    targetAmount: Number(goal.targetAmount),
    savedAmount: Number(goal.savedAmount || 0),
    note: goal.note || "",
    completedAt: goal.completedAt || null,
    deposits: (goal.deposits || []).map((deposit) => ({
      id: deposit.id,
      amount: Number(deposit.amount),
      date: String(deposit.date).slice(0, 10),
    })),
  };
}

async function loadFromApi() {
  try {
    const [remoteTransactions, remoteSettings, remoteSavingsGoals, remoteCategories] = await Promise.all([
      api.request("/api/transactions"),
      api.request("/api/settings"),
      api.request("/api/savings-goals"),
      api.request("/api/categories"),
    ]);
    transactions = remoteTransactions;
    settings = {
      ...settings,
      dailyGoal: parseAmount(remoteSettings.dailyGoal || 0),
      includeSundays: remoteSettings.includeSundays === "true",
    };
    savingsGoals = remoteSavingsGoals.map(normalizeSavingsGoal);
    customCategories = remoteCategories;
    saveTransactions();
    saveSettings();
    saveSavingsGoals();
    saveCategories();
  } catch (error) {
    if (error.status === 401) {
      showAuth("Entre ou crie um cadastro para acessar seus dados.");
      return false;
    }
    loadLocalSnapshot();
    showToast("Mostrando os dados salvos neste dispositivo.", "info", 4200);
    return false;
  }
  return true;
}

async function saveSetting(key, value) {
  settings[key] = value;
  saveSettings();
  try {
    const result = await requestOrQueue(`/api/settings/${key}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    });
    return true;
  } catch {
    return false;
  }
}

async function createTransaction(transaction) {
  transactions.push(transaction);
  saveTransactions();
  render();

  try {
    const result = await requestOrQueue("/api/transactions", {
      method: "POST",
      body: JSON.stringify(transaction),
    });
    if (result.queued) return true;
    transactions = transactions.map((item) => (item.id === transaction.id ? result.data : item));
    saveTransactions();
    render();
    return true;
  } catch {
    return false;
  }
}

async function deleteTransaction(id) {
  transactions = transactions.filter((item) => item.id !== id);
  saveTransactions();
  render();

  try {
    await requestOrQueue(`/api/transactions/${id}`, { method: "DELETE" });
    return true;
  } catch {
    return false;
  }
}

async function createSavingsGoal(goal) {
  savingsGoals.unshift(goal);
  saveSavingsGoals();
  render();

  try {
    const result = await requestOrQueue("/api/savings-goals", {
      method: "POST",
      body: JSON.stringify(goal),
    });
    if (result.queued) return true;
    savingsGoals = savingsGoals.map((item) => (item.id === goal.id ? normalizeSavingsGoal(result.data) : item));
    saveSavingsGoals();
    render();
    return true;
  } catch {
    return false;
  }
}

async function createCustomCategory(type, name) {
  const draft = { id: crypto.randomUUID(), type, name };
  customCategories.push(draft);
  saveCategories();
  const result = await requestOrQueue("/api/categories", {
    method: "POST",
    body: JSON.stringify(draft),
  });
  if (!result.queued) {
    customCategories = customCategories.map((item) => (item.id === draft.id ? result.data : item));
    saveCategories();
    return result.data;
  }
  return draft;
}

async function updateCustomCategory(id, name) {
  const previous = customCategories.find((candidate) => candidate.id === id);
  const draft = { ...previous, name };
  customCategories = customCategories.map((item) => (item.id === id ? draft : item));
  transactions = transactions.map((item) => {
    return item.type === draft.type && item.category === previous?.name
      ? { ...item, category: draft.name }
      : item;
  });
  saveCategories();
  saveTransactions();
  const result = await requestOrQueue(`/api/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
  if (!result.queued) {
    customCategories = customCategories.map((item) => (item.id === id ? result.data : item));
    saveCategories();
    return result.data;
  }
  return draft;
}

async function deleteCustomCategory(id) {
  customCategories = customCategories.filter((item) => item.id !== id);
  saveCategories();
  await requestOrQueue(`/api/categories/${id}`, { method: "DELETE" });
}

async function updateSavingsGoal(id, updates) {
  savingsGoals = savingsGoals.map((goal) => (goal.id === id ? normalizeSavingsGoal({ ...goal, ...updates }) : goal));
  saveSavingsGoals();
  render();

  try {
    const result = await requestOrQueue(`/api/savings-goals/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    if (result.queued) return true;
    savingsGoals = savingsGoals.map((goal) => (goal.id === id ? normalizeSavingsGoal(result.data) : goal));
    saveSavingsGoals();
    render();
    return true;
  } catch {
    return false;
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
    const result = await requestOrQueue(`/api/savings-goals/${goalId}/deposits`, {
      method: "POST",
      body: JSON.stringify(deposit),
    });
    if (result.queued) return true;
    savingsGoals = savingsGoals.map((goal) => (goal.id === goalId ? normalizeSavingsGoal(result.data) : goal));
    saveSavingsGoals();
    render();
    return true;
  } catch {
    return false;
  }
}

async function deleteSavingsGoal(id) {
  savingsGoals = savingsGoals.filter((goal) => goal.id !== id);
  saveSavingsGoals();
  render();

  try {
    await requestOrQueue(`/api/savings-goals/${id}`, { method: "DELETE" });
    return true;
  } catch {
    return false;
  }
}

function currentCategoryType() {
  return transactionTypeInput.value || "income";
}

async function completeSavingsGoal(id) {
  const completedAt = new Date().toISOString();
  savingsGoals = savingsGoals.map((goal) => (goal.id === id ? { ...goal, completedAt } : goal));
  saveSavingsGoals();
  render();

  try {
    const result = await requestOrQueue(`/api/savings-goals/${id}/complete`, { method: "POST" });
    if (result.queued) return true;
    savingsGoals = savingsGoals.map((goal) => (goal.id === id ? normalizeSavingsGoal(result.data) : goal));
    saveSavingsGoals();
    render();
    return true;
  } catch {
    return false;
  }
}
