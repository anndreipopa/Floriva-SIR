import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'
import { EnvironmentPage } from './pages/EnvironmentPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/environment" replace />} />
        <Route path="/environment" element={<EnvironmentPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App