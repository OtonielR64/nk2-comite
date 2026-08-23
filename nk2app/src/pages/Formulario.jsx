import { useState, useEffect } from 'react'
import {
  Form, Input, InputNumber, Select, DatePicker, Button,
  Card, Tabs, Row, Col, Typography, Divider,
  message, Spin
} from 'antd'
import { SaveOutlined, ClearOutlined, CloseOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { api } from '../services/api'

const { Text } = Typography
const { TextArea } = Input

const fmt = n => '$ ' + Math.round(n || 0).toLocaleString('es-CO')

const CONCEPTOS_ING = [
  { value: '11', label: '11 — Conserjería (casa)' },
  { value: '12', label: '12 — Conserjería (vehículo)' },
  { value: '13', label: '13 — Conserjería casa y vehículo(s)' },
  { value: '14', label: '14 — Conserjería segundo vehículo' },
  { value: '15', label: '15 — Conserjería vehículo externo' },
  { value: '16', label: '16 — Conserjería parqueadero externo (hrs)' },
  { value: '17', label: '17 — Conserjería parqueadero moto' },
  { value: '18', label: '18 — Conserjería moto externa' },
  { value: '19', label: '19 — Otros…' },
  { value: '20', label: '20 — Aporte contributivo' },
]

const CONCEPTOS_SAL = [
  { value: '21', label: '21 — Servicio de vigilancia' },
  { value: '22', label: '22 — Insumos cafetería' },
  { value: '23', label: '23 — Insumos aseo' },
  { value: '24', label: '24 — Insumo papelería' },
  { value: '25', label: '25 — Otros…' },
  { value: '26', label: '26 — Mantenimiento Gral./Áreas comunes' },
  { value: '27', label: '27 — Servicios públicos' },
  { value: '28', label: '28 — Servicio Internet/Recarga celular Garita' },
  { value: '29', label: '29 — Reconocimiento gestión administrativa' },
]

function generarMeses() {
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  const opciones = []
  for (let y = 2027; y >= 2024; y--) {
    for (let i = 11; i >= 0; i--) opciones.push(`${meses[i]}-${y}`)
  }
  return opciones
}
const MESES = generarMeses()
const mesActual = (() => {
  const h = new Date()
  const m = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${m[h.getMonth()]}-${h.getFullYear()}`
})()

function estadoCampos(cod) {
  const n = parseInt(cod)
  if ([11, 19, 20].includes(n))             return { admon: true,  vehiculo: false }
  if ([12, 14, 15, 16, 17, 18].includes(n)) return { admon: false, vehiculo: true  }
  if (n === 13)                             return { admon: true,  vehiculo: true  }
  return { admon: true, vehiculo: true }
}

// ═══════════════════════════════════════════
// TAB INGRESO
// ═══════════════════════════════════════════
function TabIngreso({ habitantes, personal, totales, onGuardado }) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [campos, setCampos] = useState({ admon: true, vehiculo: true })
  const [totalPagar, setTotalPagar] = useState(0)

  function calcTotal() {
    const a = form.getFieldValue('vlr_admon') || 0
    const v = form.getFieldValue('vlr_vehiculo') || 0
    const c = form.getFieldValue('cantidad') || 1
    setTotalPagar((a + v) * c)
  }

  function onConceptoChange(val) {
    const est = estadoCampos(val)
    setCampos(est)
    if (!est.admon) form.setFieldValue('vlr_admon', 0)
    if (!est.vehiculo) form.setFieldValue('vlr_vehiculo', 0)
    calcTotal()
  }

  function onInteriorChange(val) {
    const hab = habitantes.find(h => h.interior === val)
    form.setFieldValue('nombre', hab?.nombre || '')
  }

  async function onFinish(values) {
    const selAdmin = personal.find(p => String(p.id) === String(values.administrador))
    const concOpt  = CONCEPTOS_ING.find(c => c.value === values.concepto)
    const datos = {
      factura:      values.recibo,
      fecha:        values.fecha.format('YYYY-MM-DD'),
      interior:     values.interior,
      nombre:       values.nombre || '',
      cod_admin:    selAdmin?.id || '',
      administrador: selAdmin?.nombre || '',
      cod_concepto: values.concepto,
      concepto:     concOpt?.label.split(' — ')[1] || '',
      vlr_admon:    campos.admon    ? (values.vlr_admon    || 0) : 0,
      vlr_vehiculo: campos.vehiculo ? (values.vlr_vehiculo || 0) : 0,
      mes_pago:     values.mes_pago,
      cantidad:     values.cantidad,
      total:        totalPagar,
      observacion:  values.observacion.trim(),
    }
    setLoading(true)
    try {
      const res = await api.saveIngreso(datos)
      message.success(res.mensaje)
      onGuardado()
      limpiar()
    } catch (e) {
      message.error(e.message || 'Error de conexión con la API.')
    }
    setLoading(false)
  }

  async function limpiar() {
    try {
      const r = await api.getNextRecibo()
      form.resetFields()
      form.setFieldsValue({
        fecha: dayjs(),
        recibo: r.next,
        cantidad: 1,
        mes_pago: mesActual,
        vlr_admon: 0,
        vlr_vehiculo: 0,
      })
    } catch {
      form.resetFields()
    }
    setCampos({ admon: true, vehiculo: true })
    setTotalPagar(0)
  }

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ fecha: dayjs(), cantidad: 1, mes_pago: mesActual, vlr_admon: 0, vlr_vehiculo: 0 }}
      onFinish={onFinish}
      onValuesChange={calcTotal}
    >
      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item label="Fecha" name="fecha" rules={[{ required: true, message: 'Requerido' }]}>
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="N° Recibo" name="recibo" rules={[{ required: true, message: 'Requerido' }]}
            extra={<Text type="secondary" style={{ fontSize: 11 }}>Editable — ajusta si es retroactivo</Text>}>
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item label="Interior" name="interior" rules={[{ required: true, message: 'Requerido' }]}>
            <Select
              showSearch placeholder="-- seleccionar --" optionFilterProp="label"
              onChange={onInteriorChange}
              options={habitantes.map(h => ({ value: h.interior, label: `${h.interior} — ${h.nombre}` }))}
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="Nombre" name="nombre">
            <Input readOnly style={{ background: '#fafaf8' }} placeholder="Autocompleta al seleccionar interior" />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item label="Administrador" name="administrador" rules={[{ required: true, message: 'Requerido' }]}>
        <Select placeholder="-- seleccionar --"
          options={personal.map(p => ({ value: String(p.id), label: `${p.nombre} — ${p.cargo}` }))} />
      </Form.Item>

      <Form.Item label="Concepto" name="concepto" rules={[{ required: true, message: 'Requerido' }]}>
        <Select placeholder="-- seleccionar --" onChange={onConceptoChange}
          options={CONCEPTOS_ING.map(c => ({ value: c.value, label: c.label }))} />
      </Form.Item>

      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item label="Valor Admón ($)" name="vlr_admon" rules={[{ required: campos.admon, message: 'Requerido' }]}>
            <InputNumber style={{ width: '100%' }} min={0} step={1000} disabled={!campos.admon}
              formatter={v => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={v => v.replace(/\$\s?|(,*)/g, '')} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="Vehículo(s) ($)" name="vlr_vehiculo" rules={[{ required: campos.vehiculo, message: 'Requerido' }]}>
            <InputNumber style={{ width: '100%' }} min={0} step={1000} disabled={!campos.vehiculo}
              formatter={v => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={v => v.replace(/\$\s?|(,*)/g, '')} />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item label="Mes de pago" name="mes_pago" rules={[{ required: true, message: 'Requerido' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="-- seleccionar --"
              options={MESES.map(m => ({ value: m, label: m }))}
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="Cantidad de meses" name="cantidad" rules={[{ required: true, message: 'Mínimo 1' }]}>
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item label="Observación" name="observacion" rules={[{ required: true, message: 'Requerido' }]}>
        <TextArea rows={2} placeholder="Ej: Placa EBR621, saldo pendiente..." />
      </Form.Item>

      <div style={{ background: '#fafaf8', border: '1px solid #dddbd6', borderRadius: 6, padding: '14px 16px', marginBottom: 16 }}>
        <Row justify="space-between" align="middle" style={{ borderBottom: '1px solid #dddbd6', paddingBottom: 10, marginBottom: 10 }}>
          <Text style={{ fontSize: 14 }}>Total a pagar</Text>
          <Text strong style={{ color: '#1a5c2a', fontSize: 16, fontFamily: 'IBM Plex Mono, monospace' }}>{fmt(totalPagar)}</Text>
        </Row>
        {totales && <>
          <Row justify="space-between">
            <Text type="secondary" style={{ fontSize: 12 }}>Base Ingr. al 31 dic/25</Text>
            <Text style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>{fmt(totales.base)}</Text>
          </Row>
          <Row justify="space-between" style={{ marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Total ingresos</Text>
            <Text style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>{fmt(totales.totalIngresos)}</Text>
          </Row>
          <Row justify="space-between" style={{ marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Saldo en caja</Text>
            <Text style={{ color: '#1a5c2a', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, fontWeight: 600 }}>{fmt(totales.saldo)}</Text>
          </Row>
        </>}
      </div>

      <Row gutter={10}>
        <Col span={8}><Button block type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />} style={{ background: '#1a5c2a', borderColor: '#1a5c2a' }}>Guardar</Button></Col>
        <Col span={8}><Button block icon={<ClearOutlined />} onClick={limpiar}>Limpiar</Button></Col>
        <Col span={8}><Button block icon={<CloseOutlined />} onClick={limpiar} style={{ background: '#4a4a4a', borderColor: '#4a4a4a', color: '#fff' }}>Cancelar</Button></Col>
      </Row>
    </Form>
  )
}

// ═══════════════════════════════════════════
// TAB SALIDA
// ═══════════════════════════════════════════
function TabSalida({ personal, totales, onGuardado }) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [vals, setVals] = useState({ total: 0, abono: 0 })

  const saldo = Math.max(0, (vals.total || 0) - (vals.abono || 0))

  async function onFinish(values) {
    const selAdmin = personal.find(p => String(p.id) === String(values.administrador))
    const concOpt  = CONCEPTOS_SAL.find(c => c.value === values.concepto)
    const datos = {
      cod_registro:  values.cod_registro.trim(),
      fecha:         values.fecha.format('YYYY-MM-DD'),
      cod_admin:     selAdmin?.id || '',
      administrador: selAdmin?.nombre || '',
      cod_concepto:  values.concepto,
      concepto:      concOpt?.label.split(' — ')[1] || '',
      vlr_total:     values.vlr_total,
      abono:         values.abono || 0,
      observacion:   values.observacion.trim(),
    }
    setLoading(true)
    try {
      const res = await api.saveSalida(datos)
      message.success(res.mensaje)
      onGuardado()
      limpiar()
    } catch (e) {
      message.error(e.message || 'Error de conexión con la API.')
    }
    setLoading(false)
  }

  async function limpiar() {
    try {
      const r = await api.getNextRegistro()
      form.resetFields()
      form.setFieldsValue({ fecha: dayjs(), cod_registro: r.next, vlr_total: 0, abono: 0 })
    } catch {
      form.resetFields()
    }
    setVals({ total: 0, abono: 0 })
  }

  return (
    <Form form={form} layout="vertical"
      initialValues={{ fecha: dayjs(), vlr_total: 0, abono: 0 }}
      onFinish={onFinish}
      onValuesChange={(_, all) => setVals({ total: all.vlr_total || 0, abono: all.abono || 0 })}>

      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item label="Fecha" name="fecha" rules={[{ required: true, message: 'Requerido' }]}>
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="N° Registro" name="cod_registro" rules={[{ required: true, message: 'Requerido' }]}
            extra={<Text type="secondary" style={{ fontSize: 11 }}>Editable — ajusta si es retroactivo</Text>}>
            <Input />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item label="Administrador que autoriza" name="administrador" rules={[{ required: true, message: 'Requerido' }]}>
        <Select placeholder="-- seleccionar --"
          options={personal.map(p => ({ value: String(p.id), label: `${p.nombre} — ${p.cargo}` }))} />
      </Form.Item>

      <Form.Item label="Concepto de egreso" name="concepto" rules={[{ required: true, message: 'Requerido' }]}>
        <Select placeholder="-- seleccionar --"
          options={CONCEPTOS_SAL.map(c => ({ value: c.value, label: c.label }))} />
      </Form.Item>

      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item label="Valor total ($)" name="vlr_total" rules={[{ required: true, message: 'Requerido' }, { type: 'number', min: 1, message: 'Debe ser mayor a cero' }]}>
            <InputNumber style={{ width: '100%' }} min={0} step={1000}
              formatter={v => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={v => v.replace(/\$\s?|(,*)/g, '')} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="Abono ($)" name="abono"
            extra={<Text type="secondary" style={{ fontSize: 11 }}>Dejar en 0 si es pago total</Text>}
            rules={[{ validator: (_, v) => (v || 0) <= (vals.total || 0) ? Promise.resolve() : Promise.reject('El abono no puede superar el total') }]}>
            <InputNumber style={{ width: '100%' }} min={0} step={1000}
              formatter={v => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={v => v.replace(/\$\s?|(,*)/g, '')} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item label="Observación / Descripción del gasto" name="observacion" rules={[{ required: true, message: 'Requerido' }]}>
        <TextArea rows={2} placeholder="Ej: Servicio de vigilancia 1ra quincena..." />
      </Form.Item>

      <div style={{ background: '#fafaf8', border: '1px solid #dddbd6', borderRadius: 6, padding: '14px 16px', marginBottom: 16 }}>
        <Row justify="space-between" align="middle" style={{ borderBottom: '1px solid #dddbd6', paddingBottom: 10, marginBottom: 10 }}>
          <Text style={{ fontSize: 14 }}>Valor total salida</Text>
          <Text strong style={{ color: '#7a1a1a', fontSize: 16, fontFamily: 'IBM Plex Mono, monospace' }}>{fmt(vals.total)}</Text>
        </Row>
        <Row justify="space-between">
          <Text type="secondary" style={{ fontSize: 12 }}>Abono registrado</Text>
          <Text style={{ color: '#854f0b', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>{fmt(vals.abono)}</Text>
        </Row>
        <Row justify="space-between" style={{ marginTop: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Saldo pendiente</Text>
          <Text style={{ color: saldo > 0 ? '#854f0b' : '#1a5c2a', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, fontWeight: 600 }}>{fmt(saldo)}</Text>
        </Row>
        {totales && <>
          <Divider style={{ margin: '10px 0' }} />
          <Row justify="space-between">
            <Text type="secondary" style={{ fontSize: 12 }}>Total salidas acumuladas</Text>
            <Text style={{ color: '#7a1a1a', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>{fmt(totales.totalSalidas)}</Text>
          </Row>
          <Row justify="space-between" style={{ marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Total ingresos</Text>
            <Text style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>{fmt(totales.totalIngresos)}</Text>
          </Row>
          <Row justify="space-between" style={{ marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Saldo en caja</Text>
            <Text style={{ color: '#1a5c2a', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, fontWeight: 600 }}>{fmt(totales.saldo)}</Text>
          </Row>
        </>}
      </div>

      <Row gutter={10}>
        <Col span={8}><Button block type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />} style={{ background: '#7a1a1a', borderColor: '#7a1a1a' }}>Guardar</Button></Col>
        <Col span={8}><Button block icon={<ClearOutlined />} onClick={limpiar}>Limpiar</Button></Col>
        <Col span={8}><Button block icon={<CloseOutlined />} onClick={limpiar} style={{ background: '#4a4a4a', borderColor: '#4a4a4a', color: '#fff' }}>Cancelar</Button></Col>
      </Row>
    </Form>
  )
}

// ═══════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════
export default function Formulario() {
  const [habitantes,   setHabitantes]   = useState([])
  const [personal,     setPersonal]     = useState([])
  const [totales,      setTotales]      = useState(null)
  const [loadingInit,  setLoadingInit]  = useState(true)

  async function cargarDatos() {
    try {
      const [hab, per, tots] = await Promise.all([
        api.getHabitantes(), api.getPersonal(), api.getTotales(),
      ])
      setHabitantes(hab)
      setPersonal(per)
      setTotales(tots)
    } catch {
      message.error('Error al conectar con la API.')
    }
    setLoadingInit(false)
  }

  useEffect(() => { cargarDatos() }, [])

  const spinner = <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
  const tabs = [
    {
      key: 'ing',
      label: <span style={{ color: '#1a5c2a', fontWeight: 500 }}>Registro de Ingreso</span>,
      children: loadingInit ? spinner : <TabIngreso habitantes={habitantes} personal={personal} totales={totales} onGuardado={cargarDatos} />,
    },
    {
      key: 'sal',
      label: <span style={{ color: '#7a1a1a', fontWeight: 500 }}>Registro de Salida</span>,
      children: loadingInit ? spinner : <TabSalida personal={personal} totales={totales} onGuardado={cargarDatos} />,
    },
  ]

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px' }}>
      <Card styles={{ body: { padding: 0 } }} bordered style={{ overflow: 'hidden' }}>
        <div style={{ background: '#1a5c2a', padding: '10px 18px' }}>
          <Text style={{ color: '#fff', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            Registro — Nuevo Kennedy II Sector
          </Text>
        </div>
        <div style={{ padding: '0 18px 18px' }}>
          <Tabs items={tabs} destroyInactiveTabPane={false} />
        </div>
      </Card>
    </div>
  )
}
