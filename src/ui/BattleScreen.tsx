/** Боевой экран (§6): поле-сетка, действия активного юнита, лог, исход. */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, Space, Switch, Tag, Tooltip, Typography } from 'antd'
import { useGame } from '../state/store'
import { MathRng } from '../core/rng'
import { activeUnit, isAlive, isDowned, unitById } from '../core/battle/queue'
import { unitAt, unitHpPct, fieldSize } from '../core/battle/selectors'
import { legalMoves, cardTargets, type BattleContext } from '../core/battle/engine'
import type { BattleState, BattleUnit, Cell } from '../core/types/battle'
import { previewAction, type ActionPreview } from './battle-preview'
import { UnitIcon } from './components/UnitIcon'
import { Sprite, atlasSlice } from './components/Sprite'
import { Portrait } from './components/Portrait'

type Mode = { type: 'move' } | { type: 'basic' } | { type: 'card'; cardId: string } | null

const CELL = 44

export function BattleScreen() {
  const rev = useGame((s) => s.rev)
  const campaign = useGame((s) => s.campaign)
  const registry = useGame((s) => s.registry)
  const autoBattle = useGame((s) => s.ui.autoBattle)

  const selectCard = useGame((s) => s.selectCard)
  const battleMove = useGame((s) => s.battleMove)
  const battleBasic = useGame((s) => s.battleBasic)
  const battleCard = useGame((s) => s.battleCard)
  const battleEndTurn = useGame((s) => s.battleEndTurn)
  const toggleAuto = useGame((s) => s.toggleAuto)
  const autoStep = useGame((s) => s.autoStep)
  const finalizeVictory = useGame((s) => s.finalizeVictory)
  const retry = useGame((s) => s.retry)
  const abandon = useGame((s) => s.abandon)
  const selectBattleUnit = useGame((s) => s.selectBattleUnit)

  const [mode, setMode] = useState<Mode>(null)
  const [hover, setHover] = useState<Cell | null>(null)
  const battle = campaign.battle

  const ctx = useMemo<BattleContext>(
    () => ({ cards: registry.cards, mods: registry.cardItemMods, rng: new MathRng() }),
    [registry],
  )

  const active = battle ? activeUnit(battle) : undefined
  const phase = battle?.phase

  // Авто-бой и авто-ход врага (§6.11)
  useEffect(() => {
    if (!battle || battle.phase !== 'ongoing') return
    const u = activeUnit(battle)
    if (!u) return
    if (autoBattle) {
      const t = setTimeout(() => autoStep(), 2000)
      return () => clearTimeout(t)
    }
    if (u.side === 'enemy') {
      const t = setTimeout(() => autoStep(), 600)
      return () => clearTimeout(t)
    }
    return
    // rev меняется на каждый commit стора (campaign мутируется на месте) —
    // это и есть триггер переподписки эффекта на следующий шаг.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev, autoBattle, phase])

  // сброс режима при смене активного юнита
  const activeId = active?.id ?? null
  const prevActive = useRef<string | null>(null)
  useEffect(() => {
    if (prevActive.current !== activeId) {
      prevActive.current = activeId
      setMode(null)
      setHover(null)
    }
  }, [activeId])

  if (!battle) return null

  const playerTurn = active?.side === 'player' && phase === 'ongoing'

  // Подсветка валидных целей/клеток
  const highlight = computeHighlight(battle, active, mode, ctx)

  // Превью исхода действия для наведённой клетки (этап B1).
  const cardForMode = active ? pickCard(active, mode) : undefined
  const preview: ActionPreview | null =
    playerTurn && active && cardForMode && hover && highlight.has(`${hover.x},${hover.y}`)
      ? previewAction(battle, active, cardForMode, hover, ctx)
      : null
  const previewByUnit = new Map<string, ActionPreview['targets'][number]>()
  if (preview) for (const t of preview.targets) previewByUnit.set(t.unitId, t)

  const onCellClick = (x: number, y: number) => {
    const unit = unitAt(battle, x, y)
    const key = `${x},${y}`
    if (!playerTurn || !active) {
      if (unit && isAlive(unit)) selectBattleUnit(unit.id)
      return
    }
    if (mode?.type === 'move') {
      if (highlight.has(key)) {
        battleMove({ x, y })
        setMode(null)
      }
      return
    }
    if (mode?.type === 'basic') {
      if (unit && highlight.has(key)) {
        battleBasic(unit.id)
        setMode(null)
      }
      return
    }
    if (mode?.type === 'card') {
      if (highlight.has(key)) {
        const target: { unitId?: string; cell?: Cell } = unit ? { unitId: unit.id, cell: { x, y } } : { cell: { x, y } }
        battleCard(target)
        setMode(null)
      }
      return
    }
    if (unit && isAlive(unit)) selectBattleUnit(unit.id)
  }

  const enterCard = (cardId: string) => {
    selectCard(cardId)
    setMode({ type: 'card', cardId })
  }
  const enterMove = () => {
    selectCard(null)
    setMode({ type: 'move' })
  }
  const enterBasic = () => {
    selectCard(null)
    setMode({ type: 'basic' })
  }

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size="middle">
      <Space wrap align="center">
        <Typography.Title level={4} className="mm-display" style={{ margin: 0 }}>
          Бой
        </Typography.Title>
        <Tag>Раунд {battle.round}</Tag>
        <Tooltip title="Сила мира">
          <Tag color="volcano">🌍 {battle.worldPower}</Tag>
        </Tooltip>
        <Space>
          <span>Авто-бой</span>
          <Switch checked={autoBattle} onChange={() => toggleAuto()} />
        </Space>
        <Button size="small" disabled={phase !== 'ongoing'} onClick={() => autoStep()}>
          Авто-ход
        </Button>
      </Space>

      {phase === 'ongoing' && <QueueStrip battle={battle} />}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <BattleGrid
          battle={battle}
          active={active}
          mode={mode}
          highlight={highlight}
          preview={preview}
          previewByUnit={previewByUnit}
          onCellClick={onCellClick}
          onHover={setHover}
        />

        <div style={{ flex: '1 1 300px', minWidth: 300 }}>
          {phase === 'ongoing' && active && (
            <Card size="small" title={
              <Space>
                <UnitIcon emoji={active.iconEmoji} accent={active.iconAccent} size={28} />
                <span>{active.displayName}</span>
                <Tag color={active.side === 'player' ? 'blue' : 'red'}>
                  {active.side === 'player' ? 'Ваш ход' : 'Ход врага'}
                </Tag>
              </Space>
            }>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                <Portrait
                  id={active.classId ?? active.raceId ?? active.archetypeId}
                  emoji={active.iconEmoji}
                  accent={active.side === 'player' ? 'var(--mm-side-player-bg)' : 'var(--mm-side-enemy-bg)'}
                  size={72}
                  title={active.displayName}
                />
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                  ❤️ {active.hp}/{active.maxHp} · 👟 {active.stats.speed} · ⚡ {active.stats.initiative}
                  {active.stats.critChance > 0 && <> · 🎯 {active.stats.critChance}%</>}
                </div>
              </div>
              {playerTurn ? (
                <Space orientation="vertical" style={{ width: '100%' }}>
                  <div className="mm-actions">
                    {active.cards.filter((c) => !c.isBasic).map((c) => {
                      const onCd = c.cooldownLeft > 0
                      const selected = mode?.type === 'card' && mode.cardId === c.instanceId
                      return (
                        <span key={c.instanceId} className="mm-action-btn">
                          <Button
                            size="small"
                            type={selected ? 'primary' : 'default'}
                            disabled={onCd}
                            onClick={() => enterCard(c.instanceId)}
                          >
                            {registry.cards.get(c.templateId)?.label ?? c.templateId}
                          </Button>
                          {onCd && <span className="mm-cooldown">{c.cooldownLeft}</span>}
                        </span>
                      )
                    })}
                  </div>
                  <div className="mm-actions">
                    <Button size="small" type={mode?.type === 'basic' ? 'primary' : 'default'} onClick={enterBasic}>
                      ⚔️ Базовая атака
                    </Button>
                    <Button size="small" type={mode?.type === 'move' ? 'primary' : 'default'} onClick={enterMove}>
                      👟 Перемещение
                    </Button>
                    <Button size="small" onClick={() => battleEndTurn()}>
                      Завершить ход
                    </Button>
                    {mode && (
                      <Button size="small" danger onClick={() => { setMode(null); selectCard(null); setHover(null) }}>
                        Отмена
                      </Button>
                    )}
                  </div>
                  <PreviewHint mode={mode} preview={preview} />
                </Space>
              ) : (
                <Typography.Text type="secondary">Ходит противник…</Typography.Text>
              )}
            </Card>
          )}

          <BattleLog battle={battle} />
        </div>
      </div>

      {phase === 'victory' && (
        <Card style={{ borderColor: 'var(--mm-hp-player)' }}>
          <Space orientation="vertical" align="center" style={{ width: '100%' }}>
            <Typography.Title level={3} className="mm-display" style={{ color: 'var(--mm-hp-player)', margin: 0 }}>
              Победа!
            </Typography.Title>
            <Button type="primary" size="large" onClick={() => finalizeVictory()}>
              Продолжить
            </Button>
          </Space>
        </Card>
      )}
      {phase === 'defeat' && (
        <Card style={{ borderColor: 'var(--mm-side-enemy)' }}>
          <Space orientation="vertical" align="center" style={{ width: '100%' }}>
            <Typography.Title level={3} className="mm-display" style={{ color: 'var(--mm-side-enemy)', margin: 0 }}>
              Поражение
            </Typography.Title>
            <Space>
              <Button type="primary" size="large" onClick={() => retry()}>
                Повторить
              </Button>
              <Button size="large" onClick={() => abandon()}>
                Отступить
              </Button>
            </Space>
          </Space>
        </Card>
      )}
    </Space>
  )
}

/** Карта, соответствующая текущему режиму (базовая или выбранное умение). */
function pickCard(active: BattleUnit, mode: Mode): BattleUnit['cards'][number] | undefined {
  if (mode?.type === 'basic') return active.cards.find((c) => c.isBasic)
  if (mode?.type === 'card') return active.cards.find((c) => c.instanceId === mode.cardId)
  return undefined
}

function PreviewHint({ mode, preview }: { mode: Mode; preview: ActionPreview | null }) {
  if (!mode) return null
  if (mode.type === 'move') {
    return <Typography.Text type="secondary">Выберите подсвеченную клетку для перемещения.</Typography.Text>
  }
  if (!preview || preview.targets.length === 0) {
    return <Typography.Text type="secondary">Наведите на подсвеченную цель — покажу исход.</Typography.Text>
  }
  const kills = preview.targets.filter((t) => t.willKill).length
  const total = preview.targets.reduce((s, t) => s + (t.isHeal ? 0 : t.amount), 0)
  const first = preview.targets[0]
  return (
    <Typography.Text type="secondary">
      {first?.isHeal
        ? `Лечение +${first.amount}`
        : `Урон ~${total} по ${preview.targets.length} цел.`}
      {kills > 0 && <Typography.Text type="danger"> · добивает {kills}</Typography.Text>}
      {preview.critChance > 0 && !first?.isHeal && ` · крит ${preview.critChance}%`}
    </Typography.Text>
  )
}

function computeHighlight(
  battle: BattleState,
  active: BattleUnit | undefined,
  mode: Mode,
  ctx: BattleContext,
): Set<string> {
  const set = new Set<string>()
  if (!active || active.side !== 'player' || battle.phase !== 'ongoing' || !mode) return set
  if (mode.type === 'move') {
    for (const c of legalMoves(battle, active.id)) set.add(`${c.x},${c.y}`)
    return set
  }
  let card = undefined as BattleUnit['cards'][number] | undefined
  if (mode.type === 'basic') card = active.cards.find((c) => c.isBasic)
  else card = active.cards.find((c) => c.instanceId === mode.cardId)
  if (!card) return set
  for (const u of cardTargets(battle, active, card, ctx)) set.add(`${u.x},${u.y}`)
  return set
}

/** Лента очереди хода по инициативе с бейджами порядка (§2.1). */
function QueueStrip({ battle }: { battle: BattleState }) {
  const order = battle.turnOrder
  return (
    <div className="mm-queue">
      {order.map((id, i) => {
        const u = unitById(battle, id)
        if (!u) return null
        const isActive = i === battle.activeIndex
        const downed = isDowned(u)
        return (
          <Tooltip key={id} title={`${u.displayName} — HP ${u.hp}/${u.maxHp} · ⚡${u.stats.initiative}`}>
            <div
              className={
                'mm-queue__item' +
                (isActive ? ' mm-queue__item--active' : '') +
                (downed ? ' mm-queue__item--downed' : '')
              }
            >
              <span className="mm-queue__ord">{i + 1}</span>
              <UnitIcon
                emoji={u.iconEmoji}
                accent={u.side === 'player' ? 'var(--mm-side-player-bg)' : 'var(--mm-side-enemy-bg)'}
                size={20}
              />
            </div>
          </Tooltip>
        )
      })}
    </div>
  )
}

function BattleGrid({
  battle,
  active,
  mode,
  highlight,
  preview,
  previewByUnit,
  onCellClick,
  onHover,
}: {
  battle: BattleState
  active: BattleUnit | undefined
  mode: Mode
  highlight: Set<string>
  preview: ActionPreview | null
  previewByUnit: Map<string, ActionPreview['targets'][number]>
  onCellClick: (x: number, y: number) => void
  onHover: (c: Cell | null) => void
}) {
  const { terrain } = battle.field
  const { width, height } = fieldSize(battle)
  const isTargetMode = mode?.type === 'basic' || mode?.type === 'card'
  // Тайлы пола/стены из атласа `tiles` (фолбэк — цвет клетки из CSS, если лист
  // ещё не нарезан). Размеры одинаковы для всех клеток → считаем срез один раз.
  const floorTile = atlasSlice('tiles', 'floor', CELL)
  const wallTile = atlasSlice('tiles', 'wall', CELL)
  const rows = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const wall = terrain[idx] === 'wall'
      const key = `${x},${y}`
      const unit = unitAt(battle, x, y)
      const isActiveCell = unit && active && unit.id === active.id
      const hi = highlight.has(key)
      const inZone = preview?.zone.has(key) ?? false
      const queueIdx = unit && isAlive(unit) ? battle.turnOrder.indexOf(unit.id) : -1
      const dmg = unit ? previewByUnit.get(unit.id) : undefined

      const cls = ['mm-cell']
      if (wall) cls.push('mm-cell--wall')
      if (hi && mode?.type === 'move') cls.push('mm-cell--move')
      if (hi && isTargetMode) cls.push('mm-cell--target')
      if (inZone) cls.push('mm-cell--zone')
      if (isActiveCell) cls.push('mm-cell--active')

      rows.push(
        <div
          key={key}
          className={cls.join(' ')}
          style={{ width: CELL, height: CELL, ...(wall ? wallTile : floorTile) }}
          onClick={() => onCellClick(x, y)}
          onMouseEnter={() => onHover({ x, y })}
        >
          {unit && <UnitWidget unit={unit} badge={queueIdx >= 0 ? queueIdx + 1 : null} dmg={dmg} />}
        </div>,
      )
    }
  }
  return (
    <div
      className="mm-grid"
      style={{
        gridTemplateColumns: `repeat(${width}, ${CELL}px)`,
        gridTemplateRows: `repeat(${height}, ${CELL}px)`,
      }}
      onMouseLeave={() => onHover(null)}
    >
      {rows}
    </div>
  )
}

function UnitWidget({
  unit,
  badge,
  dmg,
}: {
  unit: BattleUnit
  badge: number | null
  dmg: ActionPreview['targets'][number] | undefined
}) {
  const downed = isDowned(unit)
  const hpPct = unitHpPct(unit)
  const bodySize = Math.round(CELL * 0.72)
  return (
    <div
      className={
        'mm-unit mm-unit--' + (unit.side === 'player' ? 'player' : 'enemy') + (downed ? ' mm-unit--downed' : '')
      }
      title={`${unit.displayName} — HP ${unit.hp}/${unit.maxHp}`}
    >
      <span className="mm-unit__body" style={{ width: bodySize, height: bodySize }}>
        <Sprite
          id={unit.classId ?? unit.raceId ?? unit.archetypeId}
          atlas="units"
          fallback={unit.iconEmoji}
          size={bodySize - 4}
        />
      </span>
      {badge !== null && <span className="mm-queue-badge">{badge}</span>}
      {dmg && !dmg.statusOnly && (
        <span
          className={'mm-dmg ' + (dmg.willKill ? 'mm-dmg--kill' : dmg.isHeal ? 'mm-dmg--heal' : 'mm-dmg--hurt')}
          title={dmg.critAmount !== undefined ? `Урон ${dmg.amount}, крит ${dmg.critAmount}` : undefined}
        >
          {dmg.willKill ? '☠' : dmg.isHeal ? '+' : '−'}
          {dmg.amount}
        </span>
      )}
      {!downed && (
        <div className="mm-hp">
          <div
            className="mm-hp__fill"
            style={{
              width: `${hpPct}%`,
              background: unit.side === 'player' ? 'var(--mm-hp-player)' : 'var(--mm-hp-enemy)',
            }}
          />
        </div>
      )}
    </div>
  )
}

function BattleLog({ battle }: { battle: BattleState }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [battle.log.length])
  return (
    <Card size="small" title="Журнал боя" style={{ marginTop: 16 }}>
      <div ref={ref} style={{ maxHeight: 240, overflowY: 'auto', fontSize: 12 }}>
        {battle.log.map((e, i) => (
          <div key={i} style={{ opacity: 0.9, marginBottom: 2 }}>
            <Typography.Text type="secondary">[{e.round}]</Typography.Text> {e.text}
          </div>
        ))}
      </div>
    </Card>
  )
}
