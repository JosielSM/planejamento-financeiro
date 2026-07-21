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
  if (!categoryManager.hidden) {
    resetCategoryEditor();
    renderCategoryManager();
  }
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
  setCategoryManagerOpen(false);
  syncModalOpenState();
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
  syncModalOpenState();
}
