(function init() {
  const USER_STORAGE_KEY = "responderforms:user";
  const ADMIN_STORAGE_KEY = "responderforms:adminFixedAnswers";
  const FORM_SCHEMA_KEY = "responderforms:formSchema";
  const ADMIN_AUTH_KEY = "responderforms:adminAuth";
  const TEMA_ENTRY_ID = "entry.976109499";

  const form = document.getElementById("responder-form");
  const message = document.getElementById("message");
  const userPanel = document.getElementById("user-panel");
  const adminPanel = document.getElementById("admin-panel");
  const adminFields = document.getElementById("admin-fields");
  const saveAdminButton = document.getElementById("save-admin");
  const adminMessage = document.getElementById("admin-message");
  const adminLoginForm = document.getElementById("admin-login-form");
  const adminLoginCancel = document.getElementById("admin-login-cancel");
  const logoutAdminButton = document.getElementById("logout-admin");
  const submissionsStatus = document.getElementById("submissions-status");
  const submissionsTableBody = document.querySelector("#submissions-table tbody");

  hydrateSavedUser();
  initUserActions();
  initLoginMode();
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

  function initLoginMode() {
    const query = new URLSearchParams(window.location.search);
    const isAdminLoginMode = query.get("admin") === "login";
    if (!isAdminLoginMode) return;

    adminLoginForm.classList.remove("hidden");
    adminLoginForm.querySelector("#admin-user").focus();
  }

  function initUserActions() {
    form.name.addEventListener("blur", () => maybeSaveCurrentUser());
    form.email.addEventListener("blur", () => maybeSaveCurrentUser());

    adminLoginCancel.addEventListener("click", () => {
      adminLoginForm.reset();
      window.location.search = "";
    });

    adminLoginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const login = adminLoginForm["admin-user"].value.trim();
      const password = adminLoginForm["admin-pass"].value.trim();

      if (login === "admin" && password === "admin123") {
        localStorage.setItem(ADMIN_AUTH_KEY, "1");
        window.location.search = "?admin=1";
        return;
      }

      setMessage("Login admin inválido.", true);
    });
  }

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

    if (localStorage.getItem(ADMIN_AUTH_KEY) !== "1") {
      window.location.search = "?admin=login";
      return;
    }

    adminPanel.classList.remove("hidden");
    userPanel.classList.add("hidden");

    loadSchemaAndRender().then(() => {
      applyTemaLastFiveOptions();
      renderAdminFields();
    });
    loadSubmittedUsers();

    saveAdminButton.addEventListener("click", () => {
      const values = {};
      const inputs = adminFields.querySelectorAll("textarea[data-entry-id]");
      inputs.forEach((input) => {
        const entryId = input.getAttribute("data-entry-id");
        values[entryId] = input.value;
      });

      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(values));
      setAdminMessage("Respostas fixas do admin salvas com sucesso.");
      renderAdminFields();
    });

    logoutAdminButton.addEventListener("click", () => {
      localStorage.removeItem(ADMIN_AUTH_KEY);
      window.location.search = "";
    });
  }

  function applyTemaLastFiveOptions() {
    const schema = readJSON(FORM_SCHEMA_KEY);
    if (!schema?.fields) return;

    const tema = schema.fields.find((field) => field.entryId === TEMA_ENTRY_ID);
    if (!tema || !Array.isArray(tema.options) || tema.options.length === 0) return;

    const lastFive = tema.options.slice(-5);
    tema.options = lastFive;
    localStorage.setItem(FORM_SCHEMA_KEY, JSON.stringify(schema));
  }

  async function loadSubmittedUsers() {
    const config = window.FORM_CONFIG || {};
    const csvUrl = config.responsesCsvUrl;

    if (!csvUrl) {
      submissionsStatus.textContent =
        "Defina responsesCsvUrl no config.js para listar usuários enviados.";
      submissionsTableBody.innerHTML = "";
      return;
    }

    try {
      const response = await fetch(csvUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const csvText = await response.text();
      const rows = parseCsv(csvText);
      if (!rows.length) {
        submissionsStatus.textContent = "Nenhum envio encontrado.";
        submissionsTableBody.innerHTML = "";
        return;
      }

      const headers = rows[0].map((h) => h.trim().toLowerCase());
      const nameIdx = headers.findIndex((h) => h.includes("nome"));
      const emailIdx = headers.findIndex((h) => h.includes("mail"));
      const dateIdx = headers.findIndex((h) => h.includes("carimbo") || h.includes("data"));

      const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim()));
      submissionsTableBody.innerHTML = dataRows
        .map((r) => {
          const name = escapeHtml(r[nameIdx] || "-");
          const email = escapeHtml(r[emailIdx] || "-");
          const date = escapeHtml(r[dateIdx] || "-");
          return `<tr><td>${name}</td><td>${email}</td><td>${date}</td></tr>`;
        })
        .join("");

      submissionsStatus.textContent = `${dataRows.length} envio(s) carregado(s).`;
    } catch {
      submissionsStatus.textContent =
        "Não foi possível carregar a lista de usuários. Verifique responsesCsvUrl.";
      submissionsTableBody.innerHTML = "";
    }
  }

  function parseCsv(text) {
    const rows = [];
    let current = "";
    let row = [];
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        row.push(current);
        current = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") i += 1;
        row.push(current);
        rows.push(row);
        row = [];
        current = "";
      } else {
        current += char;
      }
    }

    if (current.length > 0 || row.length > 0) {
      row.push(current);
      rows.push(row);
    }

    return rows;
  }

  function setAdminMessage(text) {
    if (!adminMessage) return;
    adminMessage.textContent = text;
    adminMessage.classList.add("success");
  }

  function renderAdminFields() {
    const config = window.FORM_CONFIG || {};
    const merged = getMergedFixedAnswers(config.fixedAnswers || {});
    const schema = readJSON(FORM_SCHEMA_KEY);
    const schemaMap = new Map((schema?.fields || []).map((field) => [field.entryId, field]));

    const entries = Object.entries(merged);
    if (!entries.length) {
      adminFields.innerHTML =
        '<p>Sem respostas fixas configuradas. Adicione no config.js primeiro.</p>';
      return;
    }

    adminFields.innerHTML = entries
      .map(([entryId, value]) => {
        const schemaField = schemaMap.get(entryId);
        const label = schemaField?.label || entryId;
        const options = schemaField?.options || [];
        const currentValue = String(value ?? "");

        if (options.length > 0) {
          const hasCurrent = options.includes(currentValue);
          const optionTags = [
            '<option value="">Respostas</option>',
            ...(!hasCurrent && currentValue
              ? [
                  `<option value="${escapeHtml(currentValue)}">${escapeHtml(
                    currentValue
                  )} (atual)</option>`,
                ]
              : []),
            ...options.map(
              (option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`
            ),
          ].join("");

          return `
            <div class="admin-field">
              <label for="admin-${entryId}">${escapeHtml(label)} <small>(${entryId})</small></label>
              <textarea id="admin-${entryId}" data-entry-id="${entryId}" rows="2">${escapeHtml(
            currentValue
          )}</textarea>
              <select class="admin-option-picker" data-entry-option-for="${entryId}">${optionTags}</select>
            </div>
          `;
        }

        return `
          <div class="admin-field">
            <label for="admin-${entryId}">${escapeHtml(label)} <small>(${entryId})</small></label>
            <textarea id="admin-${entryId}" data-entry-id="${entryId}" rows="2">${escapeHtml(
          currentValue
        )}</textarea>
          </div>
        `;
      })
      .join("");

    bindOptionPickers();
  }

  function bindOptionPickers() {
    const pickers = adminFields.querySelectorAll("select.admin-option-picker[data-entry-option-for]");
    pickers.forEach((picker) => {
      picker.addEventListener("change", () => {
        const entryId = picker.getAttribute("data-entry-option-for");
        const target = adminFields.querySelector(`textarea[data-entry-id="${entryId}"]`);
        if (!target || !picker.value) return;
        target.value = picker.value;
      });
    });
  }

  async function loadSchemaAndRender() {
    try {
      const response = await fetch("form-schema.json", { cache: "no-store" });
      if (response.ok) {
        const schema = await response.json();
        localStorage.setItem(FORM_SCHEMA_KEY, JSON.stringify(schema));
      }
    } catch {
      // segue com schema do cache/local
    }

    renderAdminFields();
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
    return String(value)
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
