(() => {
  let wishlistMode = "general";
  let lastKnownPokemonNameCount = Object.keys(pokemonNameCache || {}).length;

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

  function missingPokedexTemplate(entry) {
    const type = entry.types[0];
    const tint = (typeColors[type] || "#d8e1ea") + "30";
    return `<article class="pokemon-card missing-wishlist-card" style="--card-tint:${tint}">
      <span class="type-pill"><span class="type-dot" style="--type-color:${typeColors[type] || "#73808c"}"></span>#${String(entry.id).padStart(3, "0")}</span>
      <img src="${spriteUrl(entry)}" alt="${entry.name}" />
      <h3>${entry.name}</h3>
      <p>${entry.region} · ${entry.types.join(" / ")}</p>
      <p class="api-note">Nog geen kaart in de Pokédex</p>
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
    return `<article class="print-card">
      <img src="${spriteUrl(entry)}" alt="${entry.name}" />
      <h3>#${String(entry.id).padStart(3, "0")} ${entry.name}</h3>
      <p>${entry.region}</p>
      <p>${entry.types.join(" / ")}</p>
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
    const printButton = event.target.closest("#printWishlistBtn");
    if (printButton) printActiveWishlist();
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
