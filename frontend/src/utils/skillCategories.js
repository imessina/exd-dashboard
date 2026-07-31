export const SIN_CATEGORIA = '— Sin categoría —'

export const SKILL_CATEGORIES_ORDER = [
  'Cloud & DevOps',
  'Data & Analytics',
  'Delivery & Producto',
  'Desarrollo',
  'IA & GenAI',
  'Idioma',
  'Marketing & Creative',
  'Spatial Computing',
  'UX / CX',
]

const ORDER_INDEX = Object.fromEntries(
  SKILL_CATEGORIES_ORDER.map((categoria, index) => [categoria, index]),
)

export function ordenarCategorias(categorias = []) {
  return [...new Set(categorias.filter(Boolean))].sort((a, b) => {
    if (a === SIN_CATEGORIA) return 1
    if (b === SIN_CATEGORIA) return -1

    const aIndex = ORDER_INDEX[a]
    const bIndex = ORDER_INDEX[b]

    if (aIndex != null && bIndex != null) return aIndex - bIndex
    if (aIndex != null) return -1
    if (bIndex != null) return 1

    return a.localeCompare(b, 'es')
  })
}

export const SKILL_CATEGORY_BADGE = {
  'Cloud & DevOps':
    'bg-slate-200 text-slate-800 border border-slate-300',
  'Data & Analytics':
    'bg-blue-100 text-blue-950 border border-blue-200',
  'Delivery & Producto':
    'bg-amber-50 text-amber-950 border border-amber-200',
  Desarrollo:
    'bg-teal-100 text-teal-950 border border-teal-200',
  'IA & GenAI':
    'bg-indigo-100 text-indigo-950 border border-indigo-200',
  Idioma:
    'bg-cyan-50 text-cyan-950 border border-cyan-200',
  'Marketing & Creative':
    'bg-rose-50 text-rose-950 border border-rose-200',
  'Spatial Computing':
    'bg-violet-50 text-violet-950 border border-violet-200',
  'UX / CX':
    'bg-gray-100 text-gray-800 border border-gray-200',
}

export const SKILL_CATEGORY_TEXT = {
  'Cloud & DevOps': 'text-slate-800',
  'Data & Analytics': 'text-blue-950',
  'Delivery & Producto': 'text-amber-950',
  Desarrollo: 'text-teal-950',
  'IA & GenAI': 'text-indigo-950',
  Idioma: 'text-cyan-950',
  'Marketing & Creative': 'text-rose-950',
  'Spatial Computing': 'text-violet-950',
  'UX / CX': 'text-gray-800',
}

export const SKILL_CATEGORY_PANEL = {
  'Cloud & DevOps':
    'text-slate-800 bg-slate-50 border-slate-300',
  'Data & Analytics':
    'text-blue-950 bg-blue-50 border-blue-200',
  'Delivery & Producto':
    'text-amber-950 bg-amber-50/70 border-amber-200',
  Desarrollo:
    'text-teal-950 bg-teal-50 border-teal-200',
  'IA & GenAI':
    'text-indigo-950 bg-indigo-50 border-indigo-200',
  Idioma:
    'text-cyan-950 bg-cyan-50 border-cyan-200',
  'Marketing & Creative':
    'text-rose-950 bg-rose-50/70 border-rose-200',
  'Spatial Computing':
    'text-violet-950 bg-violet-50 border-violet-200',
  'UX / CX':
    'text-gray-800 bg-gray-50 border-gray-200',
}

export const skillCategoryBadge = categoria =>
  SKILL_CATEGORY_BADGE[categoria] ?? 'bg-gray-100 text-gray-600'

export const skillCategoryText = categoria =>
  SKILL_CATEGORY_TEXT[categoria] ?? 'text-gray-600'

export const skillCategoryPanel = categoria =>
  SKILL_CATEGORY_PANEL[categoria] ?? 'text-gray-700 bg-gray-50 border-gray-200'
