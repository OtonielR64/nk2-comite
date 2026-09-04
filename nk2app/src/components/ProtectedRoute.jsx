import { Navigate, useLocation } from 'react-router-dom'
import { getRole } from '../services/auth'

export default function ProtectedRoute({ children, adminOnly = false }) {
  const role = getRole()
  const location = useLocation()

  if (!role) {
    return <Navigate to="/login" state={{ next: location.pathname }} replace />
  }

  if (adminOnly && role !== 'admin' && role !== 'superadmin') {
    return <Navigate to="/informe" replace />
  }

  return children
}
