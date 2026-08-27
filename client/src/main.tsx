import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { AppProviders } from './app/providers/AppProviders'
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
