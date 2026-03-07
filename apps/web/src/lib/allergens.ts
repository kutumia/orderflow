// The 14 allergens regulated under UK food law (Natasha's Law)
export const ALLERGENS = [
  { id: "celery", label: "Celery", emoji: "🌿" },
  { id: "gluten", label: "Cereals containing gluten", emoji: "🌾" },
  { id: "crustaceans", label: "Crustaceans", emoji: "🦐" },
  { id: "eggs", label: "Eggs", emoji: "🥚" },
  { id: "fish", label: "Fish", emoji: "🐟" },
  { id: "lupin", label: "Lupin", emoji: "🌱" },
  { id: "milk", label: "Milk", emoji: "🥛" },
  { id: "molluscs", label: "Molluscs", emoji: "🐚" },
  { id: "mustard", label: "Mustard", emoji: "🟡" },
  { id: "nuts", label: "Tree nuts", emoji: "🥜" },
  { id: "peanuts", label: "Peanuts", emoji: "🥜" },
  { id: "sesame", label: "Sesame", emoji: "⚪" },
  { id: "soybeans", label: "Soybeans", emoji: "🫘" },
  { id: "sulphites", label: "Sulphur dioxide/sulphites", emoji: "🧪" },
] as const;

export type AllergenId = (typeof ALLERGENS)[number]["id"];

export function getAllergenLabel(id: string): string {
  return ALLERGENS.find((a) => a.id === id)?.label || id;
}

export function getAllergenEmoji(id: string): string {
  return ALLERGENS.find((a) => a.id === id)?.emoji || "⚠️";
}
