import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import WorkflowNav from '../components/WorkflowNav'
import { Button, Card } from '../components/ui'
import { useT } from '../i18n'

const DOMAIN_COLORS = {
  ORG:  { bg: '#EEEDFE', color: '#3C3489', dot: '#7F77DD' },
  PLAN: { bg: '#E1F5EE', color: '#085041', dot: '#1D9E75' },
  SIM:  { bg: '#FAEEDA', color: '#633806', dot: '#BA7517' },
  IQ:   { bg: '#FCEBEB', color: '#791F1F', dot: '#E24B4A' },
  ME:   { bg: '#E6F1FB', color: '#0C447C', dot: '#378ADD' },
}
const DEFAULT_DC = { bg: '#F1EFE8', color: '#444441', dot: '#888780' }

// Éditeur de liste avec drag-and-drop et numérotation optionnelle
function ListEditor({ value = [], onChange, placeholder, numbered = false }) {
  const [draft, setDraft]     = useState('')
  const [dragIdx, setDragIdx] = useState(null)
  const [overIdx, setOverIdx] = useState(null)

  const add = () => {
    const v = draft.trim()
    if (!v) return
    onChange([...value, v])
    setDraft('')
  }

  const reorder = (from, to) => {
    if (from === to) return
    const next = [...value]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  return (
    <div>
      <div className="flex flex-col mb-2">
        {value.map((item, i) => (
          <div key={i}
            draggable
            onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragIdx(i) }}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOverIdx(i) }}
            onDrop={e => { e.preventDefault(); reorder(dragIdx, i); setDragIdx(null); setOverIdx(null) }}
            onDragEnd={() => { setDragIdx(null); setOverIdx(null) }}
            className={`flex items-start gap-1.5 group py-0.5 rounded transition-opacity
              ${dragIdx === i ? 'opacity-30' : ''}
              ${overIdx === i && dragIdx !== i ? 'border-t-2 border-primary-400' : 'border-t-2 border-transparent'}`}>

            {/* Poignée de glissement */}
            <span className="text-neutral-300 hover:text-neutral-500 cursor-grab active:cursor-grabbing
              flex-shrink-0 select-none text-[14px] leading-tight mt-0.5"
              title="Glisser pour réordonner">
              ⠿
            </span>

            {/* Numéro (actions clés uniquement) */}
            {numbered && (
              <span className="text-[11px] text-neutral-400 flex-shrink-0 select-none mt-0.5 w-5 text-right">
                {i + 1}.
              </span>
            )}

            {/* Texte éditable */}
            <span className="flex-1 text-[12px] text-neutral-800 leading-relaxed"
              contentEditable suppressContentEditableWarning
              onBlur={e => {
                const newVal = [...value]
                newVal[i] = e.target.innerText.trim()
                onChange(newVal.filter(Boolean))
              }}>
              {item}
            </span>

            {/* Supprimer */}
            <button onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="opacity-0 group-hover:opacity-100 text-[10px] text-neutral-300
                hover:text-danger-700 border-none bg-transparent cursor-pointer flex-shrink-0 mt-0.5">
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        <input value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="flex-1 text-[11px] px-2 py-1 border border-neutral-200 rounded-md focus:outline-none focus:border-primary-500" />
        <button onClick={add}
          className="text-[10px] px-2 py-1 rounded-md border border-primary-500 bg-primary-50 text-primary-700 cursor-pointer hover:bg-primary-100">
          +
        </button>
      </div>
    </div>
  )
}

function SheetCard({ entry, onSave, onGenerate, t }) {
  const dc = DOMAIN_COLORS[(entry.domain_codes || [])[0]] || DEFAULT_DC
  const [sheet, setSheet]       = useState(entry.sheet)
  const [expanded, setExpanded] = useState(false)
  const [generating, setGen]    = useState(false)
  const [saving, setSaving]     = useState(false)
  const [dirty, setDirty]       = useState(false)

  const phaseLabel = (phase) => {
    if (phase === 'quick_win') return t('sheets.phase_quick_win')
    if (phase === 'court')     return t('sheets.phase_court')
    if (phase === 'moyen')     return t('sheets.phase_moyen')
    return t('sheets.phase_long')
  }

  const set = (field, val) => {
    setSheet(s => ({ ...s, [field]: val }))
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const saved = await api.sheets.upsertForTemplate(entry.template_id, sheet)
      setSheet(saved)
      setDirty(false)
      onSave && onSave(saved)
    } finally {
      setSaving(false)
    }
  }

  const handleGenerate = async () => {
    setGen(true)
    try {
      const generated = await api.sheets.generateForTemplate(entry.template_id)
      setSheet(generated)
      setDirty(false)
    } catch (e) {
      alert(`Erreur génération : ${e.message}`)
    } finally {
      setGen(false)
    }
  }

  const isEmpty = !sheet.objectives && !sheet.key_actions?.length

  return (
    <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-neutral-50 transition-colors"
        style={{ borderLeft: `3px solid ${dc.dot}` }}
        onClick={() => setExpanded(v => !v)}>
        <span className="w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center text-white flex-shrink-0"
          style={{ background: dc.dot }}>{entry.num}</span>
        <div className="flex-1 min-w-0">
          <p className="m-0 text-[13px] font-medium text-neutral-900 truncate">{entry.label}</p>
          <p className="m-0 mt-0.5 text-[10px] text-neutral-400">
            {phaseLabel(entry.phase)}
            {sheet.duration_hint && ` · ${sheet.duration_hint}`}
            {sheet.generated_by_ai && <span className="ml-1.5 text-primary-500">✦ IA</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isEmpty && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning-50 text-warning-700">
              {t('sheets.empty_sheet')}
            </span>
          )}
          {dirty && (
            <span className="text-[10px] text-warning-600">{t('sheets.unsaved')}</span>
          )}
          <button onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
            className="text-neutral-400 border-none bg-transparent cursor-pointer text-[12px]">
            {expanded ? '▾' : '▸'}
          </button>
        </div>
      </div>

      {/* Contenu fiche */}
      {expanded && (
        <div className="px-5 py-4 border-t border-neutral-100">

          {/* Actions IA + Save */}
          <div className="flex items-center gap-2 mb-4">
            <button onClick={handleGenerate} disabled={generating}
              className="text-[11px] px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-500
                cursor-pointer hover:border-primary-400 hover:text-primary-700 disabled:opacity-50 transition-colors">
              {generating ? t('common.generating') : t('common.generate_ai')}
            </button>
            {dirty && (
              <button onClick={handleSave} disabled={saving}
                className="text-[11px] px-3 py-1.5 rounded-lg border border-success-500 bg-success-50 text-success-700
                  font-medium cursor-pointer hover:bg-success-100 disabled:opacity-50 ml-auto">
                {saving ? t('common.saving') : t('sheets.save_btn')}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-5">

            {/* Objectifs */}
            <div className="col-span-2">
              <p className="m-0 mb-1.5 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
                {t('sheets.objectives')}
              </p>
              <textarea rows={3}
                value={sheet.objectives || ''}
                onChange={e => set('objectives', e.target.value)}
                placeholder="Décrire les objectifs principaux du chantier…"
                className="w-full text-[12px] px-3 py-2 border border-neutral-200 rounded-lg bg-white
                  text-neutral-900 placeholder-neutral-400 resize-y focus:outline-none focus:border-primary-500 font-[inherit]"
              />
            </div>

            {/* Actions clés */}
            <div>
              <p className="m-0 mb-1.5 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
                {t('sheets.key_actions')}
              </p>
              <ListEditor value={sheet.key_actions || []}
                onChange={v => set('key_actions', v)}
                placeholder={t('sheets.action_placeholder')}
                numbered />
            </div>

            {/* Acteurs */}
            <div>
              <p className="m-0 mb-1.5 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
                {t('sheets.stakeholders')}
              </p>
              <ListEditor value={sheet.stakeholders || []}
                onChange={v => set('stakeholders', v)}
                placeholder={t('sheets.stakeholder_placeholder')} />
            </div>

            {/* Prérequis */}
            <div>
              <p className="m-0 mb-1.5 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
                {t('sheets.prerequisites')}
              </p>
              <textarea rows={2}
                value={sheet.prerequisites || ''}
                onChange={e => set('prerequisites', e.target.value)}
                placeholder={t('sheets.prereq_placeholder')}
                className="w-full text-[12px] px-3 py-2 border border-neutral-200 rounded-lg bg-white
                  text-neutral-900 placeholder-neutral-400 resize-y focus:outline-none focus:border-primary-500 font-[inherit]"
              />
            </div>

            {/* Livrables */}
            <div>
              <p className="m-0 mb-1.5 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
                {t('sheets.deliverables')}
              </p>
              <ListEditor value={sheet.deliverables || []}
                onChange={v => set('deliverables', v)}
                placeholder={t('sheets.deliverable_placeholder')} />
            </div>

            {/* KPIs */}
            <div>
              <p className="m-0 mb-1.5 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
                {t('sheets.kpis')}
              </p>
              <ListEditor value={sheet.success_kpis || []}
                onChange={v => set('success_kpis', v)}
                placeholder={t('sheets.kpi_placeholder')} />
            </div>

            {/* Durée */}
            <div>
              <p className="m-0 mb-1.5 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
                {t('sheets.duration')}
              </p>
              <input
                value={sheet.duration_hint || ''}
                onChange={e => set('duration_hint', e.target.value)}
                placeholder={t('sheets.duration_placeholder')}
                className="w-full text-[12px] px-3 py-2 border border-neutral-200 rounded-lg bg-white
                  focus:outline-none focus:border-primary-500"
              />
            </div>

          </div>

          {/* Bouton save en bas */}
          {dirty && (
            <div className="flex justify-end mt-4 pt-3 border-t border-neutral-100">
              <button onClick={handleSave} disabled={saving}
                className="text-[12px] px-4 py-2 rounded-lg border border-success-500 bg-success-50 text-success-700
                  font-medium cursor-pointer hover:bg-success-100 disabled:opacity-50">
                {saving ? t('common.saving') : t('sheets.save_sheet_btn')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Sheets() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const { t } = useT()
  const [entries, setEntries] = useState([])
  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [genAll,  setGenAll]    = useState(false)

  useEffect(() => {
    Promise.all([api.campaigns.get(id), api.sheets.getCampaignSheets(id)])
      .then(([c, s]) => { setCampaign(c); setEntries(s) })
      .finally(() => setLoading(false))
  }, [id])

  const handleGenerateAll = async () => {
    setGenAll(true)
    try {
      for (const entry of entries) {
        if (entry.template_id && !entry.sheet?.objectives) {
          try {
            await api.sheets.generateForTemplate(entry.template_id)
          } catch (e) { /* skip */ }
        }
      }
      const sheets = await api.sheets.getCampaignSheets(id)
      setEntries(sheets)
    } finally {
      setGenAll(false)
    }
  }

  const emptyCount = entries.filter(e => !e.sheet?.objectives).length

  if (loading)  return <p className="text-neutral-500 text-[13px]">{t('common.loading')}</p>
  if (!campaign) return null

  return (
    <div className="max-w-3xl">

      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div className="flex-1">
          <p className="m-0 mb-0.5 text-[11px] text-neutral-400">
            <button onClick={() => navigate(`/campaigns/${id}/gantt`)}
              className="bg-transparent border-none cursor-pointer text-neutral-400 text-[11px] p-0 hover:text-neutral-600">
              {t('sheets.breadcrumb')}
            </button>
            <span className="mx-1.5">›</span>{t('sheets.title')}
          </p>
          <h1 className="m-0 text-[18px] font-semibold text-neutral-900 tracking-tight">
            {t('sheets.title')}
          </h1>
          <p className="m-0 mt-1 text-[12px] text-neutral-400">
            {entries.length} chantier{entries.length > 1 ? 's' : ''}
            {emptyCount > 0 && ` · ${emptyCount} fiche${emptyCount > 1 ? 's' : ''} vide${emptyCount > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {emptyCount > 0 && (
            <button onClick={handleGenerateAll} disabled={genAll}
              className="text-[11px] px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-500
                cursor-pointer hover:border-primary-400 hover:text-primary-700 disabled:opacity-50 transition-colors">
              {genAll ? t('common.generating') : t('sheets.generate_empty').replace('{n}', emptyCount)}
            </button>
          )}
          <a href={`/api/campaigns/${id}/actions.xlsx`} target="_blank" className="no-underline">
            <Button variant="default" size="sm">{t('sheets.actions_xls')}</Button>
          </a>
          <a href={`/api/campaigns/${id}/sheets.pdf`} target="_blank" className="no-underline">
            <Button variant="default" size="sm">{t('sheets.sheets_pdf')}</Button>
          </a>
          <a href={`/api/campaigns/${id}/full-report.pdf`} target="_blank" className="no-underline">
            <Button variant="primary" size="sm">{t('sheets.full_export')}</Button>
          </a>
        </div>
      </div>

      <div className="mb-5"><WorkflowNav current="sheets" /></div>

      {entries.length === 0 ? (
        <Card>
          <p className="text-neutral-400 text-[13px] text-center py-6 m-0">
            {t('sheets.no_projects')} —{' '}
            <button onClick={() => navigate(`/campaigns/${id}/plan-selection`)}
              className="bg-transparent border-none cursor-pointer text-primary-700 p-0 hover:underline">
              {t('sheets.return_selection')}
            </button>
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map(entry => (
            <SheetCard key={entry.item_id} entry={entry} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}
