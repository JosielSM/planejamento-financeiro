const title = document.querySelector("#actionTitle");
const message = document.querySelector("#actionMessage");
const loader = document.querySelector("#actionLoader");
const resetForm = document.querySelector("#resetPasswordForm");
const password = document.querySelector("#newPassword");
const passwordConfirmation = document.querySelector("#newPasswordConfirmation");
const returnLink = document.querySelector("#returnToApp");
let resetSubmitting = false;

function finish(actionTitle, actionMessage, { showReturn = true } = {}) {
  title.textContent = actionTitle;
  message.textContent = actionMessage;
  loader.hidden = true;
  returnLink.hidden = !showReturn;
}

function strongPassword(value) {
  return value.length >= 10
    && /[a-z]/.test(value)
    && /[A-Z]/.test(value)
    && /[0-9]/.test(value)
    && /[^A-Za-z0-9\s]/.test(value);
}

async function initializeAction() {
  try {
    const response = await fetch("/api/config/firebase", { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error("Configuração indisponível");
    const config = await response.json();
    window.firebase.initializeApp(config);
    const auth = window.firebase.auth();
    auth.languageCode = "pt-BR";
    const parameters = new URLSearchParams(window.location.search);
    const mode = parameters.get("mode");
    const code = parameters.get("oobCode");
    if (!code) throw new Error("Código de segurança ausente");

    if (mode === "verifyEmail") {
      await auth.applyActionCode(code);
      finish("E-mail confirmado!", "Sua conta está pronta. Agora você já pode entrar no Planejamento Financeiro.");
      return;
    }
    if (mode === "recoverEmail") {
      await auth.applyActionCode(code);
      finish("E-mail recuperado", "O endereço anterior foi restaurado com segurança.");
      return;
    }
    if (mode === "resetPassword") {
      await auth.verifyPasswordResetCode(code);
      title.textContent = "Crie uma nova senha";
      message.textContent = "Use pelo menos 10 caracteres, com maiúscula, minúscula, número e símbolo.";
      loader.hidden = true;
      resetForm.hidden = false;
      resetForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (resetSubmitting) return;
        if (!strongPassword(password.value)) {
          message.textContent = "A senha ainda não atende a todos os requisitos de segurança.";
          return;
        }
        if (password.value !== passwordConfirmation.value) {
          message.textContent = "As duas senhas precisam ser iguais.";
          return;
        }
        const submit = resetForm.querySelector("button");
        resetSubmitting = true;
        submit.disabled = true;
        submit.textContent = "Salvando...";
        try {
          await auth.confirmPasswordReset(code, password.value);
          resetForm.hidden = true;
          finish("Senha atualizada!", "Sua nova senha foi salva. Você já pode voltar e entrar na conta.");
        } catch {
          finish("Não foi possível atualizar", "Este link expirou ou já foi utilizado. Solicite uma nova recuperação de senha.");
        } finally {
          resetSubmitting = false;
        }
      });
      return;
    }
    throw new Error("Tipo de ação desconhecido");
  } catch {
    finish("Link inválido ou expirado", "Solicite um novo e-mail no aplicativo para continuar com segurança.");
  }
}

initializeAction();
