(function init() {
  const USER_STORAGE_KEY = "responderforms:user";
  const ADMIN_STORAGE_KEY = "responderforms:adminFixedAnswers";

  const form = document.getElementById("responder-form");
  const message = document.getElementById("message");
  const clearButton = document.getElementById("clear-user");
  const adminPanel = document.getElementById("admin-panel");
  const adminFields = document.getElementById("admin-fields");
  const saveAdminButton = document.getElementById("save-admin");

  hydrateSavedUser();
  initAdminPanel();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const config = window.FORM_CONFIG || {};
    const name = form.name.value.trim();
    const email = form.email.value.trim();

    if (!isValidConfig(config)) {
      setMessage("Configuração inválida. Revise o arquivo config.js.", true);
      return;
    }

    if (!name || !isValidEmail(email)) {
      setMessage("Informe nome e um email válido.", true);
      return;
    }

    saveUser(name, email);

    setMessage("Enviando...", false);
    setSubmitting(true);

    const payload = new URLSearchParams();
    payload.append(config.nameEntryId, name);
    payload.append(config.emailEntryId, email);

    const fixedAnswers = getMergedFixedAnswers(config.fixedAnswers || {});
    Object.entries(fixedAnswers).forEach(([entryId, value]) => {
      payload.append(entryId, String(value));
    });

    try {
      await fetch(`https://docs.google.com/forms/d/e/${config.formId}/formResponse`, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: payload.toString(),
      });

      setMessage("Enviado com sucesso.", false, true);
    } catch {
      setMessage("Falha no envio. Verifique internet e tente novamente.", true);
    } finally {
      setSubmitting(false);
    }
  });

  form.name.addEventListener("blur", () => maybeSaveCurrentUser());
  form.email.addEventListener("blur", () => maybeSaveCurrentUser());

  clearButton.addEventListener("click", () => {
    localStorage.removeItem(USER_STORAGE_KEY);
    form.reset();
    setMessage("Dados removidos. Informe novo nome e email.", false, true);
  });

  function maybeSaveCurrentUser() {
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    if (name && isValidEmail(email)) {
      saveUser(name, email);
    }
  }

  function hydrateSavedUser() {
    const user = readJSON(USER_STORAGE_KEY);
    if (user && user.name && user.email) {
      form.name.value = user.name;
      form.email.value = user.email;
      setMessage("Dados carregados. Você pode apenas clicar em Enviar.", false, true);
    }
  }

  function saveUser(name, email) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({ name, email }));
  }

  function getMergedFixedAnswers(baseFixedAnswers) {
    const adminOverrides = readJSON(ADMIN_STORAGE_KEY) || {};
    return { ...baseFixedAnswers, ...adminOverrides };
  }

  function initAdminPanel() {
    const query = new URLSearchParams(window.location.search);
    const isAdminMode = query.get("admin") === "1";
    if (!isAdminMode) return;

    adminPanel.classList.remove("hidden");
    renderAdminFields();

    saveAdminButton.addEventListener("click", () => {
      const values = {};
      const inputs = adminFields.querySelectorAll("textarea[data-entry-id]");
      inputs.forEach((input) => {
        const entryId = input.getAttribute("data-entry-id");
        values[entryId] = input.value;
      });

      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(values));
      setMessage("Respostas fixas do admin salvas com sucesso.", false, true);
      renderAdminFields();
    });
  }

  function renderAdminFields() {
    const config = window.FORM_CONFIG || {};
    const merged = getMergedFixedAnswers(config.fixedAnswers || {});

    const entries = Object.entries(merged);
    if (!entries.length) {
      adminFields.innerHTML =
        '<p>Sem respostas fixas configuradas. Adicione no config.js primeiro.</p>';
      return;
    }

    adminFields.innerHTML = entries
      .map(
        ([entryId, value]) => `
          <div class="admin-field">
            <label for="admin-${entryId}">${entryId}</label>
            <textarea id="admin-${entryId}" data-entry-id="${entryId}" rows="2">${escapeHtml(
          String(value)
        )}</textarea>
          </div>
        `
      )
      .join("");
  }

  function isValidConfig(config) {
    return (
      typeof config.formId === "string" &&
      config.formId.startsWith("1FAIpQL") &&
      typeof config.nameEntryId === "string" &&
      config.nameEntryId.startsWith("entry.") &&
      typeof config.emailEntryId === "string" &&
      config.emailEntryId.startsWith("entry.")
    );
  }

  function isValidEmail(value) {
    return /.+@.+\..+/.test(value);
  }

  function readJSON(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  }

  function escapeHtml(value) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function setSubmitting(flag) {
    form.querySelector("button[type='submit']").disabled = flag;
  }

  function setMessage(text, isError, isSuccess) {
    message.textContent = text;
    message.classList.toggle("error", !!isError);
    message.classList.toggle("success", !!isSuccess);
  }
})();
