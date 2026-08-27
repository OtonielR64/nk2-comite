import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Table, Typography, Tag, Button, Statistic, Row, Col, Spin, message } from 'antd'
import { LogoutOutlined } from '@ant-design/icons'
import { api } from '../services/api'

const { Text } = Typography

const fmt     = n => '$ ' + Math.round(parseFloat(n) || 0).toLocaleString('es-CO')
const fmtFecha = f => {
  if (!f) return ''
  return new Date(f + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}
const fmtMes = m => {
  if (!m || String(m).startsWith('undefined')) return ''
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  const match = String(m).match(/^(\d{4})-(\d{2})/)
  if (match) return `${meses[parseInt(match[2]) - 1]}-${match[1]}`
  return String(m)
  return m
}

export default function MiCuenta() {
  const navigate  = useNavigate()
  const interior  = localStorage.getItem('nk2_user')   || ''
  const nombre    = localStorage.getItem('nk2_nombre')  || ''
  const role      = localStorage.getItem('nk2_role')

  const [pagos,   setPagos]   = useState([])
  const [loading, setLoading] = useState(true)

  // Redirigir si no es residente
  useEffect(() => {
    if (role !== 'residente') { navigate('/login', { replace: true }); return }
    cargar()
  }, [])

  async function cargar() {
    setLoading(true)
    try {
      const data = await api.residenteData(interior)
      setPagos(Array.isArray(data) ? data : [])
    } catch (e) {
      message.error('Error al cargar tus pagos.')
    }
    setLoading(false)
  }

  function cerrarSesion() {
    localStorage.removeItem('nk2_token')
    localStorage.removeItem('nk2_role')
    localStorage.removeItem('nk2_user')
    localStorage.removeItem('nk2_nombre')
    navigate('/login', { replace: true })
  }

  const totalPagado = pagos.reduce((s, r) => s + (parseFloat(r.total) || 0), 0)
  const ultimoPago  = pagos.length ? pagos[0].fecha : null

  const columns = [
    { title: 'Recibo',    dataIndex: 'factura',     key: 'rec',  width: 90,  render: v => <Tag color="green">{v}</Tag> },
    { title: 'Fecha',     dataIndex: 'fecha',        key: 'fec',  width: 110, render: v => fmtFecha(v) },
    { title: 'Concepto',  dataIndex: 'concepto',     key: 'con',  ellipsis: true },
    { title: 'Mes pago',  dataIndex: 'mes_pago',     key: 'mes',  width: 100, render: v => fmtMes(v) },
    { title: 'Cantidad',  dataIndex: 'cantidad',     key: 'can',  width: 80,  align: 'center' },
    { title: 'Total',     dataIndex: 'total',        key: 'tot',  width: 120, align: 'right', render: v => <Text strong style={{ color: '#1a5c2a', fontFamily: 'IBM Plex Mono, monospace' }}>{fmt(v)}</Text> },
    { title: 'Observación', dataIndex: 'observacion', key: 'obs', ellipsis: true, width: 160 },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f4f3f0', display: 'flex', flexDirection: 'column' }}>

      {/* HEADER */}
      <div style={{ background: '#1a1a18', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <Text style={{ color: '#fff', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            Comité Ornato y Seguridad · NK2
          </Text>
          <Text style={{ display: 'block', color: '#888', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, marginTop: 2 }}>
            Portal del residente
          </Text>
        </div>
        <Button icon={<LogoutOutlined />} onClick={cerrarSesion}
          style={{ background: '#4a4a4a', borderColor: '#4a4a4a', color: '#fff', fontSize: 12 }}>
          🔒 Salir
        </Button>
      </div>

      {/* CONTENIDO */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px', width: '100%' }}>

        {/* BIENVENIDA */}
        <Card size="small" style={{ marginBottom: 16 }} styles={{ body: { padding: 0 } }}>
          <div style={{ background: '#2c3e7a', padding: '10px 18px', borderRadius: '6px 6px 0 0' }}>
            <Text style={{ color: '#fff', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase' }}>
              🏠 Interior {interior} — {nombre}
            </Text>
          </div>
          <div style={{ padding: '16px 18px' }}>
            <Row gutter={16}>
              <Col xs={12} sm={6}>
                <Card size="small">
                  <Statistic title="Total pagos" value={pagos.length} valueStyle={{ fontFamily: 'IBM Plex Mono, monospace', color: '#2c3e7a' }} />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small">
                  <Statistic title="Total pagado" value={fmt(totalPagado)} valueStyle={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 15, color: '#1a5c2a' }} />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small">
                  <Statistic title="Último pago" value={ultimoPago ? fmtFecha(ultimoPago) : '—'} valueStyle={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 14 }} />
                </Card>
              </Col>
            </Row>
          </div>
        </Card>

        {/* TABLA DE PAGOS */}
        <Card size="small" styles={{ body: { padding: 0 } }}>
          <div style={{ background: '#1a1a18', padding: '10px 18px' }}>
            <Text style={{ color: '#fff', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase' }}>
              Historial de pagos
            </Text>
          </div>
          {loading
            ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
            : <Table
                dataSource={pagos}
                columns={columns}
                rowKey="id"
                size="small"
                scroll={{ x: 700 }}
                pagination={{ pageSize: 20, showSizeChanger: true, showTotal: t => `${t} registros` }}
                locale={{ emptyText: 'No se encontraron pagos registrados para este interior.' }}
              />
          }
        </Card>

      </div>
    </div>
  )
}
