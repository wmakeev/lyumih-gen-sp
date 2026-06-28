/**
 * 8 игровых классов (§17). Каждый класс задаёт primary/secondary статы,
 * канал базовой атаки и 3 стартовых предмета (конвенция gear_<class>_<slot>).
 */

import type { ClassDef } from '../types/character'

export const CLASSES: ClassDef[] = [
  {
    id: 'warrior',
    label: 'Воин',
    primaryStats: ['attack', 'health'],
    secondaryStats: ['defense'],
    baseAttack: 'strike',
    startingGear: ['gear_warrior_weapon', 'gear_warrior_armor', 'gear_warrior_accessory'],
    iconEmoji: '⚔️',
  },
  {
    id: 'mage',
    label: 'Маг',
    primaryStats: ['magicPower', 'mana'],
    secondaryStats: ['critChance'],
    baseAttack: 'magic_bolt',
    startingGear: ['gear_mage_weapon', 'gear_mage_armor', 'gear_mage_accessory'],
    iconEmoji: '🧙',
  },
  {
    id: 'ranger',
    label: 'Следопыт',
    primaryStats: ['speed', 'attack'],
    secondaryStats: ['critChance'],
    baseAttack: 'shot',
    startingGear: ['gear_ranger_weapon', 'gear_ranger_armor', 'gear_ranger_accessory'],
    iconEmoji: '🏹',
  },
  {
    id: 'healer',
    label: 'Целитель',
    primaryStats: ['healPower', 'magicPower'],
    secondaryStats: ['mana'],
    baseAttack: 'magic_bolt',
    startingGear: ['gear_healer_weapon', 'gear_healer_armor', 'gear_healer_accessory'],
    iconEmoji: '💚',
  },
  {
    id: 'rogue',
    label: 'Разбойник',
    primaryStats: ['critChance', 'speed'],
    secondaryStats: ['attack'],
    baseAttack: 'strike',
    startingGear: ['gear_rogue_weapon', 'gear_rogue_armor', 'gear_rogue_accessory'],
    iconEmoji: '🗡️',
  },
  {
    id: 'paladin',
    label: 'Паладин',
    primaryStats: ['defense', 'healPower'],
    secondaryStats: ['health'],
    baseAttack: 'strike',
    startingGear: ['gear_paladin_weapon', 'gear_paladin_armor', 'gear_paladin_accessory'],
    iconEmoji: '🛡️',
  },
  {
    id: 'warlock',
    label: 'Чернокнижник',
    primaryStats: ['magicPower', 'critChance'],
    secondaryStats: ['mana'],
    baseAttack: 'magic_bolt',
    startingGear: ['gear_warlock_weapon', 'gear_warlock_armor', 'gear_warlock_accessory'],
    iconEmoji: '😈',
  },
  {
    id: 'berserker',
    label: 'Берсерк',
    primaryStats: ['attack', 'speed'],
    secondaryStats: ['health'],
    baseAttack: 'strike',
    startingGear: ['gear_berserker_weapon', 'gear_berserker_armor', 'gear_berserker_accessory'],
    iconEmoji: '🪓',
  },
]
