// Zrcadlí konstanty z mercenary/scripts/GameSettings.gd. Když ve hře přibude
// mapa/operátor/mód, doplň ho i sem - neznámé ID se jinak zobrazí syrově
// (appka na něm nespadne, jen ukáže třeba "new_map" místo hezkého názvu).

export const MODES = [
  { id: 'classic', name: 'Classic', hint: 'Mercenary free-play. Map objective, scored 0-1000.' },
  { id: 'annihilation', name: 'Annihilation', hint: 'Mercenary free-play. Eliminate everyone, scored 0-1000.' },
  { id: 'endless', name: 'Endless', hint: 'Waves until you fall. 10 points per kill, no ceiling.' },
  { id: 'story', name: 'Story', hint: 'Campaign missions, scored 0-1000.' },
]

export const MAPS = {
  warehouse: { name: 'Warehouse' },
  office: { name: 'Office' },
  cellar: { name: 'Cellar' },
  aegis_second_building: { name: 'Aegis Second Building' },
  aegis_side_1: { name: 'Aegis Solutions - Side Building' },
  aegis_side_2: { name: 'Aegis Solutions - Side Building (Demolition)' },
}

// MAP_ORDER a ENDLESS_SUPPORTED_MAPS jsou ve hře dnes stejný seznam.
const MERCENARY_MAPS = ['warehouse', 'office', 'cellar', 'aegis_second_building']
const STORY_MAPS = ['aegis_side_1', 'aegis_side_2']

export function mapsForMode(modeId) {
  return modeId === 'story' ? STORY_MAPS : MERCENARY_MAPS
}

export const OPERATOR_ORDER = ['alpha_captain', 'ak_operator', 'deagle_operator']

export const OPERATORS = {
  alpha_captain: { name: 'Alpha Team Captain', weapon: 'MP5' },
  ak_operator: { name: 'Bravo Operator', weapon: 'AK-47' },
  deagle_operator: { name: 'Charlie Operator', weapon: 'Desert Eagle' },
}

export const DIFFICULTIES = ['Easy', 'Normal', 'Hard']

/** Horní mez skóre pro daný mód - Endless nemá strop. */
export function scoreCeiling(modeId) {
  return modeId === 'endless' ? null : 1000
}

export function mapName(mapId) {
  return MAPS[mapId]?.name ?? mapId
}

export function operatorName(operatorId) {
  return OPERATORS[operatorId]?.name ?? operatorId
}

export function operatorWeapon(operatorId) {
  return OPERATORS[operatorId]?.weapon ?? ''
}

export function difficultyName(difficulty) {
  return DIFFICULTIES[difficulty] ?? `#${difficulty}`
}

export function modeName(modeId) {
  return MODES.find((m) => m.id === modeId)?.name ?? modeId
}
