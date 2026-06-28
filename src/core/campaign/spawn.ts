/**
 * Бридж «персонаж кампании → боевой юнит» (§5.2, §6.2, §8).
 * Считает effective-статы с бонусами экипировки/пассивов/модов и собирает
 * боевые карты (лоадаут + strike от оружия).
 */

import type { Character } from '../types/character'
import type { ContentRegistry, EnemyArchetype } from '../types/content'
import type { BattleCard, BattleUnit } from '../types/battle'
import type { ItemInstance, ModSlotState } from '../types/memento'
import type { Rng } from '../rng'
import { STRIKE_TEMPLATE_ID } from '../types/cards'
import {
  effectiveStats,
  powerMult,
  zeroStats,
  type StatBlock,
  STAT_IDS,
} from '../types/stats'
import {
  collectModEffects,
  resolveCarrierMods,
} from '../memento/mods'
import { luckyFlags } from './specs'

function equippedItems(ch: Character): {
  weapon?: ItemInstance
  armor?: ItemInstance
  accessory?: ItemInstance
} {
  const byId = (id: string | null) =>
    id ? ch.items.find((i) => i.id === id) : undefined
  return {
    weapon: byId(ch.equipment.weapon),
    armor: byId(ch.equipment.armor),
    accessory: byId(ch.equipment.accessory),
  }
}

/** Полные effective-статы персонажа с экипировкой/пассивами/модами. */
export function characterBattleStats(
  ch: Character,
  registry: ContentRegistry,
  worldPower: number,
): StatBlock {
  const stats = effectiveStats(ch.baseStats, ch.unitLevel, worldPower)
  const eq = equippedItems(ch)

  for (const item of [eq.weapon, eq.armor, eq.accessory]) {
    if (!item) continue
    const tpl = registry.items.get(item.templateId)
    if (!tpl) continue
    stats.health += tpl.hpBonusPerItemLevel * item.itemLevel
    if (tpl.statBonusPerItemLevel) {
      for (const id of STAT_IDS) {
        stats[id] += (tpl.statBonusPerItemLevel[id] ?? 0) * item.itemLevel
      }
    }
    // пассивные стат-моды экипировки (carrier_hp_add/defense_add/initiative_add)
    const eff = collectModEffects(resolveCarrierMods(item.modSlots, registry.cardItemMods))
    stats.health += eff.carrierHpAdd
    stats.defense += eff.defenseAdd
    stats.initiative += eff.initiativeAdd
  }

  // надетые пассивы со стат-эффектом (стакинг: ≤1 flat и ≤1 % на statId — §7.2;
  // здесь только flat-эффекты, стакинг по statId через max)
  const flatByStat = new Map<string, number>()
  for (const pid of ch.passiveEquip) {
    const inst = ch.passives.find((p) => p.id === pid)
    if (!inst) continue
    const tpl = registry.passives.get(inst.templateId)
    if (!tpl || tpl.effect.type !== 'stat') continue
    for (const id of STAT_IDS) {
      const v = tpl.effect.mods[id]
      if (v === undefined) continue
      flatByStat.set(id, Math.max(flatByStat.get(id) ?? 0, v))
    }
  }
  for (const [id, v] of flatByStat) stats[id as keyof StatBlock] += v

  for (const id of STAT_IDS) stats[id] = Math.round(stats[id])
  return stats
}

function buildStrikeCard(ch: Character, registry: ContentRegistry): BattleCard {
  const eq = equippedItems(ch)
  const weapon = eq.weapon
  // Базовая атака класса (strike/shot/magic_bolt) — иначе «кулаки» = strike.
  const cls = registry.classes.get(ch.classId)
  const baseId = cls?.baseAttack ?? STRIKE_TEMPLATE_ID
  const tpl = registry.cards.get(baseId) ?? registry.cards.get(STRIKE_TEMPLATE_ID)
  const templateId = tpl?.id ?? STRIKE_TEMPLATE_ID
  return {
    instanceId: `strike-${ch.id}`,
    templateId,
    kind: tpl?.kind ?? 'melee',
    level: weapon ? weapon.itemLevel : 0, // «кулаки» = 0 (§16.5)
    uses: 0,
    damageLevelBonus: 0,
    cooldownLeft: 0,
    cooldownTurns: 0, // strike без CD (§7.4)
    modSlots: weapon ? weapon.modSlots : [],
    carrierTags: tpl?.tags ?? ['weapon', 'attack'],
    isBasic: true,
    ...(weapon ? { weaponInstanceId: weapon.id } : {}),
  }
}

/** Суммарный cardLevelBonus от экипировки (§6.6). */
function equipmentCardLevelBonus(ch: Character, registry: ContentRegistry): number {
  let bonus = 0
  const eq = equippedItems(ch)
  for (const item of [eq.weapon, eq.armor, eq.accessory]) {
    if (!item) continue
    const tpl = registry.items.get(item.templateId)
    if (tpl) bonus += tpl.cardLevelBonusPerItemLevel * item.itemLevel
  }
  return bonus
}

function buildLoadoutCards(ch: Character, registry: ContentRegistry): BattleCard[] {
  const bonus = equipmentCardLevelBonus(ch, registry)
  const cards: BattleCard[] = []
  for (const cid of ch.battleLoadout) {
    const inst = ch.cards.find((c) => c.id === cid)
    if (!inst) continue
    const tpl = registry.cards.get(inst.templateId)
    if (!tpl || tpl.enabled === false) continue
    cards.push({
      instanceId: inst.id,
      templateId: inst.templateId,
      kind: tpl.kind,
      level: inst.global_level,
      uses: 0,
      damageLevelBonus: bonus,
      cooldownLeft: 0,
      cooldownTurns: tpl.id === STRIKE_TEMPLATE_ID ? 0 : tpl.cooldownTurns * 2, // ×2 (§7.4)
      modSlots: inst.modSlots,
      carrierTags: tpl.tags,
      isBasic: false,
    })
  }
  return cards
}

export interface SpawnedUnit {
  unit: BattleUnit
  /** Привязка обратно к инстансам для синка прогресса после боя. */
  characterId: string
}

/** Строит боевого юнита из персонажа в позиции (x,y). */
export function spawnHeroUnit(
  ch: Character,
  registry: ContentRegistry,
  worldPower: number,
  x: number,
  y: number,
): BattleUnit {
  const stats = characterBattleStats(ch, registry, worldPower)
  const eq = equippedItems(ch)
  const defensiveMods: ModSlotState[] = [
    ...(eq.armor?.modSlots ?? []),
    ...(eq.accessory?.modSlots ?? []),
  ]
  const cls = registry.classes.get(ch.classId)
  const lucky = luckyFlags(ch, registry)
  return {
    id: `unit-${ch.id}`,
    side: 'player',
    characterId: ch.id,
    x,
    y,
    hp: stats.health,
    maxHp: stats.health,
    unitLevel: ch.unitLevel,
    initiativeBase: stats.initiative,
    stats,
    baseStats: ch.baseStats,
    classId: ch.classId,
    displayName: ch.name,
    iconEmoji: ch.iconEmoji,
    iconAccent: ch.iconAccent,
    statusEffects: [],
    cards: [...buildLoadoutCards(ch, registry), buildStrikeCard(ch, registry)],
    baseAttackId: cls?.baseAttack ?? 'strike',
    hasActedThisRound: false,
    hitsTaken: 0,
    defensiveMods,
    luckyCard: lucky.card,
    luckyItem: lucky.item,
  }
}

// --- Враги (§13.2) ---

const BASIC_ATTACK_FLAT: Record<string, number> = {
  strike: 5,
  shot: 5,
  magic_bolt: 6,
}

/**
 * Балансовая правка (§0, вне нормативного scope): глобальный коэффициент силы
 * врагов. Контент-заглушки задали высокие baseStats, из-за чего стартовый
 * отряд не мог пробить ранних врагов. Базовый множитель делает раннюю игру
 * проходимой; с ростом worldPower враги всё равно усиливаются по §5.2/§13.2.
 * Боссы ослабляются меньше. См. docs/balance.md.
 */
const ENEMY_POWER_SCALE = 0.5
const BOSS_POWER_SCALE = 0.7

function enemyScaledStats(
  arch: EnemyArchetype,
  unitLevel: number,
  worldPower: number,
  rng: Rng,
): StatBlock {
  const balance = arch.isBoss ? BOSS_POWER_SCALE : ENEMY_POWER_SCALE
  const mult = powerMult(unitLevel, worldPower) * balance
  const out = zeroStats()
  // обычный — один variance на все статы; хаотичный — per-stat (§13.2)
  const singleVar = 0.5 + rng.nextFloat() // U(0.5,1.5)
  for (const id of STAT_IDS) {
    const variance = arch.isChaotic ? 0.5 + rng.nextFloat() : singleVar
    out[id] = Math.max(1, Math.round(arch.baseStats[id] * mult * variance))
  }
  return out
}

function enemyBattleCards(
  arch: EnemyArchetype,
  registry: ContentRegistry,
  unitId: string,
  unitLevel: number,
): BattleCard[] {
  const cards: BattleCard[] = []
  for (const preset of arch.skillPresets) {
    const tpl = registry.cards.get(preset.templateId)
    if (!tpl) continue
    cards.push({
      instanceId: `${unitId}-${preset.templateId}`,
      templateId: preset.templateId,
      kind: tpl.kind,
      level: preset.level,
      uses: 0,
      damageLevelBonus: 0,
      cooldownLeft: 0,
      cooldownTurns: tpl.cooldownTurns * 2,
      modSlots: preset.modSlots.map((m) => ({
        status: 'filled' as const,
        templateId: m.templateId,
        lm: m.lm,
      })),
      carrierTags: tpl.tags,
      isBasic: false,
    })
  }
  // базовая атака врага
  const basicId = arch.baseAttack
  cards.push({
    instanceId: `${unitId}-basic`,
    templateId: registry.cards.has(basicId) ? basicId : STRIKE_TEMPLATE_ID,
    kind: 'melee',
    level: Math.max(1, unitLevel), // §13.2: масштаб с worldPower, не от длины id
    uses: 0,
    damageLevelBonus: 0,
    cooldownLeft: 0,
    cooldownTurns: 0,
    modSlots: [],
    carrierTags: ['attack'],
    isBasic: true,
  })
  return cards
}

/** Строит боевого юнита-врага из архетипа (§13.2). */
export function spawnEnemyUnit(
  arch: EnemyArchetype,
  registry: ContentRegistry,
  worldPower: number,
  x: number,
  y: number,
  rng: Rng,
  index = 0,
): BattleUnit {
  const unitLevel = Math.max(1, worldPower)
  const stats = enemyScaledStats(arch, unitLevel, worldPower, rng)
  const unitId = `enemy-${arch.id}-${index}`
  // базовая атака врага использует strike-подобный шаблон, если нет своего
  if (!registry.cards.has(arch.baseAttack)) {
    // гарантируем минимальный урон базовой атаки
    void BASIC_ATTACK_FLAT
  }
  return {
    id: unitId,
    side: 'enemy',
    x,
    y,
    hp: stats.health,
    maxHp: stats.health,
    unitLevel,
    initiativeBase: stats.initiative,
    stats,
    baseStats: arch.baseStats,
    archetypeId: arch.id,
    raceId: arch.raceId,
    classId: arch.classId,
    displayName: arch.label,
    iconEmoji: arch.iconEmoji,
    statusEffects: [],
    cards: enemyBattleCards(arch, registry, unitId, unitLevel),
    baseAttackId: arch.baseAttack,
    hasActedThisRound: false,
    hitsTaken: 0,
    isBoss: arch.isBoss,
    bossMechanics: arch.bossMechanics,
    skillPriorities: arch.skillPriorities,
  }
}
