(() => {
  const TCG_API_FIX = "https://api.pokemontcg.io/v2";
  const TCGDEX_API = "https://api.tcgdex.net/v2/en";
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
    const ranks = ["common", "uncommon", "rare", "rare holo", "holo rare", "double rare", "ultra rare", "illustration rare", "special illustration rare", "secret rare", "hyper rare", "promo"];
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

    const actions = document.querySelector(".top-actions");
    if (actions && !document.querySelector("#repairCardsBtn")) {
      const btn = document.createElement("button");
      btn.id = "repairCardsBtn";
      btn.className = "icon-button cloud-button";
      btn.type = "button";
      btn.title = "Onbekende kaarten herstellen";
      btn.setAttribute("aria-label", "Onbekende kaarten herstellen");
      btn.textContent = "🛠️";
      btn.addEventListener("click", () => repairUnknownCards(true));
      actions.appendChild(btn);
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

  function markDexLookup(card, status) {
    card.dexLookupStatus = status;
    card.dexLookupCheckedAt = new Date().toISOString();
  }

  function normalizeTcgDexCard(detail) {
    if (!detail) return null;
    const imageBase = detail.image || "";
    const localId = detail.localId || detail.number || "";
    return {
      name: detail.name || "",
      setName: detail.set && detail.set.name || detail.set && detail.set.id || "",
      number: localId,
      rarity: detail.rarity || "Onbekend",
      images: imageBase ? { small: `${imageBase}/low.png`, large: `${imageBase}/high.png` } : null,
      nationalPokedexNumbers: Array.isArray(detail.dexId) ? detail.dexId : [],
      types: Array.isArray(detail.types) ? detail.types : []
    };
  }

  function applyDetail(card, detail, source) {
    if (!detail) return false;
    const setName = detail.setName || detail.set && detail.set.name || "";
    const number = detail.number || "";
    const dexNums = detail.nationalPokedexNumbers || detail.dexNumbers || [];
    const images = detail.images || null;

    if (detail.name) card.pokemon = detail.name;
    if (setName) card.set = setName;
    if (number) card.number = number;
    if (detail.rarity) card.rarity = detail.rarity;
    if (images) {
      card.imageSmall = images.small || card.imageSmall || "";
      card.imageLarge = images.large || card.imageLarge || "";
    }
    if (Array.isArray(dexNums) && dexNums.length) card.dexNumbers = dexNums;
    if (Array.isArray(detail.types) && detail.types.length) card.types = detail.types;
    card.cardDataSource = source;
    markDexLookup(card, cardDexNumbers(card).length ? "matched" : "details-only");
    return true;
  }

  async function fetchPokemonTcgById(id) {
    const response = await fetch(`${TCG_API_FIX}/cards/${encodeURIComponent(id)}`);
    if (!response.ok) return null;
    const payload = await response.json();
    return payload.data || null;
  }

  async function fetchPokemonTcgByQuery(id) {
    const response = await fetch(`${TCG_API_FIX}/cards?q=${encodeURIComponent(`id:${id}`)}&pageSize=1`);
    if (!response.ok) return null;
    const payload = await response.json();
    return payload.data && payload.data[0] || null;
  }

  async function fetchTcgDexById(id) {
    const response = await fetch(`${TCGDEX_API}/cards/${encodeURIComponent(id)}`);
    if (!response.ok) return null;
    const payload = await response.json();
    return normalizeTcgDexCard(payload);
  }

  async function enrichOne(card) {
    if (!card || !card.tcgId) return "skip";
    const needsFullRepair = card.rarity === "Onbekend" || card.pokemon === card.tcgId || !card.imageSmall || !card.imageLarge || !card.set || !card.number;
    const needsDexOnly = !cardDexNumbers(card).length;
    if (!needsFullRepair && !needsDexOnly) return "skip";

    const id = card.tcgId;
    try {
      let detail = await fetchPokemonTcgById(id);
      if (!detail) detail = await fetchPokemonTcgByQuery(id);
      if (detail && applyDetail(card, detail, "pokemontcg")) return "checked";

      detail = await fetchTcgDexById(id);
      if (detail && applyDetail(card, detail, "tcgdex")) return "checked";

      markDexLookup(card, "not-found");
      return "checked";
    } catch (error) {
      return "retry";
    }
  }

  function needsRepair(card) {
    return card &&
      card.collection === state.activeOwner &&
      card.status === "owned" &&
      card.tcgId &&
      (
        !cardDexNumbers(card).length ||
        card.rarity === "Onbekend" ||
        card.pokemon === card.tcgId ||
        !card.imageSmall ||
        !card.set ||
        !card.number
      );
  }

  async function repairUnknownCards(manual = false) {
    const missing = cards.filter(needsRepair);
    if (!missing.length) {
      if (manual) alert("Geen onbekende kaarten gevonden om te herstellen.");
      return;
    }

    const status = document.querySelector("#cloudStatus") || document.querySelector("#globalSearchStatus");
    let changed = false;
    let fixed = 0;
    const limit = Math.min(missing.length, manual ? 500 : 120);

    for (let index = 0; index < limit; index += 1) {
      if (status) status.textContent = `Kaartgegevens herstellen: ${index + 1}/${limit}`;
      const before = JSON.stringify(missing[index]);
      const result = await enrichOne(missing[index]);
      if (result === "checked" && JSON.stringify(missing[index]) !== before) {
        changed = true;
        fixed += 1;
      }
      if ((index + 1) % 25 === 0 && changed) saveCards();
    }

    if (changed) {
      saveCards();
      render();
      if (status) status.textContent = `Kaartgegevens hersteld: ${fixed}`;
    } else if (status) {
      status.textContent = "Geen extra kaartgegevens gevonden";
    }

    if (manual) alert(`Herstel klaar. Aangepast: ${fixed} kaarten.`);
  }

  const originalAddTcgCard = addTcgCard;
  addTcgCard = function addTcgCardWithDexNumber(cardId, status) {
    const source = setCardsById[cardId] || cardSearchById[cardId];
    originalAddTcgCard(cardId, status);
    if (!source || !Array.isArray(source.nationalPokedexNumbers)) return;
    const added = cards.find(card => card.tcgId === cardId && card.collection === state.activeOwner);
    if (added) {
      added.dexNumbers = source.nationalPokedexNumbers;
      markDexLookup(added, "matched");
      saveCards();
      render();
    }
  };

  ensureSortControls();
  render();
  setTimeout(() => repairUnknownCards(false), 1800);
  window.PokemonRepairCards = repairUnknownCards;
})();
