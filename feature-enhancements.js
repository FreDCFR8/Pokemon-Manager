(() => {
  const PREFERENCES_PATH = "preferences.json";
  const PREFERENCES_RAW_URL = `https://raw.githubusercontent.com/FreDCFR8/Pokemon-Manager/main/${PREFERENCES_PATH}`;
  const PREFERENCES_API_URL = `https://api.github.com/repos/FreDCFR8/Pokemon-Manager/contents/${PREFERENCES_PATH}`;
  const TOKEN_KEY = "pokemon-manager-github-token";
  const PICK_TIMESTAMPS_KEY = "pokemon-collection-v2-pokedex-pick-timestamps";
  const PRINT_SETTINGS_KEY = "pokemon-collection-v2-wishlist-print-settings";

  let pickTimestamps = loadJson(PICK_TIMESTAMPS_KEY, {});
  let lastSavedPicks = { ...pokedexPicks };
  let preferenceSaveTimer = null;
  let preferencesSaving = false;

  function loadJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value && typeof value === "object" ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function cardDexNumbers(card) {
    return [...(Array.isArray(card.dexNumbers) ? card.dexNumbers : []), ...(Array.isArray(card.nationalPokedexNumbers) ? card.nationalPokedexNumbers : [])]
      .map(Number)
      .filter(Number.isFinite);
  }

  function nameTokens(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/♀/g, " female ")
      .replace(/♂/g, " male ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  function containsTokenSequence(haystack, needle) {
    if (!needle.length || needle.length > haystack.length) return false;
    return haystack.some((_, index) => needle.every((token, offset) => haystack[index + offset] === token));
  }

  function cardBelongsToEntry(card, entry) {
    const dexNumbers = cardDexNumbers(card);
    if (dexNumbers.includes(Number(entry.id))) return true;
    if (dexNumbers.length) return false;
    return containsTokenSequence(nameTokens(card.pokemon), nameTokens(entry.name));
  }

  cardsForPokedexEntry = function cardsForPokedexEntryComplete(entry) {
    return ownedCards()
      .filter(card => cardBelongsToEntry(card, entry))
      .sort((a, b) => String(a.set || "").localeCompare(String(b.set || "")) || String(a.number || "").localeCompare(String(b.number || ""), undefined, { numeric: true }));
  };

  binderSlot = function binderSlotWithPicker(entry) {
    const matches = cardsForPokedexEntry(entry);
    const selected = selectedPokedexCard(entry, matches);
    const image = selected ? cardImageUrl(selected) || spriteUrl(entry) : spriteUrl(entry);
    const type = entry.types[0];
    const pickKey = `${state.activeOwner}::${entry.name.toLowerCase()}`;
    const picker = matches.length > 1
      ? `<select class="binder-card-select" data-pokedex-pick="${pickKey}" aria-label="Kies kaart voor ${entry.name}">${matches.map(card => `<option value="${card.id}" ${selected && selected.id === card.id ? "selected" : ""}>${card.pokemon} · ${card.set} #${card.number || "?"}</option>`).join("")}</select>`
      : `<small>${selected ? selected.set : "Nog niet"}</small>`;

    return `<article class="binder-slot ${selected ? "owned" : "missing"}" ${selected ? `data-detail="${selected.id}"` : ""}>
      <span class="binder-number">#${String(entry.id).padStart(3, "0")}</span>
      ${image ? `<img src="${image}" alt="${entry.name}" />` : `<div class="binder-missing" style="--type-color:${typeColors[type] || "#73808c"}">${entry.name}</div>`}
      <strong>${entry.name}</strong>
      ${picker}
      ${matches.length > 1 ? `<small class="binder-choice-count">${matches.length} kaarten beschikbaar</small>` : ""}
    </article>`;
  };

  function ensureCollectionCount() {
    const strip = document.querySelector("#collection .tool-strip");
    if (!strip) return null;
    let count = document.querySelector("#collectionVisibleCount");
    if (!count) {
      count = document.createElement("span");
      count.id = "collectionVisibleCount";
      count.className = "collection-visible-count";
      count.setAttribute("aria-live", "polite");
      strip.appendChild(count);
    }
    return count;
  }

  const originalRenderCollection = renderCollection;
  renderCollection = function renderCollectionWithCount() {
    originalRenderCollection();
    const visible = filteredCollection("owned");
    const total = activeCards().filter(card => card.status === "owned");
    const visibleCopies = visible.reduce((sum, card) => sum + Number(card.quantity || 1), 0);
    const count = ensureCollectionCount();
    if (!count) return;
    count.textContent = `${visible.length} van ${total.length} kaarten zichtbaar${visibleCopies !== visible.length ? ` · ${visibleCopies} exemplaren` : ""}`;
  };

  function loadPrintSettings() {
    const stored = loadJson(PRINT_SETTINGS_KEY, {});
    return {
      columns: [2, 3, 4].includes(Number(stored.columns)) ? Number(stored.columns) : 3,
      perPage: [4, 6, 8, 9, 12, 16].includes(Number(stored.perPage)) ? Number(stored.perPage) : 9
    };
  }

  function ensureWishlistPrintControls() {
    const modes = document.querySelector("#wishlistModes");
    if (!modes || document.querySelector("#wishlistPrintGrid")) return;
    const settings = loadPrintSettings();
    const controls = document.createElement("div");
    controls.className = "wishlist-print-options";
    controls.innerHTML = `
      <label>Raster
        <select id="wishlistPrintGrid" aria-label="Aantal kolommen bij afdrukken">
          <option value="2" ${settings.columns === 2 ? "selected" : ""}>2 kolommen</option>
          <option value="3" ${settings.columns === 3 ? "selected" : ""}>3 kolommen</option>
          <option value="4" ${settings.columns === 4 ? "selected" : ""}>4 kolommen</option>
        </select>
      </label>
      <label>Per pagina
        <select id="wishlistPrintPerPage" aria-label="Aantal kaarten per pagina">
          ${[4, 6, 8, 9, 12, 16].map(value => `<option value="${value}" ${settings.perPage === value ? "selected" : ""}>${value} kaarten</option>`).join("")}
        </select>
      </label>`;
    const printButton = modes.querySelector("#printWishlistBtn");
    modes.insertBefore(controls, printButton || null);
  }

  function currentPrintSettings() {
    const settings = {
      columns: Number(document.querySelector("#wishlistPrintGrid")?.value || 3),
      perPage: Number(document.querySelector("#wishlistPrintPerPage")?.value || 9)
    };
    saveJson(PRINT_SETTINGS_KEY, settings);
    return settings;
  }

  function printableCard(card) {
    const clone = card.cloneNode(true);
    clone.className = "print-card";
    clone.removeAttribute("style");
    clone.removeAttribute("data-detail");
    clone.removeAttribute("tabindex");
    clone.removeAttribute("role");
    clone.querySelectorAll("button, select, .missing-card-actions, .price-links").forEach(node => node.remove());
    return clone.outerHTML;
  }

  function printWishlistWithSettings() {
    const settings = currentPrintSettings();
    const cardsToPrint = Array.from(document.querySelectorAll("#wishlistGrid article")).map(printableCard);
    const activeMode = document.querySelector("[data-wishlist-mode].active")?.dataset.wishlistMode;
    const title = activeMode === "missing" ? "Ontbrekende Pokédex wishlist" : "Algemene wishlist";
    const pages = [];
    for (let index = 0; index < cardsToPrint.length; index += settings.perPage) pages.push(cardsToPrint.slice(index, index + settings.perPage));
    if (!pages.length) pages.push([]);

    let printArea = document.querySelector("#printArea");
    if (!printArea) {
      printArea = document.createElement("section");
      printArea.id = "printArea";
      document.body.appendChild(printArea);
    }
    printArea.style.setProperty("--print-columns", settings.columns);
    printArea.style.setProperty("--print-rows", Math.ceil(settings.perPage / settings.columns));
    printArea.innerHTML = pages.map((page, index) => `
      <section class="print-page">
        <div class="print-header"><h1>${title}</h1><p>${state.activeOwner} · ${cardsToPrint.length} kaarten · pagina ${index + 1}/${pages.length}</p></div>
        <div class="print-card-grid">${page.join("") || "<p>Geen items om af te drukken.</p>"}</div>
      </section>`).join("");
    window.print();
  }

  function encodeBase64Unicode(value) {
    return btoa(unescape(encodeURIComponent(value)));
  }

  function githubHeaders(token) {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    };
  }

  function markChangedPicks() {
    const now = new Date().toISOString();
    const allKeys = new Set([...Object.keys(lastSavedPicks), ...Object.keys(pokedexPicks)]);
    allKeys.forEach(key => {
      if (lastSavedPicks[key] !== pokedexPicks[key]) pickTimestamps[key] = now;
    });
    lastSavedPicks = { ...pokedexPicks };
    saveJson(PICK_TIMESTAMPS_KEY, pickTimestamps);
  }

  async function loadCloudPreferences() {
    try {
      const response = await fetch(`${PREFERENCES_RAW_URL}?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return;
      const remote = await response.json();
      const remotePicks = remote.pokedexPicks || {};
      const remoteTimestamps = remote.pokedexPickTimestamps || {};
      const localPicks = { ...pokedexPicks };
      const allKeys = new Set([...Object.keys(localPicks), ...Object.keys(remotePicks)]);

      allKeys.forEach(key => {
        const localTime = Date.parse(pickTimestamps[key] || 0) || 0;
        const remoteTime = Date.parse(remoteTimestamps[key] || 0) || 0;
        if (!(key in localPicks) || remoteTime > localTime) {
          if (remotePicks[key]) pokedexPicks[key] = remotePicks[key];
          else delete pokedexPicks[key];
          if (remoteTimestamps[key]) pickTimestamps[key] = remoteTimestamps[key];
        }
      });

      localStorage.setItem(POKEDEX_PICK_KEY, JSON.stringify(pokedexPicks));
      saveJson(PICK_TIMESTAMPS_KEY, pickTimestamps);
      lastSavedPicks = { ...pokedexPicks };
      renderPokedex();
    } catch {
      // Lokale keuzes blijven beschikbaar wanneer de cloud tijdelijk niet bereikbaar is.
    }
  }

  async function saveCloudPreferences() {
    const token = localStorage.getItem(TOKEN_KEY) || "";
    if (!token || preferencesSaving) return;
    preferencesSaving = true;
    try {
      const currentResponse = await fetch(`${PREFERENCES_API_URL}?ref=main&t=${Date.now()}`, { cache: "no-store", headers: githubHeaders(token) });
      const current = currentResponse.ok ? await currentResponse.json() : null;
      const content = JSON.stringify({
        version: 1,
        updatedAt: new Date().toISOString(),
        pokedexPicks,
        pokedexPickTimestamps: pickTimestamps
      }, null, 2) + "\n";
      const body = {
        message: "Update Pokemon Manager preferences",
        content: encodeBase64Unicode(content),
        branch: "main"
      };
      if (current && current.sha) body.sha = current.sha;
      await fetch(PREFERENCES_API_URL, {
        method: "PUT",
        headers: { ...githubHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    } catch {
      // De volgende wijziging probeert opnieuw; kaartgegevens blijven lokaal veilig.
    } finally {
      preferencesSaving = false;
    }
  }

  function schedulePreferenceSave() {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    clearTimeout(preferenceSaveTimer);
    preferenceSaveTimer = setTimeout(saveCloudPreferences, 1200);
  }

  const originalSavePokedexPicks = savePokedexPicks;
  savePokedexPicks = function savePokedexPicksAndSync() {
    markChangedPicks();
    originalSavePokedexPicks();
    schedulePreferenceSave();
  };

  document.addEventListener("click", event => {
    const picker = event.target.closest(".binder-card-select");
    if (picker) event.stopPropagation();
  }, true);

  document.addEventListener("click", event => {
    if (!event.target.closest("#printWishlistBtn")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    printWishlistWithSettings();
  }, true);

  document.addEventListener("change", event => {
    if (event.target.matches("#wishlistPrintGrid, #wishlistPrintPerPage")) currentPrintSettings();
  });

  document.querySelector("#cloudLoadBtn")?.addEventListener("click", loadCloudPreferences);
  document.querySelector("#cloudSaveBtn")?.addEventListener("click", saveCloudPreferences);

  ensureWishlistPrintControls();
  ensureCollectionCount();
  renderCollection();
  renderPokedex();
  setTimeout(loadCloudPreferences, 700);
})();
