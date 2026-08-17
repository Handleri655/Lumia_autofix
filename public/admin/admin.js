const loginPanel = document.getElementById("login-panel");
const editorPanels = document.getElementById("editor-panels");
const topActions = document.getElementById("top-actions");
const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");
const saveStatus = document.getElementById("save-status");
const offersStatus = document.getElementById("offers-status");
const servicesBody = document.getElementById("services-body");
const offersEditor = document.getElementById("offers-editor");
const saveBtn = document.getElementById("save-btn");
const saveOffersBtn = document.getElementById("save-offers-btn");
const addOfferBtn = document.getElementById("add-offer-btn");
const logoutBtn = document.getElementById("logout-btn");

const TOKEN_KEY = "lumia_admin_token";

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

function setStatus(el, message, type = "") {
  if (!el) return;
  el.textContent = message || "";
  el.classList.remove("is-error", "is-ok");
  if (type) el.classList.add(type);
}

function isAuthed() {
  return Boolean(getToken()) && document.body.classList.contains("is-authed");
}

function lockToLogin(message = "") {
  setToken(null);
  showEditor(false);
  servicesBody.replaceChildren();
  offersEditor.replaceChildren();
  if (message) setStatus(loginStatus, message, "is-error");
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: "include",
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (res.status === 401 && !path.endsWith("/login")) {
    lockToLogin("Istunto vanhentui. Kirjaudu uudelleen.");
  }

  if (!res.ok) {
    const err = new Error(data?.error || `Virhe ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return data;
}

function showEditor(show) {
  document.body.classList.toggle("is-authed", show);
  loginPanel.hidden = show;
  editorPanels.hidden = !show;
  topActions.hidden = !show;
}

function requireAuthAction() {
  if (isAuthed()) return true;
  lockToLogin("Kirjaudu sisään ennen tallennusta.");
  return false;
}

function renderServices(services) {
  servicesBody.innerHTML = "";
  const frag = document.createDocumentFragment();

  for (const service of services) {
    const tr = document.createElement("tr");
    tr.dataset.id = String(service.id);

    const nameTd = document.createElement("td");
    nameTd.className = "name";
    nameTd.textContent = service.name;

    const priceTd = document.createElement("td");
    priceTd.className = "price";
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 120;
    input.value = service.priceText || "";
    input.setAttribute("aria-label", `Hinta: ${service.name}`);
    priceTd.appendChild(input);

    tr.append(nameTd, priceTd);
    frag.appendChild(tr);
  }

  servicesBody.appendChild(frag);
}

function createOfferCard(offer = {}) {
  const card = document.createElement("article");
  card.className = "offer-edit";
  if (offer.id) card.dataset.id = String(offer.id);

  card.innerHTML = `
    <div class="offer-edit-row">
      <label>
        Otsikko
        <input type="text" name="title" maxlength="120" required />
      </label>
      <label>
        Hinta
        <input type="text" name="priceText" maxlength="120" placeholder="Alk. 99 €" />
      </label>
    </div>
    <label>
      Kuvaus
      <textarea name="description" rows="3" maxlength="500"></textarea>
    </label>
    <div class="offer-edit-footer">
      <label class="check">
        <input type="checkbox" name="active" />
        Näytä sivulla
      </label>
      <button type="button" class="btn btn-ghost btn-small remove-offer">Poista</button>
    </div>
  `;

  card.querySelector('[name="title"]').value = offer.title || "";
  card.querySelector('[name="priceText"]').value = offer.priceText || "";
  card.querySelector('[name="description"]').value = offer.description || "";
  card.querySelector('[name="active"]').checked = offer.active !== false;

  card.querySelector(".remove-offer").addEventListener("click", () => {
    card.remove();
  });

  return card;
}

function renderOffers(offers) {
  offersEditor.replaceChildren();
  if (!offers.length) {
    offersEditor.appendChild(createOfferCard({ active: true }));
    return;
  }
  for (const offer of offers) {
    offersEditor.appendChild(createOfferCard(offer));
  }
}

function collectOffers() {
  return [...offersEditor.querySelectorAll(".offer-edit")].map((card) => {
    const item = {
      title: card.querySelector('[name="title"]').value.trim(),
      description: card.querySelector('[name="description"]').value.trim(),
      priceText: card.querySelector('[name="priceText"]').value.trim(),
      active: card.querySelector('[name="active"]').checked,
    };
    if (card.dataset.id) item.id = Number(card.dataset.id);
    return item;
  });
}

async function loadServices() {
  const data = await api("/api/services");
  renderServices(data.services || []);
}

async function loadOffers() {
  const data = await api("/api/admin/offers");
  renderOffers(data.offers || []);
}

async function loadAll() {
  await Promise.all([loadOffers(), loadServices()]);
}

async function ensureSession() {
  showEditor(false);

  if (!getToken()) {
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
    } catch {
      /* ignore */
    }
    return;
  }

  try {
    await api("/api/admin/me");
    await loadAll();
    showEditor(true);
  } catch {
    lockToLogin();
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(loginStatus, "");
  const password = new FormData(loginForm).get("password");

  try {
    const data = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    setToken(data.token);
    await loadAll();
    showEditor(true);
    loginForm.reset();
  } catch (err) {
    lockToLogin(err.message);
  }
});

saveBtn.addEventListener("click", async () => {
  if (!requireAuthAction()) return;
  setStatus(saveStatus, "");
  saveBtn.disabled = true;

  const services = [...servicesBody.querySelectorAll("tr")].map((tr) => ({
    id: Number(tr.dataset.id),
    priceText: tr.querySelector("input")?.value?.trim() ?? "",
  }));

  try {
    const data = await api("/api/admin/services", {
      method: "PUT",
      body: JSON.stringify({ services }),
    });
    renderServices(data.services || []);
    setStatus(saveStatus, "Hinnat tallennettu.", "is-ok");
  } catch (err) {
    if (err.status !== 401) setStatus(saveStatus, err.message, "is-error");
  } finally {
    saveBtn.disabled = false;
  }
});

saveOffersBtn.addEventListener("click", async () => {
  if (!requireAuthAction()) return;
  setStatus(offersStatus, "");
  saveOffersBtn.disabled = true;

  try {
    const data = await api("/api/admin/offers", {
      method: "PUT",
      body: JSON.stringify({ offers: collectOffers() }),
    });
    renderOffers(data.offers || []);
    setStatus(offersStatus, "Tarjoukset tallennettu. Näkyvät heti sivulla.", "is-ok");
  } catch (err) {
    if (err.status !== 401) setStatus(offersStatus, err.message, "is-error");
  } finally {
    saveOffersBtn.disabled = false;
  }
});

addOfferBtn.addEventListener("click", () => {
  if (!requireAuthAction()) return;
  offersEditor.appendChild(createOfferCard({ active: true }));
});

logoutBtn.addEventListener("click", async () => {
  try {
    await api("/api/admin/logout", { method: "POST", body: "{}" });
  } catch {
    /* ignore */
  }
  lockToLogin();
  setStatus(loginStatus, "Kirjauduttu ulos.", "is-ok");
});

ensureSession();
