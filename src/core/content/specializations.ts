/**
 * 15 склонностей (§11, §17). Равный шанс при найме, неизменны.
 */

import type { SpecializationDef } from '../types/character'

export const SPECIALIZATIONS: SpecializationDef[] = [
  {
    id: 'lucky_card',
    label: 'Везение умений',
    kind: 'lucky',
    description: 'При провале повышения уровня умения владельца даётся ещё один бросок.',
    effect: { type: 'lucky', target: 'card' },
  },
  {
    id: 'lucky_item',
    label: 'Везение предметов',
    kind: 'lucky',
    description: 'При провале повышения уровня предмета владельца даётся ещё один бросок.',
    effect: { type: 'lucky', target: 'item' },
  },
  {
    id: 'lucky_passive',
    label: 'Везение пассивов',
    kind: 'lucky',
    description: 'При провале повышения уровня пассива владельца даётся ещё один бросок.',
    effect: { type: 'lucky', target: 'passive' },
  },
  {
    id: 'lucky_unit',
    label: 'Везение судьбы',
    kind: 'lucky',
    description: 'При провале повышения уровня персонажа даётся ещё один бросок.',
    effect: { type: 'lucky', target: 'unit' },
  },
  {
    id: 'meta_drop_skill',
    label: 'Щедрость умений',
    kind: 'meta',
    description: 'Повышает шанс выпадения умений после боя для всей команды.',
    effect: { type: 'meta_drop', what: 'skill', bonus: 5 },
  },
  {
    id: 'meta_drop_passive',
    label: 'Щедрость пассивов',
    kind: 'meta',
    description: 'Повышает шанс выпадения пассивов после боя для всей команды.',
    effect: { type: 'meta_drop', what: 'passive', bonus: 5 },
  },
  {
    id: 'meta_gold',
    label: 'Золотая жила',
    kind: 'meta',
    description: 'Увеличивает золото, получаемое командой за победы.',
    effect: { type: 'meta_gold', bonus: 25 },
  },
  {
    id: 'slot_skill_plus',
    label: 'Лишний приём',
    kind: 'slot',
    description: 'Владелец может брать в бой на одно активное умение больше.',
    effect: { type: 'slot_skill_plus', amount: 1 },
  },
  {
    id: 'slot_passive_plus',
    label: 'Лишний навык',
    kind: 'slot',
    description: 'Владелец может надеть на один пассив больше.',
    effect: { type: 'slot_passive_plus', amount: 1 },
  },
  {
    id: 'mod_offer_plus',
    label: 'Богатый выбор',
    kind: 'mod',
    description: 'В оффере модов владельца становится 4 варианта вместо 3.',
    effect: { type: 'mod_offer_plus' },
  },
  {
    id: 'mod_soft_rollback',
    label: 'Мягкий откат',
    kind: 'mod',
    description: 'При снятии мода теряется лишь 20% прогресса внутри вехи, а не весь.',
    effect: { type: 'mod_soft_rollback' },
  },
  {
    id: 'meta_stat_attack',
    label: 'Командная ярость',
    kind: 'meta',
    description: 'Повышает атаку всей команды, пока владелец в отряде.',
    effect: { type: 'meta_stat', stat: 'attack', bonus: 6 },
  },
  {
    id: 'meta_stat_health',
    label: 'Командная стойкость',
    kind: 'meta',
    description: 'Повышает здоровье всей команды, пока владелец в отряде.',
    effect: { type: 'meta_stat', stat: 'health', bonus: 20 },
  },
  {
    id: 'meta_stat_defense',
    label: 'Командная защита',
    kind: 'meta',
    description: 'Повышает защиту всей команды, пока владелец в отряде.',
    effect: { type: 'meta_stat', stat: 'defense', bonus: 5 },
  },
  {
    id: 'meta_stat_magic',
    label: 'Командная мудрость',
    kind: 'meta',
    description: 'Повышает силу магии всей команды, пока владелец в отряде.',
    effect: { type: 'meta_stat', stat: 'magicPower', bonus: 6 },
  },
]
