import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Products from './pages/Products.jsx'
import Inventory from './pages/Inventory.jsx'
import Sales from './pages/Sales.jsx'
import DatasetUpload from './pages/DatasetUpload.jsx'
import Prediction from './pages/Prediction.jsx'
import ModelPerformance from './pages/ModelPerformance.jsx'
import Reports from './pages/Reports.jsx'

// Pages inside the dashboard require a login token.
function Protected({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/products" element={<Products />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/dataset" element={<DatasetUpload />} />
        <Route path="/prediction" element={<Prediction />} />
        <Route path="/performance" element={<ModelPerformance />} />
        <Route path="/reports" element={<Reports />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
