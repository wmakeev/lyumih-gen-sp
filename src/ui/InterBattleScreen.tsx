/** Экран между боями (§12.3): состав, воскрешение, следующий бой. */

import { Button, Card, Col, Row, Space, Tag, Typography } from 'antd'
import { useGame } from '../state/store'
import { UnitIcon } from './components/UnitIcon'

export function InterBattleScreen() {
  useGame((s) => s.rev)
  const campaign = useGame((s) => s.campaign)
  const reviveAll = useGame((s) => s.reviveAll)
  const nextBattle = useGame((s) => s.nextBattle)

  const exp = campaign.expedition
  const snapshot = exp?.squadSnapshot ?? []
  const showRevive = exp?.interBattleReviveAllDowned === true
  const anyDowned = snapshot.some((m) => m.metaStatus === 'downed')

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size="middle">
      <Typography.Title level={3} style={{ margin: 0 }}>
        Передышка между боями
      </Typography.Title>
      {exp && (
        <Typography.Text type="secondary">
          Бой {exp.battleIndex + 1} из {exp.battleCount}
        </Typography.Text>
      )}

      <Card size="small" title="Состав отряда">
        <Row gutter={[12, 12]}>
          {snapshot.map((m) => {
            const ch = campaign.characters.find((c) => c.id === m.characterId)
            const downed = m.metaStatus === 'downed'
            return (
              <Col key={m.characterId} xs={12} sm={6}>
                <Card size="small">
                  <Space orientation="vertical" align="center" style={{ width: '100%' }}>
                    <UnitIcon emoji={ch?.iconEmoji ?? '❓'} accent={ch?.iconAccent} dimmed={downed} />
                    <Typography.Text>{ch?.name ?? m.characterId}</Typography.Text>
                    <Tag color={downed ? 'red' : 'green'}>{downed ? 'Повержен' : 'Готов'}</Tag>
                  </Space>
                </Card>
              </Col>
            )
          })}
        </Row>
      </Card>

      <Space>
        {showRevive && (
          <Button onClick={() => reviveAll()} disabled={!anyDowned}>
            Воскресить всех
          </Button>
        )}
        <Button type="primary" onClick={() => nextBattle()}>
          Следующий бой
        </Button>
      </Space>
    </Space>
  )
}
