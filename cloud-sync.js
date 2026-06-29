(() => {
  const REPO = "FreDCFR8/Pokemon-Manager";
  const BRANCH = "main";
  const DATA_PATH = "collection.json";
  const TOKEN_KEY = "pokemon-manager-github-token";
  const AUTO_LOAD_KEY = "pokemon-manager-cloud-autoload";
  const RAW_URL = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${DATA_PATH}`;
  const API_URL = `https://api.github.com/repos/${REPO}/contents/${DATA_PATH}`;

  let cloudSaveTimer = null;
  let isCloudLoading = false;
  let isCloudSaving = false;

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function setStatus(message, tone = "") {
    const el = document.querySelector("#cloudStatus");
    if (!el) return;
    el.textContent = message;
    el.dataset.tone = tone;
  }

  function encodeBase64Unicode(value) {
    return btoa(unescape(encodeURIComponent(value)));
  }

  function cloudHeaders(token) {
    return {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    };
  }

  function installCloudUi() {
    const actions = document.querySelector(".top-actions");
    if (!actions || document.querySelector("#cloudLoadBtn")) return;

    const tokenBtn = document.createElement("button");
    tokenBtn.id = "cloudTokenBtn";
    tokenBtn.className = "icon-button cloud-button";
    tokenBtn.type = "button";
    tokenBtn.title = "GitHub token instellen";
    tokenBtn.setAttribute("aria-label", "GitHub token instellen");
    tokenBtn.textContent = "🔐";

    const loadBtn = document.createElement("button");
    loadBtn.id = "cloudLoadBtn";
    loadBtn.className = "icon-button cloud-button";
    loadBtn.type = "button";
    loadBtn.title = "Cloud laden";
    loadBtn.setAttribute("aria-label", "Cloud laden");
    loadBtn.textContent = "☁️↓";

    const saveBtn = document.createElement("button");
    saveBtn.id = "cloudSaveBtn";
    saveBtn.className = "icon-button cloud-button";
    saveBtn.type = "button";
    saveBtn.title = "Cloud opslaan";
    saveBtn.setAttribute("aria-label", "Cloud opslaan");
    saveBtn.textContent = "☁️↑";

    actions.append(tokenBtn, loadBtn, saveBtn);

    const status = document.createElement("div");
    status.id = "cloudStatus";
    status.className = "cloud-status";
    status.textContent = getToken() ? "Cloud klaar" : "Cloud: token nodig om op te slaan";
    const topbar = document.querySelector(".topbar");
    if (topbar) topbar.insertAdjacentElement("afterend", status);

    tokenBtn.addEventListener("click", configureToken);
    loadBtn.addEventListener("click", () => loadCloudCollection(true));
    saveBtn.addEventListener("click", () => saveCloudCollection(true));
  }

  function configureToken() {
    const current = getToken();
    const token = prompt(
      "Plak je GitHub token met Contents read/write rechten.\n\nLaat leeg en druk OK om de token te verwijderen.",
      current ? "" : ""
    );
    if (token === null) return;
    if (!token.trim()) {
      localStorage.removeItem(TOKEN_KEY);
      setStatus("Cloud: token verwijderd", "warn");
      return;
    }
    localStorage.setItem(TOKEN_KEY, token.trim());
    localStorage.setItem(AUTO_LOAD_KEY, "1");
    setStatus("Cloud: token opgeslagen op dit toestel", "ok");
  }

  async function loadCloudCollection(manual = false) {
    if (isCloudLoading) return;
    isCloudLoading = true;
    try {
      setStatus("Cloud laden…");
      const response = await fetch(`${RAW_URL}?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("collection.json moet een array zijn");
      cards = data.map(card => ({ ...card, id: card.id || newId() }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
      localStorage.setItem(AUTO_LOAD_KEY, "1");
      render();
      setStatus(`Cloud geladen: ${cards.length} kaarten`, "ok");
    } catch (error) {
      setStatus(`Cloud laden mislukt: ${error.message}`, "error");
      if (manual) alert("Cloud laden is niet gelukt: " + error.message);
    } finally {
      isCloudLoading = false;
    }
  }

  async function fetchCurrentFileSha(token) {
    const response = await fetch(`${API_URL}?ref=${BRANCH}&t=${Date.now()}`, {
      cache: "no-store",
      headers: cloudHeaders(token)
    });
    if (!response.ok) throw new Error(`GitHub bestand ophalen mislukt: ${response.status}`);
    const payload = await response.json();
    return payload.sha;
  }

  async function saveCloudCollection(manual = false) {
    const token = getToken();
    if (!token) {
      setStatus("Cloud opslaan: eerst token instellen", "warn");
      if (manual) alert("Stel eerst je GitHub token in via het slotje 🔐.");
      return;
    }
    if (isCloudSaving) return;
    isCloudSaving = true;
    try {
      setStatus("Cloud opslaan…");
      const sha = await fetchCurrentFileSha(token);
      const content = JSON.stringify(cards, null, 2) + "\n";
      const response = await fetch(API_URL, {
        method: "PUT",
        headers: {
          ...cloudHeaders(token),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "Update Pokemon collection data",
          content: encodeBase64Unicode(content),
          sha,
          branch: BRANCH
        })
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`GitHub opslaan mislukt: ${response.status} ${text.slice(0, 140)}`);
      }
      setStatus(`Cloud opgeslagen: ${cards.length} kaarten`, "ok");
    } catch (error) {
      setStatus(`Cloud opslaan mislukt`, "error");
      if (manual) alert("Cloud opslaan is niet gelukt: " + error.message);
    } finally {
      isCloudSaving = false;
    }
  }

  function scheduleCloudSave() {
    if (!getToken()) return;
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = setTimeout(() => saveCloudCollection(false), 1200);
  }

  const originalSaveCards = saveCards;
  saveCards = function saveCardsAndSync() {
    originalSaveCards();
    scheduleCloudSave();
  };

  installCloudUi();

  if (localStorage.getItem(AUTO_LOAD_KEY) === "1") {
    loadCloudCollection(false);
  }

  window.PokemonCloudSync = {
    load: loadCloudCollection,
    save: saveCloudCollection,
    configureToken
  };
})();
