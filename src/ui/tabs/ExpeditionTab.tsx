/** Вкладка «Бой / Экспедиция»: выбор режима и состава, старт похода. */

import { Alert, Button, Card, Checkbox, Col, Row, Select, Space, Tag, Typography } from 'antd'
import { useGame } from '../../state/store'
import { UnitIcon } from '../components/UnitIcon'

export function ExpeditionTab() {
  useGame((s) => s.rev)
  const campaign = useGame((s) => s.campaign)
  const registry = useGame((s) => s.registry)
  const modeId = useGame((s) => s.ui.selectedExpeditionMode)
  const squadSelection = useGame((s) => s.ui.squadSelection)
  const setMode = useGame((s) => s.setExpeditionMode)
  const toggle = useGame((s) => s.toggleSquadSelection)
  const start = useGame((s) => s.startExpedition)

  const modes = [...registry.expeditions.values()]
  const mode = registry.expeditions.get(modeId) ?? modes[0]

  const anyChecked = squadSelection.some(Boolean)
  const participating = campaign.squad.filter((cid, i) => !!cid && (!anyChecked || squadSelection[i])).length
  const partyMin = mode?.partyMin ?? 1
  const canStart = !campaign.expedition && mode !== undefined && participating >= partyMin

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size="middle">
      {campaign.expedition && <Alert type="info" showIcon message="Экспедиция уже идёт." />}

      <Card size="small" title="Режим экспедиции">
        <Select
          style={{ width: '100%', maxWidth: 360 }}
          value={mode?.id}
          onChange={(v) => setMode(v)}
          options={modes.map((m) => ({ value: m.id, label: m.label }))}
        />
        {mode && (
          <div style={{ marginTop: 8 }}>
            <Typography.Paragraph style={{ marginBottom: 4 }}>{mode.description}</Typography.Paragraph>
            <Space wrap>
              <Tag>
                Боёв: {mode.battleCountRange[0]}
                {mode.battleCountRange[1] !== mode.battleCountRange[0] ? `–${mode.battleCountRange[1]}` : ''}
              </Tag>
              <Tag>Отряд: {mode.partyMin}–{mode.partyMax}</Tag>
              {mode.interBattleReviveAllDowned && <Tag color="green">Воскрешение между боями</Tag>}
            </Space>
          </div>
        )}
      </Card>

      <Card size="small" title="Состав отряда (отметьте участников)">
        <Row gutter={[12, 12]}>
          {campaign.squad.map((cid, i) => {
            const ch = cid ? campaign.characters.find((c) => c.id === cid) : undefined
            return (
              <Col key={i} xs={12} sm={6}>
                <Card size="small">
                  {ch ? (
                    <Space orientation="vertical" align="center" style={{ width: '100%' }}>
                      <UnitIcon emoji={ch.iconEmoji} accent={ch.iconAccent} />
                      <Typography.Text>{ch.name}</Typography.Text>
                      <Checkbox checked={squadSelection[i] ?? false} onChange={() => toggle(i)}>
                        В поход
                      </Checkbox>
                    </Space>
                  ) : (
                    <Typography.Text type="secondary">Слот {i + 1}: пусто</Typography.Text>
                  )}
                </Card>
              </Col>
            )
          })}
        </Row>
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
          Если никто не отмечен — пойдут все занятые слоты. Участников: {participating}, нужно минимум {partyMin}.
        </Typography.Text>
      </Card>

      <Button type="primary" size="large" disabled={!canStart} onClick={() => start()}>
        В поход
      </Button>
    </Space>
  )
}
