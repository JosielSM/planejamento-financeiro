newCategoryButton.addEventListener("click", () => {
  resetCategoryEditor();
  setCategoryManagerOpen(true, true);
});

manageCategoriesButton.addEventListener("click", () => {
  setCategoryManagerOpen(categoryManager.hidden, false);
});

closeCategoryManagerButton.addEventListener("click", () => {
  setCategoryManagerOpen(false);
});

cancelCategoryEditButton.addEventListener("click", () => {
  resetCategoryEditor();
  renderCategoryManager();
  customCategoryName.focus();
});

customCategoryName.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  saveCategoryButton.click();
});

saveCategoryButton.addEventListener("click", async () => {
  const type = currentCategoryType();
  const name = customCategoryName.value.trim();
  if (name.length < 2 || name.length > 40) {
    await showNotice("Informe um nome entre 2 e 40 caracteres.", "Nome da categoria", "warning");
    customCategoryName.focus();
    return;
  }

  const duplicate = [
    ...categories[type],
    ...customCategories.filter((item) => item.type === type && item.id !== editingCategoryId).map((item) => item.name),
  ].some((item) => item.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"));
  if (duplicate) {
    await showNotice("Esta categoria ja existe.", "Categoria duplicada", "warning");
    customCategoryName.focus();
    return;
  }

  saveCategoryButton.disabled = true;
  try {
    const saved = editingCategoryId
      ? await updateCustomCategory(editingCategoryId, name)
      : await createCustomCategory(type, name);
    resetCategoryEditor();
    updateCategoryOptions(saved.name);
    renderCategoryManager();
    render();
  } catch (error) {
    await showNotice(error.message || "Nao foi possivel salvar a categoria.", "Erro ao salvar", "error");
  } finally {
    saveCategoryButton.disabled = false;
  }
});

customCategoryList.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-category-edit]");
  if (editButton) {
    const category = customCategories.find((item) => item.id === editButton.dataset.categoryEdit);
    if (!category) return;
    editingCategoryId = category.id;
    customCategoryName.value = category.name;
    saveCategoryButton.textContent = "Salvar alteracao";
    cancelCategoryEditButton.hidden = false;
    renderCategoryManager();
    customCategoryName.focus();
    return;
  }

  const deleteButton = event.target.closest("[data-category-delete]");
  if (!deleteButton) return;
  const category = customCategories.find((item) => item.id === deleteButton.dataset.categoryDelete);
  if (!category) return;
  const confirmed = await askConfirmation({
    title: "Excluir categoria?",
    message: `A categoria "${category.name}" sera removida. Esta acao nao pode ser desfeita.`,
    confirmLabel: "Excluir categoria",
  });
  if (!confirmed) return;

  try {
    await deleteCustomCategory(category.id);
    resetCategoryEditor();
    updateCategoryOptions();
    renderCategoryManager();
  } catch (error) {
    await showNotice(error.message || "Nao foi possivel excluir a categoria.", "Categoria nao excluida", "error");
  }
});

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
  setSavingsGoalFormOpen(savingsGoalModal.hidden);
});

savingsGoalCancelButton.addEventListener("click", () => {
  setSavingsGoalFormOpen(false);
});

savingsGoalModal.addEventListener("click", (event) => {
  if (event.target.closest("[data-close-savings-goal-modal]")) {
    setSavingsGoalFormOpen(false);
  }
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
  const completeButton = event.target.closest("[data-goal-complete]");
  if (completeButton) {
    await completeSavingsGoal(completeButton.dataset.goalComplete);
    return;
  }

  const editButton = event.target.closest("[data-goal-edit]");
  if (editButton) {
    const goal = savingsGoals.find((item) => item.id === editButton.dataset.goalEdit);
    if (goal) setSavingsGoalFormOpen(true, goal);
    return;
  }

  const button = event.target.closest("[data-goal-delete]");
  if (!button) return;
  const confirmed = await askConfirmation({
    title: "Excluir meta?",
    message: "A meta e todo o historico de depositos dela serao removidos. Esta acao nao pode ser desfeita.",
    confirmLabel: "Excluir meta",
  });
  if (!confirmed) return;
  await deleteSavingsGoal(button.dataset.goalDelete);
});

completedGoalsList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-goal-delete]");
  if (!button) return;
  const confirmed = await askConfirmation({
    title: "Excluir do historico?",
    message: "A meta concluida e todo o historico de depositos dela serao removidos. Esta acao nao pode ser desfeita.",
    confirmLabel: "Excluir meta",
  });
  if (confirmed) await deleteSavingsGoal(button.dataset.goalDelete);
});

recordsBody.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-id]");
  if (!button) return;

  const transaction = transactions.find((item) => item.id === button.dataset.id);
  const transactionLabel = transaction
    ? `\"${transaction.description}\" no valor de ${money(transaction.amount)}`
    : "este registro";

  const confirmed = await askConfirmation({
    title: "Excluir registro?",
    message: `Voce esta prestes a excluir ${transactionLabel}. Esta acao nao pode ser desfeita.`,
    confirmLabel: "Excluir registro",
  });
  if (!confirmed) return;
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
    await showNotice("Escolha um mes para gerar o relatorio.", "Periodo obrigatorio", "warning");
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
  const enteredPassword = document.querySelector("#loginPassword").value;
  try {
    const credential = await firebaseAuth.signInWithEmailAndPassword(
      document.querySelector("#loginEmail").value.trim(),
      enteredPassword,
    );
    const loaded = await loadAuthenticatedUser(credential.user);
    if (loaded && !isStrongPassword(enteredPassword)) {
      await showNotice(
        "Sua senha atual não atende aos novos requisitos de segurança. Você ainda pode usar o sistema, mas recomendamos alterá-la agora em Perfil > Alterar senha.",
        "Atualize sua senha",
        "warning",
      );
    }
  } catch (error) {
    authError.textContent = firebaseErrorMessage(error);
  }
});

googleSignInButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    authError.textContent = "";
    googleSignInButtons.forEach((item) => { item.disabled = true; });
    try {
      const provider = new window.firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await firebaseAuth.signInWithPopup(provider);
      await loadAuthenticatedUser(credential.user);
    } catch (error) {
      if (error.code === "auth/internal-error") {
        sessionStorage.setItem("googleAuthAction", "signin");
        await firebaseAuth.signInWithRedirect(provider);
        return;
      }
      authError.textContent = firebaseErrorMessage(error);
    } finally {
      googleSignInButtons.forEach((item) => { item.disabled = false; });
    }
  });
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authError.textContent = "";
  const name = document.querySelector("#signupName").value.trim();
  const email = document.querySelector("#signupEmail").value.trim();
  const password = signupPassword.value;
  const confirmation = signupPasswordConfirmation.value;

  if (!isStrongPassword(password)) {
    authError.textContent = "Complete todos os requisitos de segurança da senha.";
    signupPassword.focus();
    return;
  }
  if (password !== confirmation) {
    authError.textContent = "A confirmação precisa ser igual à senha.";
    signupPasswordConfirmation.focus();
    return;
  }

  try {
    const credential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
    await credential.user.updateProfile({ displayName: name });
    await credential.user.sendEmailVerification();
    showVerification(credential.user);
  } catch (error) {
    authError.textContent = firebaseErrorMessage(error);
  }
});

signupPassword.addEventListener("input", updatePasswordGuidance);
signupPasswordConfirmation.addEventListener("input", updatePasswordGuidance);

passwordVisibilityButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.passwordToggle);
    if (!input) return;
    const willShow = input.type === "password";
    input.type = willShow ? "text" : "password";
    button.setAttribute("aria-pressed", String(willShow));
    button.setAttribute("aria-label", willShow ? "Ocultar senha" : "Mostrar senha");
    button.querySelector("[data-lucide]")?.setAttribute("data-lucide", willShow ? "eye-off" : "eye");
    refreshIcons();
    input.focus();
  });
});

forgotPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authError.textContent = "";
  const email = document.querySelector("#forgotPasswordEmail").value.trim();
  try {
    await firebaseAuth.sendPasswordResetEmail(email);
  } catch (error) {
    if (error.code !== "auth/user-not-found") {
      authError.textContent = firebaseErrorMessage(error);
      return;
    }
  }
  setAuthMode("login");
  authError.textContent = "Se existir uma conta com esse email, enviaremos o link de recuperacao.";
});

showSignupButton.addEventListener("click", () => {
  setAuthMode("signup");
});

showLoginButton.addEventListener("click", () => {
  setAuthMode("login");
});

showForgotPasswordButton.addEventListener("click", () => {
  document.querySelector("#forgotPasswordEmail").value = document.querySelector("#loginEmail").value;
  setAuthMode("forgot");
});

backToLoginButton.addEventListener("click", () => {
  setAuthMode("login");
});

checkVerificationButton.addEventListener("click", async () => {
  authError.textContent = "";
  try {
    await loadAuthenticatedUser(firebaseAuth.currentUser);
  } catch (error) {
    authError.textContent = error.message || "Nao foi possivel confirmar seu email.";
  }
});

resendVerificationButton.addEventListener("click", async () => {
  authError.textContent = "";
  try {
    await firebaseAuth.currentUser?.sendEmailVerification();
    verificationMessage.textContent = `Enviamos um novo link de confirmacao para ${firebaseAuth.currentUser?.email}.`;
  } catch (error) {
    authError.textContent = firebaseErrorMessage(error);
  }
});

verificationLogoutButton.addEventListener("click", async () => {
  await firebaseAuth.signOut();
  showAuth("Entre com outra conta.");
});

logoutButton.addEventListener("click", async () => {
  closeProfileModal();
  await firebaseAuth.signOut();
  transactions = [];
  savingsGoals = [];
  customCategories = [];
  settings = loadSettings();
  showAuth("Voce saiu da conta.");
});

profileButton.addEventListener("click", openProfileModal);
closeProfileButton.addEventListener("click", closeProfileModal);
profileModal.addEventListener("click", (event) => {
  if (event.target.closest("[data-profile-close]")) closeProfileModal();
});

includeSundaysToggle.addEventListener("change", async () => {
  const previousValue = Boolean(settings.includeSundays);
  const nextValue = includeSundaysToggle.checked;
  includeSundaysToggle.disabled = true;
  settings.includeSundays = nextValue;
  render();

  try {
    await saveSetting("includeSundays", nextValue);
  } catch {
    settings.includeSundays = previousValue;
    includeSundaysToggle.checked = previousValue;
    render();
    await showNotice("Nao foi possivel salvar essa preferencia. Tente novamente.", "Preferencia nao salva", "error");
  } finally {
    includeSundaysToggle.disabled = false;
  }
});

profilePasswordResetButton.addEventListener("click", async () => {
  const currentUser = firebaseAuth?.currentUser;
  if (!currentUser?.email || !hasPasswordProvider(currentUser)) {
    await showNotice("Esta conta usa o acesso pelo Google. A senha deve ser alterada na sua Conta Google.", "Senha administrada pelo Google", "info");
    return;
  }

  profilePasswordResetButton.disabled = true;
  profilePasswordResetButton.textContent = "Enviando...";
  try {
    await firebaseAuth.sendPasswordResetEmail(currentUser.email);
    await showNotice(
      `Enviamos um link seguro para ${currentUser.email}. Abra o e-mail e siga as instruções para definir uma nova senha.`,
      "Confira seu e-mail",
      "success",
    );
  } catch (error) {
    await showNotice(firebaseErrorMessage(error), "Não foi possível enviar o link", "error");
  } finally {
    profilePasswordResetButton.disabled = false;
    profilePasswordResetButton.textContent = "Alterar senha";
  }
});

linkGoogleButton.addEventListener("click", async () => {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) return;

  linkGoogleButton.disabled = true;
  try {
    const provider = new window.firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    sessionStorage.setItem("googleAuthAction", "link");
    await currentUser.linkWithRedirect(provider);
  } catch (error) {
    if (error.code === "auth/provider-already-linked") {
      linkGoogleButton.hidden = true;
      googleLinkStatus.textContent = "Vinculada";
      googleLinkStatus.classList.add("linked");
      await showNotice("Sua conta Google ja esta vinculada.", "Google vinculado", "success");
    } else if (error.code === "auth/credential-already-in-use") {
      await showNotice("Esta conta Google ja esta vinculada a outro usuario.", "Conta em uso", "error");
    } else {
      await showNotice(firebaseErrorMessage(error), "Erro no Google", "error");
    }
  } finally {
    linkGoogleButton.disabled = false;
  }
});

systemDialogConfirmButton.addEventListener("click", () => {
  closeSystemDialog(true);
});

systemDialogCancelButton.addEventListener("click", () => {
  closeSystemDialog(false);
});

systemDialog.addEventListener("click", (event) => {
  if (event.target.closest("[data-system-dialog-cancel]")) closeSystemDialog(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !systemDialog.hidden) {
    closeSystemDialog(false);
    return;
  }
  if (event.key === "Escape" && !profileModal.hidden) {
    closeProfileModal();
    return;
  }
  if (event.key === "Escape" && !savingsGoalModal.hidden) {
    setSavingsGoalFormOpen(false);
    return;
  }
  if (event.key === "Escape" && !transactionModal.hidden) {
    closeTransactionModal();
  }
  if (event.key === "Escape" && !pdfSummaryModal.hidden) {
    closePdfSummaryModal();
  }
});

themeToggleButton.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme, true);
});

async function start() {
  applyTheme(preferredTheme());
  monthFilter.value = monthISO();
  resetForm();
  pdfMonthInput.value = monthISO();

  try {
    if (window.location.protocol === "file:") {
      throw new Error("Abra o sistema pelo endereco online ou pelo servidor local, nao diretamente pelo arquivo index.html");
    }
    const health = await fetch("/api/health").then((response) => response.json());
    authRequired = health.database === "connected" && health.firebase === "configured";
    if (!authRequired) throw new Error("Banco de dados ou Firebase ainda nao configurado");

    await initializeFirebase();
    const googleAuthAction = sessionStorage.getItem("googleAuthAction");
    let redirectResult = null;
    try {
      redirectResult = await firebaseAuth.getRedirectResult();
      sessionStorage.removeItem("googleAuthAction");
    } catch (error) {
      sessionStorage.removeItem("googleAuthAction");
      showAuth(firebaseErrorMessage(error));
      refreshIcons();
      return;
    }
    const initialUser = await new Promise((resolve, reject) => {
      const unsubscribe = firebaseAuth.onAuthStateChanged(
        (user) => {
          unsubscribe();
          resolve(user);
        },
        reject,
      );
    });
    const loaded = await loadAuthenticatedUser(redirectResult?.user || initialUser);
    if (loaded && googleAuthAction === "link") {
      await showNotice("Conta Google vinculada. Agora voce pode entrar com Google ou com sua senha.", "Google vinculado", "success");
    }
  } catch (error) {
    showAuth(`Autenticacao indisponivel: ${error.message}`);
    refreshIcons();
  }
}

start();
