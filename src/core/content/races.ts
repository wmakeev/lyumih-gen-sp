/**
 * 8 рас врагов (§13.3) с элементальными аффинити (множители урона по тегам).
 * 1 = нейтрально; <1 — резист; >1 — уязвимость. Диапазон ~0.5..1.5.
 */

import type { RaceDef } from '../types/content'

export const RACES: RaceDef[] = [
  {
    id: 'beast',
    label: 'Зверь',
    affinities: { physical: 1.0, fire: 1.3, ice: 0.9, poison: 1.2, holy: 1.0, shadow: 1.1, lightning: 1.0 },
    iconEmoji: '🐺',
  },
  {
    id: 'undead',
    label: 'Нежить',
    affinities: { physical: 0.8, fire: 1.4, ice: 0.7, poison: 0.5, holy: 1.5, shadow: 0.5, lightning: 1.0 },
    iconEmoji: '💀',
  },
  {
    id: 'human',
    label: 'Человек',
    affinities: { physical: 1.0, fire: 1.0, ice: 1.0, poison: 1.0, holy: 0.9, shadow: 1.1, lightning: 1.0 },
    iconEmoji: '🧑',
  },
  {
    id: 'orc',
    label: 'Орк',
    affinities: { physical: 0.8, fire: 0.9, ice: 1.1, poison: 1.0, holy: 1.2, shadow: 1.0, lightning: 1.2 },
    iconEmoji: '👹',
  },
  {
    id: 'elf',
    label: 'Эльф',
    affinities: { physical: 1.1, fire: 1.1, ice: 0.8, poison: 0.7, holy: 0.8, shadow: 1.3, lightning: 0.9 },
    iconEmoji: '🧝',
  },
  {
    id: 'specter',
    label: 'Призрак',
    affinities: { physical: 0.5, fire: 1.0, ice: 1.0, poison: 0.6, holy: 1.5, shadow: 0.5, lightning: 1.1 },
    iconEmoji: '👻',
  },
  {
    id: 'construct',
    label: 'Голем',
    affinities: { physical: 0.7, fire: 1.2, ice: 1.3, poison: 0.5, holy: 1.0, shadow: 1.0, lightning: 1.5 },
    iconEmoji: '🤖',
  },
  {
    id: 'demon',
    label: 'Демон',
    affinities: { physical: 1.0, fire: 0.5, ice: 1.2, poison: 0.9, holy: 1.5, shadow: 0.6, lightning: 1.1 },
    iconEmoji: '👺',
  },
]
