import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider } from 'antd'
import ruRU from 'antd/locale/ru_RU'
import 'antd/dist/reset.css'
// Шрифты с кириллицей (self-host, субсеты грузятся по unicode-range).
import '@fontsource-variable/inter'
import '@fontsource/forum'
import './ui/theme.css'
import { gameTheme } from './ui/theme'
import { App } from './ui/App'

const container = document.getElementById('root')
if (!container) throw new Error('Не найден #root')

createRoot(container).render(
  <StrictMode>
    <ConfigProvider locale={ruRU} theme={gameTheme}>
      <App />
    </ConfigProvider>
  </StrictMode>,
)
