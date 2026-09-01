import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { AppProviders } from './app/providers/AppProviders'
import '@fontsource/bahiana'
import '@fontsource/titillium-web/400.css'
import '@fontsource/titillium-web/600.css'
import '@fontsource/titillium-web/700.css'
import './styles.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('No se encontró el contenedor principal de React')

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>,
)
