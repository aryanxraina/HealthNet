// Food log maths. A food (from search, a barcode or typed in) has values per 100 g; an entry is
// the amount someone ate, with its nutrients already worked out so totals are simple sums.

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snacks'];
export const NUTRIENTS = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar'];
export const DEFAULT_CALORIE_GOAL = 2000;

const round1 = (value) => Math.round(value * 10) / 10;

// Local calendar date as 'YYYY-MM-DD' (also the Firestore document id for the day)
export const dateKey = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const newEntryId = () => `food-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// food: { id, source, name, brand, per100g }; grams eaten; amountLabel e.g. "2 × 1 banana"
export const entryFrom = (food, grams, amountLabel) => {
  const entry = {
    id: newEntryId(),
    name: food.name,
    brand: food.brand || null,
    amountLabel: amountLabel || `${round1(grams)} g`,
    grams: round1(grams),
    source: food.source,
    sourceId: food.id || null,
  };
  NUTRIENTS.forEach((nutrient) => {
    const per100 = food.per100g?.[nutrient];
    entry[nutrient] = per100 === null || per100 === undefined ? null : round1((per100 * grams) / 100);
  });
  entry.kcal = Math.round(entry.kcal ?? 0);
  return entry;
};

// A typed-in food, values for the whole portion
export const customEntry = ({ name, kcal, protein, carbs, fat, amountLabel }) => ({
  id: newEntryId(),
  name: name.trim(),
  brand: null,
  amountLabel: amountLabel?.trim() || '1 portion',
  grams: null,
  source: 'custom',
  sourceId: null,
  kcal: Math.round(Number(kcal) || 0),
  protein: protein === '' || protein === undefined ? null : round1(Number(protein)),
  carbs: carbs === '' || carbs === undefined ? null : round1(Number(carbs)),
  fat: fat === '' || fat === undefined ? null : round1(Number(fat)),
  fiber: null,
  sugar: null,
});

export const totalsOf = (entries) => {
  const totals = Object.fromEntries(NUTRIENTS.map((nutrient) => [nutrient, 0]));
  entries.forEach((entry) => NUTRIENTS.forEach((nutrient) => { totals[nutrient] += Number(entry[nutrient]) || 0; }));
  return Object.fromEntries(Object.entries(totals).map(([nutrient, value]) => [nutrient, nutrient === 'kcal' ? Math.round(value) : round1(value)]));
};

export const dayTotals = (meals) => totalsOf(MEALS.flatMap((meal) => meals?.[meal] || []));

// Grams of each macro for a calorie goal, split 50% carbs / 25% protein / 25% fat
export const macroGoals = (calorieGoal) => ({
  carbs: Math.round((calorieGoal * 0.5) / 4),
  protein: Math.round((calorieGoal * 0.25) / 4),
  fat: Math.round((calorieGoal * 0.25) / 9),
});

// The meal someone is most likely logging right now
export const mealForTime = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snacks';
};
