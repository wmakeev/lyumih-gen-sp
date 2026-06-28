/**
 * Вкладка «Memento Mori» — выраженная панель мета-прогресса (этап C редизайна).
 *
 * Verified-паттерн Hades (§2.2): мета-функции — отдельная панель со слотами
 * «занято/свободно». Чисто презентационная: показывает оси силы и состояние
 * слотов модов носителей (наполняет их ядро при победах §16.7), не вводя новых
 * доменных действий.
 */

import { Card, Col, Empty, Progress, Row, Select, Tooltip, Typography } from 'antd'
import { useGame } from '../../state/store'
import { getConfig } from '../../core/config'
import { milestoneThreshold, unlockedSlotCount } from '../../core/memento/slots'
import type { Character } from '../../core/types/character'
import type { ModSlotState, ModGroup, ModTemplate } from '../../core/types/memento'
import { UnitIcon } from '../components/UnitIcon'
import { iconEmoji } from '../assets/icon-registry'

const groupIcon = (g: ModGroup): string => iconEmoji(`mod_${g}`) ?? '📿'

const ACCENT = 'var(--mm-accent)'

export function MementoTab() {
  useGame((s) => s.rev)
  const campaign = useGame((s) => s.campaign)
  const registry = useGame((s) => s.registry)
  const selectedId = useGame((s) => s.ui.selectedCharacterId)
  const selectCharacter = useGame((s) => s.selectCharacter)

  const selected =
    campaign.characters.find((c) => c.id === selectedId) ?? campaign.characters[0] ?? null

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={10}>
        <Card
          size="small"
          title={<span className="mm-display">Memento Mori — оси силы</span>}
        >
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
            Сила накапливается через <b>смерть</b>, <b>использование</b> и <b>победу</b>: носители
            растут в уровне и открывают слоты модов на вехах.
          </Typography.Paragraph>
          {selected ? (
            <PowerAxes character={selected} worldPower={campaign.worldPower} />
          ) : (
            <Empty description="Нет персонажей" />
          )}
        </Card>
      </Col>

      <Col xs={24} md={14}>
        <Card
          size="small"
          title="Носители и слоты модов"
          extra={
            <Select
              size="small"
              style={{ width: 200 }}
              value={selected?.id}
              onChange={(v) => selectCharacter(v)}
              options={campaign.characters.map((c) => ({
                value: c.id,
                label: `${c.iconEmoji} ${c.name}`,
              }))}
            />
          }
        >
          {selected ? (
            <CarrierSlots character={selected} registry={registry} />
          ) : (
            <Empty description="Выберите персонажа" />
          )}
        </Card>
      </Col>
    </Row>
  )
}

function PowerAxes({ character, worldPower }: { character: Character; worldPower: number }) {
  const ms = getConfig().modSlotMilestones
  const totalUses =
    sumUses(character.cards) + sumUses(character.passives) + sumItemUses(character)
  // Следующая веха уровня персонажа (как у носителей — даёт слоты модов).
  const unlocked = unlockedSlotCount(character.unitLevel, ms)
  const nextLevelMilestone = milestoneThreshold(unlocked, ms)
  const nextWp = (Math.floor(worldPower / 10) + 1) * 10
  const nextUses = (Math.floor(totalUses / 25) + 1) * 25

  return (
    <div>
      <Axis
        icon="🏆"
        name="Победа"
        value={`${worldPower}/${nextWp}`}
        percent={pct(worldPower, nextWp)}
        tip="Сила мира — растёт за убийства врагов (§16)."
      />
      <Axis
        icon="🔁"
        name="Использование"
        value={`${totalUses}/${nextUses}`}
        percent={pct(totalUses, nextUses)}
        tip="Суммарные применения умений/предметов/пассивов персонажа."
      />
      <Axis
        icon="💀"
        name="Стойкость"
        value={`ур. ${character.unitLevel}/${nextLevelMilestone}`}
        percent={pct(character.unitLevel, nextLevelMilestone)}
        tip="Уровень персонажа — растёт бросками побед/смертей; на вехах открывает слоты модов."
      />
    </div>
  )
}

function Axis({
  icon,
  name,
  value,
  percent,
  tip,
}: {
  icon: string
  name: string
  value: string
  percent: number
  tip: string
}) {
  return (
    <Tooltip title={tip}>
      <div className="mm-axis">
        <span className="mm-axis__icon">{icon}</span>
        <span className="mm-axis__name">{name}</span>
        <span className="mm-axis__bar">
          <Progress percent={percent} showInfo={false} strokeColor={ACCENT} size="small" />
        </span>
        <span className="mm-axis__val">{value}</span>
      </div>
    </Tooltip>
  )
}

type Registry = ReturnType<typeof useGame.getState>['registry']

function CarrierSlots({ character, registry }: { character: Character; registry: Registry }) {
  const ms = getConfig().modSlotMilestones
  const cardLabel = (t: string) => registry.cards.get(t)?.label ?? t
  const itemLabel = (t: string) => registry.items.get(t)?.label ?? t
  const passiveLabel = (t: string) => registry.passives.get(t)?.label ?? t

  const rows: React.ReactNode[] = []

  for (const c of character.cards) {
    rows.push(
      <CarrierRow
        key={`card-${c.id}`}
        emoji="🃏"
        name={cardLabel(c.templateId)}
        level={c.global_level}
        uses={c.uses_count}
        slots={c.modSlots}
        nextThreshold={nextThreshold(c.global_level, ms)}
        pool={registry.cardItemMods}
      />,
    )
  }
  for (const it of character.items) {
    rows.push(
      <CarrierRow
        key={`item-${it.id}`}
        emoji={registry.items.get(it.templateId)?.iconEmoji ?? '🎒'}
        name={itemLabel(it.templateId)}
        level={it.itemLevel}
        slots={it.modSlots}
        nextThreshold={nextThreshold(it.itemLevel, ms)}
        pool={registry.cardItemMods}
      />,
    )
  }
  for (const pi of character.passives) {
    rows.push(
      <CarrierRow
        key={`passive-${pi.id}`}
        emoji="✴️"
        name={passiveLabel(pi.templateId)}
        level={pi.global_level}
        uses={pi.uses_count}
        slots={pi.modSlots}
        nextThreshold={nextThreshold(pi.global_level, ms)}
        pool={registry.passiveMods}
      />,
    )
  }

  if (rows.length === 0) return <Empty description="Нет носителей" />
  return <div>{rows}</div>
}

function CarrierRow({
  emoji,
  name,
  level,
  uses,
  slots,
  nextThreshold,
  pool,
}: {
  emoji: string
  name: string
  level: number
  uses?: number
  slots: ModSlotState[]
  nextThreshold: number
  pool: ReadonlyMap<string, ModTemplate>
}) {
  return (
    <div className="mm-carrier">
      <UnitIcon emoji={emoji} size={30} />
      <div className="mm-carrier__main">
        <div className="mm-carrier__name" title={name}>{name}</div>
        <div className="mm-carrier__meta">
          L{level}
          {uses !== undefined && ` · применений ${uses}`}
        </div>
      </div>
      <div className="mm-slots">
        {slots.length === 0 ? (
          <Tooltip title={`Первый слот мода на L${nextThreshold}`}>
            <span className="mm-slot mm-slot--empty" style={{ opacity: 0.5 }}>·</span>
          </Tooltip>
        ) : (
          slots.map((slot, i) => <SlotWidget key={i} slot={slot} pool={pool} />)
        )}
      </div>
    </div>
  )
}

function SlotWidget({ slot, pool }: { slot: ModSlotState; pool: ReadonlyMap<string, ModTemplate> }) {
  if (slot.status === 'filled') {
    const tpl = pool.get(slot.templateId)
    const icon = tpl ? groupIcon(tpl.group) : '📿'
    return (
      <Tooltip
        title={
          <div>
            <b>{tpl?.label ?? slot.templateId}</b>
            {tpl?.descriptionLines.map((l, i) => <div key={i}>{l}</div>)}
            <div style={{ opacity: 0.7, marginTop: 2 }}>Уровень мода: {slot.lm}</div>
          </div>
        }
      >
        <span className="mm-slot mm-slot--filled">
          {icon}
          <span className="mm-slot__badge">M+</span>
          {slot.lm > 0 && <span className="mm-slot__lm">{slot.lm}</span>}
        </span>
      </Tooltip>
    )
  }
  const offerN = slot.offer?.modIds.length ?? 0
  return (
    <Tooltip title={offerN > 0 ? `Доступно модов в оффере: ${offerN}` : 'Пустой слот'}>
      <span className="mm-slot mm-slot--empty">+</span>
    </Tooltip>
  )
}

// — helpers —
function pct(value: number, max: number): number {
  if (max <= 0) return 0
  return Math.min(100, Math.round((value / max) * 100))
}
function nextThreshold(level: number, ms: { firstThreshold: number; step: number }): number {
  const unlocked = unlockedSlotCount(level, ms)
  return milestoneThreshold(unlocked, ms)
}
function sumUses(carriers: { uses_count: number }[]): number {
  return carriers.reduce((s, c) => s + c.uses_count, 0)
}
function sumItemUses(_character: Character): number {
  return 0 // у предметов нет счётчика применений — только itemLevel
}
