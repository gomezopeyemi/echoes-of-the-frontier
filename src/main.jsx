import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// ?showcase opens the character showcase instead of the game.
const Showcase = lazy(() => import('./showcase/Showcase'))
const showcase = new URLSearchParams(window.location.search).has('showcase')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {showcase ? (
      <Suspense fallback={null}>
        <Showcase />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>
)
