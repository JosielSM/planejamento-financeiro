function loadTransactions() {
  return loadJSON(TRANSACTIONS_KEY, []);
}

function saveTransactions() {
  if (authRequired) return;
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
}

function loadSettings() {
  return { dailyGoal: 0, includeSundays: false, ...loadJSON(SETTINGS_KEY, {}) };
}

function saveSettings() {
  if (authRequired) return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function loadSavingsGoals() {
  return loadJSON(SAVINGS_GOALS_KEY, []);
}

function saveSavingsGoals() {
  if (authRequired) return;
  localStorage.setItem(SAVINGS_GOALS_KEY, JSON.stringify(savingsGoals));
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
  } catch (error) {
    if (error.status === 401) {
      showAuth("Entre ou crie um cadastro para acessar seus dados.");
      return false;
    }
    if (authRequired) throw error;
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
    return true;
  } catch {
    api.enabled = false;
    return false;
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
    return true;
  } catch {
    api.enabled = false;
    return false;
  }
}

async function deleteTransaction(id) {
  transactions = transactions.filter((item) => item.id !== id);
  saveTransactions();
  render();

  try {
    await api.request(`/api/transactions/${id}`, { method: "DELETE" });
    return true;
  } catch {
    api.enabled = false;
    return false;
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
    return true;
  } catch {
    api.enabled = false;
    return false;
  }
}

async function createCustomCategory(type, name) {
  const category = await api.request("/api/categories", {
    method: "POST",
    body: JSON.stringify({ id: crypto.randomUUID(), type, name }),
  });
  customCategories.push(category);
  return category;
}

async function updateCustomCategory(id, name) {
  const previous = customCategories.find((candidate) => candidate.id === id);
  const category = await api.request(`/api/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
  customCategories = customCategories.map((item) => (item.id === id ? category : item));
  transactions = transactions.map((item) => {
    return item.type === category.type && item.category === previous?.name
      ? { ...item, category: category.name }
      : item;
  });
  return category;
}

async function deleteCustomCategory(id) {
  await api.request(`/api/categories/${id}`, { method: "DELETE" });
  customCategories = customCategories.filter((item) => item.id !== id);
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
    return true;
  } catch {
    api.enabled = false;
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
    const saved = await api.request(`/api/savings-goals/${goalId}/deposits`, {
      method: "POST",
      body: JSON.stringify(deposit),
    });
    savingsGoals = savingsGoals.map((goal) => (goal.id === goalId ? normalizeSavingsGoal(saved) : goal));
    saveSavingsGoals();
    render();
    return true;
  } catch {
    api.enabled = false;
    return false;
  }
}

async function deleteSavingsGoal(id) {
  savingsGoals = savingsGoals.filter((goal) => goal.id !== id);
  saveSavingsGoals();
  render();

  try {
    await api.request(`/api/savings-goals/${id}`, { method: "DELETE" });
    return true;
  } catch {
    api.enabled = false;
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
    const saved = await api.request(`/api/savings-goals/${id}/complete`, { method: "POST" });
    savingsGoals = savingsGoals.map((goal) => (goal.id === id ? normalizeSavingsGoal(saved) : goal));
    saveSavingsGoals();
    render();
    return true;
  } catch {
    api.enabled = false;
    return false;
  }
}
