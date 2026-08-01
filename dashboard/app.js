const STORE_KEY = "matdash-state-v1";
const AI_CONFIG_KEY = "matdash-ai-config-v1";
const DEFAULT_WATER_GOAL_ML = 2500;

const macroKeys = [
  ["kcal", "kcal"],
  ["protein", "protein"],
  ["carbs", "kolh"],
  ["fat", "fett"],
];

const waterQuickAdds = [250, 330, 500];

const requiredDailySlots = [
  { id: "frukost", label: "Frukost", tag: "Frukost" },
  { id: "lunch", label: "Lunch", tag: "Lunch" },
  { id: "middag", label: "Middag", tag: "Middag" },
];

const extraSlotTags = ["Mellanmål", "Snack", "Annat"];

const mealProfiles = [
  {
    tag: "Frukost",
    label: "Frukost",
    share: { kcal: 0.24, protein: 0.22, carbs: 0.25, fat: 0.22 },
    focus: "stabil start med protein och lagom kolhydrater",
  },
  {
    tag: "Lunch",
    label: "Lunch",
    share: { kcal: 0.32, protein: 0.32, carbs: 0.33, fat: 0.30 },
    focus: "stor basmåltid som bär mycket av dagens protein och energi",
  },
  {
    tag: "Middag",
    label: "Middag",
    share: { kcal: 0.32, protein: 0.32, carbs: 0.31, fat: 0.32 },
    focus: "stor basmåltid med protein, grönsaker och kontrollerad energimängd",
  },
  {
    tag: "Mellanmål",
    label: "Mellanmål",
    share: { kcal: 0.13, protein: 0.12, carbs: 0.12, fat: 0.12 },
    focus: "kompakt mål som fyller luckor utan att bli en hel huvudmåltid",
  },
  {
    tag: "Snack",
    label: "Snack",
    share: { kcal: 0.08, protein: 0.08, carbs: 0.07, fat: 0.08 },
    focus: "litet och enkelt tillskott när du saknar lite energi eller protein",
  },
  {
    tag: "Annat",
    label: "Extra",
    share: { kcal: 0.10, protein: 0.10, carbs: 0.09, fat: 0.10 },
    focus: "flexibelt extra mål som justerar dagens återstående behov",
  },
];

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
  todayCoachMessages: [],
  logCoachMessages: [],
  menus: [],
  temporaryItems: [],
  water: {
    goalMl: DEFAULT_WATER_GOAL_ML,
    days: {},
  },
};

let state = loadState();
let aiConfig = loadAiConfig();
let activeTarget = "training";
let activeRecipeTag = "all";
let selectedMenuId = "";
let editingRecipeId = "";
let expandedMenuItemId = "";
let editingLogId = "";
let activeFoodInput = null;
let deferredInstallPrompt = null;
let pendingTemporaryImage = null;
let temporaryAiSuggestion = null;
let temporaryAiStatus = "";
let temporaryAiBusy = false;
let pendingOverviewCoachImage = null;
let overviewCoachBusy = false;

const els = {
  settingsToggle: document.querySelector("#settingsToggle"),
  settingsBackdrop: document.querySelector("#settingsBackdrop"),
  settingsPanel: document.querySelector("#settingsPanel"),
  closeSettings: document.querySelector("#closeSettings"),
  dataStatus: document.querySelector("#dataStatus"),
  tabs: document.querySelectorAll(".tab"),
  views: document.querySelectorAll(".view"),
  targetSummary: document.querySelector("#targetSummary"),
  targetMode: document.querySelector("#targetMode"),
  targetKcal: document.querySelector("#targetKcal"),
  targetProtein: document.querySelector("#targetProtein"),
  targetCarbs: document.querySelector("#targetCarbs"),
  targetFat: document.querySelector("#targetFat"),
  waterGoal: document.querySelector("#waterGoal"),
  metricCards: document.querySelector("#metricCards"),
  waterTracker: document.querySelector("#waterTracker"),
  dailyPlan: document.querySelector("#dailyPlan"),
  temporaryAiInput: document.querySelector("#temporaryAiInput"),
  temporaryImageInput: document.querySelector("#temporaryImageInput"),
  attachTemporaryImage: document.querySelector("#attachTemporaryImage"),
  analyzeTemporaryItem: document.querySelector("#analyzeTemporaryItem"),
  temporaryAiStatus: document.querySelector("#temporaryAiStatus"),
  temporaryAiSuggestion: document.querySelector("#temporaryAiSuggestion"),
  temporaryItems: document.querySelector("#temporaryItems"),
  suggestions: document.querySelector("#suggestions"),
  overviewCoachChat: document.querySelector("#overviewCoachChat"),
  overviewCoachInput: document.querySelector("#overviewCoachInput"),
  sendOverviewCoachMessage: document.querySelector("#sendOverviewCoachMessage"),
  clearOverviewCoachHistory: document.querySelector("#clearOverviewCoachHistory"),
  attachOverviewCoachImage: document.querySelector("#attachOverviewCoachImage"),
  overviewCoachImageInput: document.querySelector("#overviewCoachImageInput"),
  overviewCoachImageStatus: document.querySelector("#overviewCoachImageStatus"),
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
  clearCoachHistory: document.querySelector("#clearCoachHistory"),
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
  installSection: document.querySelector(".app-install-section"),
  installApp: document.querySelector("#installApp"),
  resetData: document.querySelector("#resetData"),
  saveBackup: document.querySelector("#saveBackup"),
  importBackup: document.querySelector("#importBackup"),
  backupFile: document.querySelector("#backupFile"),
  settingsStatus: document.querySelector("#settingsStatus"),
  supabaseUrl: document.querySelector("#supabaseUrl"),
  supabaseAnonKey: document.querySelector("#supabaseAnonKey"),
  supabaseEmail: document.querySelector("#supabaseEmail"),
  supabasePassword: document.querySelector("#supabasePassword"),
  saveAiSettings: document.querySelector("#saveAiSettings"),
  loginAi: document.querySelector("#loginAi"),
  logoutAi: document.querySelector("#logoutAi"),
  aiSettingsStatus: document.querySelector("#aiSettingsStatus"),
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
    todayCoachMessages: [],
    logCoachMessages: [],
    menus: [],
    temporaryItems: [],
    water: clone(initialData.water || { goalMl: DEFAULT_WATER_GOAL_ML, days: {} }),
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
  const water = normalizeWater(raw.water);
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
  const legacyCoachMessages = normalizeCoachMessages(raw.coachMessages);
  const todayCoachMessages = normalizeCoachMessages(
    raw.todayCoachMessages?.length ? raw.todayCoachMessages : legacyCoachMessages,
  );
  const logCoachMessages = normalizeCoachMessages(raw.logCoachMessages);

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
      waterMl: number(entry.waterMl),
      waterGoalMl: number(entry.waterGoalMl, water.goalMl),
    })),
    menus,
    temporaryItems,
    coachMessages: [],
    todayCoachMessages,
    logCoachMessages,
    water,
  };
}

function normalizeCoachMessages(messages = []) {
  return (Array.isArray(messages) ? messages : []).map((message) => ({
    id: message.id || makeId("coach"),
    role: message.role === "user" ? "user" : "coach",
    text: String(message.text || ""),
    imageName: message.imageName || "",
    pending: Boolean(message.pending),
    error: Boolean(message.error),
    createdAt: message.createdAt || new Date().toISOString(),
    suggestion: normalizeAiSuggestion(message.suggestion),
  }));
}

function normalizeAiSuggestion(suggestion) {
  if (!suggestion || !suggestion.shouldAdd) return null;
  return {
    shouldAdd: true,
    name: String(suggestion.name || "Uppskattad måltid"),
    grams: Math.max(0, number(suggestion.grams)),
    kcal: Math.max(0, number(suggestion.kcal)),
    protein: Math.max(0, number(suggestion.protein)),
    carbs: Math.max(0, number(suggestion.carbs)),
    fat: Math.max(0, number(suggestion.fat)),
    confidence: ["low", "medium", "high"].includes(suggestion.confidence) ? suggestion.confidence : "medium",
    note: String(suggestion.note || ""),
    accepted: Boolean(suggestion.accepted),
    dismissed: Boolean(suggestion.dismissed),
  };
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function loadAiConfig() {
  try {
    const parsed = JSON.parse(localStorage.getItem(AI_CONFIG_KEY) || "{}");
    return {
      supabaseUrl: String(parsed.supabaseUrl || ""),
      anonKey: String(parsed.anonKey || ""),
      accessToken: String(parsed.accessToken || ""),
      refreshToken: String(parsed.refreshToken || ""),
      userEmail: String(parsed.userEmail || ""),
      expiresAt: number(parsed.expiresAt),
    };
  } catch {
    localStorage.removeItem(AI_CONFIG_KEY);
    return { supabaseUrl: "", anonKey: "", accessToken: "", refreshToken: "", userEmail: "", expiresAt: 0 };
  }
}

function saveAiConfig() {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(aiConfig));
}

function getCleanSupabaseUrl() {
  return String(aiConfig.supabaseUrl || "").replace(/\/+$/, "");
}

function isAiConfigured() {
  return Boolean(getCleanSupabaseUrl() && aiConfig.anonKey);
}

function isAiSignedIn() {
  return Boolean(isAiConfigured() && aiConfig.accessToken);
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

function iconSvg(name) {
  const paths = {
    check: '<path d="M20 6 9 17l-5-5"></path>',
    edit: '<path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>',
    plus: '<path d="M12 5v14"></path><path d="M5 12h14"></path>',
    trash: '<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v5"></path><path d="M14 11v5"></path>',
  };
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.plus}</svg>`;
}

function iconButton(name, attrs, label, className = "") {
  return `<button class="icon-button ${className}" type="button" ${attrs} aria-label="${escapeAttr(label)}" title="${escapeAttr(label)}">${iconSvg(name)}</button>`;
}

function trashButton(attrs, label = "Ta bort") {
  return iconButton("trash", attrs, label, "danger-icon remove-action");
}

function formatDateKey(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function formatWaterVolume(ml) {
  const value = number(ml);
  if (value >= 1000) {
    return `${format(value / 1000, value % 1000 === 0 ? 1 : 2)} l`;
  }
  return `${format(value)} ml`;
}

function normalizeWater(rawWater = {}) {
  rawWater = rawWater || {};
  const days = {};
  Object.entries(rawWater.days || {}).forEach(([date, entry]) => {
    const amount = typeof entry === "number" ? entry : entry?.ml;
    days[date] = {
      ml: Math.max(0, number(amount)),
      updatedAt: typeof entry === "object" && entry ? entry.updatedAt || "" : "",
    };
  });

  return {
    goalMl: Math.max(0, number(rawWater.goalMl, DEFAULT_WATER_GOAL_ML)) || DEFAULT_WATER_GOAL_ML,
    days,
  };
}

function getWaterGoal() {
  state.water = normalizeWater(state.water);
  return state.water.goalMl;
}

function getWaterEntry(date = formatDateKey()) {
  state.water = normalizeWater(state.water);
  if (!state.water.days[date]) {
    state.water.days[date] = { ml: 0, updatedAt: "" };
  }
  return state.water.days[date];
}

function getTodayWaterMl() {
  return number(getWaterEntry().ml);
}

function syncTodayWaterLog() {
  const today = formatDateKey();
  const entry = state.logEntries.find((item) => item.date === today);
  if (!entry) return;
  entry.waterMl = getTodayWaterMl();
  entry.waterGoalMl = getWaterGoal();
}

function addWaterMl(amount) {
  const entry = getWaterEntry();
  entry.ml = Math.max(0, number(entry.ml) + number(amount));
  entry.updatedAt = new Date().toISOString();
  syncTodayWaterLog();
  saveState();
  renderWaterTracker();
  renderLog();
}

function resetTodayWater() {
  const entry = getWaterEntry();
  entry.ml = 0;
  entry.updatedAt = new Date().toISOString();
  syncTodayWaterLog();
  saveState();
  renderWaterTracker();
  renderLog();
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

function getRecipeMealProfile(recipe) {
  const recipeTags = recipe.tags || [];
  const profiles = mealProfiles.filter((profile) =>
    recipeTags.some((tag) => normalizeTag(tag) === normalizeTag(profile.tag)),
  );
  if (!profiles.length) return null;
  if (profiles.length === 1) return profiles[0];

  const share = Object.fromEntries(
    macroKeys.map(([key]) => [
      key,
      profiles.reduce((sum, profile) => sum + profile.share[key], 0) / profiles.length,
    ]),
  );
  return {
    tag: profiles.map((profile) => profile.tag).join("/"),
    label: profiles.map((profile) => profile.label).join("/"),
    share,
    focus: "kombinerad rätt som ska fungera i flera måltidslägen",
  };
}

function getMealMacroGoal(profile) {
  const target = state.targets[activeTarget];
  return Object.fromEntries(
    macroKeys.map(([key]) => [key, number(target[key]) * profile.share[key]]),
  );
}

function getMealPurposeWord(profile) {
  return profile.label.toLowerCase();
}

function getFoodMatches(query, limit = 10) {
  const q = normalizeSearch(query);
  if (q.length < 1) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  return rankFoodMatches(q, terms, limit);
}

function getRankedFoodMatches(query, limit = 200) {
  const q = normalizeSearch(query);
  if (q.length < 1) return state.foods.slice(0, limit);
  const terms = q.split(/\s+/).filter(Boolean);
  return rankFoodMatches(q, terms, limit);
}

function rankFoodMatches(q, terms, limit) {
  const matches = state.foods
    .map((food, index) => ({
      food,
      index,
      score: scoreFoodMatch(food, q, terms),
    }))
    .filter((item) => item.score > 0);
  const fullNameMatches = terms.length > 1
    ? matches.filter((item) => foodNameIncludesAllTerms(item.food, terms))
    : [];
  return (fullNameMatches.length ? fullNameMatches : matches)
    .sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name, "sv") || a.index - b.index)
    .slice(0, limit)
    .map((item) => item.food);
}

function foodNameIncludesAllTerms(food, terms) {
  const name = normalizeSearch(food.name);
  return terms.every((term) => name.includes(term));
}

function scoreFoodMatch(food, q, terms) {
  const name = normalizeSearch(food.name);
  const group = normalizeSearch(food.group);
  const words = name.split(/\s+/).filter(Boolean);
  const compactName = name.replace(/\s+/g, "");
  const compactQuery = q.replace(/\s+/g, "");
  let score = 0;

  if (name === q) score += 180;
  if (name.startsWith(q)) score += 130;
  else if (words.some((word) => word === q)) score += 105;
  else if (words.some((word) => word.startsWith(q))) score += 82;
  else if (name.includes(q)) score += 58;
  else if (compactQuery.length >= 4 && compactName.includes(compactQuery)) score += 64;
  else if (compactQuery.length >= 7) score += getOrderedMatchScore(compactQuery, compactName);

  terms.forEach((term, termIndex) => {
    const exactWordIndex = words.findIndex((word) => word === term);
    const prefixWordIndex = words.findIndex((word) => word.startsWith(term));
    const insideWordIndex = words.findIndex((word) => word.includes(term));

    if (exactWordIndex === 0) score += 60;
    else if (exactWordIndex > 0) score += 48 - Math.min(exactWordIndex, 6);
    else if (prefixWordIndex === 0) score += 46;
    else if (prefixWordIndex > 0) score += 36 - Math.min(prefixWordIndex, 6);
    else if (insideWordIndex >= 0) score += 22 - Math.min(insideWordIndex, 6);

    if (name.startsWith(term)) score += 18;
    if (group.includes(term)) score += 6;
    if (termIndex > 0 && name.includes(term)) score += 5;
  });

  if (terms.every((term) => name.includes(term))) score += 55;
  else if (terms.every((term) => name.includes(term) || group.includes(term))) score += 18;

  const firstMatch = terms
    .map((term) => name.indexOf(term))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  if (firstMatch !== undefined) score += Math.max(0, 18 - firstMatch);

  if (score > 0 && food.source === "Eget") score += 8;
  score -= Math.min(words.length, 14) * 0.15;
  return Math.max(0, score);
}

function getOrderedMatchScore(term, value) {
  let cursor = 0;
  let first = -1;
  let last = -1;

  for (const char of term) {
    const found = value.indexOf(char, cursor);
    if (found === -1) return 0;
    if (first === -1) first = found;
    last = found;
    cursor = found + 1;
  }

  const extraChars = last - first + 1 - term.length;
  if (extraChars > Math.max(8, Math.floor(term.length * 0.75))) return 0;
  return Math.max(14, 42 - extraChars - Math.min(first, 18) * 0.5);
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
  renderAiSettings();
  renderOverview();
  renderWaterTracker();
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
  if (els.waterGoal) {
    els.waterGoal.value = getWaterGoal();
  }
  if (els.targetSummary) {
    const modeLabel = els.targetMode.selectedOptions[0]?.textContent || "Mål";
    els.targetSummary.textContent = `${modeLabel} · ${format(target.kcal)} kcal`;
  }
}

function renderAiSettings() {
  if (!els.supabaseUrl || !els.supabaseAnonKey || !els.aiSettingsStatus) return;
  els.supabaseUrl.value = aiConfig.supabaseUrl;
  els.supabaseAnonKey.value = aiConfig.anonKey;
  if (els.supabaseEmail) els.supabaseEmail.value = aiConfig.userEmail;
  if (els.loginAi) els.loginAi.disabled = false;
  if (els.logoutAi) els.logoutAi.disabled = !aiConfig.accessToken;
  if (aiConfig.accessToken) {
    els.aiSettingsStatus.textContent = `Inloggad som ${aiConfig.userEmail || "Supabase-användare"}.`;
  } else if (isAiConfigured()) {
    els.aiSettingsStatus.textContent = "Supabase är sparat. Logga in för AI-coachen.";
  } else {
    els.aiSettingsStatus.textContent = "Fyll i Supabase URL och publishable key.";
  }
}

function renderWaterTracker() {
  if (!els.waterTracker) return;
  const goal = getWaterGoal();
  const amount = getTodayWaterMl();
  const ratio = goal ? amount / goal : 0;
  const progress = Math.min(ratio * 100, 100);
  const remaining = Math.max(goal - amount, 0);
  const statusText = amount >= goal ? "Målet nått" : `${formatWaterVolume(remaining)} kvar`;
  const quickButtons = waterQuickAdds
    .map((ml) => `<button class="water-add" type="button" data-water-add="${ml}">+${format(ml)} ml</button>`)
    .join("");

  els.waterTracker.innerHTML = `
    <div class="panel-head water-panel-head">
      <div>
        <h3>Vatten</h3>
        <p>${statusText}</p>
      </div>
      <span class="water-status ${amount >= goal ? "ok" : ""}">${format(Math.min(ratio * 100, 999))}%</span>
    </div>
    <div class="water-card">
      <div class="water-progress" style="--water-progress: ${progress}%">
        <div class="water-progress-inner">
          <strong>${formatWaterVolume(amount)}</strong>
          <span>av ${formatWaterVolume(goal)}</span>
        </div>
      </div>
      <div class="water-actions">
        <div class="water-quick-actions">${quickButtons}</div>
        <div class="water-custom-row">
          <input id="waterCustomMl" type="number" min="0" step="50" value="250" aria-label="Vatten i milliliter">
          <button class="water-custom-add" type="button" data-water-custom>Lägg till</button>
          <button class="water-reset" type="button" data-water-reset>Nollställ</button>
        </div>
      </div>
    </div>
  `;
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
  renderCoachChat();

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
                ${trashButton(`data-remove-temp="${index}"`, "Ta bort tillfälligt")}
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
    <div class="meal-slot ${required ? "required" : "extra"}">
      <div class="meal-slot-head">
        ${required
          ? `<strong>${escapeHtml(slot.label)}</strong>`
          : `
            <div class="extra-slot-title">
              <strong>Extra</strong>
              <select class="extra-slot-tag" data-extra-slot-tag="${slot.id}" aria-label="Välj tagg för extra">
                ${tagOptions}
              </select>
            </div>
          `}
        ${required ? `<span class="required-badge">Obligatorisk</span>` : trashButton(`data-remove-extra-slot="${slot.id}"`, "Ta bort extra")}
      </div>
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
          ${trashButton(`data-remove-ingredient="${recipe.id}:${index}"`, "Ta bort ingrediens")}
        </div>
      `).join("");

      return `
        <article class="recipe-card ${isEditing ? "editing" : "locked"}">
          <div class="recipe-title-row">
            ${isEditing ? `<input value="${escapeAttr(recipe.name)}" data-recipe-name="${recipe.id}">` : `<h3>${escapeHtml(recipe.name)}</h3>`}
            <div class="card-actions">
              ${iconButton(isEditing ? "check" : "edit", `data-edit-recipe="${recipe.id}"`, isEditing ? "Klar" : "Redigera", "edit-icon")}
              ${isEditing ? trashButton(`data-delete-recipe="${recipe.id}"`, "Ta bort rätt") : ""}
            </div>
          </div>
          ${renderTagChips(recipe.id, recipe.tags || [], isEditing)}
          ${isEditing
            ? `<div class="macro-chips">
                <span class="chip">${format(macros.kcal)} kcal</span>
                <span class="chip">${format(macros.protein, 1)} g protein</span>
                <span class="chip">${format(macros.carbs, 1)} g kolh</span>
                <span class="chip">${format(macros.fat, 1)} g fett</span>
                <span class="chip">${format(macros.grams)} g</span>
              </div>`
            : `<div class="recipe-compact-macros">${format(macros.kcal)} kcal · ${format(macros.protein, 1)} g protein · ${format(macros.carbs, 1)} g kolh · ${format(macros.fat, 1)} g fett</div>`}
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
        ${tags.map((tag) => `<span class="tag-chip">${escapeHtml(tag)}${editable ? trashButton(`data-remove-tag="${recipeId}:${escapeAttr(tag)}"`, "Ta bort tagg") : ""}</span>`).join("")}
        ${editable ? `
          <button class="tag-chip phantom-tag" type="button" data-show-tag-input="${recipeId}">+ tagg</button>
          <span class="tag-add-row" hidden data-tag-add-row="${recipeId}">
            <input class="phantom-tag-input" list="tagOptions" data-new-tag="${recipeId}" placeholder="Skriv tagg">
            <button class="tag-save" type="button" data-save-tag="${recipeId}">Spara</button>
          </span>
        ` : ""}
      </div>
    </div>
  `;
}

function renderRecipeAdvice(recipe) {
  const macros = getRecipeMacros(recipe);
  const profile = getRecipeMealProfile(recipe);
  const tips = [];

  if (!profile) {
    tips.push("Saknar måltidstagg. Lägg till Frukost, Lunch, Middag, Mellanmål eller Snack så kan målet bli mer träffsäkert.");
    if (macros.kcal || macros.protein || macros.carbs || macros.fat) {
      tips.push(`Just nu ger rätten ${format(macros.kcal)} kcal, ${format(macros.protein, 1)} g protein, ${format(macros.carbs, 1)} g kolh och ${format(macros.fat, 1)} g fett.`);
    }
    return `
      <div class="recipe-advice">
        <strong>Förslag</strong>
        ${tips.map((tip) => `<p>${escapeHtml(tip)}</p>`).join("")}
      </div>
    `;
  }

  const goal = getMealMacroGoal(profile);
  const purpose = getMealPurposeWord(profile);
  const targetModeLabel = activeTarget === "training" ? "träningsdag" : "vilodag";
  const tags = String(profile.tag).split("/").map(normalizeTag);
  const isMainMeal = tags.some((tag) => ["lunch", "middag"].includes(tag));
  const isBreakfast = tags.includes(normalizeTag("Frukost"));
  const isSmallMeal = tags.some((tag) => [normalizeTag("Mellanmål"), normalizeTag("Snack")].includes(tag));

  const proteinBoost = isBreakfast
    ? "ägg, kvarg, keso eller whey"
    : isSmallMeal
      ? "kvarg, keso, whey eller proteinrik yoghurt"
      : "kyckling, tonfisk, lax, tofu, bönor eller magert kött";
  const carbBoost = isBreakfast
    ? "havregryn, banan, bär eller fullkornsbröd"
    : isSmallMeal
      ? "frukt, yoghurt, havre eller en mindre brödbit"
      : "ris, potatis, pasta, quinoa eller bönor";

  if (macros.kcal < goal.kcal * 0.78) {
    tips.push(`För ${purpose} är energin låg. Sikta närmare ${format(goal.kcal)} kcal genom större portion eller mer ${carbBoost}.`);
  } else if (macros.kcal > goal.kcal * 1.28) {
    const scaleText = isSmallMeal ? "Det här blir mer som en huvudmåltid" : "Minska portionsstorlek eller de energitätaste delarna";
    tips.push(`${scaleText}: ${format(macros.kcal)} kcal mot riktmärke ${format(goal.kcal)} kcal för ${purpose}.`);
  }

  if (macros.protein < goal.protein * 0.82) {
    tips.push(`Proteinet är lågt för ${purpose}. Lägg till ${proteinBoost} så rätten närmar sig ${format(goal.protein)} g protein.`);
  } else if (macros.protein > goal.protein * 1.55 && !isMainMeal) {
    tips.push(`Proteinet är högt för ${purpose}. Det är okej om dagen saknar protein, annars kan portionen göras mindre.`);
  }

  if (macros.carbs < goal.carbs * 0.65 && !isSmallMeal) {
    tips.push(`Kolhydraterna är låga för ${purpose}. Lägg till ${carbBoost}, särskilt på träningsdagar.`);
  } else if (macros.carbs > goal.carbs * 1.35) {
    tips.push(`Kolhydraterna tar stor plats för ${purpose}. Minska pasta/ris/quinoa eller flytta mer kolhydrater till en annan måltid.`);
  }

  if (macros.fat < goal.fat * 0.55 && !isSmallMeal) {
    tips.push(`Fettet är lågt för ${purpose}. Lite olivolja, avokado, nötter eller fetare fisk gör målet mer balanserat.`);
  } else if (macros.fat > goal.fat * 1.45) {
    tips.push(`Fettet är högt mot målet för ${purpose}. Minska olja, ost, nötter eller feta såser om kcal behöver hållas nere.`);
  }

  if (isMainMeal && !recipe.ingredients.some((item) => /broccoli|paprika|lök|tomat|grönsak|bönor|spenat|morot|sallad|kål/i.test(item.name))) {
    tips.push("Som lunch/middag mår rätten bra av mer grönsaker eller baljväxter för fiber, volym och mättnad.");
  }

  if (!tips.length) {
    tips.push(`Rätten ligger nära målet för ${purpose}. Finjustera främst portionen efter vad som återstår av dagen.`);
  }

  const targetLine = `Målnivå på ${targetModeLabel}: ca ${format(goal.kcal)} kcal · ${format(goal.protein)} g protein · ${format(goal.carbs)} g kolh · ${format(goal.fat)} g fett. Fokus: ${profile.focus}.`;

  return `
    <div class="recipe-advice">
      <strong>Förslag för ${escapeHtml(profile.label)}</strong>
      <p class="recipe-advice-target">${escapeHtml(targetLine)}</p>
      ${tips.slice(0, 4).map((tip) => `<p>${escapeHtml(tip)}</p>`).join("")}
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
      ${trashButton(`data-delete-menu="${menu.id}"`, "Ta bort meny")}
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
        ${trashButton(`data-remove-menu-ingredient="${menuId}:${item.id}:${index}"`, "Ta bort ingrediens")}
      </div>
    `)
    .join("");

  return `
    <article class="menu-item ${isExpanded ? "expanded" : "collapsed"}" ${isExpanded ? "" : `data-toggle-menu-item="${item.id}"`}>
      <div class="menu-item-head">
        ${isExpanded ? `<input value="${escapeAttr(item.name)}" data-menu-item-name="${menuId}:${item.id}">` : `<button class="menu-item-toggle" type="button" data-toggle-menu-item="${item.id}"><strong>${escapeHtml(item.name)}</strong><span>${item.ingredients.length} ingredienser</span></button>`}
        <input type="number" min="0" step="0.25" value="${number(item.servings, 1)}" data-menu-item-servings="${menuId}:${item.id}" title="Portioner">
        ${trashButton(`data-remove-menu-item="${menuId}:${item.id}"`, "Ta bort rätt")}
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
  const foods = getRankedFoodMatches(els.foodSearch.value, 200);
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
  const tags = activeRecipeTag !== "all" ? [activeRecipeTag] : [];
  state.recipes.push({
    id,
    name: "Ny rätt",
    defaultServings: 1,
    ingredients: [{ name: "", grams: 100 }],
    tags,
  });
  state.cookPlan.push({ recipeId: id, servings: 5 });
  state.dailyPlan.push({ recipeId: id, servings: 1 });
  editingRecipeId = id;
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

function openTagInput(recipeId) {
  const row = document.querySelector(`[data-tag-add-row="${CSS.escape(recipeId)}"]`);
  const input = document.querySelector(`[data-new-tag="${CSS.escape(recipeId)}"]`);
  if (!row || !input) return;
  row.hidden = false;
  input.value = "";
  input.focus();
}

function saveNewTag(recipeId) {
  const input = document.querySelector(`[data-new-tag="${CSS.escape(recipeId)}"]`);
  if (!input) return;
  if (!input.value.trim()) {
    const row = input.closest("[data-tag-add-row]");
    if (row) row.hidden = true;
    return;
  }
  addTagToRecipe(recipeId, input.value);
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
  const today = formatDateKey();
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
    waterMl: getTodayWaterMl(),
    waterGoalMl: getWaterGoal(),
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
  let waterAvg = 0;
  recent.forEach((entry) => {
    macroKeys.forEach(([key]) => {
      avg[key] += number(entry.macros[key]);
    });
    waterAvg += number(entry.waterMl);
  });
  macroKeys.forEach(([key]) => {
    avg[key] /= recent.length;
  });
  waterAvg /= recent.length;
  els.logSummary.innerHTML = `
    <div class="suggestion">
      <strong>Snitt senaste ${recent.length} dagar</strong>
      <span>${format(avg.kcal)} kcal · ${format(avg.protein, 1)} g protein · ${format(avg.carbs, 1)} g kolh · ${format(avg.fat, 1)} g fett · ${formatWaterVolume(waterAvg)} vatten</span>
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
          ${trashButton(`data-delete-log="${entry.id}"`, "Ta bort loggrad")}
        </div>
        ${renderMiniMeters(entry.macros)}
        <div class="water-log-line">Vatten: ${formatWaterVolume(entry.waterMl)} / ${formatWaterVolume(entry.waterGoalMl || DEFAULT_WATER_GOAL_ML)}</div>
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
        <label>vatten<input type="number" min="0" step="50" value="${number(entry.waterMl)}" data-log-water="${entry.id}:waterMl"></label>
        <label>vattenmål<input type="number" min="0" step="50" value="${number(entry.waterGoalMl, DEFAULT_WATER_GOAL_ML)}" data-log-water="${entry.id}:waterGoalMl"></label>
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

function buildCoachReply(question) {
  const entries = [...(state.logEntries || [])].sort((a, b) => b.date.localeCompare(a.date));
  const recent = entries.slice(0, 14);
  if (!recent.length) {
    return "**Börja med loggen**\n\nRegistrera 3-4 dagar först. Då kan jag se om snittet missar energi, protein, kolhydrater eller fett.\n\n- Logga måltiderna\n- Lägg in vatten\n- Notera gärna hunger, energi och träning";
  }
  const avg = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  recent.forEach((entry) => macroKeys.forEach(([key]) => { avg[key] += number(entry.macros[key]); }));
  macroKeys.forEach(([key]) => { avg[key] /= recent.length; });
  const insights = buildCoachInsights(recent, avg);
  const q = question.toLowerCase();
  if (q.includes("variation") || q.includes("variera")) {
    return "**Tänk små byten**\n\nDu behöver inte bygga om hela upplägget.\n\n- Rotera proteinkälla\n- Byt grönsak oftare\n- Variera kolhydratbas mellan ris, pasta, potatis, havre eller quinoa\n\nBehåll makrona genom att byta ungefär gram mot gram inom samma kategori.";
  }
  if (q.includes("protein")) {
    return `**Proteinläge**\n\nDitt senaste snitt är ${format(avg.protein, 1)} g protein.\n\n- Sikta på 35-55 g protein i frukost, lunch och middag\n- Använd whey/casein för att täcka luckor\n- Höj helst med riktig proteinkälla om du också behöver mer mättnad`;
  }
  if (q.includes("fett")) {
    return `**Fettläge**\n\nDitt senaste snitt är ${format(avg.fat, 1)} g fett.\n\nBra höjningar:\n- 10-20 g olivolja\n- 20-35 g nötter\n- Ägg eller fet fisk\n\nUndvik att lösa allt med jättemycket olja.`;
  }
  if (q.includes("kolh") || q.includes("carb") || q.includes("träning")) {
    return `**Kolhydrater och träning**\n\nDitt senaste snitt är ${format(avg.carbs, 1)} g kolhydrater.\n\nLägg mer runt passet om prestation saknas:\n- Banan\n- Havre\n- Ris, pasta eller potatis`;
  }
  return `**${insights[0].title}**\n\n${insights[0].body}\n\nSnitt senaste ${recent.length} dagar:\n- ${format(avg.kcal)} kcal\n- ${format(avg.protein, 1)} g protein\n- ${format(avg.carbs, 1)} g kolh\n- ${format(avg.fat, 1)} g fett`;
}

function renderCoachChat() {
  const logMessages = getCoachMessages("log");
  const todayMessages = getCoachMessages("overview");
  const logHtml = renderCoachMessageList(logMessages);
  const todayHtml = renderCoachMessageList(todayMessages);
  if (els.coachChat) {
    els.coachChat.innerHTML = logHtml || `<div class="empty-state">Fråga coachen om historik, trender och vad som behövs på längre sikt.</div>`;
  }
  if (els.overviewCoachChat) {
    els.overviewCoachChat.innerHTML = todayHtml || `<div class="empty-state">Fråga AI om dagen, maten eller skriv något du ätit så kan den föreslå vad som ska läggas till.</div>`;
  }
  renderOverviewCoachControls();
}

function getCoachMessages(source = "overview") {
  if (source === "log") {
    state.logCoachMessages ||= [];
    return state.logCoachMessages;
  }
  state.todayCoachMessages ||= [];
  return state.todayCoachMessages;
}

function renderCoachMessageList(messages) {
  return messages.length
    ? [...messages].reverse().map((message) => renderCoachMessage(message)).join("")
    : "";
}

function renderCoachMessage(message) {
  const suggestion = message.suggestion && !message.suggestion.accepted && !message.suggestion.dismissed
    ? renderCoachSuggestion(message.id, message.suggestion)
    : "";
  const imageText = message.imageName ? `<small>Bild: ${escapeHtml(message.imageName)}</small>` : "";
  const stateClass = message.pending ? "pending" : message.error ? "error" : "";
  return `
    <div class="coach-message ${message.role} ${stateClass}">
      <div class="coach-message-content">${renderFormattedCoachText(message.text)}</div>
      ${imageText}
      ${suggestion}
    </div>
  `;
}

function renderOverviewCoachControls() {
  if (els.overviewCoachImageStatus) {
    els.overviewCoachImageStatus.textContent = pendingOverviewCoachImage
      ? `Bild vald: ${pendingOverviewCoachImage.name}`
      : "";
  }
  if (els.sendOverviewCoachMessage) {
    els.sendOverviewCoachMessage.disabled = overviewCoachBusy;
    els.sendOverviewCoachMessage.textContent = overviewCoachBusy ? "Skickar" : "Skicka";
  }
  if (els.clearCoachHistory) els.clearCoachHistory.disabled = !getCoachMessages("log").length;
  if (els.clearOverviewCoachHistory) els.clearOverviewCoachHistory.disabled = !getCoachMessages("overview").length;
}

function clearCoachHistory(source = "log") {
  const messages = getCoachMessages(source);
  if (!messages.length) return;
  messages.splice(0, messages.length);
  if (source === "overview") {
    pendingOverviewCoachImage = null;
    overviewCoachBusy = false;
    if (els.overviewCoachInput) els.overviewCoachInput.value = "";
    if (els.overviewCoachImageInput) els.overviewCoachImageInput.value = "";
  } else if (els.coachInput) {
    els.coachInput.value = "";
  }
  saveState();
  renderCoachChat();
}

function renderFormattedCoachText(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${formatInlineCoachText(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push(`<${list.type}>${list.items.map((item) => `<li>${formatInlineCoachText(item)}</li>`).join("")}</${list.type}>`);
    list = null;
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (bullet || numbered) {
      flushParagraph();
      const type = numbered ? "ol" : "ul";
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push((bullet || numbered)[1]);
      return;
    }

    flushList();
    paragraph.push(trimmed);
  });

  flushParagraph();
  flushList();
  return blocks.join("") || `<p>${formatInlineCoachText(text)}</p>`;
}

function formatInlineCoachText(text) {
  return escapeHtml(text).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function renderCoachSuggestion(messageId, item) {
  return `
    <div class="coach-suggestion">
      <strong>${escapeHtml(item.name)}</strong>
      <span>${format(item.grams)} g · ${format(item.kcal)} kcal · ${format(item.protein, 1)} g protein · ${format(item.carbs, 1)} g kolh · ${format(item.fat, 1)} g fett</span>
      ${item.note ? `<small>${escapeHtml(item.note)}</small>` : ""}
      <div class="coach-suggestion-actions">
        <button type="button" data-accept-ai-food="${messageId}">Lägg till i dag</button>
        <button type="button" data-dismiss-ai-food="${messageId}">Avbryt</button>
      </div>
    </div>
  `;
}

function renderTemporaryAiAdd() {
  if (!els.temporaryAiStatus || !els.temporaryAiSuggestion) return;
  const statusParts = [];
  if (pendingTemporaryImage) statusParts.push(`Bild vald: ${pendingTemporaryImage.name}`);
  if (temporaryAiStatus) statusParts.push(temporaryAiStatus);
  els.temporaryAiStatus.textContent = statusParts.join(" ");
  els.temporaryAiSuggestion.innerHTML = temporaryAiSuggestion ? renderTemporaryAiSuggestion(temporaryAiSuggestion) : "";
  if (els.analyzeTemporaryItem) {
    els.analyzeTemporaryItem.disabled = temporaryAiBusy;
    els.analyzeTemporaryItem.textContent = temporaryAiBusy ? "Analyserar" : "Lägg till";
  }
}

function renderTemporaryAiSuggestion(item) {
  return `
    <div class="coach-suggestion temporary-ai-suggestion">
      <strong>${escapeHtml(item.name)}</strong>
      <span>${format(item.grams)} g · ${format(item.kcal)} kcal · ${format(item.protein, 1)} g protein · ${format(item.carbs, 1)} g kolh · ${format(item.fat, 1)} g fett</span>
      ${item.note ? `<small>${escapeHtml(item.note)}</small>` : ""}
      <div class="coach-suggestion-actions">
        <button type="button" data-accept-temporary-ai>Lägg till i dag</button>
        <button type="button" data-dismiss-temporary-ai>Avbryt</button>
      </div>
    </div>
  `;
}

async function sendCoachMessage(source = "log") {
  const fromOverview = source === "overview";
  const input = fromOverview ? els.overviewCoachInput : els.coachInput;
  const image = fromOverview ? pendingOverviewCoachImage : null;
  const text = input?.value.trim() || "";
  if (!text && !image) return;
  if (fromOverview) {
    pendingOverviewCoachImage = null;
    overviewCoachBusy = true;
  }
  const messages = getCoachMessages(source);
  const focus = fromOverview ? "today_general" : "history_long_term";
  const prompt = text || "Analysera bilden och uppskatta vad jag har ätit.";
  const pendingId = makeId("coach");
  messages.push({
    id: makeId("coach"),
    role: "user",
    text: prompt,
    imageName: image?.name || "",
    createdAt: new Date().toISOString(),
  });
  messages.push({
    id: pendingId,
    role: "coach",
    text: "Tänker...",
    pending: true,
    createdAt: new Date().toISOString(),
  });
  if (input) input.value = "";
  if (fromOverview && els.overviewCoachImageInput) els.overviewCoachImageInput.value = "";
  saveState();
  renderCoachChat();

  const pendingMessage = messages.find((message) => message.id === pendingId);
  try {
    const response = await requestAiCoach(prompt, image, focus, messages);
    if (pendingMessage) {
      pendingMessage.text = response.reply;
      pendingMessage.pending = false;
      pendingMessage.suggestion = normalizeAiSuggestion(response.temporaryItem);
    }
  } catch (error) {
    if (pendingMessage) {
      pendingMessage.text = `${buildCoachReply(prompt)}\n\nAI är inte tillgänglig just nu: ${error.message}`;
      pendingMessage.pending = false;
      pendingMessage.error = true;
    }
  } finally {
    if (fromOverview) overviewCoachBusy = false;
  }
  saveState();
  renderCoachChat();
}

async function requestAiCoach(text, image, focus = "today_general", historyMessages = []) {
  if (!isAiConfigured()) {
    throw new Error("lägg in Supabase URL och publishable key i inställningar.");
  }
  if (!isAiSignedIn()) {
    throw new Error("logga in i Supabase i inställningar.");
  }
  await refreshAiSessionIfNeeded();

  const response = await fetch(`${getCleanSupabaseUrl()}/functions/v1/ai-coach`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": aiConfig.anonKey,
      "Authorization": `Bearer ${aiConfig.accessToken}`,
    },
    body: JSON.stringify({
      focus,
      message: text,
      imageDataUrl: image?.dataUrl || "",
      day: buildAiDayContext(),
      foodHints: getFoodMatches(text, 10).map((food) => ({
        name: food.name,
        kcal: food.kcal,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        source: food.source,
      })),
      messages: historyMessages
        .filter((message) => !message.pending)
        .slice(-10)
        .map((message) => ({
          role: message.role,
          text: message.text,
        })),
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "AI-funktionen svarade inte.");
  }
  return body;
}

function buildAiDayContext() {
  const total = getDailyMacros();
  const target = state.targets[activeTarget];
  return {
    targetMode: activeTarget,
    target,
    total,
    water: {
      ml: getTodayWaterMl(),
      goalMl: getWaterGoal(),
    },
    dailySlots: [...state.dailySlots, ...state.extraSlots].map((slot) => {
      const recipe = state.recipes.find((item) => item.id === slot.recipeId);
      return {
        label: slot.label,
        tag: slot.tag,
        recipeName: recipe?.name || "",
        servings: number(slot.servings, 1),
        macros: recipe ? getRecipeMacros(recipe, slot.servings) : null,
      };
    }),
    temporaryItems: state.temporaryItems.map((item) => ({
      name: item.name,
      grams: number(item.grams),
      macros: getIngredientMacros(item),
    })),
    recentLog: [...(state.logEntries || [])]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7)
      .map((entry) => ({
        date: entry.date,
        macros: entry.macros,
        waterMl: entry.waterMl,
        meals: entry.meals,
      })),
  };
}

async function refreshAiSessionIfNeeded() {
  if (!aiConfig.refreshToken || aiConfig.expiresAt - Date.now() > 60000) return;
  const response = await fetch(`${getCleanSupabaseUrl()}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": aiConfig.anonKey,
    },
    body: JSON.stringify({ refresh_token: aiConfig.refreshToken }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    aiConfig.accessToken = "";
    aiConfig.refreshToken = "";
    saveAiConfig();
    renderAiSettings();
    throw new Error("sessionen har gått ut. Logga in igen.");
  }
  applySupabaseSession(body);
}

function applySupabaseSession(body) {
  aiConfig.accessToken = body.access_token || "";
  aiConfig.refreshToken = body.refresh_token || aiConfig.refreshToken || "";
  aiConfig.userEmail = body.user?.email || aiConfig.userEmail || "";
  aiConfig.expiresAt = body.expires_at ? body.expires_at * 1000 : Date.now() + number(body.expires_in, 3600) * 1000;
  saveAiConfig();
  renderAiSettings();
}

function saveAiSettingsFromInputs() {
  aiConfig.supabaseUrl = els.supabaseUrl.value.trim();
  aiConfig.anonKey = els.supabaseAnonKey.value.trim();
  aiConfig.userEmail = els.supabaseEmail?.value.trim() || aiConfig.userEmail || "";
  saveAiConfig();
  renderAiSettings();
  showAiSettingsStatus("AI-inställningar sparade.");
}

async function loginAi() {
  const email = els.supabaseEmail.value.trim();
  const password = els.supabasePassword.value;
  aiConfig.supabaseUrl = els.supabaseUrl.value.trim();
  aiConfig.anonKey = els.supabaseAnonKey.value.trim();
  aiConfig.userEmail = email;
  saveAiConfig();
  if (!isAiConfigured() || !email || !password) {
    renderAiSettings();
    showAiSettingsStatus("Fyll i Supabase URL, publishable key, e-post och lösenord.");
    return;
  }
  showAiSettingsStatus("Loggar in...");
  try {
    const response = await fetch(`${getCleanSupabaseUrl()}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": aiConfig.anonKey,
      },
      body: JSON.stringify({ email, password }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error_description || body.msg || body.error || "Kunde inte logga in.");
    applySupabaseSession(body);
    els.supabasePassword.value = "";
    showAiSettingsStatus(`Inloggad som ${aiConfig.userEmail || email}.`);
  } catch (error) {
    showAiSettingsStatus(error.message);
  }
}

async function logoutAi() {
  if (aiConfig.accessToken && isAiConfigured()) {
    await fetch(`${getCleanSupabaseUrl()}/auth/v1/logout`, {
      method: "POST",
      headers: {
        "apikey": aiConfig.anonKey,
        "Authorization": `Bearer ${aiConfig.accessToken}`,
      },
    }).catch(() => null);
  }
  aiConfig.accessToken = "";
  aiConfig.refreshToken = "";
  aiConfig.expiresAt = 0;
  saveAiConfig();
  renderAiSettings();
  showAiSettingsStatus("Utloggad.");
}

function showAiSettingsStatus(message) {
  if (!els.aiSettingsStatus) return;
  els.aiSettingsStatus.textContent = message;
}

async function selectTemporaryImage(file) {
  if (!file) return;
  pendingTemporaryImage = {
    name: file.name || "bild",
    dataUrl: await resizeImageToDataUrl(file, 1200),
  };
  temporaryAiStatus = "";
  renderTemporaryAiAdd();
}

async function selectOverviewCoachImage(file) {
  if (!file) return;
  pendingOverviewCoachImage = {
    name: file.name || "bild",
    dataUrl: await resizeImageToDataUrl(file, 1200),
  };
  renderOverviewCoachControls();
}

function resizeImageToDataUrl(file, maxSize) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Kunde inte läsa bilden."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Kunde inte läsa bilden."));
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function analyzeTemporaryItemWithAi() {
  const text = els.temporaryAiInput?.value.trim() || "";
  if (!text && !pendingTemporaryImage) {
    temporaryAiStatus = "Skriv något eller välj en bild först.";
    renderTemporaryAiAdd();
    return;
  }
  const image = pendingTemporaryImage;
  pendingTemporaryImage = null;
  temporaryAiSuggestion = null;
  temporaryAiStatus = "Analyserar...";
  temporaryAiBusy = true;
  renderTemporaryAiAdd();

  try {
    const prompt = text || "Analysera bilden och uppskatta maten som tillfälligt idag.";
    const response = await requestAiCoach(prompt, image);
    const suggestion = normalizeAiSuggestion(response.temporaryItem);
    temporaryAiSuggestion = suggestion;
    temporaryAiStatus = suggestion
      ? (response.reply || "Kontrollera uppskattningen och lägg till den om den stämmer.")
      : (response.reply || "Jag hittade inget tydligt att lägga till.");
    if (suggestion && els.temporaryAiInput) els.temporaryAiInput.value = "";
    if (els.temporaryImageInput) els.temporaryImageInput.value = "";
  } catch (error) {
    temporaryAiStatus = `AI är inte tillgänglig just nu: ${error.message}`;
    if (els.temporaryImageInput) els.temporaryImageInput.value = "";
  } finally {
    temporaryAiBusy = false;
    renderTemporaryAiAdd();
  }
}

function addTemporarySuggestionToToday(suggestion) {
  const grams = Math.max(1, number(suggestion.grams, 100));
  state.temporaryItems.push({
    id: makeId("temp"),
    name: suggestion.name,
    grams,
    kcal100: (number(suggestion.kcal) * 100) / grams,
    protein100: (number(suggestion.protein) * 100) / grams,
    carbs100: (number(suggestion.carbs) * 100) / grams,
    fat100: (number(suggestion.fat) * 100) / grams,
  });
}

function acceptTemporaryAiSuggestion() {
  if (!temporaryAiSuggestion) return;
  addTemporarySuggestionToToday(temporaryAiSuggestion);
  temporaryAiSuggestion = null;
  temporaryAiStatus = "Tillagt i Tillfälligt idag.";
  saveState();
  renderOverview();
  renderShopping();
}

function dismissTemporaryAiSuggestion() {
  temporaryAiSuggestion = null;
  temporaryAiStatus = "";
  renderTemporaryAiAdd();
}

function findCoachMessage(messageId) {
  return [getCoachMessages("overview"), getCoachMessages("log")]
    .flat()
    .find((item) => item.id === messageId);
}

function acceptAiFoodSuggestion(messageId) {
  const message = findCoachMessage(messageId);
  const suggestion = message?.suggestion;
  if (!suggestion || suggestion.accepted || suggestion.dismissed) return;
  addTemporarySuggestionToToday(suggestion);
  suggestion.accepted = true;
  saveState();
  renderCoachChat();
  renderOverview();
  renderShopping();
}

function dismissAiFoodSuggestion(messageId) {
  const message = findCoachMessage(messageId);
  if (!message?.suggestion) return;
  message.suggestion.dismissed = true;
  saveState();
  renderCoachChat();
}

function updateTargetInputs() {
  const target = state.targets[activeTarget];
  target.kcal = number(els.targetKcal.value);
  target.protein = number(els.targetProtein.value);
  target.carbs = number(els.targetCarbs.value);
  target.fat = number(els.targetFat.value);
  saveState();
  renderTargets();
  renderOverview();
}

function updateWaterGoalInput() {
  if (!els.waterGoal) return;
  state.water = normalizeWater(state.water);
  state.water.goalMl = Math.max(0, number(els.waterGoal.value, DEFAULT_WATER_GOAL_ML)) || DEFAULT_WATER_GOAL_ML;
  syncTodayWaterLog();
  saveState();
  renderTargets();
  renderWaterTracker();
  renderLog();
}

function addCustomWater() {
  const input = document.querySelector("#waterCustomMl");
  const amount = number(input?.value);
  if (amount <= 0) return;
  addWaterMl(amount);
}

function setSettingsOpen(open) {
  if (!els.settingsPanel || !els.settingsBackdrop || !els.settingsToggle) return;
  els.settingsPanel.hidden = !open;
  els.settingsBackdrop.hidden = !open;
  els.settingsToggle.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("settings-open", open);
  if (open) {
    els.closeSettings?.focus();
  } else {
    els.settingsToggle.focus();
  }
}

function showSettingsStatus(message) {
  if (!els.settingsStatus) return;
  els.settingsStatus.textContent = message;
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `matdash-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showSettingsStatus("Exporterad.");
}

async function importBackupFile(file) {
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    state = normalizeState(parsed);
    activeTarget = state.targets[activeTarget] ? activeTarget : "training";
    activeRecipeTag = "all";
    selectedMenuId = state.menus[0]?.id || "";
    editingRecipeId = "";
    expandedMenuItemId = "";
    editingLogId = "";
    activeFoodInput = null;
    saveState();
    render();
    showSettingsStatus("Importerad.");
  } catch {
    showSettingsStatus("Kunde inte importera filen.");
  } finally {
    els.backupFile.value = "";
  }
}

function bindInstallPrompt() {
  if (!els.installApp) return;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (els.installSection) els.installSection.hidden = false;
    els.installApp.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    if (els.installSection) els.installSection.hidden = true;
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

  els.settingsToggle?.addEventListener("click", () => setSettingsOpen(true));
  els.closeSettings?.addEventListener("click", () => setSettingsOpen(false));
  els.settingsBackdrop?.addEventListener("click", () => setSettingsOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.settingsPanel?.hidden) {
      setSettingsOpen(false);
    }
  });

  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      els.tabs.forEach((item) => item.classList.remove("active"));
      els.views.forEach((view) => view.classList.remove("active"));
      tab.classList.add("active");
      document.querySelector(`#${tab.dataset.view}`).classList.add("active");
      if (window.matchMedia("(max-width: 960px)").matches) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  });

  els.targetMode.addEventListener("change", () => {
    activeTarget = els.targetMode.value;
    render();
  });
  [els.targetKcal, els.targetProtein, els.targetCarbs, els.targetFat].forEach((input) => {
    input.addEventListener("change", updateTargetInputs);
  });
  els.waterGoal?.addEventListener("input", updateWaterGoalInput);
  els.waterGoal?.addEventListener("change", updateWaterGoalInput);

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
  els.sendCoachMessage?.addEventListener("click", () => sendCoachMessage("log"));
  els.sendOverviewCoachMessage?.addEventListener("click", () => sendCoachMessage("overview"));
  els.clearCoachHistory?.addEventListener("click", () => clearCoachHistory("log"));
  els.clearOverviewCoachHistory?.addEventListener("click", () => clearCoachHistory("overview"));
  els.attachOverviewCoachImage?.addEventListener("click", () => els.overviewCoachImageInput?.click());
  els.overviewCoachImageInput?.addEventListener("change", (event) => {
    const [file] = event.target.files || [];
    selectOverviewCoachImage(file).catch((error) => {
      if (els.overviewCoachImageStatus) els.overviewCoachImageStatus.textContent = error.message;
    });
  });
  els.analyzeTemporaryItem?.addEventListener("click", analyzeTemporaryItemWithAi);
  els.attachTemporaryImage?.addEventListener("click", () => els.temporaryImageInput?.click());
  els.temporaryImageInput?.addEventListener("change", (event) => {
    const [file] = event.target.files || [];
    selectTemporaryImage(file).catch((error) => {
      temporaryAiStatus = error.message;
      renderTemporaryAiAdd();
    });
  });
  els.temporaryAiInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      analyzeTemporaryItemWithAi();
    }
  });
  els.saveAiSettings?.addEventListener("click", saveAiSettingsFromInputs);
  els.loginAi?.addEventListener("click", loginAi);
  els.logoutAi?.addEventListener("click", logoutAi);
  els.coachInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendCoachMessage("log");
    }
  });
  els.overviewCoachInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendCoachMessage("overview");
    }
  });

  els.resetData.addEventListener("click", () => {
    if (!window.confirm("Återställ all data?")) return;
    localStorage.removeItem(STORE_KEY);
    state = loadState();
    render();
    showSettingsStatus("Återställt.");
  });

  els.saveBackup.addEventListener("click", exportBackup);
  els.importBackup?.addEventListener("click", () => {
    els.backupFile?.click();
  });
  els.backupFile?.addEventListener("change", (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    if (!window.confirm("Importera backup och ersätt nuvarande data?")) {
      event.target.value = "";
      return;
    }
    importBackupFile(file);
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

    const logWater = target.dataset.logWater;
    if (logWater) {
      const [logId, key] = logWater.split(":");
      const entry = state.logEntries.find((item) => item.id === logId);
      if (entry) {
        entry[key] = number(target.value);
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
    if (target.dataset.logMacro || target.dataset.logField || target.dataset.logWater) {
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
    if (target.id === "waterCustomMl" && event.key === "Enter") {
      event.preventDefault();
      addCustomWater();
    }
  });

  document.addEventListener("focusout", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const recipeId = target.dataset.newTag;
    if (!recipeId) return;
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof HTMLElement && nextTarget.closest(`[data-save-tag="${CSS.escape(recipeId)}"]`)) return;
    const value = target.value.trim();
    if (!value) {
      const row = target.closest("[data-tag-add-row]");
      if (row) row.hidden = true;
      return;
    }
    window.setTimeout(() => addTagToRecipe(recipeId, value), 0);
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

    const waterAdd = target.closest("[data-water-add]")?.dataset.waterAdd;
    if (waterAdd) {
      addWaterMl(number(waterAdd));
      return;
    }

    if (target.closest("[data-water-custom]")) {
      addCustomWater();
      return;
    }

    if (target.closest("[data-water-reset]")) {
      resetTodayWater();
      return;
    }

    const aiFoodToAccept = target.closest("[data-accept-ai-food]")?.dataset.acceptAiFood;
    if (aiFoodToAccept) {
      acceptAiFoodSuggestion(aiFoodToAccept);
      return;
    }

    const aiFoodToDismiss = target.closest("[data-dismiss-ai-food]")?.dataset.dismissAiFood;
    if (aiFoodToDismiss) {
      dismissAiFoodSuggestion(aiFoodToDismiss);
      return;
    }

    if (target.closest("[data-accept-temporary-ai]")) {
      acceptTemporaryAiSuggestion();
      return;
    }

    if (target.closest("[data-dismiss-temporary-ai]")) {
      dismissTemporaryAiSuggestion();
      return;
    }

    const tagToSave = target.closest("[data-save-tag]")?.dataset.saveTag;
    if (tagToSave) {
      saveNewTag(tagToSave);
      return;
    }

    const recipeToEdit = target.closest("[data-edit-recipe]")?.dataset.editRecipe;
    if (recipeToEdit) {
      const isClosing = editingRecipeId === recipeToEdit;
      editingRecipeId = isClosing ? "" : recipeToEdit;
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
      openTagInput(showTagInput);
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
