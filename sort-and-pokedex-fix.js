(() => {
  const TCG_API_FIX = "https://api.pokemontcg.io/v2";
  const ENRICH_FLAG = "pokemon-manager-dex-enriched-v2";
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

  function cardDexNumbers(card) {
    const values = [];
    if (Array.isArray(card.dexNumbers)) values.push(...card.dexNumbers);
    if (Array.isArray(card.nationalPokedexNumbers)) values.push(...card.nationalPokedexNumbers);
    return values.map(Number).filter(Number.isFinite);
  }

  function cardMainDexNumber(card) {
    const nums = cardDexNumbers(card);
    if (nums.length) return Math.min(...nums);
    return 99999;
  }

  function rarityRank(value) {
    const rarity = cleanName(value);
    const ranks = [
      "common", "uncommon", "rare", "rare holo", "holo rare", "double rare", "ultra rare",
      "illustration rare", "special illustration rare", "secret rare", "hyper rare", "promo"
    ];
    const index = ranks.findIndex(rank => rarity.includes(rank));
    return index === -1 ? 999 : index;
  }

  function compareCards(a, b, mode) {
    if (mode === "name") return String(a.pokemon || "").localeCompare(String(b.pokemon || ""));
    if (mode === "dex") return cardMainDexNumber(a) - cardMainDexNumber(b) || String(a.pokemon || "").localeCompare(String(b.pokemon || ""));
    if (mode === "type") return String(typeForCard(a)).localeCompare(String(typeForCard(b))) || String(a.pokemon || "").localeCompare(String(b.pokemon || ""));
    if (mode === "rarity") return rarityRank(a.rarity) - rarityRank(b.rarity) || String(a.pokemon || "").localeCompare(String(b.pokemon || ""));
    if (mode === "set") return String(a.set || "").localeCompare(String(b.set || "")) || String(a.number || "").localeCompare(String(b.number || ""), undefined, { numeric: true });
    if (mode === "newest") return new Date(b.addedAt || 0) - new Date(a.addedAt || 0);
    if (mode === "quantity") return Number(b.quantity || 0) - Number(a.quantity || 0);
    return String(a.pokemon || "").localeCompare(String(b.pokemon || ""));
  }

  function selectedSort(selector, fallback = "name") {
    const el = document.querySelector(selector);
    return el ? el.value : fallback;
  }

  function ensureSortControls() {
    const collectionStrip = document.querySelector("#collection .tool-strip");
    if (collectionStrip && !document.querySelector("#collectionSortMode")) {
      const select = document.createElement("select");
      select.id = "collectionSortMode";
      select.setAttribute("aria-label", "Collectie sorteren");
      select.innerHTML = `
        <option value="name">Naam A-Z</option>
        <option value="dex">Pokédex nummer</option>
        <option value="type">Type</option>
        <option value="rarity">Zeldzaamheid</option>
        <option value="set">Set + nummer</option>
        <option value="newest">Nieuwste eerst</option>
        <option value="quantity">Aantal</option>
      `;
      collectionStrip.appendChild(select);
      select.addEventListener("change", renderCollection);
    }

    const pokedexStrip = document.querySelector("#pokedex .tool-strip");
    if (pokedexStrip && !document.querySelector("#pokedexSortMode")) {
      const select = document.createElement("select");
      select.id = "pokedexSortMode";
      select.setAttribute("aria-label", "Pokédex sorteren");
      select.innerHTML = `
        <option value="dex">Pokédex nummer</option>
        <option value="name">Naam A-Z</option>
        <option value="type">Type</option>
        <option value="owned">In collectie eerst</option>
        <option value="missing">Ontbrekend eerst</option>
      `;
      pokedexStrip.appendChild(select);
      select.addEventListener("change", renderPokedex);
    }
  }

  function entryMatchesCard(entry, card) {
    if (!entry || !card) return false;
    const nums = cardDexNumbers(card);
    if (nums.includes(Number(entry.id))) return true;

    const entryName = cleanName(entry.name);
    if (!entryName || entryName.startsWith("pokemon #")) return false;

    const cardName = cleanName(card.pokemon);
    const cardBase = baseCardName(card.pokemon);
    return cardName === entryName || cardBase === entryName || cardName.startsWith(entryName + " ");
  }

  cardsForPokedexEntry = function cardsForPokedexEntryImproved(entry) {
    return ownedCards().filter(card => entryMatchesCard(entry, card));
  };

  const originalFilteredCollection = filteredCollection;
  filteredCollection = function filteredCollectionSorted(status = "owned") {
    return originalFilteredCollection(status).sort((a, b) => compareCards(a, b, selectedSort("#collectionSortMode", "name")));
  };

  const originalFilteredPokedexEntries = filteredPokedexEntries;
  filteredPokedexEntries = function filteredPokedexEntriesSorted() {
    const entries = originalFilteredPokedexEntries();
    const mode = selectedSort("#pokedexSortMode", "dex");
    return entries.sort((a, b) => {
      if (mode === "name") return String(a.name || "").localeCompare(String(b.name || ""));
      if (mode === "type") return String(a.types && a.types[0] || "").localeCompare(String(b.types && b.types[0] || "")) || a.id - b.id;
      if (mode === "owned") return cardsForPokedexEntry(b).length - cardsForPokedexEntry(a).length || a.id - b.id;
      if (mode === "missing") return cardsForPokedexEntry(a).length - cardsForPokedexEntry(b).length || a.id - b.id;
      return a.id - b.id;
    });
  };

  async function enrichOne(card) {
    if (!card || !card.tcgId || cardDexNumbers(card).length) return false;
    try {
      const response = await fetch(`${TCG_API_FIX}/cards/${encodeURIComponent(card.tcgId)}`);
      if (!response.ok) return false;
      const payload = await response.json();
      const detail = payload.data;
      if (!detail) return false;
      if (Array.isArray(detail.nationalPokedexNumbers)) card.dexNumbers = detail.nationalPokedexNumbers;
      if (detail.name && (!card.pokemon || card.pokemon === card.tcgId)) card.pokemon = detail.name;
      if (detail.images) {
        card.imageSmall = card.imageSmall || detail.images.small || "";
        card.imageLarge = card.imageLarge || detail.images.large || "";
      }
      if (detail.types) card.types = card.types && card.types.length ? card.types : detail.types;
      return Array.isArray(card.dexNumbers) && card.dexNumbers.length > 0;
    } catch (error) {
      return false;
    }
  }

  async function enrichMissingDexNumbers() {
    const missing = cards.filter(card => card.collection === state.activeOwner && card.status === "owned" && card.tcgId && !cardDexNumbers(card).length);
    if (!missing.length) return;

    const status = document.querySelector("#cloudStatus") || document.querySelector("#globalSearchStatus");
    let changed = false;
    const limit = Math.min(missing.length, 250);

    for (let index = 0; index < limit; index += 1) {
      if (status) status.textContent = `Pokédex-koppeling bijwerken: ${index + 1}/${limit}`;
      changed = await enrichOne(missing[index]) || changed;
    }

    if (changed) {
      saveCards();
      render();
      if (status) status.textContent = "Pokédex-koppeling bijgewerkt";
    }
  }

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

  ensureSortControls();
  render();
  setTimeout(enrichMissingDexNumbers, 1500);
})();
