import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import WorkflowNav from '../components/WorkflowNav'
import { Button, Card } from '../components/ui'
import { useT } from '../i18n'

const MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

function getMonthsGrid(startYear, startMonth, count = 18) {
  const months = []
  let y = startYear, m = startMonth
  for (let i = 0; i < count; i++) {
    months.push({ year: y, month: m, key: `${y}-${String(m).padStart(2,'0')}` })
    m++; if (m > 12) { m = 1; y++ }
  }
  return months
}

function monthDiff(key1, key2) {
  // Nombre de mois entre key1 et key2 (peut être négatif)
  const [y1, m1] = key1.split('-').map(Number)
  const [y2, m2] = key2.split('-').map(Number)
  return (y2 - y1) * 12 + (m2 - m1)
}

function MonthPicker({ value, onChange, label }) {
  const [open, setOpen]     = useState(false)
  const [pos, setPos]       = useState({ top: 0, left: 0 })
  const now                 = new Date()
  const [viewYear, setViewYear] = useState(value ? parseInt(value.split('-')[0]) : now.getFullYear())
  const btnRef   = useRef()
  const panelRef = useRef()

  useEffect(() => {
    const handler = (e) => {
      if (
        btnRef.current   && !btnRef.current.contains(e.target) &&
        panelRef.current && !panelRef.current.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left })
    }
    setOpen(v => !v)
  }

  const display = value
    ? `${MONTHS_FR[parseInt(value.split('-')[1]) - 1]} ${value.split('-')[0]}`
    : label

  return (
    <>
      <button ref={btnRef} onClick={handleToggle}
        className={`text-[11px] px-2 py-1 rounded border cursor-pointer transition-colors whitespace-nowrap
          ${value ? 'bg-white border-neutral-300 text-neutral-700' : 'bg-white border-dashed border-neutral-300 text-neutral-400'}`}>
        {display}
      </button>
      {open && createPortal(
        <div ref={panelRef}
          className="fixed z-[9999] bg-white border border-neutral-200 rounded-xl shadow-lg p-3 w-52"
          style={{ top: pos.top, left: pos.left }}>
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setViewYear(v => v - 1)}
              className="text-neutral-400 border-none bg-transparent cursor-pointer hover:text-neutral-700">‹</button>
            <span className="text-[12px] font-medium">{viewYear}</span>
            <button onClick={() => setViewYear(v => v + 1)}
              className="text-neutral-400 border-none bg-transparent cursor-pointer hover:text-neutral-700">›</button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTHS_FR.map((m, i) => {
              const key = `${viewYear}-${String(i+1).padStart(2,'0')}`
              const isSelected = value === key
              return (
                <button key={key} onClick={() => { onChange(key); setOpen(false) }}
                  className={`text-[11px] py-1.5 rounded cursor-pointer transition-colors
                    ${isSelected ? 'bg-primary-50 text-primary-700 font-medium border border-primary-500' : 'hover:bg-neutral-50 text-neutral-700 border border-transparent'}`}>
                  {m}
                </button>
              )
            })}
          </div>
          {value && (
            <button onClick={() => { onChange(null); setOpen(false) }}
              className="w-full mt-2 text-[10px] text-neutral-400 border-none bg-transparent cursor-pointer hover:text-danger-700">
              Effacer
            </button>
          )}
        </div>,
        document.body
      )}
    </>
  )
}

export default function Gantt() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { t } = useT()
  const [data,     setData]     = useState(null)
  const [campaign, setCampaign] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState({})

  const now = new Date()
  const [gridStart] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const GRID_MONTHS = 18
  const months = getMonthsGrid(gridStart.year, gridStart.month, GRID_MONTHS)
  const COL_W = 52  // px par mois

  const PHASES = [
    { id: 'quick_win', label: t('phase.quick_win'), color: '#1D9E75', bg: '#E1F5EE' },
    { id: 'court',     label: t('phase.court'),     color: '#7F77DD', bg: '#EEEDFE' },
    { id: 'moyen',     label: t('phase.moyen'),     color: '#BA7517', bg: '#FAEEDA' },
    { id: 'long',      label: t('phase.long'),      color: '#888780', bg: '#F1EFE8' },
  ]

  useEffect(() => {
    Promise.all([api.campaigns.get(id), api.gantt.get(id)])
      .then(([c, d]) => { setCampaign(c); setData(d) })
      .finally(() => setLoading(false))
  }, [id])

  const handleUpdate = async (itemId, body) => {
    setSaving(s => ({ ...s, [itemId]: true }))
    try {
      const updated = await api.gantt.updateSchedule(id, itemId, body)
      setData(prev => ({
        ...prev,
        items: prev.items.map(i => i.id === itemId ? { ...i, ...updated } : i),
        by_phase: prev.by_phase.map(p => ({
          ...p,
          items: p.items.map(i => i.id === itemId ? { ...i, ...updated } : i)
        }))
      }))
    } finally {
      setSaving(s => ({ ...s, [itemId]: false }))
    }
  }

  if (loading)  return <p className="text-neutral-500 text-[13px]">{t('common.loading')}</p>
  if (!data)    return null

  const gridFirstKey = months[0].key
  const allScheduled = data.items.filter(i => i.start_month).length

  return (
    <div className="max-w-6xl">

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-1">
          <p className="m-0 mb-0.5 text-[11px] text-neutral-400">
            <button onClick={() => navigate(`/campaigns/${id}/roadmap`)}
              className="bg-transparent border-none cursor-pointer text-neutral-400 text-[11px] p-0 hover:text-neutral-600">
              {t('workflow.roadmap')}
            </button>
            <span className="mx-1.5">›</span>{t('gantt.title')}
          </p>
          <h1 className="m-0 text-[18px] font-semibold text-neutral-900 tracking-tight">
            {t('gantt.title')}
          </h1>
          <p className="m-0 mt-1 text-[12px] text-neutral-400">
            {campaign?.supplier?.name} · {allScheduled}/{data.items.length} {t('gantt.scheduled')}
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/campaigns/${id}/gantt.pdf`} target="_blank" className="no-underline">
            <Button variant="default" size="sm">{t('common.export_pdf')}</Button>
          </a>
          <Button variant="primary" onClick={() => navigate(`/campaigns/${id}/sheets`)}>
            {t('gantt.sheets_btn')}
          </Button>
        </div>
      </div>
      <div className="mb-5"><WorkflowNav current="gantt" /></div>

      {/* Légende phases */}
      <div className="flex gap-3 mb-4">
        {PHASES.map(p => (
          <div key={p.id} className="flex items-center gap-1.5 text-[11px]" style={{ color: p.color }}>
            <span className="w-3 h-3 rounded-sm" style={{ background: p.bg, border: `1.5px solid ${p.color}` }} />
            {p.label}
          </div>
        ))}
      </div>

      {/* Gantt */}
      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">

        {/* En-tête mois */}
        <div className="flex border-b border-neutral-100 bg-neutral-50">
          <div style={{ minWidth: 280 }} className="px-4 py-2 border-r border-neutral-100">
            <span className="text-[11px] font-medium text-neutral-500">{t('gantt.project')}</span>
          </div>
          <div className="flex overflow-x-auto" style={{ minWidth: 0 }}>
            {months.map((m, i) => (
              <div key={m.key} style={{ minWidth: COL_W, width: COL_W }}
                className={`text-center py-2 border-r border-neutral-100 flex-shrink-0
                  ${m.year !== months[i-1]?.year && i > 0 ? 'border-l-2 border-l-neutral-300' : ''}`}>
                <div className="text-[9px] text-neutral-400">{m.month === 1 || i === 0 ? m.year : ''}</div>
                <div className="text-[10px] font-medium text-neutral-600">{MONTHS_FR[m.month - 1]}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Lignes par phase */}
        {data.by_phase.map(phase => (
          <div key={phase.phase}>
            {/* Header phase */}
            <div className="flex border-b border-neutral-100"
              style={{ background: PHASES.find(p => p.id === phase.phase)?.bg + '60' || '#F5F4F0' }}>
              <div style={{ minWidth: 280 }} className="px-4 py-1.5 border-r border-neutral-100">
                <span className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: phase.color }}>{phase.label}</span>
              </div>
              <div style={{ flex: 1 }} />
            </div>

            {/* Chantiers de cette phase */}
            {data.items
              .filter(item => (item.phase || 'moyen') === phase.phase)
              .map(item => {
                const startOffset = item.start_month ? monthDiff(gridFirstKey, item.start_month) : null
                const dur = item.duration_months || 3
                const barLeft  = startOffset !== null ? Math.max(0, startOffset) * COL_W : null
                const barWidth = dur * COL_W - 4
                const isOutOfRange = startOffset !== null && startOffset + dur <= 0
                const phase_obj = PHASES.find(p => p.id === (item.phase || 'moyen')) || PHASES[2]

                return (
                  <div key={item.id} className="flex border-b border-neutral-50 hover:bg-neutral-50/50 group">

                    {/* Info chantier */}
                    <div style={{ minWidth: 280, width: 280 }}
                      className="px-4 py-2 border-r border-neutral-100 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center flex-shrink-0 text-white"
                          style={{ background: item.domain_color }}>
                          {item.num}
                        </span>
                        <span className="text-[11px] text-neutral-800 leading-snug truncate flex-1">
                          {item.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 ml-6">
                        {/* Phase selector */}
                        <div className="flex gap-0.5">
                          {PHASES.map(p => (
                            <button key={p.id}
                              onClick={() => handleUpdate(item.id, { phase: p.id })}
                              title={p.label}
                              className="text-[8px] px-1.5 py-0.5 rounded border cursor-pointer transition-all"
                              style={item.phase === p.id
                                ? { background: p.bg, borderColor: p.color, color: p.color, fontWeight: 600 }
                                : { background: 'white', borderColor: '#D3D1C7', color: '#B4B2A9' }}>
                              {p.label.split(' ')[0]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Zone Gantt */}
                    <div className="relative flex-1 overflow-hidden" style={{ height: 56 }}>
                      {/* Grille verticale */}
                      {months.map((m, i) => (
                        <div key={m.key}
                          className="absolute top-0 bottom-0 border-r border-neutral-50"
                          style={{ left: i * COL_W, width: COL_W }} />
                      ))}

                      {/* Barre Gantt */}
                      {barLeft !== null && !isOutOfRange && barLeft < GRID_MONTHS * COL_W && (
                        <div className="absolute top-3 rounded-md flex items-center px-2 text-[10px] font-medium text-white shadow-sm"
                          style={{
                            left:   barLeft + 2,
                            width:  Math.min(barWidth, (GRID_MONTHS * COL_W) - barLeft - 4),
                            height: 30,
                            background: phase_obj.color,
                            opacity: saving[item.id] ? 0.6 : 1,
                          }}>
                          <span className="truncate">{dur}m</span>
                        </div>
                      )}

                      {/* Contrôles inline */}
                      <div className="absolute bottom-1 left-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MonthPicker
                          value={item.start_month}
                          label={t('gantt.start')}
                          onChange={v => handleUpdate(item.id, { start_month: v })}
                        />
                        <div className="flex items-center gap-0.5">
                          <span className="text-[9px] text-neutral-400">{t('gantt.duration')}</span>
                          <button onClick={() => handleUpdate(item.id, { duration_months: Math.max(1, dur - 1) })}
                            className="text-[10px] w-4 h-4 rounded border border-neutral-200 bg-white cursor-pointer hover:border-neutral-400 flex items-center justify-center">−</button>
                          <span className="text-[10px] text-neutral-600 w-6 text-center">{dur}m</span>
                          <button onClick={() => handleUpdate(item.id, { duration_months: Math.min(24, dur + 1) })}
                            className="text-[10px] w-4 h-4 rounded border border-neutral-200 bg-white cursor-pointer hover:border-neutral-400 flex items-center justify-center">+</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center mt-4">
        <p className="text-[11px] text-neutral-400 m-0">
          {t('gantt.hint')}
        </p>
        <Button variant="success" onClick={() => navigate(`/campaigns/${id}/sheets`)}>
          {t('gantt.validate_btn')}
        </Button>
      </div>
    </div>
  )
}
