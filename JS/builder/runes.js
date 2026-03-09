(function initBuilderRunes(global) {
  function runeKeyToId(key) {
    return String(key || "").replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  }

  function stripHtml(text) {
    return String(text || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  function normalizeRuneIconPath(iconPath) {
    if (!iconPath) return "";
    if (/^https?:\/\//i.test(iconPath)) return iconPath;
    return `https://ddragon.leagueoflegends.com/cdn/img/${String(iconPath).replace(/^\/+/, "")}`;
  }

  function parseRunesReforged(runes, runeLookup) {
    const parsedPaths = {};
    const parsedDefaults = {};
    const nextLookup = { ...(runeLookup || {}) };

    (runes || []).forEach((style) => {
      const pathId = runeKeyToId(style?.key || style?.name || style?.id);
      const slots = Array.isArray(style?.slots) ? style.slots : [];
      const primaryRows = slots.map((slot) => (slot?.runes || []).map((perk) => runeKeyToId(perk?.key || perk?.name || perk?.id)).filter(Boolean));
      parsedPaths[pathId] = {
        name: style?.name || pathId,
        icon: normalizeRuneIconPath(style?.icon),
        splash: `url(${normalizeRuneIconPath(style?.icon)})`,
        primaryRows,
      };
      parsedDefaults[pathId] = primaryRows.map((row) => row[0]).filter(Boolean).slice(0, 4);
      slots.forEach((slot) => {
        (slot?.runes || []).forEach((perk) => {
          const perkId = runeKeyToId(perk?.key || perk?.name || perk?.id);
          if (!perkId) return;
          const shortDesc = stripHtml(perk?.shortDesc);
          const longDesc = stripHtml(perk?.longDesc) || shortDesc;
          nextLookup[perkId] = { name: perk?.name || perkId, desc: shortDesc, longDesc, icon: normalizeRuneIconPath(perk?.icon) };
        });
      });
    });

    return { paths: parsedPaths, defaults: parsedDefaults, runeLookup: nextLookup };
  }

  global.BuilderRunes = { runeKeyToId, stripHtml, normalizeRuneIconPath, parseRunesReforged };
}(window));
