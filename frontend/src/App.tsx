import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { EnvironmentPage } from './pages/EnvironmentPage'

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
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App