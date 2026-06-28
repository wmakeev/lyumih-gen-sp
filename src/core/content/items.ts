/**
 * Предметы экипировки (§8, §17). 27 шаблонов: 3 generic shop + 24 class gear
 * (8 классов × 3 слота). Конвенция id: generic_* и gear_<class>_<slot>.
 *
 * weapon → cardLevelBonusPerItemLevel > 0
 * armor  → высокий hpBonusPerItemLevel
 * accessory → statBonusPerItemLevel
 */

import type { ItemTemplate } from '../types/content'

export const GENERIC_ITEMS: ItemTemplate[] = [
  {
    id: 'generic_blade',
    label: 'Простой клинок',
    slot: 'weapon',
    shopPrice: 250,
    hpBonusPerItemLevel: 0,
    cardLevelBonusPerItemLevel: 1,
    statBonusPerItemLevel: { attack: 2 },
    tags: ['weapon', 'physical'],
    iconEmoji: '🗡️',
  },
  {
    id: 'generic_jerkin',
    label: 'Простой доспех',
    slot: 'armor',
    shopPrice: 220,
    hpBonusPerItemLevel: 12,
    cardLevelBonusPerItemLevel: 0,
    statBonusPerItemLevel: { defense: 2 },
    tags: ['armor', 'physical'],
    iconEmoji: '🦺',
  },
  {
    id: 'generic_trinket',
    label: 'Простой амулет',
    slot: 'accessory',
    shopPrice: 200,
    hpBonusPerItemLevel: 2,
    cardLevelBonusPerItemLevel: 0,
    statBonusPerItemLevel: { initiative: 3, critChance: 1 },
    tags: ['accessory', 'utility'],
    iconEmoji: '📿',
  },
]

interface GearSpec {
  classId: string
  className: string
  weapon: { label: string; emoji: string; stat: ItemTemplate['statBonusPerItemLevel']; tags: string[] }
  armor: { label: string; emoji: string; stat: ItemTemplate['statBonusPerItemLevel']; tags: string[] }
  accessory: { label: string; emoji: string; stat: ItemTemplate['statBonusPerItemLevel']; tags: string[] }
}

const GEAR_SPECS: GearSpec[] = [
  {
    classId: 'warrior',
    className: 'воина',
    weapon: { label: 'Боевой меч', emoji: '⚔️', stat: { attack: 4 }, tags: ['weapon', 'physical'] },
    armor: { label: 'Латный доспех', emoji: '🛡️', stat: { defense: 4 }, tags: ['armor', 'physical'] },
    accessory: { label: 'Знамя доблести', emoji: '🚩', stat: { health: 12, defense: 2 }, tags: ['accessory', 'physical'] },
  },
  {
    classId: 'mage',
    className: 'мага',
    weapon: { label: 'Посох стихий', emoji: '🪄', stat: { magicPower: 5 }, tags: ['weapon', 'fire'] },
    armor: { label: 'Мантия чародея', emoji: '🥼', stat: { mana: 6 }, tags: ['armor', 'fire'] },
    accessory: { label: 'Кристалл маны', emoji: '🔮', stat: { magicPower: 3, mana: 4 }, tags: ['accessory', 'fire'] },
  },
  {
    classId: 'ranger',
    className: 'следопыта',
    weapon: { label: 'Длинный лук', emoji: '🏹', stat: { attack: 3, speed: 1 }, tags: ['weapon', 'physical'] },
    armor: { label: 'Кожаный кафтан', emoji: '🧥', stat: { speed: 1, defense: 2 }, tags: ['armor', 'physical'] },
    accessory: { label: 'Колчан меткости', emoji: '🎯', stat: { critChance: 3 }, tags: ['accessory', 'physical'] },
  },
  {
    classId: 'healer',
    className: 'целителя',
    weapon: { label: 'Жезл благодати', emoji: '✨', stat: { healPower: 5 }, tags: ['weapon', 'holy'] },
    armor: { label: 'Облачение жреца', emoji: '👘', stat: { healPower: 2, defense: 2 }, tags: ['armor', 'holy'] },
    accessory: { label: 'Святой символ', emoji: '🕊️', stat: { healPower: 3, mana: 3 }, tags: ['accessory', 'holy'] },
  },
  {
    classId: 'rogue',
    className: 'разбойника',
    weapon: { label: 'Парные кинжалы', emoji: '🗡️', stat: { critChance: 4, attack: 2 }, tags: ['weapon', 'physical'] },
    armor: { label: 'Тёмный плащ', emoji: '🥷', stat: { speed: 1, critChance: 2 }, tags: ['armor', 'shadow'] },
    accessory: { label: 'Перчатки вора', emoji: '🧤', stat: { critChance: 3, initiative: 2 }, tags: ['accessory', 'shadow'] },
  },
  {
    classId: 'paladin',
    className: 'паладина',
    weapon: { label: 'Священный молот', emoji: '🔨', stat: { attack: 3, healPower: 2 }, tags: ['weapon', 'holy'] },
    armor: { label: 'Освящённые латы', emoji: '🛡️', stat: { defense: 5 }, tags: ['armor', 'holy'] },
    accessory: { label: 'Реликварий', emoji: '⛪', stat: { defense: 2, healPower: 3 }, tags: ['accessory', 'holy'] },
  },
  {
    classId: 'warlock',
    className: 'чернокнижника',
    weapon: { label: 'Гримуар порчи', emoji: '📕', stat: { magicPower: 5, critChance: 2 }, tags: ['weapon', 'shadow'] },
    armor: { label: 'Одеяние тьмы', emoji: '🧛', stat: { magicPower: 3 }, tags: ['armor', 'shadow'] },
    accessory: { label: 'Череп-фетиш', emoji: '💀', stat: { critChance: 3, magicPower: 2 }, tags: ['accessory', 'shadow'] },
  },
  {
    classId: 'berserker',
    className: 'берсерка',
    weapon: { label: 'Громадная секира', emoji: '🪓', stat: { attack: 6 }, tags: ['weapon', 'physical'] },
    armor: { label: 'Шкура зверя', emoji: '🐻', stat: { health: 14, attack: 1 }, tags: ['armor', 'physical'] },
    accessory: { label: 'Тотем ярости', emoji: '🪬', stat: { attack: 3, speed: 1 }, tags: ['accessory', 'physical'] },
  },
]

function buildGear(): ItemTemplate[] {
  const out: ItemTemplate[] = []
  for (const g of GEAR_SPECS) {
    out.push({
      id: `gear_${g.classId}_weapon`,
      label: `${g.weapon.label} ${g.className}`,
      slot: 'weapon',
      shopPrice: 600,
      hpBonusPerItemLevel: 0,
      cardLevelBonusPerItemLevel: 2,
      statBonusPerItemLevel: g.weapon.stat,
      tags: g.weapon.tags,
      iconEmoji: g.weapon.emoji,
    })
    out.push({
      id: `gear_${g.classId}_armor`,
      label: `${g.armor.label} ${g.className}`,
      slot: 'armor',
      shopPrice: 550,
      hpBonusPerItemLevel: 20,
      cardLevelBonusPerItemLevel: 0,
      statBonusPerItemLevel: g.armor.stat,
      tags: g.armor.tags,
      iconEmoji: g.armor.emoji,
    })
    out.push({
      id: `gear_${g.classId}_accessory`,
      label: `${g.accessory.label} ${g.className}`,
      slot: 'accessory',
      shopPrice: 500,
      hpBonusPerItemLevel: 4,
      cardLevelBonusPerItemLevel: 0,
      statBonusPerItemLevel: g.accessory.stat,
      tags: g.accessory.tags,
      iconEmoji: g.accessory.emoji,
    })
  }
  return out
}

export const CLASS_GEAR: ItemTemplate[] = buildGear()

export const ITEMS: ItemTemplate[] = [...GENERIC_ITEMS, ...CLASS_GEAR]
