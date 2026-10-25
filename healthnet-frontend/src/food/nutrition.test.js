import { customEntry, dateKey, dayTotals, entryFrom, macroGoals, mealForTime } from './nutrition';

const banana = { id: 'usda:2709224', source: 'usda', name: 'Banana, raw', brand: null, per100g: { kcal: 97, protein: 0.74, carbs: 22.71, fat: 0.28, fiber: 1.7, sugar: null } };

test('entries scale per-100 g values to the amount eaten', () => {
  const entry = entryFrom(banana, 252, '2 × 1 banana');
  expect(entry).toMatchObject({ name: 'Banana, raw', amountLabel: '2 × 1 banana', grams: 252, kcal: 244, protein: 1.9, carbs: 57.2, fat: 0.7, fiber: 4.3, sugar: null, source: 'usda', sourceId: 'usda:2709224' });
  expect(entryFrom(banana, 50).amountLabel).toBe('50 g');
});

test('day totals add up every meal, ignoring missing values', () => {
  const meals = {
    breakfast: [entryFrom(banana, 126)],
    lunch: [customEntry({ name: 'Dal and rice', kcal: '520', protein: '18', carbs: '', fat: '9' })],
    snacks: [],
  };
  expect(dayTotals(meals)).toEqual({ kcal: 642, protein: 18.9, carbs: 28.6, fat: 9.4, fiber: 2.1, sugar: 0 });
  expect(dayTotals({})).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 });
});

test('macro goals split calories 50/25/25', () => {
  expect(macroGoals(2000)).toEqual({ carbs: 250, protein: 125, fat: 56 });
});

test('dates and meal suggestions use local time', () => {
  expect(dateKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  expect(mealForTime(new Date(2026, 0, 5, 8))).toBe('breakfast');
  expect(mealForTime(new Date(2026, 0, 5, 13))).toBe('lunch');
  expect(mealForTime(new Date(2026, 0, 5, 19))).toBe('dinner');
  expect(mealForTime(new Date(2026, 0, 5, 23))).toBe('snacks');
});
