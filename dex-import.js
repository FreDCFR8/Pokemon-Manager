(() => {
  const TCG_API_IMPORT = "https://api.pokemontcg.io/v2";

  function isDexBackup(data) {
    return data && !Array.isArray(data) && Array.isArray(data.ownedCards);
  }

  function totalQuantity(item) {
    const base = Number(item.quantity || 0);
    const variants = item.otherVariantsQuantities && typeof item.otherVariantsQuantities === "object"
      ? Object.values(item.otherVariantsQuantities).reduce((sum, value) => sum + Number(value || 0), 0)
      : 0;
    return Math.max(1, base + variants);
  }

  function setImportStatus(message) {
    const status = document.querySelector("#cloudStatus") || document.querySelector("#globalSearchStatus");
    if (status) status.textContent = message;
  }

  async function fetchCardDetails(id) {
    try {
      const response = await fetch(`${TCG_API_IMPORT}/cards/${encodeURIComponent(id)}`);
      if (!response.ok) throw new Error(String(response.status));
      const payload = await response.json();
      return payload.data || null;
    } catch (error) {
      return null;
    }
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
      converted.push({
        id: newId(),
        pokemon: detail ? detail.name : item.id,
        set: detail && detail.set ? detail.set.name : fallbackSet,
        number: detail ? detail.number : item.id,
        rarity: detail && detail.rarity ? detail.rarity : "Onbekend",
        condition: "Near Mint",
        quantity: qty,
        imageSmall: detail && detail.images ? detail.images.small || "" : "",
        imageLarge: detail && detail.images ? detail.images.large || "" : "",
        tcgId: item.id,
        types: detail && detail.types ? detail.types : [],
        status: "owned",
        collection: owner,
        addedAt: new Date().toISOString().slice(0, 10),
        cardmarketUrl: detail && detail.cardmarket ? detail.cardmarket.url || "" : "",
        tcgplayerUrl: detail && detail.tcgplayer ? detail.tcgplayer.url || "" : ""
      });
    }
    return converted;
  }

  async function handleImportFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const text = await file.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (error) {
      alert("Dit JSON-bestand kon niet worden gelezen.");
      event.target.value = "";
      return;
    }

    try {
      if (Array.isArray(data)) {
        cards = data.map(card => ({ ...card, id: card.id || newId() }));
        saveCards();
        render();
        setImportStatus(`Import klaar: ${cards.length} kaarten`);
        event.target.value = "";
        return;
      }

      if (isDexBackup(data)) {
        const converted = await convertDexBackup(data);
        if (!converted.length) throw new Error("Geen kaarten gevonden in ownedCards.");
        cards = converted.concat(cards.filter(card => card.collection !== (state && state.activeOwner ? state.activeOwner : "Lars")));
        saveCards();
        render();
        setImportStatus(`Dex backup geïmporteerd: ${converted.length} kaarten`);
        alert(`${converted.length} kaarten geïmporteerd uit je Dex-backup.`);
        event.target.value = "";
        return;
      }

      throw new Error("Onbekend JSON-formaat.");
    } catch (error) {
      alert("Import mislukt: " + error.message);
      event.target.value = "";
    }
  }

  function installDexImporter() {
    const input = document.querySelector("#importFile");
    if (!input || input.dataset.dexImporter === "1") return;
    input.dataset.dexImporter = "1";
    input.addEventListener("change", handleImportFile, true);
  }

  installDexImporter();
})();
