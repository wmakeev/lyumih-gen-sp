/**
 * Тема AntD «Memento Mori» (этап A редизайна).
 *
 * Тёмный силуэтный gothic-flat с одним акцентным цветом (приглушённый
 * кровавый). Тёмная + компактная алгоритмика — под высокую инфо-плотность
 * боевого UI (9 статов, статусы, кулдауны, бейджи очереди).
 *
 * Один источник правды по цвету: ручной слой (`theme.css`) потребляет те же
 * CSS-переменные (`--ant-color-*`), что генерирует AntD из этих токенов
 * (AntD 6 по умолчанию `cssVar`). Смена акцента — правка одного `colorPrimary`.
 */

import { theme, type ThemeConfig } from 'antd'

/** Опорные значения палитры — переиспользуются и в семантических CSS-переменных. */
export const SEED = {
  /** Акцент Memento — приглушённый кровавый/гранатовый. */
  accent: '#B0302B',
  /** Глубокий тёмный фон (почти чёрный с фиолетовым подтоном). */
  bgBase: '#0E0D12',
  /** Костяной тёплый цвет текста. */
  textBase: '#EDE8DD',
} as const

export const gameTheme: ThemeConfig = {
  algorithm: [theme.darkAlgorithm, theme.compactAlgorithm],
  token: {
    colorPrimary: SEED.accent,
    colorInfo: SEED.accent,
    colorBgBase: SEED.bgBase,
    colorTextBase: SEED.textBase,
    borderRadius: 4,
    wireframe: false,
    fontFamily:
      "'Inter Variable', Inter, 'PT Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    fontFamilyCode:
      "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  components: {
    // Карточный вид (Таверна, Персонаж, панели Memento) — готик-флэт рамки.
    Card: {
      borderRadiusLG: 6,
      colorBorderSecondary: 'rgba(176,48,43,0.22)',
      paddingLG: 16,
    },
    // Плотные тултипы под инфо-плотность.
    Tooltip: {
      borderRadius: 4,
      paddingSM: 8,
      paddingXS: 6,
      fontSize: 12,
    },
    // Боевые кнопки — акцент.
    Button: {
      borderRadius: 4,
      primaryShadow: 'none',
      fontWeight: 500,
    },
    // Хаб вкладочный. Подпись активной вкладки — светлее акцента: #B0302B как
    // текст даёт лишь 3:1 (мало для ~14px), #D7615A = 5.3:1 (AA). См. этап F.
    Tabs: {
      inkBarColor: '#D7615A',
      itemSelectedColor: '#D7615A',
      itemHoverColor: '#E07B74',
      horizontalItemGutter: 20,
    },
    Tag: {
      borderRadiusSM: 3,
    },
    Progress: {
      defaultColor: SEED.accent,
    },
  },
}
