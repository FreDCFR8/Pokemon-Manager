(() => {
  const POKEMON_CARD_SUFFIXES = [
    "ex", "gx", "v", "vmax", "vstar", "star", "break", "prime", "lvx", "lv", "mega",
    "radiant", "shining", "dark", "light", "alolan", "galarian", "hisuian", "paldean"
  ];

  function cleanName(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9♀♂\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function baseCardName(value) {
    const words = cleanName(value).split(" ").filter(Boolean);
    return words.filter(word => !POKEMON_CARD_SUFFIXES.includes(word)).join(" ");
  }

  function entryMatchesCard(entry, card) {
    if (!entry || !card) return false;

    if (Array.isArray(card.dexNumbers) && card.dexNumbers.map(Number).includes(Number(entry.id))) return true;
    if (Array.isArray(card.nationalPokedexNumbers) && card.nationalPokedexNumbers.map(Number).includes(Number(entry.id))) return true;

    const entryName = cleanName(entry.name);
    const cardName = cleanName(card.pokemon);
    const cardBase = baseCardName(card.pokemon);

    return cardName === entryName || cardBase === entryName || cardName.startsWith(entryName + " ");
  }

  cardsForPokedexEntry = function cardsForPokedexEntryFixed(entry) {
    return ownedCards().filter(card => entryMatchesCard(entry, card));
  };

  const originalAddTcgCard = addTcgCard;
  addTcgCard = function addTcgCardWithDexNumber(cardId, status) {
    const source = setCardsById[cardId] || cardSearchById[cardId];
    originalAddTcgCard(cardId, status);
    if (!source || !Array.isArray(source.nationalPokedexNumbers)) return;
    const added = cards.find(card => card.tcgId === cardId && card.collection === state.activeOwner);
    if (added) {
      added.dexNumbers = source.nationalPokedexNumbers;
      saveCards();
      render();
    }
  };

  renderBinderPages = function renderBinderPagesFixed(entries) {
    if (!entries.length) return `<div class="empty-state">Geen Pokémon gevonden.</div>`;
    const pageSize = 20;
    const pages = [];
    for (let index = 0; index < entries.length; index += pageSize) {
      pages.push(entries.slice(index, index + pageSize));
    }

    return pages.map((page, pageIndex) => `
      <section class="binder-page">
        <div class="binder-page-title">
          <strong>Pagina ${pageIndex + 1}</strong>
          <span>${page[0] ? "#" + String(page[0].id).padStart(3, "0") : ""} - ${page[page.length - 1] ? "#" + String(page[page.length - 1].id).padStart(3, "0") : ""}</span>
        </div>
        <div class="binder-slots binder-slots-20">
          ${page.map(entry => binderSlot(entry)).join("")}
          ${Array.from({ length: Math.max(0, pageSize - page.length) }, () => `<div class="binder-slot empty-slot"></div>`).join("")}
        </div>
      </section>
    `).join("");
  };

  render();
})();
