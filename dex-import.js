(() => {
  const TCG_API_IMPORT = "https://api.pokemontcg.io/v2";
  const TCGDEX_API_IMPORT = "https://api.tcgdex.net/v2/en";
  const DEX_SET_ALIASES = {
    sv35: "sv3pt5",
    sv45: "sv4pt5",
    sv85: "sv8pt5",
    sv105b: "zsv10pt5",
    sv105w: "rsv10pt5",
    me25: "me2pt5"
  };
  const DEX_SET_CACHE = new Map();
  const DEX_CARD_FALLBACKS = {
    "mep-10": ["Riolu", "Mega Evolution Black Star Promos", "10", "Promo", ["Fighting"], [447]],
    "mep-11": ["Mega Latias ex", "Mega Evolution Black Star Promos", "11", "Promo", ["Dragon"], [380]],
    "mep-22": ["Charcadet", "Mega Evolution Black Star Promos", "22", "Promo", ["Fire"], [935]],
    "mep-80": ["Fennekin", "Mega Evolution Black Star Promos", "80", "Promo", ["Fire"], [653]],
    "mcd23-2": ["Fuecoco", "McDonald's Collection 2023", "2/15", "Promo", ["Fire"], [909]],
    "mcd23-3": ["Quaxly", "McDonald's Collection 2023", "3/15", "Promo", ["Water"], [912]],
    "mcd23-5": ["Cetitan", "McDonald's Collection 2023", "5/15", "Promo", ["Water"], [975]],
    "mcd23-6": ["Pikachu", "McDonald's Collection 2023", "6/15", "Promo", ["Lightning"], [25]],
    "mcd24-1": ["Charizard", "McDonald's Collection 2024", "1/15", "Promo", ["Fire"], [6]],
    "mcd24-2": ["Pikachu", "McDonald's Collection 2024", "2/15", "Promo", ["Lightning"], [25]],
    "mcd24-6": ["Dragapult", "McDonald's Collection 2024", "6/15", "Promo", ["Psychic"], [887]],
    "mcd19fr-20": ["Pikachu", "McDonald's Collection 2019 (French)", "20/40", "Promo", ["Lightning"], [25]],
    "ba22c-13": ["Vulpix", "Battle Academy 2022 (Cinderace)", "029/264 (#13)", "Common", ["Fire"], [37]],
    "ba22c-18": ["Vulpix", "Battle Academy 2022 (Cinderace)", "029/264 (#18)", "Common", ["Fire"], [37]],
    "ba22c-31": ["Vulpix", "Battle Academy 2022 (Cinderace)", "029/264 (#31)", "Common", ["Fire"], [37]],
    "ba22p-60": ["Pikachu V", "Battle Academy 2022 (Pikachu)", "043/185 (#60)", "Rare Holo V", ["Lightning"], [25]],
    "cclb-10": ["Suicune ex", "Pokémon TCG Classic (Blastoise)", "010/034", "Double Rare", ["Water"], [245]],
    "svp-209": ["Thundurus", "Scarlet & Violet Black Star Promos", "209", "Promo", ["Lightning"], [642]],
    "svp-212": ["Reuniclus", "Scarlet & Violet Black Star Promos", "212", "Promo", ["Psychic"], [579]]
  };

  function isDexBackup(data) { return data && !Array.isArray(data) && Array.isArray(data.ownedCards); }
  function totalQuantity(item) {
    const base = Number(item.quantity || 0);
    const variants = item.otherVariantsQuantities && typeof item.otherVariantsQuantities === "object"
      ? Object.values(item.otherVariantsQuantities).reduce((sum, value) => sum + Number(value || 0), 0)
      : 0;
    return Math.max(1, base + variants);
  }
  function setImportStatus(message) { const status = document.querySelector("#cloudStatus") || document.querySelector("#globalSearchStatus"); if (status) status.textContent = message; }
  function splitDexId(id) { const separator = String(id).lastIndexOf("-"); if (separator < 1) return null; return { setId: String(id).slice(0, separator), number: String(id).slice(separator + 1) }; }
  function normalizedDexId(id) { const split = splitDexId(id); if (!split) return String(id); return `${DEX_SET_ALIASES[split.setId] || split.setId}-${split.number}`; }
  function lookupCandidates(id) {
    const split = splitDexId(id);
    if (!split) return [String(id)];
    const ids = new Set([String(id), normalizedDexId(id)]);
    const alias = DEX_SET_ALIASES[split.setId];
    if (alias) ids.add(`${alias}-${split.number}`);
    ids.add(`${split.setId}-${String(split.number).replace(/^0+/, "")}`);
    if (alias) ids.add(`${alias}-${String(split.number).replace(/^0+/, "")}`);
    return Array.from(ids).filter(Boolean);
  }
  function fallbackCardDetails(id) {
    const entry = DEX_CARD_FALLBACKS[id];
    if (!entry) return null;
    const setId = String(id).slice(0, String(id).lastIndexOf("-"));
    const image = `https://images.pokemoncard.io/images/${setId}/${id}.png`;
    return { id, name: entry[0], set: { name: entry[1] }, number: entry[2], rarity: entry[3], types: entry[4], nationalPokedexNumbers: entry[5], images: { small: image, large: image } };
  }
  async function fetchJsonWithRetry(url) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(url);
        if (response.ok) return response.json();
        if (response.status !== 429 && response.status < 500) return null;
      } catch (error) {}
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
    return null;
  }
  function fetchSetCards(setId) {
    if (DEX_SET_CACHE.has(setId)) return DEX_SET_CACHE.get(setId);
    const request = (async () => {
      const cardsById = new Map();
      let page = 1;
      let totalCount = 1;
      const query = encodeURIComponent(`set.id:${setId}`);
      while (cardsById.size < totalCount) {
        const payload = await fetchJsonWithRetry(`${TCG_API_IMPORT}/cards?q=${query}&pageSize=250&page=${page}`);
        if (!payload || !Array.isArray(payload.data)) break;
        payload.data.forEach(card => cardsById.set(card.id, card));
        totalCount = Number(payload.totalCount || payload.data.length);
        if (!payload.data.length) break;
        page += 1;
      }
      return cardsById;
    })();
    DEX_SET_CACHE.set(setId, request);
    return request;
  }
  async function fetchPokemonTcgDirect(candidate) {
    const payload = await fetchJsonWithRetry(`${TCG_API_IMPORT}/cards/${encodeURIComponent(candidate)}`);
    return payload && payload.data || null;
  }
  async function fetchPokemonTcgSetLookup(candidate) {
    const split = splitDexId(candidate);
    if (!split) return null;
    const cardsById = await fetchSetCards(split.setId);
    return cardsById.get(candidate) || null;
  }
  function normalizeTcgdexCard(detail, candidate) {
    if (!detail) return null;
    const imageBase = detail.image || "";
    return {
      id: candidate,
      name: detail.name || "",
      set: { name: detail.set && (detail.set.name || detail.set.id) || "" },
      number: detail.localId || detail.number || splitDexId(candidate)?.number || "",
      rarity: detail.rarity || "Onbekend",
      images: imageBase ? { small: `${imageBase}/low.png`, large: `${imageBase}/high.png` } : null,
      nationalPokedexNumbers: Array.isArray(detail.dexId) ? detail.dexId : [],
      types: Array.isArray(detail.types) ? detail.types : []
    };
  }
  async function fetchTcgdex(candidate) {
    const payload = await fetchJsonWithRetry(`${TCGDEX_API_IMPORT}/cards/${encodeURIComponent(candidate)}`);
    return normalizeTcgdexCard(payload, candidate);
  }
  async function fetchCardDetails(id) {
    const fallback = fallbackCardDetails(id);
    if (fallback) return fallback;
    for (const candidate of lookupCandidates(id)) {
      const direct = await fetchPokemonTcgDirect(candidate);
      if (direct) return direct;
      const setLookup = await fetchPokemonTcgSetLookup(candidate);
      if (setLookup) return setLookup;
      const tcgdex = await fetchTcgdex(candidate);
      if (tcgdex && tcgdex.name) return tcgdex;
    }
    return null;
  }
  function applyCardDetails(card, detail, sourceId) {
    card.pokemon = detail.name;
    card.set = detail.set ? detail.set.name : card.set;
    card.number = detail.number || card.number;
    card.rarity = detail.rarity || "Onbekend";
    card.imageSmall = detail.images ? detail.images.small || "" : "";
    card.imageLarge = detail.images ? detail.images.large || "" : "";
    card.tcgId = detail.id || sourceId;
    card.dexSourceId = sourceId;
    card.dexNumbers = Array.isArray(detail.nationalPokedexNumbers) ? detail.nationalPokedexNumbers : [];
    card.types = detail.types || [];
    card.cardmarketUrl = detail.cardmarket ? detail.cardmarket.url || "" : "";
    card.tcgplayerUrl = detail.tcgplayer ? detail.tcgplayer.url || "" : "";
    return card;
  }
  async function convertDexBackup(data) {
    const sourceCards = data.ownedCards.filter(item => item && item.id && totalQuantity(item) > 0);
    const converted = [];
    const owner = state && state.activeOwner ? state.activeOwner : "Lars";
    for (let index = 0; index < sourceCards.length; index += 1) {
      const item = sourceCards[index];
      setImportStatus(`Dex backup importeren: ${index + 1}/${sourceCards.length}`);
      const detail = await fetchCardDetails(item.id);
      const qty = totalQuantity(item);
      const fallbackSet = String(item.id).split("-")[0] || "Onbekende set";
      const convertedCard = { id: newId(), pokemon: item.id, set: fallbackSet, number: item.id, rarity: "Onbekend", condition: "Near Mint", quantity: qty, imageSmall: "", imageLarge: "", tcgId: item.id, dexSourceId: item.id, dexNumbers: [], types: [], status: "owned", collection: owner, addedAt: new Date().toISOString().slice(0, 10), cardmarketUrl: "", tcgplayerUrl: "" };
      converted.push(detail ? applyCardDetails(convertedCard, detail, item.id) : convertedCard);
    }
    return converted;
  }
  function needsDexRepair(card) { return card && card.tcgId && (card.rarity === "Onbekend" || !card.imageSmall || card.pokemon === card.tcgId); }
  async function repairUnknownDexCards() {
    const unknown = cards.filter(needsDexRepair);
    if (!unknown.length) return;
    let cursor = 0, processed = 0, repaired = 0, unsaved = 0;
    function saveRepairProgress() { if (!unsaved) return; saveCards(); renderCollection(); unsaved = 0; }
    async function repairWorker() {
      while (cursor < unknown.length) {
        const index = cursor; cursor += 1;
        const card = unknown[index];
        const sourceId = card.dexSourceId || card.tcgId;
        const detail = await fetchCardDetails(sourceId);
        processed += 1;
        if (detail) { applyCardDetails(card, detail, sourceId); repaired += 1; unsaved += 1; }
        setImportStatus(`Onbekende kaarten koppelen: ${processed}/${unknown.length}`);
        if (unsaved >= 8) saveRepairProgress();
      }
    }
    const workerCount = Math.min(4, unknown.length);
    await Promise.all(Array.from({ length: workerCount }, () => repairWorker()));
    saveRepairProgress();
    if (repaired) render();
    setImportStatus(`${repaired} onbekende kaarten gekoppeld${repaired < unknown.length ? `; ${unknown.length - repaired} niet gevonden` : ""}.`);
  }
  async function handleImportFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const text = await file.text();
    let data;
    try { data = JSON.parse(text); } catch (error) { alert("Dit JSON-bestand kon niet worden gelezen."); event.target.value = ""; return; }
    try {
      if (Array.isArray(data)) { cards = data.map(card => ({ ...card, id: card.id || newId() })); saveCards(); render(); setImportStatus(`Import klaar: ${cards.length} kaarten`); event.target.value = ""; return; }
      if (isDexBackup(data)) {
        const converted = await convertDexBackup(data);
        if (!converted.length) throw new Error("Geen kaarten gevonden in ownedCards.");
        cards = converted.concat(cards.filter(card => card.collection !== (state && state.activeOwner ? state.activeOwner : "Lars")));
        saveCards(); render(); setImportStatus(`Dex backup geïmporteerd: ${converted.length} kaarten`); alert(`${converted.length} kaarten geïmporteerd uit je Dex-backup.`); event.target.value = ""; return;
      }
      throw new Error("Onbekend JSON-formaat.");
    } catch (error) { alert("Import mislukt: " + error.message); event.target.value = ""; }
  }
  function installDexImporter() { const input = document.querySelector("#importFile"); if (!input || input.dataset.dexImporter === "1") return; input.dataset.dexImporter = "1"; input.addEventListener("change", handleImportFile, true); }
  installDexImporter();
  repairUnknownDexCards();
  window.DexCardLookup = { fetchCardDetails, applyCardDetails, lookupCandidates, repairUnknownDexCards };
})();
