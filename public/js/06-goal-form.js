function resetSavingsGoalForm() {
  savingsGoalForm.reset();
  editingSavingsGoalId = null;
  savingsGoalSubmitButton.textContent = "Concluir";
}

function setSavingsGoalFormOpen(isOpen, goal = null) {
  savingsGoalModal.hidden = !isOpen;
  savingsGoalToggleButton.setAttribute("aria-expanded", String(isOpen));

  if (!isOpen) {
    resetSavingsGoalForm();
    syncModalOpenState();
    savingsGoalToggleButton.focus();
    return;
  }

  document.body.classList.add("modal-open");

  if (goal) {
    editingSavingsGoalId = goal.id;
    document.querySelector("#savingsGoalName").value = goal.name;
    document.querySelector("#savingsGoalTarget").value = goal.targetAmount;
    document.querySelector("#savingsGoalNote").value = goal.note || "";
    savingsGoalSubmitButton.textContent = "Salvar alteracoes";
    savingsGoalModalTitle.textContent = "Editar meta";
  } else {
    resetSavingsGoalForm();
    savingsGoalModalTitle.textContent = "Nova meta";
  }

  setTimeout(() => document.querySelector("#savingsGoalName").focus(), 80);
}
