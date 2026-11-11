import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { EnvironmentPage } from './pages/EnvironmentPage'
import { ScalePage } from './pages/ScalePage'
import { SettingsPage } from './pages/SettingsPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route
            path="/"
            element={<Navigate to="/environment" replace />}
          />
          <Route path="/environment" element={<EnvironmentPage />} />
          <Route path="/scale" element={<ScalePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App