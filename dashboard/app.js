const STORE_KEY = "matdash-state-v1";

const macroKeys = [
  ["kcal", "kcal"],
  ["protein", "protein"],
  ["carbs", "kolh"],
  ["fat", "fett"],
];

const requiredDailySlots = [
  { id: "frukost", label: "Frukost", tag: "Frukost" },
  { id: "lunch", label: "Lunch", tag: "Lunch" },
  { id: "middag", label: "Middag", tag: "Middag" },
];

const extraSlotTags = ["Mellanmål", "Snack", "Annat"];

const initialData = window.MATDASH_DATA || {
  generatedAt: new Date().toISOString(),
  sourceFile: "",
  sourceLastWriteTime: "",
  targets: {
    training: { kcal: 2500, protein: 190, carbs: 290, fat: 56 },
    rest: { kcal: 2250, protein: 190, carbs: 225, fat: 64 },
  },
  foods: [],
  recipes: [],
  cookPlan: [],
  shoppingSelections: [],
  dailySlots: [],
  extraSlots: [],
  logEntries: [],
  coachMessages: [],
  menus: [],
  temporaryItems: [],
};

let state = loadState();
let activeTarget = "training";
let activeRecipeTag = "all";
let selectedMenuId = "";
let editingRecipeId = "";
let expandedMenuItemId = "";
let editingLogId = "";
let activeFoodInput = null;
let deferredInstallPrompt = null;

const els = {
  dataStatus: document.querySelector("#dataStatus"),
  tabs: document.querySelectorAll(".tab"),
  views: document.querySelectorAll(".view"),
  targetMode: document.querySelector("#targetMode"),
  targetKcal: document.querySelector("#targetKcal"),
  targetProtein: document.querySelector("#targetProtein"),
  targetCarbs: document.querySelector("#targetCarbs"),
  targetFat: document.querySelector("#targetFat"),
  metricCards: document.querySelector("#metricCards"),
  dailyPlan: document.querySelector("#dailyPlan"),
  temporaryItems: document.querySelector("#temporaryItems"),
  suggestions: document.querySelector("#suggestions"),
  recipeGrid: document.querySelector("#recipeGrid"),
  recipeTagFilter: document.querySelector("#recipeTagFilter"),
  menuList: document.querySelector("#menuList"),
  menuDetail: document.querySelector("#menuDetail"),
  cookPlan: document.querySelector("#cookPlan"),
  shoppingSelectors: document.querySelector("#shoppingSelectors"),
  shoppingRows: document.querySelector("#shoppingRows"),
  logEntries: document.querySelector("#logEntries"),
  logSummary: document.querySelector("#logSummary"),
  coachChat: document.querySelector("#coachChat"),
  coachInput: document.querySelector("#coachInput"),
  sendCoachMessage: document.querySelector("#sendCoachMessage"),
  foodRows: document.querySelector("#foodRows"),
  foodSearch: document.querySelector("#foodSearch"),
  foodOptions: document.querySelector("#foodOptions"),
  tagOptions: document.querySelector("#tagOptions"),
  foodSuggest: document.querySelector("#foodSuggest"),
  addRecipe: document.querySelector("#addRecipe"),
  addMenu: document.querySelector("#addMenu"),
  addFood: document.querySelector("#addFood"),
  addTemporaryItem: document.querySelector("#addTemporaryItem"),
  addExtraSlot: document.querySelector("#addExtraSlot"),
  logToday: document.querySelector("#logToday"),
  installApp: document.querySelector("#installApp"),
  resetData: document.querySelector("#resetData"),
  saveBackup: document.querySelector("#saveBackup"),
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadState() {
  const saved = localStorage.getItem(STORE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return normalizeState(parsed);
    } catch {
      localStorage.removeItem(STORE_KEY);
    }
  }

  return normalizeState({
    targets: clone(initialData.targets),
    foods: clone(initialData.foods),
    recipes: clone(initialData.recipes).map((recipe) => ({ ...recipe, tags: recipe.tags?.length ? recipe.tags : inferDefaultTags(recipe) })),
    cookPlan: clone(initialData.cookPlan),
    shoppingSelections: [],
    dailySlots: createDefaultDailySlots([]),
    extraSlots: [],
    logEntries: [],
    coachMessages: [],
    menus: [],
    temporaryItems: [],
    dailyPlan: initialData.recipes.map((recipe) => ({
      recipeId: recipe.id,
      servings: 1,
    })),
  });
}

function normalizeState(raw) {
  const recipes = (raw.recipes || []).map((recipe) => ({
    ...recipe,
    ingredients: recipe.ingredients || [],
    tags: recipe.tags?.length ? recipe.tags : inferDefaultTags(recipe),
  }));
  const menus = (raw.menus || []).map((menu) => ({
    id: menu.id || `meny-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: menu.name || "Ny meny",
    items: (menu.items || []).map((item) => ({
      ...item,
      id: item.id || `menyratt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      sourceRecipeId: item.sourceRecipeId || "",
      name: item.name || "Rätt",
      ingredients: item.ingredients || [],
      tags: item.tags || [],
      servings: number(item.servings, 1),
    })),
  }));
  const cookPlan = raw.cookPlan?.length
    ? raw.cookPlan
    : recipes.map((recipe) => ({ recipeId: recipe.id, servings: 5 }));
  const dailyPlan = raw.dailyPlan?.length
    ? raw.dailyPlan
    : recipes.map((recipe) => ({ recipeId: recipe.id, servings: 1 }));
  const temporaryItems = (raw.temporaryItems || []).map((item) => ({
    id: item.id || `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: item.name || "",
    grams: number(item.grams),
    kcal100: item.kcal100,
    protein100: item.protein100,
    carbs100: item.carbs100,
    fat100: item.fat100,
  }));
  const dailySlots = normalizeDailySlots(raw.dailySlots, recipes, raw.dailyPlan);
  const extraSlots = (raw.extraSlots || []).map((slot) => ({
    id: slot.id || makeId("extra"),
    label: slot.label || "Extra",
    tag: slot.tag || "Annat",
    recipeId: slot.recipeId || "",
    servings: number(slot.servings, 1),
  }));
  const shoppingSelections = raw.shoppingSelections?.length
    ? raw.shoppingSelections
    : recipes.map((recipe) => ({ type: "recipe", id: recipe.id, servings: 0 }));

  return {
    targets: raw.targets || clone(initialData.targets),
    foods: raw.foods || [],
    recipes,
    cookPlan,
    dailyPlan,
    dailySlots,
    extraSlots,
    shoppingSelections,
    logEntries: (raw.logEntries || []).map((entry) => ({
      ...entry,
      notes: entry.notes || "",
      macros: entry.macros || { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      meals: entry.meals || [],
      temporaryItems: entry.temporaryItems || [],
    })),
    menus,
    temporaryItems,
    coachMessages: raw.coachMessages || [],
  };
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(number(value) * factor) / factor;
}

function format(value, digits = 0) {
  return round(value, digits).toLocaleString("sv-SE", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function findFood(name) {
  const lower = String(name || "").trim().toLowerCase();
  return state.foods.find((food) => food.name.toLowerCase() === lower);
}

function parseTags(value) {
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getAllTags() {
  return [...new Set(state.recipes.flatMap((recipe) => recipe.tags || []))]
    .sort((a, b) => a.localeCompare(b, "sv"));
}

function normalizeTag(value) {
  return String(value || "").trim().toLowerCase();
}

function recipeHasTag(recipe, tag) {
  const wanted = normalizeTag(tag);
  return (recipe.tags || []).some((item) => normalizeTag(item) === wanted);
}

function getRecipesByTag(tag) {
  return state.recipes.filter((recipe) => recipeHasTag(recipe, tag));
}

function getFoodMatches(query, limit = 10) {
  const q = normalizeSearch(query);
  if (q.length < 1) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  return state.foods
    .map((food) => {
      const name = normalizeSearch(food.name);
      const group = normalizeSearch(food.group);
      const words = name.split(/\s+/).filter(Boolean);
      let score = 0;
      if (name === q) score += 100;
      if (name.startsWith(q)) score += 70;
      if (name.includes(q)) score += 35;
      terms.forEach((term) => {
        if (name.startsWith(term)) score += 15;
        else if (words.some((word) => word.startsWith(term))) score += 12;
        else if (name.includes(term)) score += 8;
        if (group.includes(term)) score += 2;
      });
      if (terms.every((term) => name.includes(term) || group.includes(term))) score += 20;
      if (food.source === "Eget") score += 5;
      return { food, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name, "sv"))
    .slice(0, limit)
    .map((item) => item.food);
}

function normalizeSearch(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ");
}

function showFoodSuggest(input) {
  const matches = getFoodMatches(input.value, 12);
  if (!matches.length) {
    hideFoodSuggest();
    return;
  }
  const rect = input.getBoundingClientRect();
  els.foodSuggest.style.left = `${rect.left + window.scrollX}px`;
  els.foodSuggest.style.top = `${rect.bottom + window.scrollY + 4}px`;
  els.foodSuggest.style.width = `${rect.width}px`;
  els.foodSuggest.innerHTML = matches.map((food) => `
    <button type="button" data-pick-food="${escapeAttr(food.name)}" tabindex="-1">
      <strong>${escapeHtml(food.name)}</strong>
      <span>${format(food.kcal)} kcal · ${format(food.protein, 1)}P · ${format(food.carbs, 1)}K · ${format(food.fat, 1)}F</span>
    </button>
  `).join("");
  els.foodSuggest.hidden = false;
  activeFoodInput = input;
}

function hideFoodSuggest() {
  els.foodSuggest.hidden = true;
  els.foodSuggest.innerHTML = "";
  els.foodSuggest.style.removeProperty("left");
  els.foodSuggest.style.removeProperty("top");
  els.foodSuggest.style.removeProperty("width");
  activeFoodInput = null;
}

function applyFoodToInput(input, foodName) {
  input.value = foodName;
  updateFoodBackedField(input, true);
  hideFoodSuggest();
}

function hydrateFoodBackedItem(item) {
  const food = findFood(item.name);
  if (!food) {
    delete item.kcal100;
    delete item.protein100;
    delete item.carbs100;
    delete item.fat100;
    return false;
  }
  item.kcal100 = food.kcal;
  item.protein100 = food.protein;
  item.carbs100 = food.carbs;
  item.fat100 = food.fat;
  return true;
}

function inferDefaultTags(recipe) {
  const name = String(recipe.name || "").toLowerCase();
  if (name.includes("havre") || name.includes("whey")) return ["Frukost"];
  if (name.includes("casein") || name.includes("kvarg")) return ["Snack"];
  if (name.includes("pasta") || name.includes("tonfisk") || name.includes("kyckling") || name.includes("quinoa")) {
    return ["Lunch", "Middag"];
  }
  return [];
}

function createDefaultDailySlots() {
  return requiredDailySlots.map((slot) => ({
    ...slot,
    recipeId: "",
    servings: 1,
  }));
}

function normalizeDailySlots(rawSlots, recipes, oldDailyPlan) {
  const slots = createDefaultDailySlots();
  const saved = Array.isArray(rawSlots) ? rawSlots : [];
  slots.forEach((slot) => {
    const match = saved.find((item) => item.id === slot.id);
    if (match) {
      slot.recipeId = match.recipeId || "";
      slot.servings = number(match.servings, 1);
      return;
    }
    const taggedRecipe = recipes.find((recipe) => recipeHasTag(recipe, slot.tag));
    slot.recipeId = taggedRecipe?.id || "";
  });

  if (!saved.length && Array.isArray(oldDailyPlan)) {
    oldDailyPlan.forEach((entry) => {
      const recipe = recipes.find((item) => item.id === entry.recipeId);
      const slot = slots.find((candidate) => recipe && recipeHasTag(recipe, candidate.tag) && !candidate.recipeId);
      if (slot) {
        slot.recipeId = recipe.id;
        slot.servings = number(entry.servings, 1);
      }
    });
  }

  return slots;
}

function getIngredientMacros(ingredient) {
  const food = findFood(ingredient.name);
  const kcal100 = number(ingredient.kcal100 ?? food?.kcal);
  const protein100 = number(ingredient.protein100 ?? food?.protein);
  const carbs100 = number(ingredient.carbs100 ?? food?.carbs);
  const fat100 = number(ingredient.fat100 ?? food?.fat);
  const grams = number(ingredient.grams);

  return {
    grams,
    kcal: (grams * kcal100) / 100,
    protein: (grams * protein100) / 100,
    carbs: (grams * carbs100) / 100,
    fat: (grams * fat100) / 100,
  };
}

function getRecipeMacros(recipe, servings = 1) {
  const total = { grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 };
  recipe.ingredients.forEach((ingredient) => {
    const macros = getIngredientMacros(ingredient);
    total.grams += macros.grams;
    total.kcal += macros.kcal;
    total.protein += macros.protein;
    total.carbs += macros.carbs;
    total.fat += macros.fat;
  });

  Object.keys(total).forEach((key) => {
    total[key] *= number(servings, 1);
  });
  return total;
}

function getMenuMacros(menu) {
  const total = { grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 };
  (menu.items || []).forEach((item) => {
    const macros = getRecipeMacros(item, item.servings);
    Object.keys(total).forEach((key) => {
      total[key] += macros[key];
    });
  });
  return total;
}

function getDailySlotMacros(slots) {
  const total = { grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 };
  slots.forEach((slot) => {
    const recipe = state.recipes.find((item) => item.id === slot.recipeId);
    if (!recipe) return;
    const macros = getRecipeMacros(recipe, slot.servings);
    Object.keys(total).forEach((key) => {
      total[key] += macros[key];
    });
  });
  return total;
}

function getPlanMacros(plan) {
  const total = { grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 };
  plan.forEach((entry) => {
    const recipe = state.recipes.find((item) => item.id === entry.recipeId);
    if (!recipe) return;
    const macros = getRecipeMacros(recipe, entry.servings);
    Object.keys(total).forEach((key) => {
      total[key] += macros[key];
    });
  });
  return total;
}

function getTemporaryMacros() {
  const total = { grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 };
  state.temporaryItems.forEach((item) => {
    const macros = getIngredientMacros(item);
    Object.keys(total).forEach((key) => {
      total[key] += macros[key];
    });
  });
  return total;
}

function getDailyMacros() {
  const total = getDailySlotMacros([...state.dailySlots, ...state.extraSlots]);
  const temporary = getTemporaryMacros();
  Object.keys(total).forEach((key) => {
    total[key] += temporary[key];
  });
  return total;
}

function ensurePlanEntries() {
  state.recipes.forEach((recipe) => {
    if (!state.cookPlan.some((entry) => entry.recipeId === recipe.id)) {
      state.cookPlan.push({ recipeId: recipe.id, servings: 5 });
    }
    if (!state.dailyPlan.some((entry) => entry.recipeId === recipe.id)) {
      state.dailyPlan.push({ recipeId: recipe.id, servings: 1 });
    }
  });
  state.shoppingSelections = state.shoppingSelections || [];
  state.recipes.forEach((recipe) => {
    if (!state.shoppingSelections.some((entry) => entry.type === "recipe" && entry.id === recipe.id)) {
      state.shoppingSelections.push({ type: "recipe", id: recipe.id, servings: 0 });
    }
  });
  state.menus.forEach((menu) => {
    if (!state.shoppingSelections.some((entry) => entry.type === "menu" && entry.id === menu.id)) {
      state.shoppingSelections.push({ type: "menu", id: menu.id, servings: 0 });
    }
  });
  [...state.dailySlots, ...state.extraSlots].forEach((slot) => {
    const recipe = state.recipes.find((item) => item.id === slot.recipeId);
    if (recipe && !recipeHasTag(recipe, slot.tag)) {
      slot.recipeId = "";
    }
  });
}

function render() {
  ensurePlanEntries();
  renderStatus();
  renderFoodOptions();
  renderTargets();
  renderOverview();
  renderRecipes();
  renderMenus();
  renderShopping();
  renderFoods();
  renderLog();
}

function renderStatus() {
  const date = initialData.sourceLastWriteTime
    ? new Date(initialData.sourceLastWriteTime).toLocaleString("sv-SE")
    : "okänd tid";
  els.dataStatus.textContent = `${state.recipes.length} rätter · ${date}`;
}

function renderFoodOptions() {
  const names = state.foods
    .map((food) => food.name)
    .sort((a, b) => a.localeCompare(b, "sv"));
  els.foodOptions.innerHTML = names
    .map((name) => `<option value="${escapeHtml(name)}"></option>`)
    .join("");
  els.tagOptions.innerHTML = getAllTags()
    .map((tag) => `<option value="${escapeHtml(tag)}"></option>`)
    .join("");
}

function renderTargets() {
  const target = state.targets[activeTarget];
  els.targetMode.value = activeTarget;
  els.targetKcal.value = target.kcal;
  els.targetProtein.value = target.protein;
  els.targetCarbs.value = target.carbs;
  els.targetFat.value = target.fat;
}

function renderOverview(options = {}) {
  const renderTemporary = options.renderTemporary !== false;
  const total = getDailyMacros();
  const target = state.targets[activeTarget];
  els.metricCards.innerHTML = macroKeys
    .map(([key, label]) => {
      const value = total[key];
      const targetValue = number(target[key]);
      const ratio = targetValue ? value / targetValue : 0;
      const status = ratio > 1.08 ? "over" : ratio < 0.9 ? "warn" : "";
      const unit = key === "kcal" ? "" : " g";
      const diff = value - targetValue;
      const diffDigits = key === "kcal" ? 0 : 1;
      const deltaClass = Math.abs(diff) <= (key === "kcal" ? 100 : 10) ? "ok" : diff > 0 ? "over" : "warn";
      const deltaText = targetValue
        ? Math.abs(diff) <= (key === "kcal" ? 100 : 10)
          ? "nära mål"
          : diff > 0
            ? `+${format(diff, diffDigits)}${unit}`
            : `${format(Math.abs(diff), diffDigits)}${unit} kvar`
        : "inget mål";
      return `
        <article class="metric-card macro-${key} ${status}">
          <div class="metric-head">
            <span>${label}</span>
            <span class="metric-percent">${targetValue ? format(ratio * 100) : 0}%</span>
          </div>
          <strong>${format(value)}${unit}</strong>
          <div class="bar ${status}"><span style="width:${Math.min(ratio * 100, 130)}%"></span></div>
          <div class="metric-meta">
            <small>Mål ${format(targetValue)}${unit}</small>
            <span class="metric-delta ${deltaClass}">${deltaText}</span>
          </div>
        </article>
      `;
    })
    .join("");

  els.dailyPlan.innerHTML = [
    ...state.dailySlots.map((slot) => renderDailySlot(slot, true)),
    ...state.extraSlots.map((slot) => renderDailySlot(slot, false)),
  ].join("");

  if (renderTemporary) {
    els.temporaryItems.innerHTML = state.temporaryItems.length
      ? state.temporaryItems
          .map((item, index) => {
            const macros = getIngredientMacros(item);
            return `
              <div class="temporary-row">
                <div class="temporary-fields">
                  <input class="food-lookup" value="${escapeAttr(item.name)}" placeholder="Livsmedel" data-food-lookup data-temp="${index}" data-temp-field="name">
                  <input type="number" min="0" step="1" value="${number(item.grams)}" placeholder="g" data-temp="${index}" data-temp-field="grams">
                  <div class="temporary-macro">${format(macros.kcal)} kcal · ${format(macros.protein, 1)} g protein · ${format(macros.carbs, 1)} g kolh · ${format(macros.fat, 1)} g fett</div>
                </div>
                <button class="remove-ingredient" type="button" data-remove-temp="${index}" title="Ta bort">×</button>
              </div>
            `;
          })
          .join("")
      : `<div class="empty-state">Inget extra tillagt idag.</div>`;
  }

  els.suggestions.innerHTML = buildSuggestions(total, target)
    .map(
      (item) => `
        <div class="suggestion ${item.level}">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.body)}</span>
        </div>
      `,
    )
    .join("");
}

function renderDailySlot(slot, required) {
  const recipe = state.recipes.find((item) => item.id === slot.recipeId);
  const macros = recipe ? getRecipeMacros(recipe, slot.servings) : null;
  const options = getRecipesByTag(slot.tag)
    .map((item) => `<option value="${item.id}" ${item.id === slot.recipeId ? "selected" : ""}>${escapeHtml(item.name)}</option>`)
    .join("");
  const tagOptions = extraSlotTags
    .map((tag) => `<option value="${escapeAttr(tag)}" ${tag === slot.tag ? "selected" : ""}>${escapeHtml(tag)}</option>`)
    .join("");

  return `
    <div class="meal-slot ${required ? "required" : ""}">
      <div class="meal-slot-head">
        <strong>${escapeHtml(slot.label)}</strong>
        ${required ? `<span class="required-badge">Obligatorisk</span>` : `<button class="remove-ingredient" type="button" data-remove-extra-slot="${slot.id}" title="Ta bort">×</button>`}
      </div>
      ${required ? "" : `<select data-extra-slot-tag="${slot.id}">${tagOptions}</select>`}
      <div class="meal-slot-controls">
        <select data-daily-slot="${slot.id}">
          <option value="">Välj ${escapeHtml(slot.tag.toLowerCase())}</option>
          ${options}
        </select>
        <input type="number" min="0" step="0.25" value="${number(slot.servings, 1)}" data-daily-slot-servings="${slot.id}" title="Portioner">
      </div>
      <div class="muted">${macros ? `${format(macros.kcal)} kcal · ${format(macros.protein, 1)} g protein · ${format(macros.carbs, 1)} g kolh · ${format(macros.fat, 1)} g fett` : `Endast rätter taggade med ${slot.tag} visas här.`}</div>
    </div>
  `;
}

function renderMiniMeters(macros, className = "") {
  const target = state.targets[activeTarget];
  return `
    <div class="mini-meters ${className}">
      ${macroKeys.map(([key, label]) => {
        const targetValue = number(target[key]);
        const value = number(macros[key]);
        const ratio = targetValue ? value / targetValue : 0;
        const status = ratio > 1.08 ? "over" : ratio < 0.9 ? "warn" : "";
        const unit = key === "kcal" ? "" : " g";
        return `
          <div class="mini-meter">
            <div><span>${label}</span><strong>${format(value)}${unit}</strong></div>
            <div class="bar ${status}"><span style="width:${Math.min(ratio * 100, 130)}%"></span></div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function buildSuggestions(total, target) {
  const suggestions = [];
  const kcalDiff = number(target.kcal) - total.kcal;
  const proteinDiff = number(target.protein) - total.protein;
  const carbsDiff = number(target.carbs) - total.carbs;
  const fatDiff = number(target.fat) - total.fat;

  if (Math.abs(kcalDiff) <= 100 && Math.abs(proteinDiff) <= 12 && Math.abs(carbsDiff) <= 25 && Math.abs(fatDiff) <= 10) {
    suggestions.push({
      level: "",
      title: "Sitter bra",
      body: "Dagens upplägg ligger nära målet. Justera bara efter hunger, pass och vikttrend.",
    });
  }

  if (fatDiff > 12) {
    const oilGrams = Math.min(fatDiff, 20);
    const nutsGrams = Math.min(fatDiff / 0.5, 35);
    suggestions.push({
      level: "warning",
      title: "Fettet är lågt",
      body: `Lägg till ungefär ${format(oilGrams)} g olivolja eller ${format(nutsGrams)} g nötter. Ta resten via maten om gapet fortfarande är stort.`,
    });
  }

  if (carbsDiff > 35) {
    suggestions.push({
      level: "warning",
      title: "Kolhydraterna är låga",
      body: "Lägg till banan, riskakor, pasta, ris eller mer quinoa runt träningen.",
    });
  }

  if (proteinDiff > 20) {
    suggestions.push({
      level: "warning",
      title: "Protein saknas",
      body: "En extra skopa whey/casein eller mer kyckling/tonfisk löser gapet utan mycket extra fett.",
    });
  }

  if (kcalDiff < -150) {
    suggestions.push({
      level: "alert",
      title: "Kalorierna är höga",
      body: "Minska först pasta/quinoa/riskakor eller portionsstorlek på energitäta rätter.",
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      level: "",
      title: "Små marginaler",
      body: "Makrona är inom ett praktiskt spann. Följ midja, vikttrend och prestation innan du ändrar mer.",
    });
  }

  return suggestions;
}

function renderRecipes() {
  renderRecipeTagFilter();
  const recipes = activeRecipeTag === "all"
    ? state.recipes
    : state.recipes.filter((recipe) => recipeHasTag(recipe, activeRecipeTag));

  els.recipeGrid.innerHTML = recipes
    .map((recipe) => {
      const macros = getRecipeMacros(recipe);
      const isEditing = editingRecipeId === recipe.id;
      const ingredients = (recipe.ingredients || []).map((ingredient, index) => `
        <div class="ingredient-row">
          <input class="ingredient-name food-lookup" value="${escapeAttr(ingredient.name)}" data-food-lookup data-recipe="${recipe.id}" data-ingredient="${index}" data-field="name">
          <input class="ingredient-grams" type="number" min="0" step="1" value="${ingredient.grams}" data-recipe="${recipe.id}" data-ingredient="${index}" data-field="grams">
          <button class="remove-ingredient" type="button" data-remove-ingredient="${recipe.id}:${index}" title="Ta bort">×</button>
        </div>
      `).join("");

      return `
        <article class="recipe-card ${isEditing ? "editing" : "locked"}">
          <div class="recipe-title-row">
            ${isEditing ? `<input value="${escapeAttr(recipe.name)}" data-recipe-name="${recipe.id}">` : `<h3>${escapeHtml(recipe.name)}</h3>`}
            <div class="card-actions">
              <button type="button" data-edit-recipe="${recipe.id}">${isEditing ? "Klar" : "Redigera"}</button>
              ${isEditing ? `<button class="delete-recipe" type="button" data-delete-recipe="${recipe.id}" title="Ta bort rätt">×</button>` : ""}
            </div>
          </div>
          ${renderTagChips(recipe.id, recipe.tags || [], isEditing)}
          <div class="macro-chips">
            <span class="chip">${format(macros.kcal)} kcal</span>
            <span class="chip">${format(macros.protein, 1)} g protein</span>
            <span class="chip">${format(macros.carbs, 1)} g kolh</span>
            <span class="chip">${format(macros.fat, 1)} g fett</span>
            <span class="chip">${format(macros.grams)} g</span>
          </div>
          ${isEditing ? `
            <div class="ingredient-list">${ingredients}</div>
            <button class="add-ingredient" type="button" data-add-ingredient="${recipe.id}">Lägg till ingrediens</button>
            ${renderRecipeAdvice(recipe)}
          ` : ""}
        </article>
      `;
    })
    .join("");
}

function renderTagChips(recipeId, tags, editable) {
  return `
    <div class="tag-editor">
      <div class="tag-chip-list">
        ${tags.map((tag) => `<span class="tag-chip">${escapeHtml(tag)}${editable ? `<button type="button" data-remove-tag="${recipeId}:${escapeAttr(tag)}" title="Ta bort tagg">×</button>` : ""}</span>`).join("")}
        ${editable ? `<button class="tag-chip phantom-tag" type="button" data-show-tag-input="${recipeId}">+ tagg</button><input class="phantom-tag-input" list="tagOptions" hidden data-new-tag="${recipeId}" placeholder="Skriv tagg">` : ""}
      </div>
    </div>
  `;
}

function renderRecipeAdvice(recipe) {
  const macros = getRecipeMacros(recipe);
  const target = state.targets[activeTarget];
  const tips = [];
  if (macros.protein < target.protein * 0.2) tips.push("Proteinet är lågt för en huvudmåltid. Öka kyckling, tonfisk, kvarg eller lägg till whey om rätten passar.");
  if (macros.fat < target.fat * 0.12) tips.push("Fettet är väldigt lågt. Lite olivolja, avokado, nötter eller fetare fisk kan göra rätten mer balanserad.");
  if (macros.carbs > target.carbs * 0.45) tips.push("Kolhydraterna tar stor plats. Bra runt träning, men minska pasta/ris/quinoa om det här ska vara vilodagsmat.");
  if (!recipe.ingredients.some((item) => /broccoli|paprika|lök|tomat|grönsak|bönor|spenat|morot/i.test(item.name))) {
    tips.push("Lägg gärna till grönsaker eller baljväxter för fiber, kalium, folat och bättre mättnad.");
  }
  if (!tips.length) tips.push("Rätten ser balanserad ut mot dina mål. Finjustera främst portionen efter dagens total.");
  return `
    <div class="recipe-advice">
      <strong>Förslag</strong>
      ${tips.map((tip) => `<p>${escapeHtml(tip)}</p>`).join("")}
    </div>
  `;
}

function renderRecipeTagFilter() {
  const tags = getAllTags();
  els.recipeTagFilter.innerHTML = [
    `<option value="all">Alla taggar</option>`,
    ...tags.map((tag) => `<option value="${escapeAttr(tag)}">${escapeHtml(tag)}</option>`),
  ].join("");
  els.recipeTagFilter.value = tags.includes(activeRecipeTag) ? activeRecipeTag : "all";
  activeRecipeTag = els.recipeTagFilter.value;
}

function renderMenus() {
  if (!selectedMenuId && state.menus[0]) {
    selectedMenuId = state.menus[0].id;
  }
  if (selectedMenuId && !state.menus.some((menu) => menu.id === selectedMenuId)) {
    selectedMenuId = state.menus[0]?.id || "";
  }

  els.menuList.innerHTML = state.menus.length
    ? state.menus
        .map((menu) => {
          const macros = getMenuMacros(menu);
          return `
            <button class="menu-list-item ${menu.id === selectedMenuId ? "active" : ""}" type="button" data-select-menu="${menu.id}">
              <strong>${escapeHtml(menu.name)}</strong>
              <span>${menu.items.length} rätter · ${format(macros.kcal)} kcal</span>
              ${renderMiniMeters(macros, "compact")}
            </button>
          `;
        })
        .join("")
    : `<div class="empty-state">Ingen meny ännu.</div>`;

  const menu = state.menus.find((item) => item.id === selectedMenuId);
  if (!menu) {
    els.menuDetail.innerHTML = `<div class="empty-state">Skapa en meny för att börja lägga till rätter.</div>`;
    return;
  }

  const macros = getMenuMacros(menu);
  const recipeOptions = state.recipes
    .map((recipe) => `<option value="${recipe.id}">${escapeHtml(recipe.name)}</option>`)
    .join("");
  const items = menu.items
    .map((item) => renderMenuItem(menu.id, item))
    .join("");

  els.menuDetail.innerHTML = `
    <div class="menu-title-row">
      <input value="${escapeAttr(menu.name)}" data-menu-name="${menu.id}">
      <button class="delete-recipe" type="button" data-delete-menu="${menu.id}" title="Ta bort meny">×</button>
    </div>
    <div class="macro-chips">
      <span class="chip">${format(macros.kcal)} kcal</span>
      <span class="chip">${format(macros.protein, 1)} g protein</span>
      <span class="chip">${format(macros.carbs, 1)} g kolh</span>
      <span class="chip">${format(macros.fat, 1)} g fett</span>
      <span class="chip">${format(macros.grams)} g</span>
    </div>
    ${renderMiniMeters(macros)}
    <div class="add-menu-recipe">
      <span>Välj grundrätt</span>
      <select data-menu-recipe-source="${menu.id}">
        ${recipeOptions}
      </select>
      <button type="button" data-add-menu-recipe="${menu.id}">Lägg till rätt</button>
    </div>
    <div class="menu-item-list">${items || `<div class="empty-state">Menyn är tom.</div>`}</div>
  `;
}

function renderMenuItem(menuId, item) {
  const macros = getRecipeMacros(item, item.servings);
  const isExpanded = expandedMenuItemId === item.id;
  const ingredients = (item.ingredients || [])
    .map((ingredient, index) => `
      <div class="ingredient-row">
        <input class="ingredient-name food-lookup" value="${escapeAttr(ingredient.name)}" data-food-lookup data-menu="${menuId}" data-menu-item="${item.id}" data-menu-ingredient="${index}" data-field="name">
        <input class="ingredient-grams" type="number" min="0" step="1" value="${ingredient.grams}" data-menu="${menuId}" data-menu-item="${item.id}" data-menu-ingredient="${index}" data-field="grams">
        <button class="remove-ingredient" type="button" data-remove-menu-ingredient="${menuId}:${item.id}:${index}" title="Ta bort">×</button>
      </div>
    `)
    .join("");

  return `
    <article class="menu-item ${isExpanded ? "expanded" : "collapsed"}" ${isExpanded ? "" : `data-toggle-menu-item="${item.id}"`}>
      <div class="menu-item-head">
        ${isExpanded ? `<input value="${escapeAttr(item.name)}" data-menu-item-name="${menuId}:${item.id}">` : `<button class="menu-item-toggle" type="button" data-toggle-menu-item="${item.id}"><strong>${escapeHtml(item.name)}</strong><span>${item.ingredients.length} ingredienser</span></button>`}
        <input type="number" min="0" step="0.25" value="${number(item.servings, 1)}" data-menu-item-servings="${menuId}:${item.id}" title="Portioner">
        <button class="delete-recipe" type="button" data-remove-menu-item="${menuId}:${item.id}" title="Ta bort rätt">×</button>
      </div>
      <div class="macro-chips">
        <span class="chip">${format(macros.kcal)} kcal</span>
        <span class="chip">${format(macros.protein, 1)} g protein</span>
        <span class="chip">${format(macros.carbs, 1)} g kolh</span>
        <span class="chip">${format(macros.fat, 1)} g fett</span>
      </div>
      ${isExpanded ? `
        <div class="ingredient-list">${ingredients}</div>
        <button class="add-ingredient" type="button" data-add-menu-ingredient="${menuId}:${item.id}">Lägg till ingrediens</button>
      ` : ""}
    </article>
  `;
}

function renderShopping() {
  els.shoppingSelectors.innerHTML = `
    <div class="selector-group">
      <h4>Rätter</h4>
      ${state.recipes.map((recipe) => renderShoppingSelection("recipe", recipe.id, recipe.name, getRecipeMacros(recipe))).join("")}
    </div>
    <div class="selector-group">
      <h4>Menyer</h4>
      ${state.menus.length ? state.menus.map((menu) => renderShoppingSelection("menu", menu.id, menu.name, getMenuMacros(menu))).join("") : `<div class="empty-state">Inga menyer ännu.</div>`}
    </div>
  `;

  const items = getShoppingList();
  els.shoppingRows.innerHTML = items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td>${format(item.grams)}</td>
          <td>${escapeHtml(formatPracticalAmount(item.name, item.grams))}</td>
        </tr>
      `,
    )
    .join("");
}

function renderShoppingSelection(type, id, name, macros) {
  const entry = getShoppingSelection(type, id);
  return `
    <label class="shopping-choice">
      <input type="checkbox" ${number(entry.servings) > 0 ? "checked" : ""} data-shopping-toggle="${type}:${id}">
      <div>
        <strong>${escapeHtml(name)}</strong>
        <span>${format(macros.kcal)} kcal · ${format(macros.protein, 1)} g protein</span>
      </div>
      <input type="number" min="0" step="1" value="${number(entry.servings)}" data-shopping-servings="${type}:${id}" title="Antal">
    </label>
  `;
}

function getShoppingSelection(type, id) {
  let entry = state.shoppingSelections.find((item) => item.type === type && item.id === id);
  if (!entry) {
    entry = { type, id, servings: 0 };
    state.shoppingSelections.push(entry);
  }
  return entry;
}

function getShoppingList() {
  const totals = new Map();
  const addRecipeIngredients = (recipe, servings) => {
    recipe.ingredients.forEach((ingredient) => {
      const key = ingredient.name.trim();
      if (!key) return;
      totals.set(key, number(totals.get(key)) + number(ingredient.grams) * number(servings));
    });
  };

  state.shoppingSelections.forEach((entry) => {
    const servings = number(entry.servings);
    if (servings <= 0) return;
    if (entry.type === "recipe") {
      const recipe = state.recipes.find((item) => item.id === entry.id);
      if (recipe) addRecipeIngredients(recipe, servings);
      return;
    }
    if (entry.type === "menu") {
      const menu = state.menus.find((item) => item.id === entry.id);
      menu?.items.forEach((item) => addRecipeIngredients(item, servings * number(item.servings, 1)));
    }
  });

  return [...totals.entries()]
    .map(([name, grams]) => ({ name, grams }))
    .sort((a, b) => a.name.localeCompare(b.name, "sv"));
}

function formatPracticalAmount(name, grams) {
  const lower = name.toLowerCase();
  if (lower.includes("tonfisk")) return `${Math.ceil(grams / 120)} burkar à ca 120 g avrunnet`;
  if (lower.includes("krossad") || lower.includes("tomat")) return `${Math.ceil(grams / 400)} förp. à ca 400 g`;
  if (lower.includes("keso")) return `${Math.ceil(grams / 500)} förp. à ca 500 g`;
  if (lower.includes("paprika")) return `${Math.ceil(grams / 150)} st`;
  if (lower.includes("lök")) return `${Math.ceil(grams / 100)} st`;
  if (lower.includes("broccoli")) return `${Math.ceil(grams / 500)} påse à ca 500 g`;
  if (lower.includes("quinoa") || lower.includes("pasta") || lower.includes("havre")) return `${Math.ceil(grams / 500)} paket à ca 500 g`;
  if (lower.includes("whey") || lower.includes("casein")) return `${format(grams)} g`;
  return grams >= 1000 ? `${format(grams / 1000, 1)} kg` : `${format(grams)} g`;
}

function renderFoods() {
  const query = els.foodSearch.value.trim().toLowerCase();
  const foods = state.foods
    .filter((food) => !query || food.name.toLowerCase().includes(query) || String(food.group || "").toLowerCase().includes(query))
    .slice(0, 200);
  els.foodRows.innerHTML = foods
    .map((food) => {
      const index = state.foods.indexOf(food);
      if (food.source === "Eget") {
        return `
          <tr>
            <td><input value="${escapeAttr(food.name)}" data-food="${index}" data-food-field="name"></td>
            <td><input type="number" min="0" step="1" value="${number(food.kcal)}" data-food="${index}" data-food-field="kcal"></td>
            <td><input type="number" min="0" step="0.1" value="${number(food.protein)}" data-food="${index}" data-food-field="protein"></td>
            <td><input type="number" min="0" step="0.1" value="${number(food.carbs)}" data-food="${index}" data-food-field="carbs"></td>
            <td><input type="number" min="0" step="0.1" value="${number(food.fat)}" data-food="${index}" data-food-field="fat"></td>
            <td><span class="source-badge">Eget</span></td>
          </tr>
        `;
      }
      return `
        <tr>
          <td>${escapeHtml(food.name)}<div class="muted">${escapeHtml(food.group || "")}</div></td>
          <td>${format(food.kcal)}</td>
          <td>${format(food.protein, 1)}</td>
          <td>${format(food.carbs, 1)}</td>
          <td>${format(food.fat, 1)}</td>
          <td><span class="source-badge">${escapeHtml(food.source || "")}</span></td>
        </tr>
      `;
    })
    .join("");
}

function addRecipe() {
  const id = makeId("ratt");
  state.recipes.push({
    id,
    name: "Ny rätt",
    defaultServings: 1,
    ingredients: [{ name: "", grams: 100 }],
    tags: [],
  });
  state.cookPlan.push({ recipeId: id, servings: 5 });
  state.dailyPlan.push({ recipeId: id, servings: 1 });
  saveState();
  render();
}

function addMenu() {
  const id = makeId("meny");
  state.menus.push({
    id,
    name: `Meny ${state.menus.length + 1}`,
    items: [],
  });
  selectedMenuId = id;
  saveState();
  renderMenus();
}

function cloneRecipeForMenu(recipe) {
  return {
    id: makeId("menyratt"),
    sourceRecipeId: recipe.id,
    name: recipe.name,
    servings: 1,
    tags: clone(recipe.tags || []),
    ingredients: clone(recipe.ingredients || []),
  };
}

function findMenu(menuId) {
  return state.menus.find((menu) => menu.id === menuId);
}

function findMenuItem(menuId, itemId) {
  const menu = findMenu(menuId);
  return menu?.items.find((item) => item.id === itemId);
}

function addTagToRecipe(recipeId, value) {
  const recipe = state.recipes.find((item) => item.id === recipeId);
  const tag = String(value || "").trim();
  if (!recipe || !tag) return;
  if (!(recipe.tags || []).some((item) => normalizeTag(item) === normalizeTag(tag))) {
    recipe.tags = [...(recipe.tags || []), tag];
  }
  saveState();
  render();
}

function addFood() {
  const name = `Eget livsmedel ${state.foods.filter((food) => food.source === "Eget").length + 1}`;
  state.foods.unshift({
    id: `eget:${name.toLowerCase()}`,
    name,
    group: "Eget",
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    source: "Eget",
  });
  saveState();
  render();
}

function addTemporaryItem() {
  hideFoodSuggest();
  state.temporaryItems.push({
    id: `temp-${Date.now()}`,
    name: "Banan",
    grams: 100,
  });
  hydrateTemporaryItem(state.temporaryItems[state.temporaryItems.length - 1]);
  saveState();
  renderOverview();
}

function addExtraSlot() {
  const tag = "Mellanmål";
  state.extraSlots.push({
    id: makeId("extra"),
    label: tag,
    tag,
    recipeId: "",
    servings: 1,
  });
  saveState();
  renderOverview();
}

function hydrateTemporaryItem(item) {
  hydrateFoodBackedItem(item);
}

function updateFoodBackedField(input, forceRender = false) {
  const field = input.dataset.field || input.dataset.tempField;
  if (field && field !== "name") return false;

  const tempIndex = input.dataset.temp;
  if (tempIndex !== undefined) {
    const item = state.temporaryItems[number(tempIndex)];
    if (item) {
      item.name = input.value;
      hydrateFoodBackedItem(item);
      saveState();
      if (forceRender) renderOverview();
      else renderOverview({ renderTemporary: false });
    }
    return true;
  }

  const recipeId = input.dataset.recipe;
  const ingredientIndex = input.dataset.ingredient;
  if (recipeId && ingredientIndex !== undefined) {
    const recipe = state.recipes.find((item) => item.id === recipeId);
    const ingredient = recipe?.ingredients[number(ingredientIndex)];
    if (ingredient) {
      ingredient.name = input.value;
      hydrateFoodBackedItem(ingredient);
      saveState();
      renderOverview();
      renderShopping();
      if (forceRender) renderRecipes();
    }
    return true;
  }

  const menuId = input.dataset.menu;
  const menuItemId = input.dataset.menuItem;
  const menuIngredientIndex = input.dataset.menuIngredient;
  if (menuId && menuItemId && menuIngredientIndex !== undefined) {
    const item = findMenuItem(menuId, menuItemId);
    const ingredient = item?.ingredients[number(menuIngredientIndex)];
    if (ingredient) {
      ingredient.name = input.value;
      hydrateFoodBackedItem(ingredient);
      saveState();
      if (forceRender) renderMenus();
    }
    return true;
  }

  return false;
}

function logToday() {
  const today = new Date().toISOString().slice(0, 10);
  const macros = getDailyMacros();
  const meals = [...state.dailySlots, ...state.extraSlots].map((slot) => {
    const recipe = state.recipes.find((item) => item.id === slot.recipeId);
    return {
      label: slot.label,
      tag: slot.tag,
      recipeId: slot.recipeId,
      recipeName: recipe?.name || "",
      servings: number(slot.servings, 1),
    };
  });
  const entry = {
    id: makeId("logg"),
    date: today,
    targetMode: activeTarget,
    macros,
    meals,
    temporaryItems: clone(state.temporaryItems),
  };
  state.logEntries = state.logEntries.filter((item) => item.date !== today);
  state.logEntries.unshift(entry);
  saveState();
  renderLog();
}

function renderLog() {
  const entries = [...(state.logEntries || [])].sort((a, b) => b.date.localeCompare(a.date));
  els.logEntries.innerHTML = entries.length
    ? entries.map((entry) => renderLogEntry(entry)).join("")
    : `<div class="empty-state">Ingen dag registrerad ännu.</div>`;

  const recent = entries.slice(0, 14);
  if (!recent.length) {
    els.logSummary.innerHTML = `<div class="empty-state">Registrera dagar för att se snitt.</div>`;
    renderCoachChat();
    return;
  }
  const avg = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  recent.forEach((entry) => {
    macroKeys.forEach(([key]) => {
      avg[key] += number(entry.macros[key]);
    });
  });
  macroKeys.forEach(([key]) => {
    avg[key] /= recent.length;
  });
  els.logSummary.innerHTML = `
    <div class="suggestion">
      <strong>Snitt senaste ${recent.length} dagar</strong>
      <span>${format(avg.kcal)} kcal · ${format(avg.protein, 1)} g protein · ${format(avg.carbs, 1)} g kolh · ${format(avg.fat, 1)} g fett</span>
    </div>
    ${renderMiniMeters(avg)}
    ${renderCoachInsights(entries, avg)}
  `;
  renderCoachChat();
}

function renderLogEntry(entry) {
  const isEditing = editingLogId === entry.id;
  if (!isEditing) {
    return `
      <div class="log-entry clickable" data-edit-log="${entry.id}">
        <div class="log-entry-head">
          <strong>${escapeHtml(entry.date)}</strong>
          <button class="remove-ingredient" type="button" data-delete-log="${entry.id}" title="Ta bort">×</button>
        </div>
        ${renderMiniMeters(entry.macros)}
        <div class="muted">${entry.meals.map((meal) => `${meal.label}: ${meal.recipeName || "tom"}`).join(" · ")}</div>
      </div>
    `;
  }

  return `
    <div class="log-entry editing">
      <div class="log-entry-head">
        <input type="date" value="${escapeAttr(entry.date)}" data-log-field="${entry.id}:date">
        <button type="button" data-close-log="${entry.id}">Klar</button>
      </div>
      <div class="log-edit-grid">
        <label>kcal<input type="number" min="0" step="10" value="${number(entry.macros.kcal)}" data-log-macro="${entry.id}:kcal"></label>
        <label>protein<input type="number" min="0" step="1" value="${number(entry.macros.protein)}" data-log-macro="${entry.id}:protein"></label>
        <label>kolh<input type="number" min="0" step="1" value="${number(entry.macros.carbs)}" data-log-macro="${entry.id}:carbs"></label>
        <label>fett<input type="number" min="0" step="1" value="${number(entry.macros.fat)}" data-log-macro="${entry.id}:fat"></label>
      </div>
      <textarea data-log-field="${entry.id}:notes" placeholder="Noteringar, hunger, energi, träning">${escapeHtml(entry.notes || "")}</textarea>
      <div class="muted">${entry.meals.map((meal) => `${meal.label}: ${meal.recipeName || "tom"}`).join(" · ")}</div>
    </div>
  `;
}

function renderCoachInsights(entries, avg) {
  const insights = buildCoachInsights(entries, avg);
  return insights.map((item) => `
    <div class="suggestion ${item.level}">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.body)}</span>
    </div>
  `).join("");
}

function buildCoachInsights(entries, avg) {
  const target = state.targets[activeTarget];
  const insights = [];
  const proteinGap = number(target.protein) - number(avg.protein);
  const carbsGap = number(target.carbs) - number(avg.carbs);
  const fatGap = number(target.fat) - number(avg.fat);
  const kcalGap = number(target.kcal) - number(avg.kcal);
  const allNames = entries.flatMap((entry) => [
    ...(entry.meals || []).map((meal) => meal.recipeName),
    ...(entry.temporaryItems || []).map((item) => item.name),
  ]).filter(Boolean);
  const uniqueNames = new Set(allNames.map((name) => name.toLowerCase()));
  const vegHits = allNames.filter((name) => /broccoli|paprika|lök|tomat|bön|spenat|morot|grön|sallad|frukt|banan/i.test(name)).length;
  const fishHits = allNames.filter((name) => /tonfisk|lax|torsk|fisk|makrill|sill/i.test(name)).length;

  if (Math.abs(kcalGap) > 150) {
    insights.push({
      level: kcalGap > 0 ? "warning" : "alert",
      title: kcalGap > 0 ? "Energin ligger lågt" : "Energin ligger högt",
      body: kcalGap > 0 ? "Höj främst med kolhydrater runt träning och lite fett från olivolja/nötter." : "Dra först ner portionsstorlek på pasta/quinoa/olja innan du rör proteinmaten.",
    });
  }
  if (proteinGap > 15) {
    insights.push({ level: "warning", title: "Protein behöver upp", body: "Lägg in en tydlig proteinkälla i varje huvudmål: kyckling, fisk, ägg, kvarg, tofu eller baljväxter." });
  }
  if (fatGap > 12) {
    insights.push({ level: "warning", title: "Fettkvalitet", body: "Sikta på små mängder olivolja, nötter, avokado eller fet fisk i stället för att lösa allt med stora mängder olja." });
  }
  if (carbsGap > 35) {
    insights.push({ level: "warning", title: "Träningsbränsle", body: "Lägg mer kolhydrater nära passet: banan, ris, potatis, pasta, havre eller quinoa." });
  }
  if (uniqueNames.size < Math.min(8, allNames.length)) {
    insights.push({ level: "", title: "Variation", body: "Du upprepar många samma rätter. Byt grönsak, proteinkälla eller kolhydratbas några dagar i veckan för fler mikronäringsämnen." });
  }
  if (vegHits < entries.length * 2) {
    insights.push({ level: "", title: "Fiber och mineraler", body: "Lägg in mer grönsaker, bär, baljväxter eller frukt. Det hjälper mättnad, kalium, folat och tarmhälsa utan att störa makromålet." });
  }
  if (fishHits < 2 && entries.length >= 7) {
    insights.push({ level: "", title: "Omega-3 och jod", body: "Överväg fisk 2 gånger per vecka eller variera med skaldjur/ägg/berikade alternativ beroende på vad du gillar." });
  }
  if (!insights.length) {
    insights.push({ level: "", title: "Bra riktning", body: "Snittet ligger nära målet. Fortsätt logga och justera små saker, inte hela kostupplägget på en gång." });
  }
  return insights;
}

function renderCoachChat() {
  const messages = state.coachMessages || [];
  els.coachChat.innerHTML = messages.length
    ? messages.map((message) => `<div class="coach-message ${message.role}">${escapeHtml(message.text)}</div>`).join("")
    : `<div class="empty-state">Fråga t.ex. “hur ska jag tänka den här veckan?” eller “vad saknas i min variation?”.</div>`;
}

function sendCoachMessage() {
  const text = els.coachInput.value.trim();
  if (!text) return;
  state.coachMessages.push({ role: "user", text });
  state.coachMessages.push({ role: "coach", text: buildCoachReply(text) });
  els.coachInput.value = "";
  saveState();
  renderCoachChat();
}

function buildCoachReply(question) {
  const entries = [...(state.logEntries || [])].sort((a, b) => b.date.localeCompare(a.date));
  const recent = entries.slice(0, 14);
  if (!recent.length) {
    return "Börja med att registrera 3-4 dagar. Då kan jag se om snittet missar energi, protein, kolhydrater eller fett och ge bättre råd om variation.";
  }
  const avg = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  recent.forEach((entry) => macroKeys.forEach(([key]) => { avg[key] += number(entry.macros[key]); }));
  macroKeys.forEach(([key]) => { avg[key] /= recent.length; });
  const insights = buildCoachInsights(recent, avg);
  const q = question.toLowerCase();
  if (q.includes("variation") || q.includes("variera")) {
    return "Tänk variation som små byten, inte ett helt nytt liv: rotera proteinkälla, grönsak och kolhydratbas. Behåll makrona genom att byta ungefär gram mot gram inom samma kategori.";
  }
  if (q.includes("protein")) {
    return `Ditt senaste snitt är ${format(avg.protein, 1)} g protein. Prioritera 35-55 g protein i frukost/lunch/middag och använd whey/casein bara för att täcka luckor.`;
  }
  if (q.includes("fett")) {
    return `Ditt senaste snitt är ${format(avg.fat, 1)} g fett. Höj med små doser: 10-20 g olivolja, 20-35 g nötter, ägg eller fet fisk. Undvik att “lösa” allt med jättemycket olja.`;
  }
  if (q.includes("kolh") || q.includes("carb") || q.includes("träning")) {
    return `Ditt senaste snitt är ${format(avg.carbs, 1)} g kolhydrater. Lägg mer runt passet om prestation saknas: banan, havre, ris, pasta eller potatis.`;
  }
  return `${insights[0].title}: ${insights[0].body} Snittet senaste ${recent.length} dagar är ${format(avg.kcal)} kcal, ${format(avg.protein, 1)} g protein, ${format(avg.carbs, 1)} g kolh och ${format(avg.fat, 1)} g fett.`;
}

function updateTargetInputs() {
  const target = state.targets[activeTarget];
  target.kcal = number(els.targetKcal.value);
  target.protein = number(els.targetProtein.value);
  target.carbs = number(els.targetCarbs.value);
  target.fat = number(els.targetFat.value);
  saveState();
  renderOverview();
}

function bindInstallPrompt() {
  if (!els.installApp) return;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    els.installApp.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    els.installApp.hidden = true;
  });

  els.installApp.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice.catch(() => null);
    deferredInstallPrompt = null;
    els.installApp.hidden = true;
  });
}

function bindEvents() {
  bindInstallPrompt();

  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      els.tabs.forEach((item) => item.classList.remove("active"));
      els.views.forEach((view) => view.classList.remove("active"));
      tab.classList.add("active");
      document.querySelector(`#${tab.dataset.view}`).classList.add("active");
    });
  });

  els.targetMode.addEventListener("change", () => {
    activeTarget = els.targetMode.value;
    render();
  });
  [els.targetKcal, els.targetProtein, els.targetCarbs, els.targetFat].forEach((input) => {
    input.addEventListener("change", updateTargetInputs);
  });

  els.foodSearch.addEventListener("input", renderFoods);
  els.recipeTagFilter.addEventListener("change", () => {
    activeRecipeTag = els.recipeTagFilter.value;
    renderRecipes();
  });
  els.addRecipe.addEventListener("click", addRecipe);
  els.addMenu.addEventListener("click", addMenu);
  els.addFood.addEventListener("click", addFood);
  els.addTemporaryItem.addEventListener("click", addTemporaryItem);
  els.addExtraSlot.addEventListener("click", addExtraSlot);
  els.logToday.addEventListener("click", logToday);
  els.sendCoachMessage.addEventListener("click", sendCoachMessage);
  els.coachInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendCoachMessage();
    }
  });

  els.resetData.addEventListener("click", () => {
    localStorage.removeItem(STORE_KEY);
    state = loadState();
    render();
  });

  els.saveBackup.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `matdash-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) {
      const logField = target.dataset.logField;
      if (logField) {
        const [logId, field] = logField.split(":");
        const entry = state.logEntries.find((item) => item.id === logId);
        if (entry) entry[field] = target.value;
        saveState();
      }
      return;
    }
    if (!(target instanceof HTMLInputElement)) return;

    if (target.dataset.foodLookup !== undefined) {
      updateFoodBackedField(target, false);
      showFoodSuggest(target);
      return;
    }

    const dailyId = target.dataset.daily;
    if (dailyId) {
      const entry = state.dailyPlan.find((item) => item.recipeId === dailyId);
      if (entry) entry.servings = number(target.value);
      saveState();
      renderOverview();
      return;
    }

    const dailySlotServings = target.dataset.dailySlotServings;
    if (dailySlotServings) {
      const slot = [...state.dailySlots, ...state.extraSlots].find((item) => item.id === dailySlotServings);
      if (slot) slot.servings = number(target.value, 1);
      saveState();
      renderOverview();
      return;
    }

    const shoppingServings = target.dataset.shoppingServings;
    if (shoppingServings) {
      const [type, id] = shoppingServings.split(":");
      const entry = getShoppingSelection(type, id);
      entry.servings = number(target.value);
      saveState();
      renderShopping();
      return;
    }

    const logMacro = target.dataset.logMacro;
    if (logMacro) {
      const [logId, key] = logMacro.split(":");
      const entry = state.logEntries.find((item) => item.id === logId);
      if (entry) {
        entry.macros[key] = number(target.value);
      }
      saveState();
      return;
    }

    const logField = target.dataset.logField;
    if (logField) {
      const [logId, field] = logField.split(":");
      const entry = state.logEntries.find((item) => item.id === logId);
      if (entry) entry[field] = target.value;
      saveState();
      return;
    }

    const tempIndex = target.dataset.temp;
    const tempField = target.dataset.tempField;
    if (tempIndex !== undefined && tempField) {
      const item = state.temporaryItems[number(tempIndex)];
      if (item) {
        item[tempField] = tempField === "grams" ? number(target.value) : target.value;
        if (tempField === "name") {
          hydrateTemporaryItem(item);
        }
      }
      saveState();
      renderOverview({ renderTemporary: false });
      return;
    }

    const cookId = target.dataset.cook;
    if (cookId) {
      const entry = state.cookPlan.find((item) => item.recipeId === cookId);
      if (entry) entry.servings = number(target.value);
      saveState();
      renderShopping();
      return;
    }

    const recipeNameId = target.dataset.recipeName;
    if (recipeNameId) {
      const recipe = state.recipes.find((item) => item.id === recipeNameId);
      if (recipe) recipe.name = target.value;
      saveState();
      renderOverview();
      renderShopping();
      return;
    }

    const menuNameId = target.dataset.menuName;
    if (menuNameId) {
      const menu = findMenu(menuNameId);
      if (menu) menu.name = target.value;
      saveState();
      return;
    }

    const menuItemName = target.dataset.menuItemName;
    if (menuItemName) {
      const [menuId, itemId] = menuItemName.split(":");
      const item = findMenuItem(menuId, itemId);
      if (item) item.name = target.value;
      saveState();
      return;
    }

    const menuItemServings = target.dataset.menuItemServings;
    if (menuItemServings) {
      const [menuId, itemId] = menuItemServings.split(":");
      const item = findMenuItem(menuId, itemId);
      if (item) item.servings = number(target.value, 1);
      saveState();
      renderMenus();
      return;
    }

    const recipeId = target.dataset.recipe;
    const ingredientIndex = target.dataset.ingredient;
    const field = target.dataset.field;
    if (recipeId && ingredientIndex !== undefined && field) {
      const recipe = state.recipes.find((item) => item.id === recipeId);
      const ingredient = recipe?.ingredients[number(ingredientIndex)];
      if (ingredient) {
        ingredient[field] = field === "grams" ? number(target.value) : target.value;
        const food = findFood(ingredient.name);
        if (food) {
          ingredient.kcal100 = food.kcal;
          ingredient.protein100 = food.protein;
          ingredient.carbs100 = food.carbs;
          ingredient.fat100 = food.fat;
        }
      }
      saveState();
      renderOverview();
      renderShopping();
      return;
    }

    const menuId = target.dataset.menu;
    const menuItemId = target.dataset.menuItem;
    const menuIngredientIndex = target.dataset.menuIngredient;
    if (menuId && menuItemId && menuIngredientIndex !== undefined && target.dataset.field) {
      const item = findMenuItem(menuId, menuItemId);
      const ingredient = item?.ingredients[number(menuIngredientIndex)];
      if (ingredient) {
        ingredient[target.dataset.field] = target.dataset.field === "grams" ? number(target.value) : target.value;
        const food = findFood(ingredient.name);
        if (food) {
          ingredient.kcal100 = food.kcal;
          ingredient.protein100 = food.protein;
          ingredient.carbs100 = food.carbs;
          ingredient.fat100 = food.fat;
        }
      }
      saveState();
      return;
    }

    const foodIndex = target.dataset.food;
    const foodField = target.dataset.foodField;
    if (foodIndex !== undefined && foodField) {
      const food = state.foods[number(foodIndex)];
      if (food && food.source === "Eget") {
        food[foodField] = foodField === "name" ? target.value : number(target.value);
      }
      saveState();
      renderFoodOptions();
      renderOverview();
      renderShopping();
    }
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (target instanceof HTMLSelectElement) {
      const dailySlotId = target.dataset.dailySlot;
      if (dailySlotId) {
        const slot = [...state.dailySlots, ...state.extraSlots].find((item) => item.id === dailySlotId);
        if (slot) slot.recipeId = target.value;
        saveState();
        renderOverview();
        return;
      }

      const extraSlotTagId = target.dataset.extraSlotTag;
      if (extraSlotTagId) {
        const slot = state.extraSlots.find((item) => item.id === extraSlotTagId);
        if (slot) {
          slot.tag = target.value;
          slot.label = target.value;
          slot.recipeId = "";
        }
        saveState();
        renderOverview();
        return;
      }
      return;
    }

    if (!(target instanceof HTMLInputElement)) return;
    const shoppingToggle = target.dataset.shoppingToggle;
    if (shoppingToggle) {
      const [type, id] = shoppingToggle.split(":");
      const entry = getShoppingSelection(type, id);
      entry.servings = target.checked ? Math.max(number(entry.servings), 1) : 0;
      saveState();
      renderShopping();
      return;
    }

    if (target.dataset.temp !== undefined) {
      renderOverview();
      return;
    }
    if (target.dataset.logMacro || target.dataset.logField) {
      renderLog();
      return;
    }
    if (
      target.dataset.menuName ||
      target.dataset.menuItemName ||
      target.dataset.menu !== undefined
    ) {
      renderRecipes();
      renderMenus();
      return;
    }
    if (target.dataset.recipe || target.dataset.food !== undefined) {
      renderRecipes();
      renderFoods();
    }
  });

  document.addEventListener("focusin", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.dataset.foodLookup !== undefined) {
      showFoodSuggest(target);
    }
  });

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.dataset.foodLookup !== undefined) {
      if (event.key === "Enter") {
        const [match] = getFoodMatches(target.value, 1);
        if (match) {
          event.preventDefault();
          applyFoodToInput(target, match.name);
        }
        return;
      }
      if (event.key === "Escape") {
        hideFoodSuggest();
        return;
      }
    }
    const recipeId = target.dataset.newTag;
    if (recipeId && event.key === "Enter") {
      event.preventDefault();
      addTagToRecipe(recipeId, target.value);
    }
  });

  document.addEventListener("click", (event) => {
    const rawTarget = event.target;
    const target = rawTarget instanceof HTMLElement ? rawTarget : null;
    if (!target) return;

    const pickedFood = target.closest("[data-pick-food]")?.dataset.pickFood;
    if (pickedFood && activeFoodInput) {
      applyFoodToInput(activeFoodInput, pickedFood);
      return;
    }

    if (!target.closest("#foodSuggest") && !target.closest("[data-food-lookup]")) {
      hideFoodSuggest();
    }

    const recipeToEdit = target.closest("[data-edit-recipe]")?.dataset.editRecipe;
    if (recipeToEdit) {
      editingRecipeId = editingRecipeId === recipeToEdit ? "" : recipeToEdit;
      renderRecipes();
      return;
    }

    const menuToggleSource = target.closest("[data-toggle-menu-item]");
    const menuItemToToggle = menuToggleSource?.dataset.toggleMenuItem;
    const menuToggleControl = target.closest("input, select, textarea, [data-remove-menu-item]");
    if (menuItemToToggle && (menuToggleSource.classList.contains("menu-item-toggle") || !menuToggleControl)) {
      expandedMenuItemId = expandedMenuItemId === menuItemToToggle ? "" : menuItemToToggle;
      renderMenus();
      return;
    }

    const recipeIdToDelete = target.closest("[data-delete-recipe]")?.dataset.deleteRecipe;
    if (recipeIdToDelete) {
      state.recipes = state.recipes.filter((recipe) => recipe.id !== recipeIdToDelete);
      state.cookPlan = state.cookPlan.filter((entry) => entry.recipeId !== recipeIdToDelete);
      state.dailyPlan = state.dailyPlan.filter((entry) => entry.recipeId !== recipeIdToDelete);
      state.dailySlots.forEach((slot) => {
        if (slot.recipeId === recipeIdToDelete) slot.recipeId = "";
      });
      state.extraSlots.forEach((slot) => {
        if (slot.recipeId === recipeIdToDelete) slot.recipeId = "";
      });
      state.shoppingSelections = state.shoppingSelections.filter((entry) => !(entry.type === "recipe" && entry.id === recipeIdToDelete));
      saveState();
      render();
      return;
    }

    const showTagInput = target.closest("[data-show-tag-input]")?.dataset.showTagInput;
    if (showTagInput) {
      const input = document.querySelector(`[data-new-tag="${CSS.escape(showTagInput)}"]`);
      if (input) {
        input.hidden = false;
        input.focus();
      }
      return;
    }

    const tagToRemove = target.closest("[data-remove-tag]")?.dataset.removeTag;
    if (tagToRemove) {
      const [recipeId, ...tagParts] = tagToRemove.split(":");
      const tag = tagParts.join(":");
      const recipe = state.recipes.find((item) => item.id === recipeId);
      if (recipe) {
        recipe.tags = (recipe.tags || []).filter((item) => item !== tag);
        saveState();
        render();
      }
      return;
    }

    const logToEdit = target.closest("[data-edit-log]")?.dataset.editLog;
    if (logToEdit && !target.closest("[data-delete-log]")) {
      editingLogId = editingLogId === logToEdit ? "" : logToEdit;
      renderLog();
      return;
    }

    const logToClose = target.closest("[data-close-log]")?.dataset.closeLog;
    if (logToClose) {
      editingLogId = "";
      renderLog();
      return;
    }

    const menuToSelect = target.closest("[data-select-menu]")?.dataset.selectMenu;
    if (menuToSelect) {
      selectedMenuId = menuToSelect;
      renderMenus();
      return;
    }

    const menuForRecipe = target.closest("[data-add-menu-recipe]")?.dataset.addMenuRecipe;
    if (menuForRecipe) {
      const select = document.querySelector(`[data-menu-recipe-source="${CSS.escape(menuForRecipe)}"]`);
      const recipe = state.recipes.find((item) => item.id === select?.value);
      const menu = findMenu(menuForRecipe);
      if (recipe && menu) {
        menu.items.push(cloneRecipeForMenu(recipe));
        saveState();
        renderMenus();
      }
      return;
    }

    const menuToDelete = target.closest("[data-delete-menu]")?.dataset.deleteMenu;
    if (menuToDelete) {
      state.menus = state.menus.filter((menu) => menu.id !== menuToDelete);
      state.shoppingSelections = state.shoppingSelections.filter((entry) => !(entry.type === "menu" && entry.id === menuToDelete));
      selectedMenuId = state.menus[0]?.id || "";
      saveState();
      renderMenus();
      renderShopping();
      return;
    }

    const menuItemToRemove = target.closest("[data-remove-menu-item]")?.dataset.removeMenuItem;
    if (menuItemToRemove) {
      const [menuId, itemId] = menuItemToRemove.split(":");
      const menu = findMenu(menuId);
      if (menu) {
        menu.items = menu.items.filter((item) => item.id !== itemId);
        saveState();
        renderMenus();
      }
      return;
    }

    const addIngredientId = target.closest("[data-add-ingredient]")?.dataset.addIngredient;
    if (addIngredientId) {
      const recipe = state.recipes.find((item) => item.id === addIngredientId);
      recipe?.ingredients.push({ name: "", grams: 100 });
      saveState();
      renderRecipes();
      return;
    }

    const menuIngredientToAdd = target.closest("[data-add-menu-ingredient]")?.dataset.addMenuIngredient;
    if (menuIngredientToAdd) {
      const [menuId, itemId] = menuIngredientToAdd.split(":");
      const item = findMenuItem(menuId, itemId);
      item?.ingredients.push({ name: "", grams: 100 });
      saveState();
      renderMenus();
      return;
    }

    const removeIngredient = target.closest("[data-remove-ingredient]")?.dataset.removeIngredient;
    if (removeIngredient) {
      const [recipeId, index] = removeIngredient.split(":");
      const recipe = state.recipes.find((item) => item.id === recipeId);
      if (recipe) recipe.ingredients.splice(number(index), 1);
      saveState();
      render();
      return;
    }

    const removeTemp = target.closest("[data-remove-temp]")?.dataset.removeTemp;
    if (removeTemp !== undefined) {
      hideFoodSuggest();
      state.temporaryItems.splice(number(removeTemp), 1);
      saveState();
      renderOverview();
      return;
    }

    const extraSlotToRemove = target.closest("[data-remove-extra-slot]")?.dataset.removeExtraSlot;
    if (extraSlotToRemove) {
      state.extraSlots = state.extraSlots.filter((slot) => slot.id !== extraSlotToRemove);
      saveState();
      renderOverview();
      return;
    }

    const logToDelete = target.closest("[data-delete-log]")?.dataset.deleteLog;
    if (logToDelete) {
      state.logEntries = state.logEntries.filter((entry) => entry.id !== logToDelete);
      saveState();
      renderLog();
      return;
    }

    const menuIngredientToRemove = target.closest("[data-remove-menu-ingredient]")?.dataset.removeMenuIngredient;
    if (menuIngredientToRemove) {
      const [menuId, itemId, index] = menuIngredientToRemove.split(":");
      const item = findMenuItem(menuId, itemId);
      if (item) {
        item.ingredients.splice(number(index), 1);
        saveState();
        renderMenus();
      }
    }
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

bindEvents();
render();
