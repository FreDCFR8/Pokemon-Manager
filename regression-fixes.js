(() => {
  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function dexNumbersForCard(card) {
    return [...(Array.isArray(card.dexNumbers) ? card.dexNumbers : []), ...(Array.isArray(card.nationalPokedexNumbers) ? card.nationalPokedexNumbers : [])]
      .map(Number)
      .filter(Number.isFinite);
  }

  function pokedexEntryForCard(card) {
    const dexNumbers = dexNumbersForCard(card);
    if (dexNumbers.length) return pokedex.find(entry => dexNumbers.includes(Number(entry.id))) || null;
    return pokedex.find(entry => entry.name.toLowerCase() === String(card.pokemon || "").toLowerCase()) || null;
  }

  binderSlot = function binderSlotDetailChoiceOnly(entry) {
    const matches = cardsForPokedexEntry(entry);
    const selected = selectedPokedexCard(entry, matches);
    const image = selected ? cardImageUrl(selected) || spriteUrl(entry) : spriteUrl(entry);
    const type = entry.types[0];
    const availability = matches.length > 1 ? `${matches.length} kaarten · klik om te kiezen` : selected ? selected.set : "Nog niet";

    return `<article class="binder-slot ${selected ? "owned" : "missing"}" ${selected ? `data-detail="${selected.id}"` : ""}>
      <span class="binder-number">#${String(entry.id).padStart(3, "0")}</span>
      ${image ? `<img src="${image}" alt="${escapeHtml(entry.name)}" />` : `<div class="binder-missing" style="--type-color:${typeColors[type] || "#73808c"}">${escapeHtml(entry.name)}</div>`}
      <strong>${escapeHtml(entry.name)}</strong>
      <small class="binder-choice-hint">${escapeHtml(availability)}</small>
    </article>`;
  };

  showDetail = function showDetailWithCompleteBinderChoice(id) {
    const card = cards.find(item => item.id === id);
    if (!card) return;
    const entry = pokedexEntryForCard(card);
    const matches = entry ? cardsForPokedexEntry(entry) : ownedCards().filter(item => item.pokemon.toLowerCase() === card.pokemon.toLowerCase());
    const pickName = entry ? entry.name : card.pokemon;
    const pickKey = `${state.activeOwner}::${String(pickName || "").toLowerCase()}`;
    const image = cardImageUrl(card, "large") || (entry ? spriteUrl(entry) : spriteUrl(card.pokemon));
    const links = priceLinks(card);
    const choice = matches.length > 1 ? `<label class="detail-card-picker">Andere kaart kiezen<select data-detail-switch="${escapeHtml(pickKey)}" aria-label="Kies andere kaart voor ${escapeHtml(pickName)}">${matches.map(item => `<option value="${item.id}" ${item.id === card.id ? "selected" : ""}>${escapeHtml(item.pokemon)} · ${escapeHtml(item.set)} #${escapeHtml(item.number || "?")}</option>`).join("")}</select></label>` : "";
    document.querySelector("#detailContent").innerHTML = `<div class="detail-view card-detail-view">${image ? `<img class="detail-card-image" src="${image}" alt="${escapeHtml(card.pokemon)}" />` : cardPlaceholder(card)}<div><p class="eyebrow">${card.status === "owned" ? "In collectie" : "Wishlist"} · ${escapeHtml(card.collection || "")}</p><h2>${escapeHtml(card.pokemon)}</h2><p>${escapeHtml(card.set)} · ${escapeHtml(card.number || "zonder nummer")}</p><p>${escapeHtml(card.rarity)} · ${escapeHtml(card.condition)} · x${Number(card.quantity || 1)}</p>${choice}${links ? `<p class="price-links">Prijsinfo: ${links}</p>` : `<p class="api-note">Geen prijslink beschikbaar. Prijs wordt daarom niet getoond.</p>`}<div class="detail-actions"><button class="danger-action" data-delete="${card.id}" type="button">Verwijder kaart</button></div></div></div>`;
    document.querySelector("#detailDialog").showModal();
  };

  function printSettings() {
    return {
      columns: Number(document.querySelector("#wishlistPrintGrid")?.value || 3),
      perPage: Number(document.querySelector("#wishlistPrintPerPage")?.value || 9)
    };
  }

  function cleanPrintCard(source) {
    const card = document.createElement("article");
    card.className = "print-card print-card-clean";

    const image = source.querySelector("img");
    if (image && image.src) {
      const frame = document.createElement("div");
      frame.className = "print-image-frame";
      const copy = document.createElement("img");
      copy.src = image.src;
      copy.alt = image.alt || "Pokemon kaart";
      frame.appendChild(copy);
      card.appendChild(frame);
    }

    const copy = document.createElement("div");
    copy.className = "print-card-copy";
    const heading = source.querySelector("h3");
    if (heading) {
      const title = document.createElement("h3");
      title.textContent = heading.textContent;
      copy.appendChild(title);
    }

    Array.from(source.querySelectorAll("p"))
      .filter(paragraph => !paragraph.matches(".price-links, .api-note"))
      .slice(0, 3)
      .forEach(paragraph => {
        const line = document.createElement("p");
        line.textContent = paragraph.textContent;
        copy.appendChild(line);
      });

    card.appendChild(copy);
    return card;
  }

  function printWishlistCleanly() {
    const settings = printSettings();
    const sources = Array.from(document.querySelectorAll("#wishlistGrid article"));
    const activeMode = document.querySelector("[data-wishlist-mode].active")?.dataset.wishlistMode;
    const title = activeMode === "missing" ? "Ontbrekende Pokédex wishlist" : "Algemene wishlist";
    const pageCount = Math.max(1, Math.ceil(sources.length / settings.perPage));

    let printArea = document.querySelector("#printArea");
    if (!printArea) {
      printArea = document.createElement("section");
      printArea.id = "printArea";
      document.body.appendChild(printArea);
    }
    printArea.replaceChildren();
    printArea.style.setProperty("--print-columns", settings.columns);
    printArea.style.setProperty("--print-rows", Math.ceil(settings.perPage / settings.columns));

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const page = document.createElement("section");
      page.className = "print-page print-page-clean";
      const header = document.createElement("header");
      header.className = "print-header";
      header.innerHTML = `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(state.activeOwner)} · ${sources.length} kaarten · pagina ${pageIndex + 1}/${pageCount}</p>`;
      const grid = document.createElement("div");
      grid.className = "print-card-grid print-card-grid-clean";
      sources
        .slice(pageIndex * settings.perPage, (pageIndex + 1) * settings.perPage)
        .forEach(source => grid.appendChild(cleanPrintCard(source)));
      if (!sources.length) {
        const empty = document.createElement("p");
        empty.textContent = "Geen items om af te drukken.";
        grid.appendChild(empty);
      }
      page.append(header, grid);
      printArea.appendChild(page);
    }

    document.body.classList.add("wishlist-printing");
    window.addEventListener("afterprint", () => document.body.classList.remove("wishlist-printing"), { once: true });
    window.print();
  }

  function installFixedPrintButton() {
    const button = document.querySelector("#printWishlistBtn");
    if (!button) return;
    button.id = "printWishlistCleanBtn";
    button.addEventListener("click", event => {
      event.preventDefault();
      printWishlistCleanly();
    });
  }

  installFixedPrintButton();
  renderPokedex();
})();
