import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Form, Input, Button, Card, Typography, Tabs } from 'antd'
import { login, getRole, isLoggedIn } from '../services/auth'
import { api } from '../services/api'

const { Text } = Typography

export default function Login() {
  const [errorAdmin,   setErrorAdmin]   = useState('')
  const [errorRes,     setErrorRes]     = useState('')
  const [loadingAdmin, setLoadingAdmin] = useState(false)
  const [loadingRes,   setLoadingRes]   = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const next     = location.state?.next || '/'

  const role = getRole()
  if (isLoggedIn()) {
    if (role === 'visor')     { navigate('/informe',   { replace: true }); return null }
    if (role === 'residente') { navigate('/mi-cuenta', { replace: true }); return null }
    navigate(next, { replace: true }); return null
  }

  async function handleAdmin({ username, password }) {
    setLoadingAdmin(true); setErrorAdmin('')
    try {
      const rol = await login(username, password)
      navigate(rol === 'visor' ? '/informe' : next, { replace: true })
    } catch (e) {
      setErrorAdmin(e.message || 'Credenciales incorrectas')
    }
    setLoadingAdmin(false)
  }

  async function handleResidente({ interior, pin }) {
    setLoadingRes(true); setErrorRes('')
    try {
      const data = await api.residenteAuth({ interior, pin })
      localStorage.setItem('nk2_token',  data.token)
      localStorage.setItem('nk2_role',   'residente')
      localStorage.setItem('nk2_user',   data.interior)
      localStorage.setItem('nk2_nombre', data.nombre)
      navigate('/mi-cuenta', { replace: true })
    } catch (e) {
      setErrorRes(e.message || 'Interior o PIN incorrecto')
    }
    setLoadingRes(false)
  }

  const tabItems = [
    {
      key: 'admin',
      label: <span style={{ fontSize: 13 }}>🔐 Administrador</span>,
      children: (
        <Form onFinish={handleAdmin} layout="vertical" onChange={() => setErrorAdmin('')} style={{ marginTop: 8 }}>
          <Form.Item label="Usuario" name="username" rules={[{ required: true, message: 'Ingresa tu usuario' }]}>
            <Input placeholder="usuario" autoFocus size="large" autoComplete="username" />
          </Form.Item>
          <Form.Item label="Contraseña" name="password" rules={[{ required: true, message: 'Ingresa tu contraseña' }]}
            validateStatus={errorAdmin ? 'error' : ''} help={errorAdmin || ''}>
            <Input.Password placeholder="••••••••" size="large" autoComplete="current-password" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block size="large" loading={loadingAdmin}
              style={{ background: '#1a5c2a', borderColor: '#1a5c2a' }}>
              Ingresar
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'residente',
      label: <span style={{ fontSize: 13 }}>🏠 Residente</span>,
      children: (
        <>
          <Text style={{ display: 'block', fontSize: 12, color: '#6b6b66', marginBottom: 14, fontFamily: 'IBM Plex Mono, monospace' }}>
            Consulta tus pagos con tu número de interior y PIN.
          </Text>
          <Form onFinish={handleResidente} layout="vertical" onChange={() => setErrorRes('')}>
            <Form.Item label="N° Interior" name="interior" rules={[{ required: true, message: 'Requerido' }]}>
              <Input placeholder="Ej: 17, 67A" size="large" autoComplete="off" />
            </Form.Item>
            <Form.Item label="PIN" name="pin" rules={[{ required: true, message: 'Requerido' }]}
              validateStatus={errorRes ? 'error' : ''} help={errorRes || ''}>
              <Input.Password placeholder="••••" size="large" autoComplete="off" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" block size="large" loading={loadingRes}
                style={{ background: '#2c3e7a', borderColor: '#2c3e7a' }}>
                Ver mis pagos
              </Button>
            </Form.Item>
          </Form>
        </>
      ),
    },
  ]

  return (
    <div style={{
      minHeight: '100vh', background: '#323030',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <Card style={{ width: '100%', maxWidth: 400, padding: 0 }} styles={{ body: { padding: 0 } }} bordered>
        <div style={{ background: '#1a1a18', padding: '16px 20px', borderRadius: '6px 6px 0 0' }}>
          <Text style={{ color: '#fff', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 500 }}>
            Comité Ornato y Seguridad · NK2
          </Text>
          <br />
          <Text style={{ color: '#888', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, letterSpacing: 1 }}>
            Selecciona tu tipo de acceso
          </Text>
        </div>
        <div style={{ padding: '8px 20px 24px' }}>
          <Tabs items={tabItems} centered />
        </div>
      </Card>
      <Text style={{ marginTop: 20, fontSize: 11, color: '#aaa', fontFamily: 'IBM Plex Mono, monospace' }}>
        Contacta al administrador si olvidaste tus credenciales.
      </Text>
    </div>
  )
}
