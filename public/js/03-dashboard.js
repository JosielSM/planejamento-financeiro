function updateCategoryOptions(selectedValue = "") {
  const type = new FormData(form).get("type");
  const previousValue = selectedValue || categorySelect.value;
  categorySelect.innerHTML = "";
  const availableCategories = [
    ...categories[type],
    ...customCategories.filter((item) => item.type === type).map((item) => item.name),
  ];
  availableCategories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categorySelect.append(option);
  });
  if (availableCategories.includes(previousValue)) categorySelect.value = previousValue;
}

function resetCategoryEditor() {
  editingCategoryId = null;
  customCategoryName.value = "";
  saveCategoryButton.textContent = "Salvar categoria";
  cancelCategoryEditButton.hidden = true;
}

function renderCategoryManager() {
  const type = currentCategoryType();
  const typeLabel = type === "income" ? "ganho" : "despesa";
  categoryManagerTitle.textContent = editingCategoryId
    ? `Editar categoria de ${typeLabel}`
    : `Nova categoria de ${typeLabel}`;
  const items = customCategories.filter((item) => item.type === type);
  customCategoryList.innerHTML = items.length
    ? items.map((item) => `
        <div class="custom-category-item">
          <span><i data-lucide="tag" aria-hidden="true"></i>${escapeHTML(item.name)}</span>
          <div>
            <button class="category-icon-button" type="button" data-category-edit="${item.id}" aria-label="Editar ${escapeHTML(item.name)}"><i data-lucide="pencil" aria-hidden="true"></i></button>
            <button class="category-icon-button danger" type="button" data-category-delete="${item.id}" aria-label="Excluir ${escapeHTML(item.name)}"><i data-lucide="trash-2" aria-hidden="true"></i></button>
          </div>
        </div>
      `).join("")
    : '<p class="category-empty">Nenhuma categoria personalizada deste tipo.</p>';
  refreshIcons();
}

function setCategoryManagerOpen(isOpen, focusInput = false) {
  categoryManager.hidden = !isOpen;
  if (!isOpen) resetCategoryEditor();
  renderCategoryManager();
  if (isOpen && focusInput) setTimeout(() => customCategoryName.focus(), 80);
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

function getAverageDayCount(monthValue) {
  const year = Number(monthValue.slice(0, 4));
  const monthIndex = Number(monthValue.slice(5, 7)) - 1;
  const today = new Date();
  const isCurrentMonth = monthValue === monthISO();
  const lastDay = isCurrentMonth
    ? today.getDate()
    : new Date(year, monthIndex + 1, 0).getDate();
  let workingDayCount = 0;

  for (let day = 1; day <= lastDay; day += 1) {
    if (settings.includeSundays || new Date(year, monthIndex, day).getDay() !== 0) workingDayCount += 1;
  }

  return workingDayCount;
}

function renderSummary() {
  const monthItems = getMonthTransactions();
  const income = monthItems.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expense = monthItems.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const balance = income - expense;
  const dayCount = getAverageDayCount(monthFilter.value);
  includeSundaysToggle.checked = Boolean(settings.includeSundays);

  document.querySelector("#totalIncome").textContent = money(income);
  document.querySelector("#totalExpense").textContent = money(expense);
  document.querySelector("#balance").textContent = money(balance);
  document.querySelector("#dailyAverage").textContent = money(balance / Math.max(dayCount, 1));
  document.querySelector("#incomeDailyAverage").textContent = money(income / Math.max(dayCount, 1));
  renderIncomeExpenseChart(income, expense);
  renderRegisterOverview(monthItems, income, expense);
}

function renderIncomeExpenseChart(income, expense) {
  const total = income + expense;
  const incomePercent = total > 0 ? (income / total) * 100 : 0;
  const chart = document.querySelector("#incomeExpenseChart");

  chart.style.background = total > 0
    ? `conic-gradient(var(--green) 0 ${incomePercent}%, var(--red) ${incomePercent}% 100%)`
    : "var(--line)";
  chart.setAttribute("aria-label", `Ganhos ${money(income)} e despesas ${money(expense)}`);
  document.querySelector("#chartIncomeValue").textContent = money(income);
  document.querySelector("#chartExpenseValue").textContent = money(expense);
  document.querySelector("#registerIncomeValue").textContent = money(income);
  document.querySelector("#registerExpenseValue").textContent = money(expense);
}

function renderRegisterOverview(monthItems, income, expense) {
  const recentItems = [...monthItems]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  const lastItem = recentItems[0];
  const recentList = document.querySelector("#recentRegistersList");
  const recentEmpty = document.querySelector("#recentRegistersEmpty");

  document.querySelector("#registerBalanceValue").textContent = money(income - expense);
  document.querySelector("#registerCountValue").textContent = String(monthItems.length);
  document.querySelector("#registerLastDate").textContent = lastItem
    ? lastItem.date.split("-").reverse().slice(0, 2).join("/")
    : "Nenhuma";

  recentList.innerHTML = recentItems.map((item) => `
    <article class="recent-register-item ${item.type}">
      <div class="recent-register-icon"><i data-lucide="${item.type === "income" ? "arrow-down-left" : "arrow-up-right"}" aria-hidden="true"></i></div>
      <div>
        <strong>${escapeHTML(item.description)}</strong>
        <span>${escapeHTML(item.category)} · ${item.date.split("-").reverse().join("/")}</span>
      </div>
      <strong class="recent-register-value">${item.type === "income" ? "+" : "-"} ${money(item.amount)}</strong>
    </article>
  `).join("");
  recentEmpty.hidden = recentItems.length > 0;
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

function renderSavingsOverview() {
  const activeGoals = savingsGoals.filter((goal) => !goal.completedAt);
  const monthItems = getMonthTransactions();
  const income = monthItems.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expenses = monthItems.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const monthBalance = income - expenses;
  const totalReserved = activeGoals.reduce((sum, goal) => sum + Number(goal.savedAmount || 0), 0);
  const totalTargets = activeGoals.reduce((sum, goal) => sum + Number(goal.targetAmount || 0), 0);
  const availableBalance = monthBalance - totalReserved;
  const reservedPercentOfBalance = monthBalance > 0 ? Math.min((totalReserved / monthBalance) * 100, 100) : 0;
  const freePercent = monthBalance > 0 ? Math.max(100 - reservedPercentOfBalance, 0) : 0;
  const overallPercent = totalTargets > 0 ? Math.min((totalReserved / totalTargets) * 100, 100) : 0;

  goalsMonthBalance.textContent = money(monthBalance);
  goalsReservedAmount.textContent = money(totalReserved);
  goalsAvailableBalance.textContent = money(availableBalance);
  goalsAvailableBalance.classList.toggle("negative-value", availableBalance < 0);
  reserveChartPercent.textContent = `${Math.round(freePercent)}%`;
  reserveChart.style.background = monthBalance > 0
    ? `conic-gradient(var(--green) 0 ${freePercent}%, var(--purple) ${freePercent}% 100%)`
    : "var(--line)";
  reserveChart.setAttribute(
    "aria-label",
    `Saldo livre estimado ${money(availableBalance)} e dinheiro reservado ${money(totalReserved)}`,
  );

  if (!activeGoals.length) {
    reserveChartMessage.textContent = "Crie um objetivo e registre depositos para acompanhar seu dinheiro reservado.";
  } else if (monthBalance <= 0) {
    reserveChartMessage.textContent = "O saldo do mes nao esta positivo. Revise ganhos e despesas antes de aumentar as reservas.";
  } else if (availableBalance < 0) {
    reserveChartMessage.textContent = "O valor reservado esta acima do saldo deste mes. Isso pode incluir dinheiro guardado em meses anteriores.";
  } else {
    reserveChartMessage.textContent = `${money(totalReserved)} estao separados para seus objetivos e ${money(availableBalance)} permanecem livres.`;
  }

  overallGoalsPercent.textContent = `${Math.round(overallPercent)}%`;
  overallGoalsProgressBar.style.width = `${overallPercent}%`;
  overallGoalsCaption.textContent = totalTargets > 0
    ? `${money(totalReserved)} guardados de ${money(totalTargets)} planejados.`
    : "Nenhum objetivo criado.";
}

function renderSavingsGoals() {
  renderSavingsOverview();
  savingsGoalsList.innerHTML = "";
  completedGoalsList.innerHTML = "";
  const activeGoals = savingsGoals.filter((goal) => !goal.completedAt);
  const completedGoals = savingsGoals.filter((goal) => goal.completedAt);
  savingsEmptyState.style.display = activeGoals.length ? "none" : "block";
  savingsEmptyState.textContent = completedGoals.length
    ? "Todas as suas metas estao concluidas. Crie uma nova quando quiser."
    : "Nenhuma meta cadastrada ainda.";
  completedGoalsSection.hidden = !completedGoals.length;
  completedGoalsCount.textContent = `${completedGoals.length} ${completedGoals.length === 1 ? "concluida" : "concluidas"}`;

  activeGoals.forEach((goal) => {
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
      ${remaining <= 0 ? `
        <button class="primary-button completed-goal-button" type="button" data-goal-complete="${goal.id}">
          <i data-lucide="circle-check-big" aria-hidden="true"></i>
          <span>Meta Conclu&iacute;da</span>
        </button>
      ` : `<form class="deposit-form" data-goal-deposit="${goal.id}">
        <label>
          Depositar
          <input type="number" min="0.01" step="0.01" placeholder="0,00" required />
        </label>
        <button class="secondary-button" type="submit">Adicionar</button>
      </form>`}
    `;
    savingsGoalsList.append(card);
  });

  completedGoals.forEach((goal) => {
    const completedDate = new Date(goal.completedAt).toLocaleDateString("pt-BR");
    const card = document.createElement("article");
    card.className = "savings-card completed-goal-card";
    card.innerHTML = `
      <header>
        <div>
          <span class="completed-goal-badge"><i data-lucide="trophy" aria-hidden="true"></i> Meta conclu&iacute;da</span>
          <h3>${escapeHTML(goal.name)}</h3>
          ${goal.note ? `<p class="muted">${escapeHTML(goal.note)}</p>` : ""}
        </div>
        <button class="delete-button" type="button" data-goal-delete="${goal.id}" title="Excluir do historico" aria-label="Excluir meta do historico">x</button>
      </header>
      <div class="savings-values">
        <div><span>Valor alcancado</span><strong>${money(goal.savedAmount)}</strong></div>
        <div><span>Objetivo</span><strong>${money(goal.targetAmount)}</strong></div>
        <div><span>Concluida em</span><strong>${completedDate}</strong></div>
      </div>
      <div class="progress-track completed-progress" aria-label="Meta ${escapeHTML(goal.name)} concluida"><span style="width: 100%"></span></div>
    `;
    completedGoalsList.append(card);
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
  const pieChart = document.querySelector("#destinationPieChart");
  const pieTotal = document.querySelector("#destinationPieTotal");
  const legend = document.querySelector("#destinationLegend");
  const totalExpense = document.querySelector("#destinationTotalExpense");
  const topCategory = document.querySelector("#destinationTopCategory");
  const topValue = document.querySelector("#destinationTopValue");
  const categoryCount = document.querySelector("#destinationCategoryCount");
  const palette = ["#38b978", "#ef725f", "#e6ad3c", "#5b91d8", "#9b74cf", "#35aeb5", "#dd7fab", "#8da346"];
  target.innerHTML = "";
  legend.innerHTML = "";
  pieTotal.textContent = money(total);
  totalExpense.textContent = money(total);
  topCategory.textContent = rows[0]?.[0] || "Sem dados";
  topValue.textContent = rows[0] ? money(rows[0][1]) : money(0);
  categoryCount.textContent = String(rows.length);

  if (!rows.length) {
    pieChart.style.background = "var(--line)";
    pieChart.setAttribute("aria-label", "Nenhuma despesa cadastrada no mês");
    legend.innerHTML = '<p class="destination-empty">As categorias aparecerão aqui quando você registrar despesas.</p>';
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.style.display = "block";
    empty.textContent = "Cadastre despesas para ver o resumo.";
    target.append(empty);
    return;
  }

  let accumulated = 0;
  const slices = rows.map(([, value], index) => {
    const start = accumulated;
    accumulated += (value / total) * 100;
    return `${palette[index % palette.length]} ${start}% ${accumulated}%`;
  });
  pieChart.style.background = `conic-gradient(${slices.join(", ")})`;
  pieChart.setAttribute("aria-label", `Gráfico com ${rows.length} categorias e total de ${money(total)}`);

  rows.forEach(([category, value], index) => {
    const percent = total > 0 ? (value / total) * 100 : 0;
    const color = palette[index % palette.length];
    const legendItem = document.createElement("div");
    legendItem.className = "destination-legend-item";
    legendItem.innerHTML = `
      <i style="--category-color: ${color}" aria-hidden="true"></i>
      <span>${escapeHTML(category)}</span>
      <strong>${percent.toFixed(0)}%</strong>
    `;
    legend.append(legendItem);
    const row = document.createElement("div");
    row.className = "category-row";
    row.innerHTML = `
      <header>
        <span><i style="--category-color: ${color}" aria-hidden="true"></i><strong>${escapeHTML(category)}</strong></span>
        <strong>${money(value)} <small>${percent.toFixed(0)}%</small></strong>
      </header>
      <div class="bar" aria-label="${escapeHTML(category)} representa ${percent.toFixed(0)} por cento"><span style="width: ${percent}%; --category-color: ${color}"></span></div>
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
    tr.className = `transaction-row ${item.type === "income" ? "income-row" : "expense-row"}`;
    const dateLabel = item.frequency === "monthly"
      ? `Desde ${item.date.split("-").reverse().join("/")}`
      : item.date.split("-").reverse().join("/");
    tr.innerHTML = `
      <td data-label="Data">${dateLabel}</td>
      <td data-label="Descricao">
        <strong class="record-title"><i data-lucide="${item.type === "income" ? "arrow-down-left" : "arrow-up-right"}" aria-hidden="true"></i>${escapeHTML(item.description)}</strong>
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
