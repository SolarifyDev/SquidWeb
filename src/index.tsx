import { createRoot } from 'react-dom/client'
import 'tailwindcss/tailwind.css'
import 'assets/octo-dropdown.css'
import App from 'components/App'
import SetupGate from 'pages/setup/SetupGate'
import { BrowserRouter as Router } from 'react-router-dom'
import { ConfigProvider, type ThemeConfig } from 'antd'

const GEIST_FONT_STACK =
  "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

const squidTheme: ThemeConfig = {
  token: {
    colorPrimary: '#0d80d8',
    colorInfo: '#0d80d8',
    colorSuccess: '#00874d',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorLink: '#0d80d8',
    borderRadius: 8,
    fontFamily: GEIST_FONT_STACK,
  },
}

const container = document.getElementById('root') as HTMLDivElement
const root = createRoot(container)

root.render(
  <Router>
    <ConfigProvider theme={squidTheme}>
      <SetupGate>
        <App />
      </SetupGate>
    </ConfigProvider>
  </Router>
)
