import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import WorkflowNav from '../components/WorkflowNav'
import { Button, Card } from '../components/ui'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { useT } from '../i18n'

const EFFORT_STYLES = {
  faible: { background: '#EAF3DE', color: '#27500A' },
  moyen:  { background: '#FAEEDA', color: '#633806' },
  fort:   { background: '#FCEBEB', color: '#791F1F' },
}
const IMPACT_STYLES = {
  faible: { background: '#F1EFE8', color: '#444441' },
  moyen:  { background: '#EEEDFE', color: '#3C3489' },
  fort:   { background: '#E1F5EE', color: '#085041' },
}
const BUCKET_COLOR = {
  critical: '#E24B4A', weak: '#BA7517', moderate: '#378ADD', good: '#1D9E75', none: '#D3D1C7'
}
function scoreBucket(s) {
  if (!s && s !== 0) return 'none'
  if (s < 1) return 'critical'; if (s < 2) return 'weak'
  if (s < 3) return 'moderate'; return 'good'
}
function RadarTick({ x, y, payload, textAnchor }) {
  return <text x={x} y={y} textAnchor={textAnchor} fill="#888780" fontSize={10}>{payload.value}</text>
}

// ─── Modal création chantier ──────────────────────────────────────────────────
function NewChantierModal({ subdomains, onClose, onSave, t, tf }) {
  const EFFORT_OPTS = ['faible', 'moyen', 'fort']
  const [form, setForm] = useState({
    label: '', description: '', effort: 'moyen', impact: 'moyen',
    subdomain_id: subdomains[0]?.id || '', maturity_target: 3,
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
      onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
        onClick={e => e.stopPropagation()}>
        <p className="m-0 mb-4 text-[15px] font-semibold text-neutral-900">{t('plan_selection.new_project')}</p>

        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-[11px] font-medium text-neutral-500 mb-1">{t('plan_selection.label')}</label>
            <input value={form.label} onChange={e => set('label', e.target.value)}
              placeholder="Ex: Déployer un processus S&OP mensuel"
              className="w-full text-[12px] px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:border-primary-500" />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-neutral-500 mb-1">{t('plan_selection.description')}</label>
            <textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Description courte…"
              className="w-full text-[12px] px-3 py-2 border border-neutral-200 rounded-lg resize-none focus:outline-none focus:border-primary-500" />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-neutral-500 mb-1">{t('plan_selection.main_subdomain')}</label>
            <select value={form.subdomain_id} onChange={e => set('subdomain_id', e.target.value)}
              className="w-full text-[12px] px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:border-primary-500 bg-white">
              {subdomains.map(sd => (
                <option key={sd.id} value={sd.id}>{sd.domain_label} — {sd.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-neutral-500 mb-1">{t('plan_selection.target_maturity')}</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map(v => (
                <button key={v} onClick={() => set('maturity_target', v)}
                  className={`flex-1 py-1.5 rounded-lg border text-[12px] cursor-pointer transition-colors
                    ${form.maturity_target === v
                      ? 'bg-success-50 border-success-500 text-success-700 font-medium'
                      : 'bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300'}`}>
                  {v}/4
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 mb-1">Effort</label>
              <div className="flex gap-1">
                {EFFORT_OPTS.map(opt => (
                  <button key={opt} onClick={() => set('effort', opt)}
                    style={form.effort === opt ? EFFORT_STYLES[opt] : {}}
                    className={`flex-1 text-[10px] py-1 rounded border cursor-pointer transition-colors
                      ${form.effort === opt ? 'font-medium' : 'bg-white border-neutral-200 text-neutral-400'}`}>
                    {t(`effort_impact.${opt}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 mb-1">Impact</label>
              <div className="flex gap-1">
                {EFFORT_OPTS.map(opt => (
                  <button key={opt} onClick={() => set('impact', opt)}
                    style={form.impact === opt ? IMPACT_STYLES[opt] : {}}
                    className={`flex-1 text-[10px] py-1 rounded border cursor-pointer transition-colors
                      ${form.impact === opt ? 'font-medium' : 'bg-white border-neutral-200 text-neutral-400'}`}>
                    {t(`effort_impact.${opt}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose}
            className="text-[12px] px-4 py-2 rounded-lg border border-neutral-200 bg-white text-neutral-500 cursor-pointer hover:bg-neutral-50">
            {t('common.cancel')}
          </button>
          <button
            disabled={!form.label.trim() || !form.subdomain_id}
            onClick={() => onSave(form)}
            className="text-[12px] px-4 py-2 rounded-lg bg-primary-50 border border-primary-500 text-primary-700 font-medium cursor-pointer hover:bg-primary-100 disabled:opacity-40">
            {t('plan_selection.create_add')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Ligne template ───────────────────────────────────────────────────────────
function TemplateRow({ template: t, added, onAdd, onRemove, incompatible = false }) {
  return (
    <div className={`flex items-start gap-3 px-4 py-3 transition-colors
      ${added ? 'bg-primary-50/60' : incompatible ? 'opacity-60' : 'hover:bg-neutral-50'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="m-0 text-[12px] font-medium text-neutral-800 leading-snug">{t.label}</p>
          {t.maturity_minimum && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-warning-50 text-warning-700 flex-shrink-0">
              min ≥ {t.maturity_minimum}
            </span>
          )}
        </div>
        {t.description && (
          <p className="m-0 text-[11px] text-neutral-500 leading-relaxed line-clamp-1 mb-1">{t.description}</p>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium"
            style={EFFORT_STYLES[t.effort_default]}>{t.effort_default}</span>
          <span className="text-[9px] text-neutral-300">·</span>
          <span className="text-[9px] text-primary-700 font-medium">→ {t.maturity_target}/4</span>
          {t.all_impacts?.length > 1 && (
            <span className="text-[9px] text-neutral-400">
              +{t.all_impacts.length - 1} SD
            </span>
          )}
        </div>
      </div>
      <button onClick={added ? onRemove : onAdd}
        className={`text-[11px] px-3 py-1 rounded-lg border cursor-pointer transition-colors flex-shrink-0 mt-0.5
          ${added
            ? 'bg-primary-100 border-primary-500 text-primary-700 font-medium'
            : 'bg-white border-neutral-200 text-neutral-500 hover:border-primary-400 hover:text-primary-700'}`}>
        {added ? '✓' : '+'}
      </button>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function PlanSelection() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { t, tf } = useT()

  const [campaign,      setCampaign]      = useState(null)
  const [synthesis,     setSynthesis]     = useState(null)
  const [templatesBySd, setTemplatesBySd] = useState({})
  const [tobe,          setTobe]          = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [selectedSd,    setSelectedSd]    = useState(null)
  // targets indexés par subdomain_id (UUID) — clé stable
  const [targets,       setTargets]       = useState({})
  const [generating,    setGenerating]    = useState(false)
  const [showModal,     setShowModal]     = useState(false)
  // Map subdomain_code → {id, label, domain_label}
  const [sdMap,         setSdMap]         = useState({})

  const loadAll = useCallback(async () => {
    const [c, s, tmpl, tb] = await Promise.all([
      api.campaigns.get(id),
      api.synthesis.synthesis(id),
      api.assessment.templatesBySubdomain(id),
      api.plan.tobe(id),
    ])
    setCampaign(c); setSynthesis(s); setTemplatesBySd(tmpl); setTobe(tb)

    // Construire sdMap : code → {id, label, domain_label}
    const map = {}
    tb?.domains?.forEach(d =>
      d.subdomains?.forEach(s => {
        map[s.subdomain_code] = { id: s.subdomain_id, label: s.subdomain_label, domain_label: d.domain_label }
      })
    )
    setSdMap(map)

    // Initialiser les cibles (UUID comme clé)
    const initTargets = {}
    tb?.domains?.forEach(d =>
      d.subdomains?.forEach(s => {
        s.heatmap_target = null
      })
    )
    // Charger les cibles depuis synthesis heatmap
    s.heatmap?.forEach(domain =>
      domain.subdomains?.forEach(sd => {
        const sdId = map[sd.subdomain_code]?.id
        if (sdId && sd.target && sd.target !== 3.0) {
          initTargets[sdId] = sd.target
        }
      })
    )
    setTargets(initTargets)

    if (!selectedSd) {
      const firstCode = tb?.domains?.[0]?.subdomains?.[0]?.subdomain_code
      if (firstCode) setSelectedSd(firstCode)
    }
    setLoading(false)
  }, [id])

  useEffect(() => { loadAll() }, [loadAll])

  const handleTargetChange = async (sdId, value) => {
    const val = Math.min(4, Math.max(1, parseInt(value)))
    setTargets(prev => ({ ...prev, [sdId]: val }))
    try {
      await api.assessment.updateTargets(id, { [sdId]: val })
      const tb = await api.plan.tobe(id)
      setTobe(tb)
    } catch (e) { console.error(e) }
  }

  const handleAddTemplate = async (templateId) => {
    try {
      await api.plan.fromTemplate(id, templateId)
      const [tmpl, tb] = await Promise.all([
        api.assessment.templatesBySubdomain(id),
        api.plan.tobe(id),
      ])
      setTemplatesBySd(tmpl); setTobe(tb)
    } catch (e) {
      if (!e.message?.includes('déjà')) alert(e.message)
    }
  }

  const handleRemoveTemplate = async (templateId) => {
    const items = await api.plan.list(id)
    const item = items.find(i => i.template_id === templateId)
    if (item) {
      await api.plan.delete(id, item.id)
      const [tmpl, tb] = await Promise.all([
        api.assessment.templatesBySubdomain(id),
        api.plan.tobe(id),
      ])
      setTemplatesBySd(tmpl); setTobe(tb)
    }
  }

  const handleCreateChantier = async (form) => {
    try {
      await api.plan.create(id, {
        label:       form.label,
        description: form.description,
        effort:      form.effort,
        impact:      form.impact,
        subdomain_codes: [
          Object.entries(sdMap).find(([code, sd]) => sd.id === form.subdomain_id)?.[0] || ''
        ],
        domain_codes: [],
        impacts: [{ subdomain_id: form.subdomain_id, maturity_target: form.maturity_target }],
      })
      setShowModal(false)
      const [tmpl, tb] = await Promise.all([
        api.assessment.templatesBySubdomain(id),
        api.plan.tobe(id),
      ])
      setTemplatesBySd(tmpl); setTobe(tb)
    } catch (e) { alert(e.message) }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await api.synthesis.generate(id)
      await loadAll()
    } catch (e) { alert(`Erreur : ${e.message}`) }
    finally { setGenerating(false) }
  }

  if (loading) return <p className="text-neutral-500 text-[13px]">{t('common.loading')}</p>
  if (!synthesis) return null

  const { heatmap } = synthesis
  const allSds = Object.entries(sdMap).map(([code, sd]) => ({
    code, id: sd.id, label: tf('subdomains', code) || sd.label, domain_label: tf('domains', code.split('_')[0]) || sd.domain_label
  }))

  const radarData = tobe?.domains?.map(d => ({
    domain:  (tf('domains', d.domain_code) || d.domain_label)?.substring(0, 12) || d.domain_code,
    'As-is': d.as_is  || 0,
    'Cible': (() => {
      // Moyenne des cibles CDP pour ce domaine
      const domainSds = d.subdomains || []
      const cibleVals = domainSds.map(s => targets[s.subdomain_id]).filter(Boolean)
      return cibleVals.length ? cibleVals.reduce((a,b) => a+b,0) / cibleVals.length : (d.as_is || 0)
    })(),
    'To-be': d.tobe || d.as_is || 0,
  })) || []

  const selSd     = sdMap[selectedSd]
  const selSdId   = selSd?.id
  const selSdData = heatmap?.flatMap(d => d.subdomains)?.find(s => s.subdomain_code === selectedSd)
  const sdTemplates    = selSdId ? (templatesBySd[selSdId] || []) : []
  const compatible     = sdTemplates.filter(t => t.compatible)
  const incompatible   = sdTemplates.filter(t => !t.compatible)
  const addedTemplateIds = new Set(
    Object.values(templatesBySd).flat().filter(t => t.already_added).map(t => t.template_id)
  )
  const totalAdded = addedTemplateIds.size

  return (
    <div className="max-w-5xl">

      {/* Modal */}
      {showModal && (
        <NewChantierModal
          subdomains={allSds.map(s => ({ id: s.id, label: s.label, domain_label: s.domain_label }))}
          onClose={() => setShowModal(false)}
          onSave={handleCreateChantier}
          t={t}
          tf={tf}
        />
      )}

      {/* Header */}
      <div className="flex items-start gap-4 mb-5">
        <div className="flex-1">
          <p className="m-0 mb-0.5 text-[11px] text-neutral-400">
            <button onClick={() => navigate(`/campaigns/${id}/synthesis`)}
              className="bg-transparent border-none cursor-pointer text-neutral-400 text-[11px] p-0 hover:text-neutral-600">
              {t('plan_selection.breadcrumb')}
            </button>
            <span className="mx-1.5">›</span>{t('plan_selection.title')}
          </p>
          <h1 className="m-0 text-[18px] font-semibold text-neutral-900 tracking-tight">
            {t('plan_selection.title')}
          </h1>
          <p className="m-0 mt-1 text-[12px] text-neutral-400">
            {t('plan_selection.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleGenerate} disabled={generating}
            className="text-[11px] px-3 py-1.5 rounded-lg border border-neutral-200 bg-white
              text-neutral-500 cursor-pointer hover:border-neutral-300 disabled:opacity-50 transition-colors">
            {generating ? t('common.generating') : t('common.generate_ai')}
          </button>
          <Button variant="success" onClick={() => navigate(`/campaigns/${id}/plan`)}>
            {t('plan_selection.qualify_btn')}
          </Button>
        </div>
      </div>
      <div className="mb-5"><WorkflowNav current="plan-selection" /></div>

      {/* Spider */}
      {radarData.length > 0 && (
        <Card className="mb-5">
          <div className="grid grid-cols-[1fr_160px] gap-4 items-center">
            <div>
              <p className="m-0 mb-0.5 text-[13px] font-medium">{t('plan_selection.maturity_projection')}</p>
              <p className="m-0 mb-3 text-[11px] text-neutral-400">As-is · Cible CDP · To-be projeté</p>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData} margin={{ top: 15, right: 35, bottom: 15, left: 35 }}>
                  <PolarGrid stroke="#F1EFE8" strokeDasharray="3 3" />
                  <PolarAngleAxis dataKey="domain" tick={<RadarTick />} />
                  <PolarRadiusAxis domain={[0, 4]} tick={{ fontSize: 8, fill: '#D3D1C7' }} tickCount={5} axisLine={false} />
                  <Radar name="As-is"     dataKey="As-is"  stroke="#C2C0B6" fill="#F1EFE8" fillOpacity={0.4} strokeWidth={1.5} />
                  <Radar name="Cible CDP" dataKey="Cible"  stroke="#1D9E75" fill="none"    strokeDasharray="5 3" strokeWidth={1.5} />
                  <Radar name="To-be"     dataKey="To-be"  stroke="#7F77DD" fill="#EEEDFE" fillOpacity={0.5} strokeWidth={2} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  <Tooltip formatter={v => typeof v === 'number' ? v.toFixed(1)+'/4' : v}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '0.5px solid #D3D1C7' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="border-l border-neutral-100 pl-4">
              <p className="m-0 mb-2 text-[10px] font-medium text-neutral-400 uppercase tracking-wider">{t('plan_selection.delta_per_domain')}</p>
              {tobe?.domains?.map(d => {
                const gain = d.tobe && d.as_is ? d.tobe - d.as_is : 0
                return (
                  <div key={d.domain_code} className="flex items-center gap-1.5 py-1 border-b border-neutral-50 last:border-0">
                    <span className="text-[10px] text-neutral-700 flex-1 truncate">{tf('domains', d.domain_code) || d.domain_label}</span>
                    <span className="text-[10px] font-mono text-neutral-400">{d.as_is?.toFixed(1) ?? '—'}</span>
                    <span className="text-[9px] text-neutral-300">→</span>
                    <span className={`text-[10px] font-mono font-medium ${gain > 0.05 ? 'text-primary-700' : 'text-neutral-400'}`}>
                      {d.tobe?.toFixed(1) ?? '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Corps — gauche SD, droite templates */}
      <div className="grid grid-cols-[280px_1fr] gap-4">

        {/* Panneau gauche */}
        <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-2">
            <div className="flex-1">
              <p className="m-0 text-[12px] font-medium text-neutral-700">{t('plan_selection.subdomains')}</p>
              <p className="m-0 mt-0.5 text-[10px] text-neutral-400">{t('plan_selection.click_set_target')}</p>
            </div>
            <button onClick={() => setShowModal(true)}
              className="text-[10px] px-2.5 py-1 rounded-lg border border-primary-500 bg-primary-50
                text-primary-700 font-medium cursor-pointer hover:bg-primary-100 transition-colors flex-shrink-0">
              {t('plan_selection.manual')}
            </button>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 440px)' }}>
            {heatmap.map(domain => (
              <div key={domain.domain_code}>
                <div className="px-4 py-1.5 bg-neutral-50 border-y border-neutral-100">
                  <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
                    {tf('domains', domain.domain_code) || domain.domain_label}
                  </span>
                </div>
                {domain.subdomains.map(sd => {
                  const isSelected  = selectedSd === sd.subdomain_code
                  const sdId        = sdMap[sd.subdomain_code]?.id
                  const currentTarget = targets[sdId]
                  const bucket      = scoreBucket(sd.score)
                  const nAdded      = sdId ? (templatesBySd[sdId] || []).filter(t => t.already_added).length : 0

                  return (
                    <div key={sd.subdomain_code}
                      onClick={() => setSelectedSd(sd.subdomain_code)}
                      className={`px-4 py-2.5 border-b border-neutral-50 cursor-pointer transition-all
                        ${isSelected
                          ? 'bg-primary-50 border-l-2 border-l-primary-500'
                          : 'hover:bg-neutral-50 border-l-2 border-l-transparent'}`}>

                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[11px] text-neutral-800 flex-1 leading-snug truncate">
                          {tf('subdomains', sd.subdomain_code) || sd.subdomain_label}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                          style={{ background: BUCKET_COLOR[bucket]+'22', color: BUCKET_COLOR[bucket] }}>
                          {sd.score !== null ? `${sd.score}/4` : '—'}
                        </span>
                      </div>

                      {/* Boutons cible */}
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-neutral-400 mr-0.5">{t('plan_selection.target')}</span>
                        {[1, 2, 3, 4].map(v => (
                          <button key={v}
                            onClick={e => { e.stopPropagation(); sdId && handleTargetChange(sdId, v) }}
                            className={`text-[9px] w-7 h-5 rounded border cursor-pointer transition-all font-medium
                              ${currentTarget === v
                                ? 'bg-success-50 border-success-500 text-success-700 shadow-sm'
                                : 'bg-white border-neutral-200 text-neutral-400 hover:border-success-400 hover:text-success-600'}`}>
                            {v}
                          </button>
                        ))}
                        {nAdded > 0 && (
                          <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-700 font-medium flex-shrink-0">
                            {nAdded}✓
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Panneau droit */}
        <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
          {!selectedSd ? (
            <div className="flex items-center justify-center h-full text-neutral-400 text-[13px] py-20">
              {t('plan_selection.select_subdomain')}
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-3">
                <div className="flex-1">
                  <p className="m-0 text-[13px] font-medium text-neutral-900">{tf('subdomains', selectedSd) || selSd?.label}</p>
                  <p className="m-0 mt-0.5 text-[11px] text-neutral-400">
                    {t('plan_selection.current_score')} {selSdData?.score !== null ? `${selSdData?.score}/4` : '—'}
                    {targets[selSdId] && ` · ${t('plan_selection.target')} : ${targets[selSdId]}/4`}
                    {' · '}{compatible.length} {t('plan_selection.compatible')}{compatible.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              <div className="overflow-y-auto divide-y divide-neutral-50"
                style={{ maxHeight: 'calc(100vh - 500px)' }}>
                {sdTemplates.length === 0 ? (
                  <div className="px-4 py-8 text-center text-neutral-400 text-[12px]">
                    {t('plan_selection.no_projects')}
                  </div>
                ) : <>
                  {compatible.map(tmpl => (
                    <TemplateRow key={tmpl.template_id} template={tmpl}
                      added={addedTemplateIds.has(tmpl.template_id)}
                      onAdd={() => handleAddTemplate(tmpl.template_id)}
                      onRemove={() => handleRemoveTemplate(tmpl.template_id)} />
                  ))}
                  {incompatible.length > 0 && compatible.length > 0 && (
                    <div className="px-4 py-1.5 bg-warning-50 border-y border-warning-200">
                      <p className="m-0 text-[10px] text-warning-700 font-medium">
                        {t('plan_selection.insufficient_maturity')}
                      </p>
                    </div>
                  )}
                  {incompatible.map(tmpl => (
                    <TemplateRow key={tmpl.template_id} template={tmpl}
                      added={addedTemplateIds.has(tmpl.template_id)}
                      onAdd={() => handleAddTemplate(tmpl.template_id)}
                      onRemove={() => handleRemoveTemplate(tmpl.template_id)}
                      incompatible />
                  ))}
                </>}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-4">
        <p className="text-[11px] text-neutral-400 m-0">
          {totalAdded} chantier{totalAdded > 1 ? 's' : ''} {t('plan_selection.selected')}
        </p>
        <Button variant="success" onClick={() => navigate(`/campaigns/${id}/plan`)}>
          {t('plan_selection.validate_btn')}
        </Button>
      </div>
    </div>
  )
}
