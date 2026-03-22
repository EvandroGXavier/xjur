import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { applyThemePreference, getStoredThemePreference } from './utils/theme'
import { getUser } from './auth/authStorage'

const bootUser: any = getUser()
applyThemePreference((bootUser?.theme || getStoredThemePreference() || 'DARK') as any)

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <App />,
)





