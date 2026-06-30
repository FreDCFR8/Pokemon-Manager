(() => {
  const MISSING_WISHLIST_PICK_KEY = "pokemon-collection-v2-missing-pokedex-wishlist-picks";
  const MISSING_WISHLIST_OPTIONS_KEY = "pokemon-collection-v2-missing-pokedex-card-options";

  let wishlistMode = "general";
  let lastKnownPokemonNameCount = Object.keys(pokemonNameCache || {}).length;
  let missingWishlistPicks = loadJson(MISSING_WISHLIST_PICK_KEY, {});
  let missingWishlistOptions = loadJson(MISSING_WISHLIST_OPTIONS_KEY, {});

  function loadJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function missingPickKey(entry) {
    return `${state.activeOwner}::${entry.id}`;
  }

  function ensureWishlistToolbar() {
    const section = document.querySelector("#wishlist");
    const grid = document.querySelector("#wishlistGrid");
    if (!section || !grid || document.querySelector("#wishlistModes")) return;

    const tools = section.querySelector(".tool-strip");
    const controls = document.createElement("div");
    controls.id = "wishlistModes";
    controls.className = "wishlist-modes tool-strip";
    controls.innerHTML = `
      <button class="chip-button active" data-wishlist-mode="general" type="button">Algemene wishlist</button>
      <button class="chip-button" data-wishlist-mode="missing" type="button">Ontbrekende Pokédex</button>
      <button id="printWishlistBtn" class="primary-action" type="button">Print actieve wishlist</button>
    `;
    if (tools) tools.insertAdjacentElement("afterend", controls);
    else section.insertBefore(controls, grid);
  }

  function wishlistQuery() {
    const input = document.querySelector("#wishlistSearch");
    return input ? input.value.trim().toLowerCase() : "";
  }

  function generalWishlistCards() {
    const q = wishlistQuery();
    return activeCards()
      .filter(c => c.status === "wishlist")
      .filter(c => !q || `${c.pokemon} ${c.set} ${c.number} ${c.rarity || ""}`.toLowerCase().includes(q))
      .sort((a, b) => a.pokemon.localeCompare(b.pokemon));
  }

  function missingPokedexEntries() {
    const q = wishlistQuery();
    return pokedex
      .filter(entry => !cardsForPokedexEntry(entry).length)
      .filter(entry => !q || entry.name.toLowerCase().includes(q) || String(entry.id).padStart(3, "0").includes(q));
  }

  function selectedMissingWishlistCard(entry) {
    const key = missingPickKey(entry);
    const pickedId = missingWishlistPicks[key];
    const options = missingWishlistOptions[key] || [];
    return options.find(card => card.id === pickedId) || null;
  }

  function missingOptionLabel(card) {
    return `${card.setName || "Set onbekend"} #${card.number || "?"}${card.rarity ? ` · ${card.rarity}` : ""}`;
  }

  function missingPokedexTemplate(entry) {
    const type = entry.types[0];
    const tint = (typeColors[type] || "#d8e1ea") + "30";
    const key = missingPickKey(entry);
    const options = missingWishlistOptions[key] || [];
    const selected = selectedMissingWishlistCard(entry);
    const image = selected && selected.imageSmall ? selected.imageSmall : spriteUrl(entry);
    const selectedInfo = selected ? `<p class="chosen-card-note">Gewenst: ${missingOptionLabel(selected)}</p>` : `<p class="api-note">Nog geen specifieke kaart gekozen</p>`;
    const optionSelect = options.length ? `<select class="missing-card-select" data-missing-card-select="${key}" aria-label="Kies gewenste kaart voor ${entry.name}">
      <option value="">Kies kaart…</option>
      ${options.map(card => `<option value="${card.id}" ${selected && selected.id === card.id ? "selected" : ""}>${missingOptionLabel(card)}</option>`).join("")}
    </select>` : "";

    return `<article class="pokemon-card missing-wishlist-card" style="--card-tint:${tint}">
      <span class="type-pill"><span class="type-dot" style="--type-color:${typeColors[type] || "#73808c"}"></span>#${String(entry.id).padStart(3, "0")}</span>
      <img src="${image}" alt="${selected ? selected.name : entry.name}" />
      <h3>${entry.name}</h3>
      <p>${entry.region} · ${entry.types.join(" / ")}</p>
      ${selectedInfo}
      <div class="missing-card-actions">
        <button class="text-action" data-load-missing-options="${entry.id}" type="button">Zoek kaartopties</button>
        ${optionSelect}
      </div>
    </article>`;
  }

  function setWishlistMode(mode) {
    wishlistMode = mode === "missing" ? "missing" : "general";
    document.querySelectorAll("[data-wishlist-mode]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.wishlistMode === wishlistMode);
    });
    renderWishlist();
  }

  renderWishlist = function enhancedRenderWishlist() {
    ensureWishlistToolbar();
    const grid = document.querySelector("#wishlistGrid");
    if (!grid) return;

    if (wishlistMode === "missing") {
      const missing = missingPokedexEntries();
      grid.classList.add("missing-pokedex-grid");
      grid.innerHTML = missing.map(missingPokedexTemplate).join("") || `<div class="empty-state">Je hebt van elke getoonde Pokémon minstens één kaart in de Pokédex.</div>`;
      return;
    }

    grid.classList.remove("missing-pokedex-grid");
    const filtered = generalWishlistCards();
    grid.innerHTML = filtered.map(cardTemplate).join("") || `<div class="empty-state">Geen wishlist-kaarten gevonden.</div>`;
  };

  async function loadMissingCardOptions(entryId) {
    const entry = pokedex.find(p => String(p.id) === String(entryId));
    if (!entry) return;
    const key = missingPickKey(entry);
    const button = document.querySelector(`[data-load-missing-options="${entry.id}"]`);
    if (button) button.textContent = "Zoeken…";

    try {
      const url = `${TCG_API}/cards?q=${encodeURIComponent(`name:"${entry.name}"`)}&orderBy=-set.releaseDate,number&pageSize=40`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Cards API ${res.status}`);
      const payload = await res.json();
      const options = (payload.data || []).map(card => ({
        id: card.id,
        name: card.name,
        setName: card.set && card.set.name || "",
        number: card.number || "",
        rarity: card.rarity || "Onbekend",
        imageSmall: card.images && (card.images.small || card.images.large) || "",
        imageLarge: card.images && (card.images.large || card.images.small) || "",
        cardmarketUrl: card.cardmarket && card.cardmarket.url || "",
        tcgplayerUrl: card.tcgplayer && card.tcgplayer.url || ""
      }));
      missingWishlistOptions[key] = options;
      saveJson(MISSING_WISHLIST_OPTIONS_KEY, missingWishlistOptions);
      if (!missingWishlistPicks[key] && options[0]) {
        missingWishlistPicks[key] = options[0].id;
        saveJson(MISSING_WISHLIST_PICK_KEY, missingWishlistPicks);
      }
    } catch {
      alert(`Kaartopties voor ${entry.name} konden niet worden geladen.`);
    }
    renderWishlist();
  }

  function selectMissingWishlistCard(key, cardId) {
    if (cardId) missingWishlistPicks[key] = cardId;
    else delete missingWishlistPicks[key];
    saveJson(MISSING_WISHLIST_PICK_KEY, missingWishlistPicks);
    renderWishlist();
  }

  function printCardForGeneral(card) {
    const type = typeForCard(card);
    const image = cardImageUrl(card) || spriteUrl(card.pokemon);
    return `<article class="print-card">
      ${image ? `<img src="${image}" alt="${card.pokemon}" />` : ""}
      <h3>${card.pokemon}</h3>
      <p>${card.set} · #${card.number || "?"}</p>
      <p>${card.rarity || "Onbekend"} · ${type}</p>
    </article>`;
  }

  function printCardForMissing(entry) {
    const selected = selectedMissingWishlistCard(entry);
    const image = selected && (selected.imageLarge || selected.imageSmall) ? (selected.imageLarge || selected.imageSmall) : spriteUrl(entry);
    return `<article class="print-card">
      <img src="${image}" alt="${selected ? selected.name : entry.name}" />
      <h3>#${String(entry.id).padStart(3, "0")} ${entry.name}</h3>
      ${selected ? `<p>Gewenst: ${missingOptionLabel(selected)}</p>` : `<p>Nog geen specifieke kaart gekozen</p>`}
      <p>${entry.region} · ${entry.types.join(" / ")}</p>
    </article>`;
  }

  function printActiveWishlist() {
    let printArea = document.querySelector("#printArea");
    if (!printArea) {
      printArea = document.createElement("section");
      printArea.id = "printArea";
      document.body.appendChild(printArea);
    }

    const title = wishlistMode === "missing" ? "Ontbrekende Pokédex wishlist" : "Algemene wishlist";
    const items = wishlistMode === "missing"
      ? missingPokedexEntries().map(printCardForMissing)
      : generalWishlistCards().map(printCardForGeneral);

    printArea.innerHTML = `
      <div class="print-header">
        <h1>${title}</h1>
        <p>${state.activeOwner} · ${items.length} items</p>
      </div>
      <div class="print-card-grid">${items.join("") || `<p>Geen items om af te drukken.</p>`}</div>
    `;
    window.print();
  }

  document.addEventListener("click", event => {
    const modeButton = event.target.closest("[data-wishlist-mode]");
    if (modeButton) {
      setWishlistMode(modeButton.dataset.wishlistMode);
      return;
    }
    const loadMissingButton = event.target.closest("[data-load-missing-options]");
    if (loadMissingButton) {
      loadMissingCardOptions(loadMissingButton.dataset.loadMissingOptions);
      return;
    }
    const printButton = event.target.closest("#printWishlistBtn");
    if (printButton) printActiveWishlist();
  });

  document.addEventListener("change", event => {
    const select = event.target.closest("[data-missing-card-select]");
    if (select) selectMissingWishlistCard(select.dataset.missingCardSelect, select.value);
  });

  const wishlistSearch = document.querySelector("#wishlistSearch");
  if (wishlistSearch) wishlistSearch.addEventListener("input", () => renderWishlist());

  const refreshAfterNamesLoad = setInterval(() => {
    const currentCount = Object.keys(pokemonNameCache || {}).length;
    if (currentCount !== lastKnownPokemonNameCount) {
      lastKnownPokemonNameCount = currentCount;
      renderWishlist();
    }
    if (currentCount >= POKEDEX_TOTAL) clearInterval(refreshAfterNamesLoad);
  }, 600);

  ensureWishlistToolbar();
  renderWishlist();
})();
