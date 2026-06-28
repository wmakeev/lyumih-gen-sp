/** Вкладка «Персонаж»: ростер, отряд, экипировка, лоадаут, пассивы, сундук. */

import { Button, Card, Col, Divider, Empty, List, Row, Select, Space, Tag, Typography } from 'antd'
import { useGame } from '../../state/store'
import { LIMITS } from '../../core/config'
import type { Character, EquipmentSlot } from '../../core/types/character'
import { StatStrip } from '../components/StatStrip'
import { UnitIcon } from '../components/UnitIcon'
import { Portrait } from '../components/Portrait'

const SLOT_RU: Record<EquipmentSlot, string> = {
  weapon: 'Оружие',
  armor: 'Доспех',
  accessory: 'Аксессуар',
}

export function PersonaTab() {
  useGame((s) => s.rev)
  const campaign = useGame((s) => s.campaign)
  const registry = useGame((s) => s.registry)
  const selectedId = useGame((s) => s.ui.selectedCharacterId)
  const selectCharacter = useGame((s) => s.selectCharacter)
  const setSquadSlot = useGame((s) => s.setSquadSlot)
  const equip = useGame((s) => s.equip)
  const unequip = useGame((s) => s.unequip)
  const toggleLoadoutCard = useGame((s) => s.toggleLoadoutCard)
  const togglePassiveEquip = useGame((s) => s.togglePassiveEquip)
  const bindCard = useGame((s) => s.bindCard)
  const bindPassive = useGame((s) => s.bindPassive)

  const locked = campaign.expedition !== null
  const selected = campaign.characters.find((c) => c.id === selectedId) ?? null

  const itemLabel = (templateId: string) => registry.items.get(templateId)?.label ?? templateId
  const cardLabel = (templateId: string) => registry.cards.get(templateId)?.label ?? templateId
  const passiveLabel = (templateId: string) => registry.passives.get(templateId)?.label ?? templateId
  const className = (classId: string) => registry.classes.get(classId)?.label ?? classId

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={9}>
        <Card size="small" title="Отряд (4 слота)">
          {locked && (
            <Typography.Text type="warning">Отряд заблокирован: идёт экспедиция.</Typography.Text>
          )}
          <Space orientation="vertical" style={{ width: '100%' }}>
            {campaign.squad.map((cid, slot) => (
              <Space key={slot} style={{ width: '100%' }}>
                <Tag>{slot + 1}</Tag>
                <Select
                  style={{ width: 220 }}
                  disabled={locked}
                  allowClear
                  placeholder="— пусто —"
                  value={cid ?? undefined}
                  onChange={(v) => setSquadSlot(slot, v ?? null)}
                  options={campaign.characters.map((c) => ({ value: c.id, label: `${c.iconEmoji} ${c.name}` }))}
                />
              </Space>
            ))}
          </Space>
        </Card>

        <Card size="small" title="Ростер" style={{ marginTop: 16 }}>
          <List
            dataSource={campaign.characters}
            renderItem={(c) => (
              <List.Item
                style={{ cursor: 'pointer', background: c.id === selectedId ? 'rgba(124,92,255,0.15)' : undefined }}
                onClick={() => selectCharacter(c.id)}
              >
                <List.Item.Meta
                  avatar={<UnitIcon emoji={c.iconEmoji} accent={c.iconAccent} />}
                  title={`${c.name} (ур. ${c.unitLevel})`}
                  description={
                    <Space size={4} wrap>
                      <Tag>{className(c.classId)}</Tag>
                      <Tag color="gold">★ {Math.round(c.baseStatRating * 100)}%</Tag>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      </Col>

      <Col xs={24} md={15}>
        {selected ? (
          <CharacterPanel
            ch={selected}
            locked={locked}
            registry={registry}
            equip={equip}
            unequip={unequip}
            toggleLoadoutCard={toggleLoadoutCard}
            togglePassiveEquip={togglePassiveEquip}
            itemLabel={itemLabel}
            cardLabel={cardLabel}
            passiveLabel={passiveLabel}
            className={className}
          />
        ) : (
          <Empty description="Выберите персонажа" />
        )}

        <Card size="small" title="Сундук" style={{ marginTop: 16 }}>
          <Typography.Text strong>Непривязанные умения</Typography.Text>
          {campaign.chest.unboundCards.length === 0 ? (
            <div><Typography.Text type="secondary">— нет —</Typography.Text></div>
          ) : (
            <Space wrap style={{ display: 'flex', marginTop: 4, marginBottom: 8 }}>
              {campaign.chest.unboundCards.map((ci) => (
                <Tag key={ci.id} style={{ padding: 6 }}>
                  {cardLabel(ci.templateId)} (L{ci.global_level}){' '}
                  <Button size="small" type="link" disabled={!selected} onClick={() => selected && bindCard(ci.id, selected.id)}>
                    Привязать
                  </Button>
                </Tag>
              ))}
            </Space>
          )}

          <Divider style={{ margin: '8px 0' }} />
          <Typography.Text strong>Непривязанные пассивы</Typography.Text>
          {campaign.chest.unboundPassives.length === 0 ? (
            <div><Typography.Text type="secondary">— нет —</Typography.Text></div>
          ) : (
            <Space wrap style={{ display: 'flex', marginTop: 4, marginBottom: 8 }}>
              {campaign.chest.unboundPassives.map((pi) => (
                <Tag key={pi.id} style={{ padding: 6 }}>
                  {passiveLabel(pi.templateId)} (L{pi.global_level}){' '}
                  <Button size="small" type="link" disabled={!selected} onClick={() => selected && bindPassive(pi.id, selected.id)}>
                    Привязать
                  </Button>
                </Tag>
              ))}
            </Space>
          )}

          <Divider style={{ margin: '8px 0' }} />
          <Typography.Text strong>Предметы в сундуке</Typography.Text>
          {campaign.chest.items.length === 0 ? (
            <div><Typography.Text type="secondary">— нет —</Typography.Text></div>
          ) : (
            <Space wrap style={{ display: 'flex', marginTop: 4 }}>
              {campaign.chest.items.map((it) => (
                <Tag key={it.id}>
                  {registry.items.get(it.templateId)?.iconEmoji} {itemLabel(it.templateId)} (L{it.itemLevel})
                </Tag>
              ))}
            </Space>
          )}
          <div style={{ marginTop: 6 }}>
            <Typography.Text type="secondary">Продать предметы можно во вкладке «Магазин».</Typography.Text>
          </div>
        </Card>
      </Col>
    </Row>
  )
}

interface PanelProps {
  ch: Character
  locked: boolean
  registry: ReturnType<typeof useGame.getState>['registry']
  equip: (characterId: string, itemId: string) => void
  unequip: (characterId: string, slot: EquipmentSlot) => void
  toggleLoadoutCard: (characterId: string, cardId: string) => void
  togglePassiveEquip: (characterId: string, passiveId: string) => void
  itemLabel: (t: string) => string
  cardLabel: (t: string) => string
  passiveLabel: (t: string) => string
  className: (t: string) => string
}

function CharacterPanel(p: PanelProps) {
  const { ch, locked, registry } = p
  const slots: EquipmentSlot[] = ['weapon', 'armor', 'accessory']
  const spec = registry.specializations.get(ch.specializationId)

  return (
    <Card
      size="small"
      title={
        <Space>
          <UnitIcon emoji={ch.iconEmoji} accent={ch.iconAccent} />
          <span>{ch.name}</span>
          <Tag>{p.className(ch.classId)}</Tag>
          <Tag>ур. {ch.unitLevel}</Tag>
        </Space>
      }
    >
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Portrait
          id={ch.classId}
          emoji={ch.iconEmoji}
          accent={ch.iconAccent}
          size={104}
          title={`${ch.name} — ${p.className(ch.classId)}`}
        />
        <div style={{ flex: '1 1 220px', minWidth: 220 }}>
          <StatStrip stats={ch.baseStats} rating={ch.baseStatRating} />
          {spec && (
            <div style={{ marginTop: 8 }}>
              <Tag color="purple">Склонность: {spec.label}</Tag>
              <Typography.Text type="secondary">{spec.description}</Typography.Text>
            </div>
          )}
        </div>
      </div>

      <Divider titlePlacement="start" style={{ margin: '12px 0' }}>
        Экипировка
      </Divider>
      <Space orientation="vertical" style={{ width: '100%' }}>
        {slots.map((slot) => {
          const equippedId = ch.equipment[slot]
          const equipped = equippedId ? ch.items.find((i) => i.id === equippedId) : undefined
          const available = ch.items.filter((i) => {
            const tpl = registry.items.get(i.templateId)
            return tpl?.slot === slot && i.id !== equippedId
          })
          return (
            <div key={slot}>
              <Space wrap>
                <Tag>{SLOT_RU[slot]}</Tag>
                {equipped ? (
                  <>
                    <span>
                      {registry.items.get(equipped.templateId)?.iconEmoji} {p.itemLabel(equipped.templateId)} (L
                      {equipped.itemLevel})
                    </span>
                    <Button size="small" disabled={locked} onClick={() => p.unequip(ch.id, slot)}>
                      Снять
                    </Button>
                  </>
                ) : (
                  <Typography.Text type="secondary">— пусто —</Typography.Text>
                )}
              </Space>
              {available.length > 0 && (
                <Space wrap style={{ marginLeft: 8 }}>
                  {available.map((i) => (
                    <Button key={i.id} size="small" type="dashed" disabled={locked} onClick={() => p.equip(ch.id, i.id)}>
                      Надеть: {p.itemLabel(i.templateId)} (L{i.itemLevel})
                    </Button>
                  ))}
                </Space>
              )}
            </div>
          )
        })}
      </Space>

      <Divider titlePlacement="start" style={{ margin: '12px 0' }}>
        Боевой лоадаут ({ch.battleLoadout.length}/{LIMITS.baseLoadoutSize})
      </Divider>
      <Space wrap>
        {ch.cards.length === 0 && <Typography.Text type="secondary">Нет умений</Typography.Text>}
        {ch.cards.map((c) => {
          const on = ch.battleLoadout.includes(c.id)
          return (
            <Button
              key={c.id}
              size="small"
              type={on ? 'primary' : 'default'}
              onClick={() => p.toggleLoadoutCard(ch.id, c.id)}
            >
              {p.cardLabel(c.templateId)} (L{c.global_level})
            </Button>
          )
        })}
      </Space>

      <Divider titlePlacement="start" style={{ margin: '12px 0' }}>
        Пассивы ({ch.passiveEquip.length}/{LIMITS.baseEquippedPassives})
      </Divider>
      <Space wrap>
        {ch.passives.length === 0 && <Typography.Text type="secondary">Нет пассивов</Typography.Text>}
        {ch.passives.map((pi) => {
          const on = ch.passiveEquip.includes(pi.id)
          return (
            <Button
              key={pi.id}
              size="small"
              type={on ? 'primary' : 'default'}
              onClick={() => p.togglePassiveEquip(ch.id, pi.id)}
            >
              {p.passiveLabel(pi.templateId)} (L{pi.global_level})
            </Button>
          )
        })}
      </Space>
    </Card>
  )
}
