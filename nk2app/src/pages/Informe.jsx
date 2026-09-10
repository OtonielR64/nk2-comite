import { useState, useRef } from 'react'
import { Card, Button, Select, DatePicker, Radio, Row, Col, Typography, Progress, Table, Statistic, Spin, message } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import InformesNav from '../components/InformesNav'
import { api } from '../services/api'

const { Text } = Typography
const { RangePicker } = DatePicker

const BASE_INGRESOS = 3637452.26
const fmt = n => '$ ' + Math.round(parseFloat(n) || 0).toLocaleString('es-CO')
const pct = (v, t) => t > 0 ? ((v / t) * 100).toFixed(1) + '%' : '0%'
const AÑOS = [2024, 2025, 2026, 2027]
const TRIM_NOMBRES = ['', 'Ene–Mar', 'Abr–Jun', 'Jul–Sep', 'Oct–Dic']
const CONC_SAL = { '21':'Vigilancia','22':'Cafetería','23':'Aseo','24':'Papelería','25':'Otros','26':'Mantenimiento Gral.','27':'Servicios públicos','28':'Internet/Cel. Garita','29':'Reconocimiento gestión admin.' }

function ultimoDia(a, m) { return new Date(a, m, 0).getDate() }
function pad(n) { return String(n).padStart(2, '0') }

function getRango(modo, trim, año, rangoPicker, añoCompleto) {
  if (modo === 'actual') {
    const hoy = new Date()
    const t = Math.floor(hoy.getMonth() / 3) + 1
    const a = hoy.getFullYear()
    const meses = [[0,2],[3,5],[6,8],[9,11]]
    const [m1, m2] = meses[t - 1]
    return { desde: `${a}-${pad(m1+1)}-01`, hasta: `${a}-${pad(m2+1)}-${ultimoDia(a, m2+1)}`, label: `T${t} ${a} (${TRIM_NOMBRES[t]})` }
  }
  if (modo === 'manual') {
    const meses = [[0,2],[3,5],[6,8],[9,11]]
    const [m1, m2] = meses[trim - 1]
    return { desde: `${año}-${pad(m1+1)}-01`, hasta: `${año}-${pad(m2+1)}-${ultimoDia(año, m2+1)}`, label: `T${trim} ${año} (${TRIM_NOMBRES[trim]})` }
  }
  if (modo === 'rango') {
    if (!rangoPicker?.[0] || !rangoPicker?.[1]) return null
    const desde = rangoPicker[0].format('YYYY-MM-DD')
    const hasta  = rangoPicker[1].format('YYYY-MM-DD')
    return { desde, hasta, label: `${rangoPicker[0].format('DD MMM YYYY')} — ${rangoPicker[1].format('DD MMM YYYY')}` }
  }
  if (modo === 'anual') {
    return { desde: `${añoCompleto}-01-01`, hasta: `${añoCompleto}-12-31`, label: `Año completo ${añoCompleto}` }
  }
}

export default function Informe() {
  const [modo, setModo] = useState('actual')
  const [trim, setTrim] = useState(Math.floor(new Date().getMonth() / 3) + 1)
  const [año,  setAño]  = useState(new Date().getFullYear())
  const [rangoPicker, setRangoPicker] = useState(null)
  const [añoCompleto, setAñoCompleto] = useState(new Date().getFullYear())
  const [loading,  setLoading]  = useState(false)
  const [informe,  setInforme]  = useState(null)
  const [label,    setLabel]    = useState('')
  const cacheIng = useRef(null)
  const cacheSal = useRef(null)

  async function generar() {
    const rango = getRango(modo, trim, año, rangoPicker, añoCompleto)
    if (!rango) { message.warning('Selecciona las dos fechas.'); return }
    setLoading(true)
    try {
      if (!cacheIng.current || !cacheSal.current) {
        const [ing, sal] = await Promise.all([api.getIngresos(), api.getSalidas()])
        cacheIng.current = ing || []
        cacheSal.current = sal || []
      }
      const ing = cacheIng.current.filter(r => r.fecha >= rango.desde && r.fecha <= rango.hasta)
      const sal = cacheSal.current.filter(r => r.fecha >= rango.desde && r.fecha <= rango.hasta)
      const totalIng = ing.reduce((s, r) => s + (parseFloat(r.total)     || 0), 0)
      const totalSal = sal.reduce((s, r) => s + (parseFloat(r.saldo)     || 0), 0)
      const balance  = totalIng - totalSal
      const saldoCaja = BASE_INGRESOS
        + cacheIng.current.filter(r => r.fecha <= rango.hasta).reduce((s, r) => s + (parseFloat(r.total) || 0), 0)
        - cacheSal.current.filter(r => r.fecha <= rango.hasta).reduce((s, r) => s + (parseFloat(r.saldo) || 0), 0)

      const catIng = {}
      ing.forEach(r => {
        const k = `${r.cod_concepto} — ${r.concepto}`
        if (!catIng[k]) catIng[k] = { count: 0, total: 0 }
        catIng[k].count++; catIng[k].total += parseFloat(r.total) || 0
      })
      const catSal = {}
      sal.forEach(r => {
        const cod = String(r.cod_concepto).trim()
        const k = CONC_SAL[cod] ? `${cod} — ${CONC_SAL[cod]}` : `${cod} — ${r.concepto || 'Sin concepto'}`
        if (!catSal[k]) catSal[k] = { count: 0, total: 0 }
        catSal[k].count++; catSal[k].total += parseFloat(r.vlr_total) || 0
      })
      setLabel(rango.label)
      setInforme({ totalIng, totalSal, balance, saldoCaja, catIng, catSal })
    } catch { message.error('Error al cargar datos.') }
    setLoading(false)
  }

  function CatTabla({ cat, total, color }) {
    const sorted = Object.entries(cat).sort((a, b) => b[1].total - a[1].total)
    if (!sorted.length) return <Text type="secondary">Sin registros.</Text>
    return (
      <>
        <div style={{ marginBottom: 12 }}>
          {sorted.map(([k, v]) => (
            <div key={k} style={{ marginBottom: 8 }}>
              <Row justify="space-between" style={{ marginBottom: 3 }}>
                <Text style={{ fontSize: 12 }}>{k}</Text>
                <Text style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace' }}>{fmt(v.total)}</Text>
              </Row>
              <Progress percent={parseFloat(pct(v.total, total))} showInfo={false} strokeColor={color} trailColor="#f0ede8" size={['100%', 8]} />
            </div>
          ))}
        </div>
        <Table
          size="small"
          pagination={false}
          dataSource={sorted.map(([k, v]) => ({ key: k, concepto: k, count: v.count, total: v.total }))}
          columns={[
            { title: 'Concepto', dataIndex: 'concepto' },
            { title: 'Registros', dataIndex: 'count', align: 'right', width: 90 },
            { title: 'Total', dataIndex: 'total', align: 'right', width: 140, render: v => <Text style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{fmt(v)}</Text> },
            { title: '%', align: 'right', width: 70, render: (_, r) => pct(r.total, total) },
          ]}
          summary={() => (
            <Table.Summary.Row style={{ fontWeight: 600, background: '#fafaf8' }}>
              <Table.Summary.Cell index={0}>Total</Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">{sorted.reduce((s, [, v]) => s + v.count, 0)}</Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right"><Text style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{fmt(total)}</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right">100%</Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </>
    )
  }

  return (
    <div>
      <InformesNav />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

        {/* CONTROLES */}
        <Card size="small" style={{ marginBottom: 16 }} className="no-print">
          <Text style={{ fontSize: 11, color: '#6b6b66', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.8px', display: 'block', marginBottom: 12 }}>
            Seleccionar período
          </Text>
          <Radio.Group value={modo} onChange={e => setModo(e.target.value)} style={{ marginBottom: 14 }}>
            <Radio.Button value="actual">Trimestre actual</Radio.Button>
            <Radio.Button value="manual">Elegir trimestre</Radio.Button>
            <Radio.Button value="rango">Rango de fechas</Radio.Button>
            <Radio.Button value="anual">Año completo</Radio.Button>
          </Radio.Group>

          {modo === 'actual' && (
            <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
              T{Math.floor(new Date().getMonth() / 3) + 1} {new Date().getFullYear()} ({TRIM_NOMBRES[Math.floor(new Date().getMonth() / 3) + 1]})
            </Text>
          )}
          {modo === 'manual' && (
            <Row gutter={12} style={{ maxWidth: 380, marginBottom: 12 }}>
              <Col span={12}>
                <Select value={año} onChange={setAño} style={{ width: '100%' }} options={AÑOS.map(a => ({ value: a, label: String(a) }))} />
              </Col>
              <Col span={12}>
                <Select value={trim} onChange={setTrim} style={{ width: '100%' }}
                  options={[1,2,3,4].map(t => ({ value: t, label: `T${t} — ${TRIM_NOMBRES[t]}` }))} />
              </Col>
            </Row>
          )}
          {modo === 'rango' && (
            <div style={{ marginBottom: 12 }}>
              <RangePicker value={rangoPicker} onChange={setRangoPicker} format="YYYY-MM-DD" style={{ maxWidth: 380 }} />
            </div>
          )}
          {modo === 'anual' && (
            <div style={{ marginBottom: 12, maxWidth: 200 }}>
              <Select value={añoCompleto} onChange={setAñoCompleto} style={{ width: '100%' }} options={AÑOS.map(a => ({ value: a, label: String(a) }))} />
            </div>
          )}

          <Row gutter={8}>
            <Col><Button type="primary" onClick={generar} loading={loading} style={{ background: '#1a1a18', borderColor: '#1a1a18' }}>Generar informe</Button></Col>
            <Col><Button icon={<PrinterOutlined />} onClick={() => window.print()} style={{ background: '#2980b9', borderColor: '#2980b9', color: '#fff' }}>Imprimir</Button></Col>
          </Row>
        </Card>

        {/* INFORME */}
        {loading && <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>}

        {informe && !loading && (
          <>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontStyle: 'italic', fontSize: 13 }}>📅 {label}</Text>

            <Card size="small" style={{ marginBottom: 16 }} title={<Text style={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: '#6b6b66' }}>Resumen financiero</Text>}>
              <Row gutter={12}>
                {[
                  { title: 'Total ingresos',   value: fmt(informe.totalIng),  color: '#1a5c2a' },
                  { title: 'Total salidas',    value: fmt(informe.totalSal),  color: '#7a1a1a' },
                  { title: 'Balance período',  value: fmt(informe.balance),   color: informe.balance >= 0 ? '#1a5c2a' : '#7a1a1a' },
                  { title: 'Saldo en caja',    value: fmt(informe.saldoCaja), color: '#1a5c2a' },
                ].map(s => (
                  <Col xs={12} sm={6} key={s.title}>
                    <Card size="small">
                      <Statistic title={s.title} value={s.value} valueStyle={{ color: s.color, fontFamily: 'IBM Plex Mono, monospace', fontSize: 15 }} />
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>

            <Card size="small" style={{ marginBottom: 16 }} title={<Text style={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: '#6b6b66' }}>Ingresos por concepto</Text>}>
              <CatTabla cat={informe.catIng} total={informe.totalIng} color="#1a5c2a" />
            </Card>

            <Card size="small" title={<Text style={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: '#6b6b66' }}>Salidas por concepto</Text>}>
              <CatTabla cat={informe.catSal} total={informe.totalSal} color="#7a1a1a" />
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
