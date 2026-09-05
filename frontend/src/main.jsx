import React from 'react'
import ReactDOM from 'react-dom/client'
import TranslatePage from './pages/TranslatePage'
import './index.css'

// Single-page app: the root mounts <TranslatePage/> directly. There is no
// separate App shell — kept minimal on purpose. If routing (e.g. a dictionary
// browser page) is ever added, introduce it here.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TranslatePage />
  </React.StrictMode>,
)
