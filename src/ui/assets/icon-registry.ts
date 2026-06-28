/**
 * UI-реестр иконок — единый источник истины «что показать» для статических
 * семантических id (план §D2). Фолбэк-эмодзи живёт здесь, а НЕ в `core`: ядро
 * отдаёт только семантический id (statId, kind, slot…), отображение — целиком
 * в UI. Согласован по id с `atlas-manifest.json` («где это в атласе»).
 *
 * Не входят сюда: per-instance аватары персонажей/врагов — это динамическая
 * игровая флешь (рандом при найме), её id-картинку в атласе задаёт класс/раса,
 * а фолбэк — собственный `iconEmoji` инстанса (передаётся в <Sprite fallback>).
 */

export interface IconEntry {
  emoji: string
  /** Атлас по умолчанию для этого id (см. atlas-manifest.json). */
  atlas: string
}

export const ICONS: Record<string, IconEntry> = {
  // 9 статов (§5.1) — перенесены из core STAT_META.emoji.
  health: { emoji: '❤️', atlas: 'icons' },
  defense: { emoji: '🛡️', atlas: 'icons' },
  attack: { emoji: '⚔️', atlas: 'icons' },
  magicPower: { emoji: '✨', atlas: 'icons' },
  mana: { emoji: '🔷', atlas: 'icons' },
  healPower: { emoji: '💚', atlas: 'icons' },
  speed: { emoji: '👟', atlas: 'icons' },
  initiative: { emoji: '⚡', atlas: 'icons' },
  critChance: { emoji: '🎯', atlas: 'icons' },

  // 11 CardKind (§6.5).
  melee: { emoji: '🗡️', atlas: 'icons' },
  ranged: { emoji: '🏹', atlas: 'icons' },
  aoe: { emoji: '💥', atlas: 'icons' },
  heal: { emoji: '💚', atlas: 'icons' },
  regen: { emoji: '🌿', atlas: 'icons' },
  resurrect: { emoji: '🕯️', atlas: 'icons' },
  buff: { emoji: '⬆️', atlas: 'icons' },
  debuff: { emoji: '⬇️', atlas: 'icons' },
  dot: { emoji: '☠️', atlas: 'icons' },
  lifesteal_spell: { emoji: '🩸', atlas: 'icons' },
  utility: { emoji: '🔧', atlas: 'icons' },

  // Слоты экипировки (§4.4).
  slot_weapon: { emoji: '🗡️', atlas: 'icons' },
  slot_armor: { emoji: '🛡️', atlas: 'icons' },
  slot_accessory: { emoji: '📿', atlas: 'icons' },

  // Оси Memento и группы модов (§7.4).
  axis_victory: { emoji: '🏆', atlas: 'meta' },
  axis_use: { emoji: '🔁', atlas: 'meta' },
  axis_death: { emoji: '💀', atlas: 'meta' },
  mod_damage: { emoji: '⚔️', atlas: 'meta' },
  mod_survival: { emoji: '💚', atlas: 'meta' },
  mod_utility: { emoji: '🔧', atlas: 'meta' },
  mod_defense: { emoji: '🛡️', atlas: 'meta' },

  // UI-глифы хаба.
  gold: { emoji: '💰', atlas: 'meta' },
  world_power: { emoji: '🌍', atlas: 'meta' },
  scenario: { emoji: '📜', atlas: 'meta' },
}

/** Фолбэк-эмодзи по id (пусто, если id не в реестре). */
export function iconEmoji(id: string): string | undefined {
  return ICONS[id]?.emoji
}
