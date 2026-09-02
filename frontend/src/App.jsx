import React from 'react'
import TranslatePage from './pages/TranslatePage'

// App shell. A single page for now; kept as a component so routing (e.g. an
// admin/dictionary browser page) can be added later without restructuring.
export default function App() {
  return <TranslatePage />
}
