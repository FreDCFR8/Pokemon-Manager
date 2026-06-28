const STORAGE_KEY = "pokemon-collection-v2";
const SETS_CACHE_KEY = "pokemon-collection-v2-sets";
const POKEDEX_PICK_KEY = "pokemon-collection-v2-pokedex-picks";
const TCG_API = "https://api.pokemontcg.io/v2";

const typeColors = {
  Electric: "#f2bf27", Fire: "#f36b3f", Water: "#3d8fe3", Grass: "#45a86b",
  Psychic: "#cf69c8", Normal: "#9da5ae", Dragon: "#6a70d6", Dark: "#3d4652",
  Fairy: "#ee85b8", Fighting: "#c65542", Ghost: "#6d5aa6", Poison: "#9a61b8", Flying: "#7fa6d9",
  Bug: "#8fb84f", Ground: "#d59b55", Rock: "#a98952", Steel: "#8ba4b8", Ice: "#67c7d4"
};

const POKEDEX_TOTAL = 1025;
const featuredPokemon = [
  { id: 1,   name: "Bulbasaur",  types: ["Grass", "Poison"], region: "Kanto" },
  { id: 4,   name: "Charmander", types: ["Fire"],            region: "Kanto" },
  { id: 6,   name: "Charizard",  types: ["Fire", "Flying"],  region: "Kanto" },
  { id: 7,   name: "Squirtle",   types: ["Water"],           region: "Kanto" },
  { id: 25,  name: "Pikachu",    types: ["Electric"],        region: "Kanto" },
  { id: 39,  name: "Jigglypuff", types: ["Normal", "Fairy"], region: "Kanto" },
  { id: 94,  name: "Gengar",     types: ["Ghost", "Poison"], region: "Kanto" },
  { id: 130, name: "Gyarados",   types: ["Water", "Flying"], region: "Kanto" },
  { id: 143, name: "Snorlax",    types: ["Normal"],          region: "Kanto" },
  { id: 149, name: "Dragonite",  types: ["Dragon", "Flying"],region: "Kanto" },
  { id: 150, name: "Mewtwo",     types: ["Psychic"],         region: "Kanto" },
  { id: 197, name: "Umbreon",    types: ["Dark"],            region: "Johto" },
  { id: 448, name: "Lucario",    types: ["Fighting", "Steel"], region: "Sinnoh" }
];
const featuredById = Object.fromEntries(featuredPokemon.map(p => [p.id, p]));
function regionForDexNumber(id) {
  if (id <= 151) return "Kanto"; if (id <= 251) return "Johto"; if (id <= 386) return "Hoenn";
  if (id <= 493) return "Sinnoh"; if (id <= 649) return "Unova"; if (id <= 721) return "Kalos";
  if (id <= 809) return "Alola"; if (id <= 905) return "Galar"; return "Paldea";
}
const pokedex = Array.from({ length: POKEDEX_TOTAL }, (_, index) => {
  const id = index + 1;
  return featuredById[id] || {
    id,
    name: `Pokemon #${String(id).padStart(3, "0")}`,
    types: ["Normal"],
    region: regionForDexNumber(id)
  };
});

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

const seedCards = [
  { id: newId(), pokemon: "Pikachu",   set: "Celebrations",   number: "005/025",    rarity: "Holo Rare",   condition: "Near Mint", quantity: 2, value: 9.5,  status: "owned",    collection: "Lars", addedAt: "2026-06-10" },
  { id: newId(), pokemon: "Charizard", set: "Obsidian Flames", number: "223/197",   rarity: "Secret Rare", condition: "Excellent",  quantity: 1, value: 72,   status: "owned",    collection: "Lars", addedAt: "2026-06-18" },
  { id: newId(), pokemon: "Bulbasaur", set: "Pokemon 151",     number: "001/165",   rarity: "Common",      condition: "Near Mint", quantity: 3, value: 1.2,  status: "owned",    collection: "Lore", addedAt: "2026-06-22" },
  { id: newId(), pokemon: "Mewtwo",    set: "Crown Zenith",    number: "GG44/GG70", rarity: "Ultra Rare",  condition: "Near Mint", quantity: 1, value: 58,   status: "wishlist", collection: "Lars", addedAt: "2026-06-24" },
  { id: newId(), pokemon: "Umbreon",   set: "Evolving Skies",  number: "215/203",   rarity: "Secret Rare", condition: "Near Mint", quantity: 1, value: 640,  status: "wishlist", collection: "Lore", addedAt: "2026-06-25" }
];

let cards = loadCards();
let state = {
  view: "dashboard",
  sortAsc: true,
  selectedSetId: "",
  setQuery: "",
  activeOwner: "Lars"   // ← Lars / Lore switch
};
let tcgSets = loadCachedSets();
let setCards = [];
let setCardsById = {};
let cardSearchResults = [];
let cardSearchById = {};
let pokedexPicks = loadPokedexPicks();
let setsLoaded = false;

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

/* ── Helpers ── */
function spriteUrl(name) {
  const entry = pokedex.find(p => p.name.toLowerCase() === name.toLowerCase());
  return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/" +
    ((entry && entry.id) || 25) + ".png";
}
function typeFor(name) {
  const entry = pokedex.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (entry) return entry.types[0];
  const match = String(name || "").match(/#(\d{1,4})/);
  if (match && Number(match[1]) >= 1 && Number(match[1]) <= POKEDEX_TOTAL) return "Normal";
  return "Normal";
}
function typeForCard(card) {
  if (card && Array.isArray(card.types) && card.types.length) return card.types[0];
  return typeFor(card && card.pokemon ? card.pokemon : "");
}
function cardImageUrl(card, preferredSize = "small") {
  if (!card) return spriteUrl("Pikachu");
  if (preferredSize === "large" && card.imageLarge) return card.imageLarge;
  if (card.imageSmall) return card.imageSmall;
  if (card.imageLarge) return card.imageLarge;
  return spriteUrl(card.pokemon);
}
function formatMoney(value) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(value);
}
function loadCards() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || seedCards; } catch (e) { return seedCards; }
}
function saveCards() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}
function loadCachedSets() {
  try { return JSON.parse(localStorage.getItem(SETS_CACHE_KEY)) || []; } catch (e) { return []; }
}
function loadPokedexPicks() {
  try { return JSON.parse(localStorage.getItem(POKEDEX_PICK_KEY)) || {}; } catch (e) { return {}; }
}
function savePokedexPicks() {
  localStorage.setItem(POKEDEX_PICK_KEY, JSON.stringify(pokedexPicks));
}
function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}
function ownedKey(setName, number) {
  return normalizeText(setName) + "::" + normalizeText(number);
}
function collectionKeys() {
  const owned = new Set(), wishlist = new Set();
  activeCards().forEach(card => {
    const key = ownedKey(card.set, card.number);
    if (card.status === "owned") owned.add(key);
    if (card.status === "wishlist") wishlist.add(key);
  });
  return { owned, wishlist };
}

/* ── Active collection filter (Lars / Lore) ── */
function activeCards() {
  return cards.filter(c => c.collection === state.activeOwner);
}
function ownedCards() {
  return activeCards().filter(c => c.status === "owned");
}

/* ── View routing ── */
function setView(view) {
  state.view = view;
  $$(".view").forEach(el => el.classList.toggle("active-view", el.id === view));
  $$(".nav-tab").forEach(el => el.classList.toggle("active", el.dataset.view === view));
  const titles = {
    dashboard: ["Overzicht", "Dashboard"],
    collection: ["Binder", "Collectie"],
    sets:       ["Catalogus", "Sets"],
    wishlist:   ["Wensen", "Wishlist"],
    pokedex:    ["Database", "Pokedex"],
    manage:     ["Invoer", "Beheer"]
  };
  $("#viewKicker").textContent = titles[view][0];
  $("#viewTitle").textContent  = titles[view][1];
  window.scrollTo(0, 0);
  render();
}

/* ── Master render ── */
function render() {
  renderFilters();
  renderDashboard();
  renderCollection();
  renderSets();
  renderWishlist();
  renderPokedex();
  renderManage();
}

function renderFilters() {
  const types    = Array.from(new Set(pokedex.flatMap(p => p.types))).sort();
  const rarities = Array.from(new Set(cards.map(c => c.rarity))).sort();
  fillSelect("#typeFilter",   ["all"].concat(types),    "Alle types");
  fillSelect("#pokedexType",  ["all"].concat(types),    "Alle types");
  fillSelect("#rarityFilter", ["all"].concat(rarities), "Alle zeldzaamheden");
}
function fillSelect(selector, values, allLabel) {
  const select = $(selector);
  const current = select.value;
  select.innerHTML = values.map(v =>
    `<option value="${v}">${v === "all" ? allLabel : v}</option>`
  ).join("");
  select.value = values.includes(current) ? current : "all";
}

/* ── Dashboard ── */
function renderDashboard() {
  const owned = ownedCards();
  const totalCards    = owned.reduce((s, c) => s + Number(c.quantity), 0);
  const uniquePokemon = new Set(owned.map(c => c.pokemon.toLowerCase())).size;
  const totalValue    = owned.reduce((s, c) => s + Number(c.value) * Number(c.quantity), 0);
  const wishlist      = activeCards().filter(c => c.status === "wishlist").length;
  const completion    = Math.round((uniquePokemon / POKEDEX_TOTAL) * 100);

  $("#metricCards").textContent    = totalCards;
  $("#metricPokemon").textContent  = uniquePokemon;
  $("#metricValue").textContent    = formatMoney(totalValue);
  $("#metricWishlist").textContent = wishlist;
  $("#completionLabel").textContent = completion + "%";
  $("#completionBar").style.width   = completion + "%";

  const counts = {};
  owned.forEach(card => {
    const t = typeForCard(card);
    counts[t] = (counts[t] || 0) + Number(card.quantity);
  });
  $("#typeBreakdown").innerHTML = Object.entries(counts)
    .map(([t, n]) => `<span class="type-pill"><span class="type-dot" style="--type-color:${typeColors[t] || "#73808c"}"></span>${t} ${n}</span>`)
    .join("") || `<div class="empty-state">Nog geen typeverdeling.</div>`;

  $("#recentList").innerHTML = activeCards()
    .slice().sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
    .slice(0, 5).map(compactRow).join("");
}
function compactRow(card) {
  return `<div class="compact-row">
    <img class="sprite" src="${cardImageUrl(card)}" alt="${card.pokemon}" />
    <div><strong>${card.pokemon}</strong><p>${card.set} — ${card.rarity}</p></div>
    <span class="value">${formatMoney(Number(card.value))}</span>
  </div>`;
}

/* ── Collection ── */
function renderCollection() {
  const query  = $("#collectionSearch").value.trim().toLowerCase();
  const type   = $("#typeFilter").value;
  const rarity = $("#rarityFilter").value;
  const filtered = ownedCards()
    .filter(c => !query || (c.pokemon + " " + c.set + " " + c.number).toLowerCase().includes(query))
    .filter(c => type   === "all" || typeForCard(c) === type)
    .filter(c => rarity === "all" || c.rarity === rarity)
    .sort((a, b) => state.sortAsc ? a.pokemon.localeCompare(b.pokemon) : b.pokemon.localeCompare(a.pokemon));
  $("#collectionGrid").innerHTML = filtered.map(cardTemplate).join("") ||
    `<div class="empty-state">Geen kaarten gevonden.</div>`;
}
function renderWishlist() {
  const input = $("#wishlistSearch");
  const query = input ? input.value.trim().toLowerCase() : "";
  const filtered = activeCards()
    .filter(c => c.status === "wishlist")
    .filter(c => !query || (c.pokemon + " " + c.set + " " + c.number).toLowerCase().includes(query))
    .sort((a, b) => a.pokemon.localeCompare(b.pokemon));
  const grid = $("#wishlistGrid");
  if (grid) grid.innerHTML = filtered.map(cardTemplate).join("") ||
    `<div class="empty-state">Geen wishlist-kaarten gevonden.</div>`;
}

function cardTemplate(card) {
  const type = typeForCard(card);
  const tint = (typeColors[type] || "#d8e1ea") + "30";
  const image = cardImageUrl(card);
  return `<article class="pokemon-card" style="--card-tint:${tint}">
    <span class="type-pill"><span class="type-dot" style="--type-color:${typeColors[type] || "#73808c"}"></span>${type}</span>
    <img src="${image}" alt="${card.pokemon}" />
    <h3>${card.pokemon}</h3>
    <p>${card.set} — ${card.number || "zonder nummer"}</p>
    <p>${card.rarity} · ${card.condition} · x${card.quantity}</p>
    <div class="card-footer">
      <span class="value">${formatMoney(Number(card.value) * Number(card.quantity))}</span>
      <button class="text-action" data-detail="${card.id}" type="button">Details</button>
    </div>
  </article>`;
}

/* ── Pokédex ── */
function cardsForPokedexEntry(entry) {
  return ownedCards().filter(c => c.pokemon.toLowerCase() === entry.name.toLowerCase());
}
function selectedPokedexCard(entry, matches) {
  if (!matches.length) return null;
  const pickedId = pokedexPicks[state.activeOwner + "::" + entry.name.toLowerCase()];
  return matches.find(c => c.id === pickedId) || matches[0];
}
function renderPokedex() {
  const query = $("#pokedexSearch").value.trim().toLowerCase();
  const type  = $("#pokedexType").value;
  const filtered = pokedex
    .filter(e => !query || e.name.toLowerCase().includes(query))
    .filter(e => type === "all" || e.types.includes(type));
  $("#pokedexGrid").innerHTML = filtered.map(entry => {
    const mt = entry.types[0];
    const matches = cardsForPokedexEntry(entry);
    const selected = selectedPokedexCard(entry, matches);
    const pickKey = state.activeOwner + "::" + entry.name.toLowerCase();
    const image = selected ? cardImageUrl(selected) : spriteUrl(entry.name);
    const choice = matches.length > 1
      ? `<select class="pokedex-card-select" data-pokedex-pick="${pickKey}" aria-label="Kies kaart voor ${entry.name}">
          ${matches.map(c => `<option value="${c.id}" ${selected && selected.id === c.id ? "selected" : ""}>${c.set} #${c.number || "?"}</option>`).join("")}
        </select>`
      : `<span class="rarity-pill">${matches.length === 1 ? matches[0].set : "Nog zoeken"}</span>`;
    return `<article class="pokemon-card" style="--card-tint:${(typeColors[mt] || "#d8e1ea") + "30"}">
      <span class="type-pill"><span class="type-dot" style="--type-color:${typeColors[mt] || "#73808c"}"></span>#${String(entry.id).padStart(3,"0")}</span>
      <img src="${image}" alt="${entry.name}" />
      <h3>${entry.name}</h3>
      <p>${entry.region} · ${entry.types.join(" / ")}</p>
      <div class="card-footer pokedex-footer">
        <span class="rarity-pill">${matches.length ? "✓ In collectie" : "Nog niet in collectie"}</span>
        ${choice}
      </div>
    </article>`;
  }).join("") || `<div class="empty-state">Geen Pokemon gevonden.</div>`;
}

/* ── Beheer ── */
function renderManage() {
  $("#manageList").innerHTML = activeCards().map(card =>
    `<div class="manage-row">
      <img class="sprite" src="${cardImageUrl(card)}" alt="${card.pokemon}" />
      <div><strong>${card.pokemon}</strong><p>${card.status === "owned" ? "Collectie" : "Wishlist"} · ${card.set} · x${card.quantity}</p></div>
      <button data-delete="${card.id}" type="button" aria-label="Verwijderen">✕</button>
    </div>`
  ).join("");
}

/* ── Sets ── */
async function loadSets(force) {
  if (setsLoaded && !force) return;
  const status = $("#setsStatus");
  if (status) status.textContent = tcgSets.length
    ? "Sets worden bijgewerkt…"
    : "Sets worden geladen uit de Pokemon TCG API…";
  try {
    const res = await fetch(TCG_API + "/sets?orderBy=-releaseDate&pageSize=250");
    if (!res.ok) throw new Error(`Sets API ${res.status}`);
    const payload = await res.json();
    tcgSets = payload.data || [];
    localStorage.setItem(SETS_CACHE_KEY, JSON.stringify(tcgSets));
    setsLoaded = true;
  } catch (e) {
    if (status) status.textContent = tcgSets.length
      ? "Live sets niet bereikbaar; offline cache gebruikt."
      : "Sets konden niet worden geladen. Controleer je internetverbinding of probeer later opnieuw.";
  }
  renderSets();
}

async function loadSetCards(setId) {
  if (!setId) return;
  state.selectedSetId = setId;
  setCards = []; setCardsById = {};
  const title = $("#setCardsTitle"), grid = $("#setCardsGrid");
  const selected = tcgSets.find(s => s.id === setId);
  if (title) title.textContent = selected ? selected.name : "Set";
  if (grid)  grid.innerHTML = `<div class="empty-state">Kaarten worden geladen…</div>`;
  updateSetProgress(selected, []);
  try {
    let page = 1, all = [];
    while (true) {
      const query = encodeURIComponent(`set.id:${setId}`);
      const url = `${TCG_API}/cards?q=${query}&orderBy=number&pageSize=250&page=${page}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Cards API ${res.status}`);
      const payload = await res.json();
      const batch = payload.data || [];
      all = all.concat(batch);
      if (batch.length < 250) break;
      page++;
    }
    setCards = all;
    setCardsById = Object.fromEntries(all.map(c => [c.id, c]));
  } catch (e) {
    if (grid) grid.innerHTML = `<div class="empty-state">Kaarten konden niet worden geladen voor deze set.</div>`;
    return;
  }
  renderSets();
}


async function searchCards() {
  const input = $("#cardSearch");
  const status = $("#cardSearchStatus");
  const grid = $("#cardSearchGrid");
  const query = input ? input.value.trim() : "";
  if (!query) {
    if (status) status.textContent = "Vul een Pokemon-naam of deel van de naam in.";
    return;
  }
  if (status) status.textContent = "Kaarten worden gezocht…";
  if (grid) grid.innerHTML = `<div class="empty-state">Zoeken in Pokemon TCG API…</div>`;
  try {
    const url = `${TCG_API}/cards?q=${encodeURIComponent(`name:*${query}*`)}&orderBy=name,set.releaseDate,number&pageSize=250`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Cards API ${res.status}`);
    const payload = await res.json();
    cardSearchResults = payload.data || [];
    cardSearchById = Object.fromEntries(cardSearchResults.map(c => [c.id, c]));
    if (status) status.textContent = `${cardSearchResults.length} kaarten gevonden voor “${query}”.`;
    renderCardSearchResults();
  } catch (e) {
    if (status) status.textContent = "Zoeken is niet gelukt. Controleer je internetverbinding of probeer later opnieuw.";
    if (grid) grid.innerHTML = `<div class="empty-state">Geen zoekresultaten beschikbaar.</div>`;
  }
}

function renderCardSearchResults() {
  const grid = $("#cardSearchGrid");
  if (!grid) return;
  const previousSetCards = setCards;
  setCards = cardSearchResults;
  grid.innerHTML = cardSearchResults.length ? renderTcgCardItems(cardSearchResults) : `<div class="empty-state">Geen kaarten gevonden.</div>`;
  setCards = previousSetCards;
}

function filteredSets() {
  const q = state.setQuery;
  return tcgSets.filter(s =>
    !q || normalizeText(s.name + " " + s.series + " " + s.releaseDate).includes(normalizeText(q))
  );
}

function setOwnedStats(set) {
  const total = Number(set.total || set.printedTotal || 0);
  const ownedCount = activeCards().filter(c =>
    c.status === "owned" && normalizeText(c.set) === normalizeText(set.name)
  ).length;
  return { ownedCount, total };
}

function renderSets() {
  const setSearch = $("#setSearch"), setSelect = $("#setSelect");
  const status = $("#setsStatus"), grid = $("#setsGrid");
  if (!setSearch || !setSelect || !grid) return;
  if (!tcgSets.length && !setsLoaded) {
    if (status) status.textContent = "Sets worden geladen…";
    grid.innerHTML = `<div class="empty-state">Nog geen sets geladen.</div>`;
    updateSetProgress(null, []); return;
  }
  const sets = filteredSets();
  if (status) status.innerHTML = `${tcgSets.length} sets beschikbaar via de Pokemon TCG API. <span class="api-note">Kies een set om alle kaarten te zien.</span>`;
  const current = setSelect.value || state.selectedSetId;
  setSelect.innerHTML = `<option value="">Set kiezen</option>` +
    tcgSets.map(s => `<option value="${s.id}">${s.name} (${s.releaseDate || ""})</option>`).join("");
  setSelect.value = tcgSets.some(s => s.id === current) ? current : "";
  grid.innerHTML = sets.map(set => {
    const stats = setOwnedStats(set);
    return `<button class="set-card ${state.selectedSetId === set.id ? "active" : ""}" data-set-id="${set.id}" type="button">
      <img src="${(set.images && set.images.logo) || ""}" alt="${set.name}" />
      <div><strong>${set.name}</strong><p>${set.series || ""} · ${set.releaseDate || ""}</p></div>
      <span class="set-count">${stats.ownedCount}/${stats.total}</span>
    </button>`;
  }).join("") || `<div class="empty-state">Geen sets gevonden.</div>`;
  const selected = tcgSets.find(s => s.id === state.selectedSetId);
  renderSetCards(selected);
}

function updateSetProgress(set, cardsInSet) {
  const keys  = collectionKeys();
  const total = cardsInSet.length || Number(set && (set.total || set.printedTotal)) || 0;
  const owned = cardsInSet.length
    ? cardsInSet.filter(c => keys.owned.has(ownedKey(c.set.name, c.number))).length
    : 0;
  const percent = total ? Math.round((owned / total) * 100) : 0;
  const label = $("#setProgressLabel"), bar = $("#setProgressBar");
  if (label) label.textContent = owned + "/" + total;
  if (bar)   bar.style.width   = percent + "%";
}

function renderSetCards(set) {
  const title = $("#setCardsTitle"), grid = $("#setCardsGrid");
  if (!title || !grid) return;
  if (!set) {
    title.textContent = "Kies een set";
    grid.innerHTML = `<div class="empty-state">Selecteer links een set om de kaarten te laden.</div>`;
    updateSetProgress(null, []); return;
  }
  title.textContent = set.name;
  updateSetProgress(set, setCards);
  if (!setCards.length) {
    grid.innerHTML = `<div class="empty-state">Klik op deze set om alle kaarten te laden.</div>`;
    return;
  }
  grid.innerHTML = renderTcgCardItems(setCards);
}

function renderTcgCardItems(tcgCards) {
  const keys = collectionKeys();
  return tcgCards.map(card => {
    const key   = ownedKey(card.set.name, card.number);
    const owned = keys.owned.has(key);
    const wish  = keys.wishlist.has(key);
    const cls   = owned ? " owned" : wish ? " wishlist" : "";
    const image = (card.images && (card.images.small || card.images.large)) || spriteUrl(card.name);
    return `<article class="set-card-item${cls}">
      <img src="${image}" alt="${card.name}" />
      <h3>${card.name}</h3>
      <p>${card.set.name} · #${card.number} · ${card.rarity || "Onbekend"}</p>
      <p>${card.supertype || "Card"}</p>
      <div class="set-card-actions">
        <button data-add-card="${card.id}" type="button" ${owned ? "disabled" : ""}>${owned ? "In collectie" : "+ Collectie"}</button>
        <button data-wish-card="${card.id}" type="button" ${wish || owned ? "disabled" : ""}>${wish ? "Op wishlist" : "+ Wishlist"}</button>
      </div>
    </article>`;
  }).join("");
}

function addTcgCard(cardId, status) {
  const card = setCardsById[cardId] || cardSearchById[cardId];
  if (!card) return;
  const key = ownedKey(card.set.name, card.number);
  cards = cards.filter(item =>
    item.collection !== state.activeOwner || ownedKey(item.set, item.number) !== key
  );
  cards.unshift({
    id: newId(),
    pokemon: card.name,
    set: card.set.name,
    number: card.number,
    rarity: card.rarity || "Onbekend",
    condition: "Near Mint",
    quantity: 1,
    value: 0,
    imageSmall: card.images && card.images.small || "",
    imageLarge: card.images && card.images.large || "",
    tcgId: card.id,
    types: card.types || [],
    status,
    collection: state.activeOwner,
    addedAt: new Date().toISOString().slice(0, 10)
  });
  saveCards();
  render();
  renderCardSearchResults();
}

/* ── Detail dialog ── */
function showDetail(id) {
  const card = cards.find(c => c.id === id);
  if (!card) return;
  $("#detailContent").innerHTML = `<div class="detail-view">
    <img src="${cardImageUrl(card, "large")}" alt="${card.pokemon}" />
    <div>
      <p class="eyebrow">${card.status === "owned" ? "In collectie" : "Wishlist"} · ${card.collection || ""}</p>
      <h2>${card.pokemon}</h2>
      <p>${card.set} · ${card.number || "zonder nummer"}</p>
      <p>${card.rarity} · ${card.condition} · x${card.quantity}</p>
      <p class="value">${formatMoney(Number(card.value) * Number(card.quantity))}</p>
    </div>
  </div>`;
  $("#detailDialog").showModal();
}

/* ── Add card (form) ── */
function addCard(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  cards = [{
    id: newId(),
    pokemon:    data.pokemon.trim(),
    set:        data.set.trim(),
    number:     data.number.trim(),
    rarity:     data.rarity,
    condition:  data.condition,
    quantity:   Math.max(1, Number(data.quantity) || 1),
    value:      Math.max(0, Number(data.value) || 0),
    status:     data.status,
    collection: data.collection,
    addedAt:    new Date().toISOString().slice(0, 10)
  }].concat(cards);
  saveCards();
  event.currentTarget.reset();
  event.currentTarget.quantity.value = 1;
  event.currentTarget.value.value    = 0;
  render();
}

/* ── Export / Import ── */
function exportCards() {
  const blob = new Blob([JSON.stringify(cards, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "pokemon-collection-v2.json";
  link.click();
  URL.revokeObjectURL(url);
}
function importCards(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function () {
    try {
      const incoming = JSON.parse(reader.result);
      if (!Array.isArray(incoming)) throw new Error("Geen collectie-array");
      cards = incoming.map(c => Object.assign({}, c, { id: c.id || newId() }));
      saveCards();
      render();
    } catch (e) {
      alert("Dit JSON-bestand kon niet worden ingelezen.");
    }
  };
  reader.readAsText(file);
}

/* ── Event binding ── */
function bindEvents() {
  // Nav tabs
  $$(".nav-tab").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.view)));
  $$("[data-view-link]").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.viewLink)));

  // Owner switch (Lars / Lore)
  $$(".owner-toggle").forEach(btn => btn.addEventListener("click", () => {
    state.activeOwner = btn.dataset.owner;
    $$(".owner-toggle").forEach(b => b.classList.toggle("active", b.dataset.owner === state.activeOwner));
    render();
  }));

  // Collection filters
  $("#collectionSearch").addEventListener("input", renderCollection);
  $("#pokedexSearch").addEventListener("input",    renderPokedex);
  $("#wishlistSearch").addEventListener("input",   renderWishlist);
  $("#typeFilter").addEventListener("change",      renderCollection);
  $("#rarityFilter").addEventListener("change",    renderCollection);
  $("#pokedexType").addEventListener("change",     renderPokedex);

  // Set search / select
  $("#setSearch").addEventListener("input", e => { state.setQuery = e.target.value; renderSets(); });
  $("#setSelect").addEventListener("change", e => loadSetCards(e.target.value));
  $("#refreshSetsBtn").addEventListener("click",  () => loadSets(true));
  $("#cardSearchBtn").addEventListener("click",   searchCards);
  $("#cardSearch").addEventListener("keydown", e => { if (e.key === "Enter") searchCards(); });

  // Sort toggle
  $("#sortToggle").addEventListener("click", () => {
    state.sortAsc = !state.sortAsc;
    $("#sortToggle").textContent = state.sortAsc ? "Naam A-Z" : "Naam Z-A";
    renderCollection();
  });

  // Form / export / import / reset
  $("#cardForm").addEventListener("submit",     addCard);
  $("#exportBtn").addEventListener("click",     exportCards);
  $("#importFile").addEventListener("change",   importCards);
  $("#resetBtn").addEventListener("click", () => {
    if (!confirm("Collectie terugzetten naar de startdata?")) return;
    cards = seedCards;
    saveCards();
    render();
  });

  // Dialog
  $("#closeDialog").addEventListener("click", () => $("#detailDialog").close());

  // Delegated clicks
  document.addEventListener("change", event => {
    const pick = event.target.closest("[data-pokedex-pick]");
    if (pick) {
      pokedexPicks[pick.dataset.pokedexPick] = pick.value;
      savePokedexPicks();
      renderPokedex();
    }
  });

  document.addEventListener("click", event => {
    const detail  = event.target.closest("[data-detail]");
    const remove  = event.target.closest("[data-delete]");
    const setBtn  = event.target.closest("[data-set-id]");
    const addBtn  = event.target.closest("[data-add-card]");
    const wishBtn = event.target.closest("[data-wish-card]");
    if (detail)  showDetail(detail.dataset.detail);
    if (setBtn)  loadSetCards(setBtn.dataset.setId);
    if (addBtn)  addTcgCard(addBtn.dataset.addCard, "owned");
    if (wishBtn) addTcgCard(wishBtn.dataset.wishCard, "wishlist");
    if (remove) { cards = cards.filter(c => c.id !== remove.dataset.delete); saveCards(); render(); }
  });
}

/* ── Boot ── */
bindEvents();
render();
loadSets(false);