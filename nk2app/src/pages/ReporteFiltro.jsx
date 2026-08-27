import { useState, useRef } from 'react'
import { Card, Button, DatePicker, Table, Typography, Tabs, Row, Col, Space, Statistic, message } from 'antd'
import { PrinterOutlined, FilterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import InformesNav from '../components/InformesNav'
import { api } from '../services/api'

const { Text } = Typography
const { RangePicker } = DatePicker

const fmt = n => '$ ' + Math.round(parseFloat(n) || 0).toLocaleString('es-CO')
const fmtMes = m => {
  if (!m || String(m).startsWith('undefined')) return ''
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  const match = String(m).match(/^(\d{4})-(\d{2})/)
  if (match) return meses[parseInt(match[2]) - 1] + '-' + match[1]
  return String(m)
  return m
}

function TotalCard({ label, value, color }) {
  return (
    <Card size="small">
      <Statistic
        title={<Text style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.8px', fontFamily: 'IBM Plex Mono, monospace', color: '#6b6b66' }}>{label}</Text>}
        value={value}
        valueStyle={{ fontSize: 17, fontFamily: 'IBM Plex Mono, monospace', color }}
      />
    </Card>
  )
}

export default function ReporteFiltro() {
  const primerDiaMes = dayjs().startOf('month')
  const ultimoDiaMes = dayjs().endOf('month')
  const [rango, setRango]       = useState([primerDiaMes, ultimoDiaMes])
  const [tab, setTab]           = useState('ing')
  const [loading, setLoading]   = useState(false)
  const [resultado, setResultado] = useState(null)
  const cacheIng = useRef(null)
  const cacheSal = useRef(null)

  async function filtrar() {
    if (!rango?.[0] || !rango?.[1]) { message.warning('Selecciona las dos fechas.'); return }
    const desde = rango[0].format('YYYY-MM-DD')
    const hasta  = rango[1].format('YYYY-MM-DD')
    setLoading(true)
    setResultado(null)
    try {
      if (tab === 'ing') {
        if (!cacheIng.current) cacheIng.current = await api.getIngresos()
        const filas = (cacheIng.current || []).filter(r => r.fecha >= desde && r.fecha <= hasta)
        let totAdmon = 0, totVeh = 0, totGen = 0
        filas.forEach(r => {
          totAdmon += parseFloat(r.vlr_admon)    || 0
          totVeh   += parseFloat(r.vlr_vehiculo) || 0
          totGen   += parseFloat(r.total)        || 0
        })
        setResultado({ tipo: 'ing', filas, totAdmon, totVeh, totGen, desde, hasta })
      } else {
        if (!cacheSal.current) cacheSal.current = await api.getSalidas()
        const filas = (cacheSal.current || []).filter(r => r.fecha >= desde && r.fecha <= hasta)
        let totTotal = 0, totAbono = 0, totSaldo = 0
        filas.forEach(r => {
          totTotal += parseFloat(r.vlr_total) || 0
          totAbono += parseFloat(r.abono)     || 0
          totSaldo += parseFloat(r.saldo)     || 0
        })
        setResultado({ tipo: 'sal', filas, totTotal, totAbono, totSaldo, desde, hasta })
      }
    } catch { message.error('Error al cargar datos.') }
    setLoading(false)
  }

  const colsIng = [
    { title: '# Recibo',  dataIndex: 'factura',      width: 90,  render: v => <Text style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>{v}</Text> },
    { title: 'Fecha',     dataIndex: 'fecha',         width: 100, render: v => <Text style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>{v}</Text> },
    { title: 'Int.',      dataIndex: 'interior',      width: 60 },
    { title: 'Nombre',    dataIndex: 'nombre' },
    { title: 'Concepto',  dataIndex: 'concepto' },
    { title: 'Vlr. Admon',    dataIndex: 'vlr_admon',    align: 'right', width: 120, render: v => <Text style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>{fmt(v)}</Text> },
    { title: 'Vlr. Vehículo', dataIndex: 'vlr_vehiculo', align: 'right', width: 120, render: v => <Text style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>{fmt(v)}</Text> },
    { title: 'Mes pago',  dataIndex: 'mes_pago',      width: 90,  render: v => fmtMes(v) },
    { title: 'Cant.',     dataIndex: 'cantidad',      align: 'right', width: 60 },
    { title: 'Total',     dataIndex: 'total',         align: 'right', width: 120, render: v => <Text style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>{fmt(v)}</Text> },
  ]

  const colsSal = [
    { title: '# Registro',   dataIndex: 'cod_registro',  width: 100, render: v => <Text style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>{v}</Text> },
    { title: 'Fecha',        dataIndex: 'fecha',          width: 100, render: v => <Text style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>{v}</Text> },
    { title: 'Administrador',dataIndex: 'administrador' },
    { title: 'Concepto',     dataIndex: 'concepto' },
    { title: 'Vlr. Total',  dataIndex: 'vlr_total', align: 'right', width: 120, render: v => <Text style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>{fmt(v)}</Text> },
    { title: 'Abono',        dataIndex: 'abono',     align: 'right', width: 110, render: v => <Text style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#854f0b' }}>{fmt(v)}</Text> },
    { title: 'Saldo',        dataIndex: 'saldo',     align: 'right', width: 120, render: v => <Text style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#7a1a1a' }}>{fmt(v)}</Text> },
    { title: 'Observación',  dataIndex: 'observacion', render: v => <Text style={{ fontSize: 12 }}>{v || ''}</Text> },
  ]

  const tabItems = [
    { key: 'ing', label: <span style={{ color: tab === 'ing' ? '#1a5c2a' : undefined }}>Ingresos</span> },
    { key: 'sal', label: <span style={{ color: tab === 'sal' ? '#7a1a1a' : undefined }}>Egresos</span> },
  ]

  return (
    <div>
      <InformesNav />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>

        <Card size="small" style={{ marginBottom: 16 }} className="no-print"
          title={<Text style={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: '#6b6b66' }}>Filtrar por período</Text>}>
          <Tabs activeKey={tab} onChange={k => { setTab(k); setResultado(null) }} items={tabItems} style={{ marginBottom: 12 }} />
          <Row gutter={12} align="bottom" style={{ maxWidth: 480 }}>
            <Col span={24}>
              <Text style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.8px', textTransform: 'uppercase', color: '#6b6b66', fontFamily: 'IBM Plex Mono, monospace', display: 'block', marginBottom: 6 }}>Rango de fechas</Text>
              <RangePicker value={rango} onChange={setRango} format="YYYY-MM-DD" style={{ width: '100%' }} />
            </Col>
          </Row>
          <Row gutter={8} style={{ marginTop: 16 }}>
            <Col><Button type="primary" icon={<FilterOutlined />} onClick={filtrar} loading={loading} style={{ background: '#1a1a18', borderColor: '#1a1a18' }}>Filtrar</Button></Col>
            <Col>
              <Button icon={<PrinterOutlined />} onClick={() => {
                if (!resultado) { message.warning('Primero aplica un filtro.'); return }
                window.print()
              }} style={{ background: '#2980b9', borderColor: '#2980b9', color: '#fff' }}>Imprimir / PDF</Button>
            </Col>
            {resultado && <Col style={{ display: 'flex', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace' }}>
                {resultado.filas.length} registro{resultado.filas.length !== 1 ? 's' : ''}
              </Text>
            </Col>}
          </Row>
        </Card>

        {resultado && (
          <>
            <div className="print-header" style={{ display: 'none' }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>COMITÉ DE ORNATO Y SEGURIDAD — NUEVO KENNEDY 2do SECTOR</h2>
              <p style={{ textAlign: 'center', fontSize: 11, color: '#555', marginTop: 3 }}>
                {resultado.tipo === 'ing' ? 'Ingresos' : 'Egresos'} — {resultado.desde} al {resultado.hasta}
              </p>
            </div>

            <Card size="small" style={{ marginBottom: 16 }}
              title={<Text style={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: '#6b6b66' }}>
                Totales — {resultado.tipo === 'ing' ? 'Ingresos' : 'Egresos'}
              </Text>}>
              <Row gutter={12}>
                {resultado.tipo === 'ing' ? (
                  <>
                    <Col xs={24} sm={8}><TotalCard label="Vlr. Admon"    value={fmt(resultado.totAdmon)} color="#1a5c2a" /></Col>
                    <Col xs={24} sm={8}><TotalCard label="Vlr. Vehículo" value={fmt(resultado.totVeh)}   color="#1a5c2a" /></Col>
                    <Col xs={24} sm={8}><TotalCard label="Total general"  value={fmt(resultado.totGen)}   color="#1a5c2a" /></Col>
                  </>
                ) : (
                  <>
                    <Col xs={24} sm={8}><TotalCard label="Total facturado"  value={fmt(resultado.totTotal)} color="#7a1a1a" /></Col>
                    <Col xs={24} sm={8}><TotalCard label="Total abonos"     value={fmt(resultado.totAbono)} color="#854f0b" /></Col>
                    <Col xs={24} sm={8}><TotalCard label="Saldo pendiente"  value={fmt(resultado.totSaldo)} color="#7a1a1a" /></Col>
                  </>
                )}
              </Row>
            </Card>

            <Card size="small" bodyStyle={{ padding: 0 }}
              title={<Text style={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: '#6b6b66' }}>
                Detalle de {resultado.tipo === 'ing' ? 'ingresos' : 'egresos'} — {resultado.filas.length} registro{resultado.filas.length !== 1 ? 's' : ''}
              </Text>}>
              {resultado.filas.length === 0
                ? <div style={{ textAlign: 'center', padding: '40px 0', color: '#6b6b66', fontSize: 13 }}>Sin registros para el período seleccionado.</div>
                : <Table
                    size="small"
                    dataSource={resultado.filas}
                    rowKey="id"
                    columns={resultado.tipo === 'ing' ? colsIng : colsSal}
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                    summary={() => resultado.tipo === 'ing'
                      ? (
                        <Table.Summary.Row style={{ fontWeight: 600, background: '#fafaf8' }}>
                          <Table.Summary.Cell index={0} colSpan={5}>TOTALES ({resultado.filas.length} registros)</Table.Summary.Cell>
                          <Table.Summary.Cell index={5} align="right"><Text style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{fmt(resultado.totAdmon)}</Text></Table.Summary.Cell>
                          <Table.Summary.Cell index={6} align="right"><Text style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{fmt(resultado.totVeh)}</Text></Table.Summary.Cell>
                          <Table.Summary.Cell index={7} colSpan={2} />
                          <Table.Summary.Cell index={9} align="right"><Text style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{fmt(resultado.totGen)}</Text></Table.Summary.Cell>
                        </Table.Summary.Row>
                      ) : (
                        <Table.Summary.Row style={{ fontWeight: 600, background: '#fafaf8' }}>
                          <Table.Summary.Cell index={0} colSpan={4}>TOTALES ({resultado.filas.length} registros)</Table.Summary.Cell>
                          <Table.Summary.Cell index={4} align="right"><Text style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{fmt(resultado.totTotal)}</Text></Table.Summary.Cell>
                          <Table.Summary.Cell index={5} align="right"><Text style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{fmt(resultado.totAbono)}</Text></Table.Summary.Cell>
                          <Table.Summary.Cell index={6} align="right"><Text style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{fmt(resultado.totSaldo)}</Text></Table.Summary.Cell>
                          <Table.Summary.Cell index={7} />
                        </Table.Summary.Row>
                      )
                    }
                  />
              }
            </Card>
          </>
        )}
      </div>

      <style>{`
        @media print {
          @page { size: Letter landscape; margin: 8mm; }
          .no-print { display: none !important; }
          .print-header { display: block !important; }
          body { background: #fff !important; font-size: 9px; }
          .ant-card { border: 1px solid #ccc !important; margin-bottom: 6px !important; box-shadow: none !important; }
          .ant-card-head { padding: 0 8px !important; min-height: 28px !important; }
          .ant-card-head-title { padding: 4px 0 !important; font-size: 9px !important; }
          .ant-card-body { padding: 6px 8px !important; }
          .ant-statistic-title { font-size: 8px !important; }
          .ant-statistic-content-value { font-size: 13px !important; }
          .ant-table { font-size: 8px !important; }
          .ant-table-thead > tr > th { padding: 3px 5px !important; font-size: 7px !important; }
          .ant-table-tbody > tr > td { padding: 2px 5px !important; }
          .ant-table-summary > tr > td { padding: 3px 5px !important; font-size: 8px !important; }
        }
      `}</style>
    </div>
  )
}
