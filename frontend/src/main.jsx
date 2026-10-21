/** Inicializa React y la caché de consultas; borra datos privados cuando cambia la cuenta. */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'
import { supabase } from './lib/supabase'
import { clearAuthorizedUserCache } from './lib/authUser'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 2, retry: 1 },
  },
})

// Callback síncrono: evita solicitar tokens dentro del bloqueo de autenticación.
let activeUserId
const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
  const nextUserId = session?.user?.id ?? null
  if (event === 'SIGNED_OUT' || (activeUserId !== undefined && activeUserId !== nextUserId)) {
    queryClient.clear()
    clearAuthorizedUserCache()
    sessionStorage.removeItem('somosdx_authorized_user')
  } else if (event === 'USER_UPDATED') {
    clearAuthorizedUserCache()
  }
  activeUserId = nextUserId
})

// Libera la suscripción al reemplazar el módulo durante el desarrollo.
if (import.meta.hot) import.meta.hot.dispose(() => subscription.unsubscribe())

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)
// Deploy trigger 1778260466
