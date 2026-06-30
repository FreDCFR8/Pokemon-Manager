(() => {
  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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
