import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { applyThemePreference, getStoredThemePreference } from './utils/theme'
import { getUser } from './auth/authStorage'

function ensureFatalOverlay(message: string) {
  // Não mexe no container do React para evitar conflito com o reconciler (removeChild NotFoundError)
  const existing = document.getElementById('drx_fatal_overlay')
  if (existing) {
    const body = existing.querySelector('[data-body="1"]')
    if (body) body.textContent = message
    return
  }

  const overlay = document.createElement('div')
  overlay.id = 'drx_fatal_overlay'
  overlay.style.position = 'fixed'
  overlay.style.inset = '0'
  overlay.style.zIndex = '2147483647'
  overlay.style.background = 'rgba(2,6,23,0.82)'
  overlay.style.backdropFilter = 'blur(6px)'
  overlay.style.padding = '24px'
  overlay.style.overflow = 'auto'

  overlay.innerHTML = `
    <div style="font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial; max-width: 980px; margin: 0 auto;">
      <div style="border: 1px solid rgba(244,63,94,0.35); background: rgba(244,63,94,0.12); border-radius: 16px; padding: 16px 18px;">
        <div style="font-weight: 800; color: white; font-size: 14px;">Falha ao inicializar a aplicação</div>
        <pre data-body="1" style="margin-top: 10px; color: rgba(255,255,255,0.9); font-size: 12px; white-space: pre-wrap; line-height: 1.35;">${message}</pre>
        <button id="drx_reload" style="margin-top: 12px; padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.08); cursor: pointer; font-weight: 700; color: white;">Recarregar</button>
      </div>
    </div>
  `

  document.body.appendChild(overlay)

  const btn = document.getElementById('drx_reload')
  if (btn) btn.addEventListener('click', () => window.location.reload())
}

function installGlobalErrorHandlers() {
  window.addEventListener('error', (event) => {
    const err = event.error instanceof Error ? event.error : null
    const msg = err?.stack || err?.message || String(event.message || 'Erro desconhecido')
    // eslint-disable-next-line no-console
    console.error('GlobalError:', err || event)
    setTimeout(() => ensureFatalOverlay(msg), 0)
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason: any = (event as PromiseRejectionEvent).reason
    const msg = reason instanceof Error ? (reason.stack || reason.message) : String(reason || 'Promise rejection')
    // eslint-disable-next-line no-console
    console.error('UnhandledRejection:', reason)
    setTimeout(() => ensureFatalOverlay(msg), 0)
  })
}

function boot() {
  installGlobalErrorHandlers()

  const bootUser: any = getUser()
  applyThemePreference((bootUser?.theme || getStoredThemePreference() || 'DARK') as any)

  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />)
}

try {
  boot()
} catch (err: any) {
  // eslint-disable-next-line no-console
  console.error('BootError:', err)
  ensureFatalOverlay(err?.stack || err?.message || String(err))
}





