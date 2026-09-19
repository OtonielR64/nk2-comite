import { useState, useEffect, useMemo } from 'react'
import {
  Table, Button, Input, Select, DatePicker, Form, InputNumber,
  Modal, Card, Row, Col, Space, Typography, Tag, Tabs, Statistic, message, Alert
} from 'antd'
import {
  ClearOutlined, FileExcelOutlined,
  EditOutlined, DeleteOutlined, SaveOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { api } from '../services/api'
import { isAdmin } from '../services/auth'

const { Text } = Typography
const { RangePicker } = DatePicker

function generarMeses() {
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  const opciones = []
  for (let y = 2027; y >= 2024; y--)
    for (let i = 11; i >= 0; i--) opciones.push(`${meses[i]}-${y}`)
  return opciones
}
const MESES = generarMeses()

const fmt = n => '$ ' + Math.round(parseFloat(n) || 0).toLocaleString('es-CO')
const fmtMes = m => {
  if (!m || String(m).startsWith('undefined')) return ''
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  const match = String(m).match(/^(\d{4})-(\d{2})/)
  if (match) return `${meses[parseInt(match[2]) - 1]}-${match[1]}`
  return String(m)
  return m
}
const fmtFecha = f => {
  if (!f) return ''
  return new Date(f + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const CONCEPTOS_ING = [
  { value: '11', label: '11 — Conserjería (casa)' },
  { value: '12', label: '12 — Conserjería (vehículo)' },
  { value: '13', label: '13 — Casa y vehículo(s)' },
  { value: '14', label: '14 — Segundo vehículo' },
  { value: '15', label: '15 — Vehículo externo' },
  { value: '16', label: '16 — Parqueadero externo' },
  { value: '17', label: '17 — Parqueadero moto' },
  { value: '18', label: '18 — Moto externa' },
  { value: '19', label: '19 — Otros' },
  { value: '20', label: '20 — Aporte contributivo' },
]

const CONCEPTOS_SAL = [
  { value: '21', label: '21 — Vigilancia' },
  { value: '22', label: '22 — Cafetería' },
  { value: '23', label: '23 — Aseo' },
  { value: '24', label: '24 — Papelería' },
  { value: '25', label: '25 — Otros' },
  { value: '26', label: '26 — Mantenimiento Gral.' },
  { value: '27', label: '27 — Servicios públicos' },
  { value: '28', label: '28 — Internet/Cel. Garita' },
  { value: '29', label: '29 — Reconocimiento gestión admin.' },
]

function exportarCSV(tipo, datos) {
  if (!datos.length) { message.warning('No hay datos para exportar.'); return }
  let csv, filename
  if (tipo === 'ing') {
    const headers = ['Recibo','Fecha','Interior','Nombre','Cod Admin','Administrador','Cod Concepto','Concepto','Vlr Admón','Vlr Vehículo','Mes Pago','Cantidad','Total','Observación']
    const rows = datos.map(r => [r.factura,r.fecha,r.interior,r.nombre,r.cod_admin,r.administrador,r.cod_concepto,r.concepto,r.vlr_admon,r.vlr_vehiculo,r.mes_pago,r.cantidad,r.total,r.observacion].map(c => `"${c ?? ''}"`).join(','))
    csv = [headers.join(','), ...rows].join('\n')
    filename = `NK2_Ingresos_${new Date().toISOString().slice(0,10)}.csv`
  } else {
    const headers = ['N° Registro','Fecha','Cod Admin','Administrador','Cod Concepto','Concepto','Vlr Total','Abono','Saldo','Observación']
    const rows = datos.map(r => [r.cod_registro,r.fecha,r.cod_admin,r.administrador,r.cod_concepto,r.concepto,r.vlr_total,r.abono,r.saldo,r.observacion].map(c => `"${c ?? ''}"`).join(','))
    csv = [headers.join(','), ...rows].join('\n')
    filename = `NK2_Salidas_${new Date().toISOString().slice(0,10)}.csv`
  }
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}

// ═══════════════════════════════════════════
// TAB INGRESOS
// ═══════════════════════════════════════════
function TabIngresos({ datos, habitantes, onActualizar, dupIng }) {
  const [filtros, setFiltros] = useState({ interior: '', recibo: '', concepto: '', rango: null })
  const [editRecord, setEditRecord] = useState(null)
  const [editForm] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [editTotal, setEditTotal] = useState(0)
  const [soloDups, setSoloDups] = useState(false)

  const filtrado = useMemo(() => {
    let d = [...datos]
    if (filtros.interior) d = d.filter(r => String(r.interior) === filtros.interior)
    if (filtros.recibo)   d = d.filter(r => String(r.factura) === filtros.recibo)
    if (filtros.concepto) d = d.filter(r => String(r.cod_concepto) === filtros.concepto)
    if (filtros.rango?.[0]) d = d.filter(r => r.fecha >= filtros.rango[0].format('YYYY-MM-DD'))
    if (filtros.rango?.[1]) d = d.filter(r => r.fecha <= filtros.rango[1].format('YYYY-MM-DD'))
    if (soloDups) d = d.filter(r => dupIng.has(String(r.factura)))
    return d
  }, [datos, filtros, soloDups, dupIng])

  const totalSum = filtrado.reduce((s, r) => s + (parseFloat(r.total) || 0), 0)

  function abrirEdit(r) {
    setEditRecord(r)
    const a = parseFloat(r.vlr_admon) || 0
    const v = parseFloat(r.vlr_vehiculo) || 0
    const c = parseInt(r.cantidad) || 1
    setEditTotal(a + v)
    editForm.setFieldsValue({
      fecha:        dayjs(r.fecha),
      recibo:       r.factura,
      interior:     String(r.interior),
      nombre:       r.nombre,
      concepto:     String(r.cod_concepto),
      vlr_admon:    a,
      vlr_vehiculo: v,
      mes_pago:     r.mes_pago || '',
      cantidad:     c,
      observacion:  r.observacion || '',
    })
  }

  async function guardarEdit(values) {
    const a = values.vlr_admon || 0
    const v = values.vlr_vehiculo || 0
    const c = values.cantidad || 1
    const concOpt = CONCEPTOS_ING.find(x => x.value === values.concepto)
    setSaving(true)
    try {
      await api.updateIngreso({
        id:           editRecord.id,
        factura:      values.recibo,
        fecha:        values.fecha.format('YYYY-MM-DD'),
        interior:     values.interior,
        nombre:       values.nombre || '',
        cod_admin:    editRecord.cod_admin || '',
        administrador: editRecord.administrador || '',
        cod_concepto: values.concepto,
        concepto:     concOpt?.label.split(' — ')[1] || '',
        vlr_admon: a, vlr_vehiculo: v,
        cantidad: c, total: a + v,
        mes_pago: values.mes_pago,
        observacion: values.observacion,
      })
      message.success('Ingreso actualizado correctamente.')
      setEditRecord(null)
      onActualizar()
    } catch (e) { message.error(e.message || 'Error de conexión.') }
    setSaving(false)
  }

  async function eliminar(r) {
    Modal.confirm({
      title: '¿Eliminar registro?',
      content: 'Esta acción no se puede deshacer.',
      okText: 'Sí, eliminar', okType: 'danger', cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await api.deleteIngreso({ id: r.id })
          message.success('Registro eliminado.')
          onActualizar()
        } catch (e) { message.error(e.message || 'Error de conexión.') }
      }
    })
  }

  const columns = [
    { title: 'Recibo', dataIndex: 'factura', key: 'recibo',
      render: v => (
        <Space size={4}>
          <Tag color="green">{v}</Tag>
          {dupIng.has(String(v)) && <span style={{ color: '#c0392b', fontSize: 10, fontWeight: 700 }}>DUP</span>}
        </Space>
      ),
      sorter: (a,b) => a.factura - b.factura },
    { title: 'Fecha',     dataIndex: 'fecha',        key: 'fecha',     render: v => fmtFecha(v), sorter: (a,b) => a.fecha.localeCompare(b.fecha) },
    { title: 'Interior',  dataIndex: 'interior',     key: 'interior' },
    { title: 'Nombre',    dataIndex: 'nombre',       key: 'nombre' },
    { title: 'Concepto',  key: 'concepto',           render: (_, r) => `${r.cod_concepto} — ${r.concepto}` },
    { title: 'Mes pago',  dataIndex: 'mes_pago',     key: 'mes',       render: v => fmtMes(v) },
    { title: 'Vlr Admón', dataIndex: 'vlr_admon',    key: 'admon',     render: v => fmt(v), align: 'right' },
    { title: 'Vehículo',  dataIndex: 'vlr_vehiculo', key: 'vehiculo',  render: v => fmt(v), align: 'right' },
    { title: 'Total',     dataIndex: 'total',        key: 'total',     render: v => <Text strong style={{ color: '#1a5c2a' }}>{fmt(v)}</Text>, align: 'right', sorter: (a,b) => (parseFloat(a.total)||0) - (parseFloat(b.total)||0) },
    { title: 'Observación', dataIndex: 'observacion', key: 'obs', ellipsis: true, width: 160 },
    {
      title: 'Acciones', key: 'acc', fixed: 'right', width: 110,
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} type="primary" ghost onClick={() => abrirEdit(r)} style={{ borderColor: '#854f0b', color: '#854f0b' }} />
          <Button size="small" icon={<DeleteOutlined />} danger onClick={() => eliminar(r)} />
        </Space>
      )
    }
  ]

  return (
    <>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="bottom">
          <Col xs={24} sm={12} md={6}>
            <div style={{ fontSize: 11, color: '#6b6b66', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.8px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600 }}>Interior</div>
            <Select allowClear placeholder="Todos" style={{ width: '100%' }} value={filtros.interior || undefined}
              onChange={v => setFiltros(f => ({ ...f, interior: v || '' }))}
              options={habitantes.map(h => ({ value: h.interior, label: `${h.interior} — ${h.nombre}` }))}
              showSearch optionFilterProp="label" />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <div style={{ fontSize: 11, color: '#6b6b66', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.8px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600 }}>N° Recibo</div>
            <Input placeholder="Ej: 10815" value={filtros.recibo} onChange={e => setFiltros(f => ({ ...f, recibo: e.target.value }))} />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div style={{ fontSize: 11, color: '#6b6b66', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.8px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600 }}>Concepto</div>
            <Select allowClear placeholder="Todos" style={{ width: '100%' }} value={filtros.concepto || undefined}
              onChange={v => setFiltros(f => ({ ...f, concepto: v || '' }))} options={CONCEPTOS_ING} />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div style={{ fontSize: 11, color: '#6b6b66', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.8px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600 }}>Rango fechas</div>
            <RangePicker style={{ width: '100%' }} value={filtros.rango} onChange={v => setFiltros(f => ({ ...f, rango: v }))} format="YYYY-MM-DD" />
          </Col>
          <Col xs={24} sm={24} md={2}>
            <Button icon={<ClearOutlined />} onClick={() => setFiltros({ interior: '', recibo: '', concepto: '', rango: null })} block>Limpiar</Button>
          </Col>
        </Row>
        <Row style={{ marginTop: 10 }}>
          <Col>
            <Button icon={<FileExcelOutlined />} onClick={() => exportarCSV('ing', filtrado)}
              style={{ background: '#1d6f42', borderColor: '#1d6f42', color: '#fff' }}>Exportar CSV</Button>
          </Col>
        </Row>
      </Card>

      {dupIng.size > 0 && (
        <Alert
          type="warning"
          style={{ marginBottom: 16 }}
          message={
            <span>
              <strong>Recibos duplicados en el sistema:</strong>{' '}
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>
                {[...dupIng].sort((a,b) => Number(a)-Number(b)).join(' · ')}
              </span>
            </span>
          }
          action={
            <Space>
              {!soloDups
                ? <Button size="small" onClick={() => setSoloDups(true)} style={{ borderColor: '#854f0b', color: '#854f0b' }}>Ver solo duplicados</Button>
                : <Button size="small" onClick={() => setSoloDups(false)}>Ver todos</Button>
              }
            </Space>
          }
        />
      )}

      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8}><Card size="small"><Statistic title="Registros" value={filtrado.length} valueStyle={{ fontFamily: 'IBM Plex Mono, monospace' }} /></Card></Col>
        <Col xs={12} sm={8}><Card size="small"><Statistic title="Total ingresos" value={fmt(totalSum)} valueStyle={{ color: '#1a5c2a', fontFamily: 'IBM Plex Mono, monospace', fontSize: 16 }} /></Card></Col>
      </Row>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table dataSource={filtrado} columns={columns} rowKey="id" size="small" scroll={{ x: 1100 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: t => `${t} registros` }}
          locale={{ emptyText: 'No se encontraron registros' }}
          rowClassName={r => dupIng.has(String(r.factura)) ? 'dup-row' : ''} />
      </Card>

      <Modal open={!!editRecord} title="Editar Ingreso" onCancel={() => setEditRecord(null)} footer={null} width={700} destroyOnHidden>
        <Form form={editForm} layout="vertical" onFinish={guardarEdit} style={{ marginTop: 12 }}
          onValuesChange={(_, vals) => setEditTotal((vals.vlr_admon||0) + (vals.vlr_vehiculo||0))}>
          <Row gutter={12}>
            <Col span={6}><Form.Item label="Fecha" name="fecha"><DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" /></Form.Item></Col>
            <Col span={6}><Form.Item label="N° Recibo" name="recibo"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}><Form.Item label="Interior" name="interior"><Input /></Form.Item></Col>
            <Col span={6}><Form.Item label="Nombre" name="nombre"><Input /></Form.Item></Col>
          </Row>
          <Form.Item label="Concepto" name="concepto"><Select options={CONCEPTOS_ING} /></Form.Item>
          <Row gutter={12}>
            <Col span={6}><Form.Item label="Vlr Admón" name="vlr_admon"><InputNumber style={{ width: '100%' }} min={0} step={1000} /></Form.Item></Col>
            <Col span={6}><Form.Item label="Vlr Vehículo" name="vlr_vehiculo"><InputNumber style={{ width: '100%' }} min={0} step={1000} /></Form.Item></Col>
            <Col span={6}>
              <Form.Item label="Mes pago" name="mes_pago" rules={[{ required: true, message: 'Requerido' }]}>
                <Select showSearch optionFilterProp="label" placeholder="-- seleccionar --"
                  options={MESES.map(m => ({ value: m, label: m }))} />
              </Form.Item>
            </Col>
            <Col span={6}><Form.Item label="Cantidad" name="cantidad"><InputNumber style={{ width: '100%' }} min={1} /></Form.Item></Col>
          </Row>
          <Form.Item label="Observación" name="observacion"><Input.TextArea rows={2} /></Form.Item>
          <div style={{ background: '#f6fdf8', border: '1px solid #d4edda', borderRadius: 6, padding: '10px 14px', marginBottom: 12 }}>
            <Row justify="space-between" align="middle">
              <Text style={{ fontSize: 13 }}>Total calculado</Text>
              <Text strong style={{ color: '#1a5c2a', fontSize: 15, fontFamily: 'IBM Plex Mono, monospace' }}>{fmt(editTotal)}</Text>
            </Row>
          </div>
          <Row justify="end" gutter={8}>
            <Col><Button onClick={() => setEditRecord(null)}>Cancelar</Button></Col>
            <Col><Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />} style={{ background: '#1a5c2a', borderColor: '#1a5c2a' }}>Guardar cambios</Button></Col>
          </Row>
        </Form>
      </Modal>
    </>
  )
}

// ═══════════════════════════════════════════
// TAB SALIDAS
// ═══════════════════════════════════════════
function TabSalidas({ datos, onActualizar, dupSal }) {
  const [filtros, setFiltros] = useState({ cod: '', concepto: '', rango: null })
  const [editRecord, setEditRecord] = useState(null)
  const [editForm] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [soloDups, setSoloDups] = useState(false)

  const filtrado = useMemo(() => {
    let d = [...datos]
    if (filtros.cod)     d = d.filter(r => String(r.cod_registro).toLowerCase().includes(filtros.cod.toLowerCase()))
    if (filtros.concepto) d = d.filter(r => String(r.cod_concepto) === filtros.concepto)
    if (filtros.rango?.[0]) d = d.filter(r => r.fecha >= filtros.rango[0].format('YYYY-MM-DD'))
    if (filtros.rango?.[1]) d = d.filter(r => r.fecha <= filtros.rango[1].format('YYYY-MM-DD'))
    if (soloDups) d = d.filter(r => dupSal.has(r.cod_registro))
    return d
  }, [datos, filtros, soloDups, dupSal])

  const totalSum = filtrado.reduce((s, r) => s + (parseFloat(r.vlr_total) || 0), 0)
  const abonoSum = filtrado.reduce((s, r) => s + (parseFloat(r.abono)     || 0), 0)
  const saldoSum = filtrado.reduce((s, r) => s + (parseFloat(r.saldo)     || 0), 0)

  function abrirEdit(r) {
    setEditRecord(r)
    editForm.setFieldsValue({
      fecha:         dayjs(r.fecha),
      cod_registro:  r.cod_registro,
      administrador: r.administrador,
      concepto:      String(r.cod_concepto),
      vlr_total:     parseFloat(r.vlr_total) || 0,
      abono:         parseFloat(r.abono)     || 0,
      observacion:   r.observacion || '',
    })
  }

  async function guardarEdit(values) {
    const concOpt = CONCEPTOS_SAL.find(x => x.value === values.concepto)
    const total = values.vlr_total || 0
    const abono = values.abono || 0
    setSaving(true)
    try {
      await api.updateSalida({
        id:            editRecord.id,
        cod_registro:  values.cod_registro,
        fecha:         values.fecha.format('YYYY-MM-DD'),
        administrador: values.administrador,
        cod_concepto:  values.concepto,
        concepto:      concOpt?.label.split(' — ')[1] || '',
        vlr_total: total, abono, saldo: total - abono,
        observacion: values.observacion,
      })
      message.success('Salida actualizada correctamente.')
      setEditRecord(null)
      onActualizar()
    } catch (e) { message.error(e.message || 'Error de conexión.') }
    setSaving(false)
  }

  async function eliminar(r) {
    Modal.confirm({
      title: '¿Eliminar registro?',
      content: 'Esta acción no se puede deshacer.',
      okText: 'Sí, eliminar', okType: 'danger', cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await api.deleteSalida({ id: r.id })
          message.success('Registro eliminado.')
          onActualizar()
        } catch (e) { message.error(e.message || 'Error de conexión.') }
      }
    })
  }

  const columns = [
    { title: 'N° Reg.', dataIndex: 'cod_registro', key: 'cod',
      render: v => (
        <Space size={4}>
          <Tag color="red">{v}</Tag>
          {dupSal.has(v) && <span style={{ color: '#c0392b', fontSize: 10, fontWeight: 700 }}>DUP</span>}
        </Space>
      )
    },
    { title: 'Fecha',        dataIndex: 'fecha',          key: 'fecha',  render: v => fmtFecha(v), sorter: (a,b) => a.fecha.localeCompare(b.fecha) },
    { title: 'Administrador',dataIndex: 'administrador',  key: 'admin' },
    { title: 'Concepto',     key: 'concepto',             render: (_, r) => `${r.cod_concepto} — ${r.concepto}` },
    { title: 'Vlr Total',    dataIndex: 'vlr_total',      key: 'total',  render: v => <Text style={{ color: '#7a1a1a' }}>{fmt(v)}</Text>, align: 'right', sorter: (a,b) => (parseFloat(a.vlr_total)||0) - (parseFloat(b.vlr_total)||0) },
    { title: 'Abono',        dataIndex: 'abono',          key: 'abono',  render: v => fmt(v), align: 'right' },
    { title: 'Saldo',        dataIndex: 'saldo',          key: 'saldo',  render: v => <Text style={{ color: parseFloat(v) > 0 ? '#854f0b' : '#1a5c2a' }}>{fmt(v)}</Text>, align: 'right' },
    { title: 'Observación',  dataIndex: 'observacion',    key: 'obs',    ellipsis: true, width: 160 },
    {
      title: 'Acciones', key: 'acc', fixed: 'right', width: 110,
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} type="primary" ghost onClick={() => abrirEdit(r)} style={{ borderColor: '#854f0b', color: '#854f0b' }} />
          <Button size="small" icon={<DeleteOutlined />} danger onClick={() => eliminar(r)} />
        </Space>
      )
    }
  ]

  return (
    <>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="bottom">
          <Col xs={24} sm={12} md={6}>
            <div style={{ fontSize: 11, color: '#6b6b66', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.8px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600 }}>N° Registro</div>
            <Input placeholder="Ej: NK-38" value={filtros.cod} onChange={e => setFiltros(f => ({ ...f, cod: e.target.value }))} />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div style={{ fontSize: 11, color: '#6b6b66', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.8px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600 }}>Concepto</div>
            <Select allowClear placeholder="Todos" style={{ width: '100%' }} value={filtros.concepto || undefined}
              onChange={v => setFiltros(f => ({ ...f, concepto: v || '' }))} options={CONCEPTOS_SAL} />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div style={{ fontSize: 11, color: '#6b6b66', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.8px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600 }}>Rango fechas</div>
            <RangePicker style={{ width: '100%' }} value={filtros.rango} onChange={v => setFiltros(f => ({ ...f, rango: v }))} format="YYYY-MM-DD" />
          </Col>
          <Col xs={12} sm={6} md={2}>
            <Button icon={<ClearOutlined />} onClick={() => setFiltros({ cod: '', concepto: '', rango: null })} block>Limpiar</Button>
          </Col>
        </Row>
        <Row style={{ marginTop: 10 }}>
          <Col>
            <Button icon={<FileExcelOutlined />} onClick={() => exportarCSV('sal', filtrado)}
              style={{ background: '#1d6f42', borderColor: '#1d6f42', color: '#fff' }}>Exportar CSV</Button>
          </Col>
        </Row>
      </Card>

      {dupSal.size > 0 && (
        <Alert
          type="warning"
          style={{ marginBottom: 16 }}
          message={
            <span>
              <strong>Registros duplicados en el sistema:</strong>{' '}
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>
                {[...dupSal].sort().join(' · ')}
              </span>
            </span>
          }
          action={
            <Space>
              {!soloDups
                ? <Button size="small" onClick={() => setSoloDups(true)} style={{ borderColor: '#7a1a1a', color: '#7a1a1a' }}>Ver solo duplicados</Button>
                : <Button size="small" onClick={() => setSoloDups(false)}>Ver todos</Button>
              }
            </Space>
          }
        />
      )}

      <Row gutter={12} style={{ marginBottom: 16 }}>
        {[
          { title: 'Registros',      value: filtrado.length },
          { title: 'Total salidas',  value: fmt(totalSum), color: '#7a1a1a' },
          { title: 'Total abonos',   value: fmt(abonoSum), color: '#854f0b' },
          { title: 'Saldo pendiente',value: fmt(saldoSum), color: '#854f0b' },
        ].map(s => (
          <Col xs={12} sm={6} key={s.title}>
            <Card size="small"><Statistic title={s.title} value={s.value} valueStyle={{ color: s.color, fontFamily: 'IBM Plex Mono, monospace', fontSize: 15 }} /></Card>
          </Col>
        ))}
      </Row>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table dataSource={filtrado} columns={columns} rowKey="id" size="small" scroll={{ x: 900 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: t => `${t} registros` }}
          locale={{ emptyText: 'No se encontraron registros' }}
          rowClassName={r => dupSal.has(r.cod_registro) ? 'dup-row' : ''} />
      </Card>

      <Modal open={!!editRecord} title="Editar Salida" onCancel={() => setEditRecord(null)} footer={null} width={600} destroyOnHidden>
        <Form form={editForm} layout="vertical" onFinish={guardarEdit} style={{ marginTop: 12 }}>
          <Row gutter={12}>
            <Col span={8}><Form.Item label="Fecha" name="fecha"><DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" /></Form.Item></Col>
            <Col span={8}><Form.Item label="N° Registro" name="cod_registro"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item label="Administrador" name="administrador"><Input /></Form.Item></Col>
          </Row>
          <Form.Item label="Concepto" name="concepto"><Select options={CONCEPTOS_SAL} /></Form.Item>
          <Row gutter={12}>
            <Col span={8}><Form.Item label="Vlr Total" name="vlr_total"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
            <Col span={8}><Form.Item label="Abono" name="abono"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
            <Col span={8}><Form.Item label="Observación" name="observacion"><Input /></Form.Item></Col>
          </Row>
          <Row justify="end" gutter={8}>
            <Col><Button onClick={() => setEditRecord(null)}>Cancelar</Button></Col>
            <Col><Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />} style={{ background: '#7a1a1a', borderColor: '#7a1a1a' }}>Guardar cambios</Button></Col>
          </Row>
        </Form>
      </Modal>
    </>
  )
}

// ═══════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════
export default function Consulta() {
  const [ingresos,   setIngresos]   = useState([])
  const [salidas,    setSalidas]    = useState([])
  const [habitantes, setHabitantes] = useState([])
  const [loading,    setLoading]    = useState(true)

  const dupIng = useMemo(() => {
    const conteo = {}
    ingresos.forEach(r => { const k = String(r.factura); conteo[k] = (conteo[k]||0)+1 })
    return new Set(Object.keys(conteo).filter(k => conteo[k] > 1))
  }, [ingresos])

  const dupSal = useMemo(() => {
    const conteo = {}
    salidas.forEach(r => { const k = r.cod_registro; conteo[k] = (conteo[k]||0)+1 })
    return new Set(Object.keys(conteo).filter(k => conteo[k] > 1))
  }, [salidas])

  async function cargarTodo() {
    setLoading(true)
    try {
      const [ing, sal, hab] = await Promise.all([
        api.getIngresos(), api.getSalidas(), api.getHabitantes()
      ])
      setIngresos(ing || [])
      setSalidas(sal || [])
      setHabitantes(hab || [])
    } catch { message.error('Error al conectar con la API.') }
    setLoading(false)
  }

  useEffect(() => { cargarTodo() }, [])

  const tabs = [
    {
      key: 'ing',
      label: <span style={{ color: '#1a5c2a', fontWeight: 500 }}>Ingresos</span>,
      children: <TabIngresos datos={ingresos} habitantes={habitantes} onActualizar={cargarTodo} dupIng={dupIng} />,
    },
    {
      key: 'sal',
      label: <span style={{ color: '#7a1a1a', fontWeight: 500 }}>Salidas</span>,
      children: <TabSalidas datos={salidas} onActualizar={cargarTodo} dupSal={dupSal} />,
    },
  ]

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      <Card styles={{ body: { padding: 0 } }} bordered style={{ overflow: 'hidden' }}>
        <div style={{ background: '#1a1a18', padding: '10px 18px' }}>
          <Text style={{ color: '#fff', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            Consultas — Nuevo Kennedy II Sector
          </Text>
        </div>
        <div style={{ padding: '0 18px 18px' }}>
          <Tabs items={tabs} destroyInactiveTabPane={false} />
        </div>
      </Card>
    </div>
  )
}
