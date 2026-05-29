import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import WorkflowNav from '../components/WorkflowNav'
import { Button, Card, SectionTitle } from '../components/ui'
import { useT } from '../i18n'

const EFFORT_STYLES = {
  faible: { background: '#EAF3DE', borderColor: '#639922', color: '#27500A' },
  moyen:  { background: '#FAEEDA', borderColor: '#BA7517', color: '#633806' },
  fort:   { background: '#FCEBEB', borderColor: '#E24B4A', color: '#791F1F' },
}
const IMPACT_STYLES = {
  faible: { background: '#F1EFE8', borderColor: '#888780', color: '#444441' },
  moyen:  { background: '#EEEDFE', borderColor: '#7F77DD', color: '#3C3489' },
  fort:   { background: '#E1F5EE', borderColor: '#1D9E75', color: '#085041' },
}

function EIToggle({ value, options, styles, onChange }) {
  return (
    <div className="flex gap-1">
      {options.map(opt => (
        <button key={opt} onClick={() => onChange(opt)}
          style={value === opt ? { ...styles[opt], border: '0.5px solid' } : {}}
          className={`text-[10px] px-2 py-0.5 rounded border cursor-pointer transition-colors
            ${value === opt ? 'font-medium' : 'bg-white border-neutral-200 text-neutral-400 hover:border-neutral-300'}`}>
          {opt}
        </button>
      ))}
    </div>
  )
}

export default function PlanQualification() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { t } = useT()
  const [items,    setItems]    = useState([])
  const [campaign, setCampaign] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [editingId, setEditingId] = useState(null)

  const EFFORT_OPTS = ['faible', 'moyen', 'fort']

  const load = async () => {
    const [c, it] = await Promise.all([api.campaigns.get(id), api.plan.list(id)])
    setCampaign(c); setItems(it); setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const handleUpdate = async (itemId, body) => {
    await api.plan.update(id, itemId, body)
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...body } : i))
  }

  const handleExclude = async (itemId) => {
    await api.plan.update(id, itemId, { status: 'excluded', exclusion_reason: 'Exclu manuellement' })
    await load()
  }

  const handleRestore = async (itemId) => {
    await api.plan.update(id, itemId, { status: 'proposed', exclusion_reason: null })
    await load()
  }

  if (loading)    return <p className="text-neutral-500 text-[13px]">{t('common.loading')}</p>
  if (!campaign)  return null

  const activeItems   = items.filter(i => i.status !== 'excluded')
  const excludedItems = items.filter(i => i.status === 'excluded')

  return (
    <div className="max-w-3xl">

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-1">
          <p className="m-0 mb-0.5 text-[11px] text-neutral-400">
            <button onClick={() => navigate(`/campaigns/${id}/plan-selection`)}
              className="bg-transparent border-none cursor-pointer text-neutral-400 text-[11px] p-0 hover:text-neutral-600">
              {t('plan_qualification.breadcrumb')}
            </button>
            <span className="mx-1.5">›</span>{t('plan_qualification.title')}
          </p>
          <h1 className="m-0 text-[18px] font-semibold text-neutral-900 tracking-tight">
            {t('plan_qualification.title')}
          </h1>
          <p className="m-0 mt-1 text-[12px] text-neutral-400">
            {t('plan_qualification.subtitle')}
          </p>
        </div>
        <Button variant="success" onClick={() => navigate(`/campaigns/${id}/roadmap`)}>
          {t('plan_qualification.roadmap_btn')}
        </Button>
      </div>
      <div className="mb-5"><WorkflowNav current="plan" /></div>

      <Card padding={false}>
        <div className="px-5 py-3 border-b border-neutral-100">
          <p className="m-0 text-[12px] font-medium text-neutral-700">
            {activeItems.length} chantier{activeItems.length > 1 ? 's' : ''} {t('plan_qualification.to_qualify')}
          </p>
        </div>

        {activeItems.length === 0 ? (
          <div className="px-5 py-10 text-center text-neutral-400 text-[13px]">
            Aucun chantier —{' '}
            <button onClick={() => navigate(`/campaigns/${id}/plan-selection`)}
              className="bg-transparent border-none cursor-pointer text-primary-700 p-0 hover:underline text-[13px]">
              {t('plan_qualification.return_selection')}
            </button>
          </div>
        ) : (
          <div className="divide-y divide-neutral-50">
            {activeItems.map((item, i) => {
              const isEditing = editingId === item.id
              return (
                <div key={item.id} className={`px-5 py-4 transition-colors ${isEditing ? 'bg-neutral-50' : 'hover:bg-neutral-50/50'}`}>
                  {/* Ligne principale */}
                  <div className="flex items-start gap-3">
                    <span className="text-[12px] font-medium text-neutral-300 w-5 flex-shrink-0 mt-0.5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="m-0 text-[13px] font-medium text-neutral-900 leading-snug">
                        {item.label}
                        {item.label_custom && (
                          <span className="ml-2 text-[10px] text-success-500 font-normal">✓ reworded</span>
                        )}
                      </p>
                      {!isEditing && item.description && (
                        <p className="m-0 mt-0.5 text-[11px] text-neutral-400 leading-relaxed">{item.description}</p>
                      )}
                      {!isEditing && (
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <EIToggle value={item.effort} options={EFFORT_OPTS} styles={EFFORT_STYLES}
                            onChange={v => handleUpdate(item.id, { effort: v })} />
                          <span className="text-neutral-200 text-[10px]">|</span>
                          <EIToggle value={item.impact} options={EFFORT_OPTS} styles={IMPACT_STYLES}
                            onChange={v => handleUpdate(item.id, { impact: v })} />
                          {item.template_impacts?.map(ti => (
                            <span key={ti.subdomain_id} className="text-[9px] px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 font-medium">
                              {ti.subdomain_code} → {ti.maturity_target}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => setEditingId(isEditing ? null : item.id)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border cursor-pointer transition-colors
                          ${isEditing ? 'bg-neutral-200 border-neutral-300 text-neutral-700' : 'bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300'}`}>
                        {isEditing ? t('common.close') : t('plan_qualification.rephrase')}
                      </button>
                      <button onClick={() => handleExclude(item.id)}
                        className="text-[11px] px-2 py-1 rounded-lg border border-neutral-200 bg-white text-neutral-400 cursor-pointer hover:text-danger-700 hover:border-danger-400 transition-colors">
                        ×
                      </button>
                    </div>
                  </div>

                  {/* Panneau rewording */}
                  {isEditing && (
                    <div className="mt-3 ml-8 flex flex-col gap-2.5">
                      <div>
                        <p className="m-0 mb-1 text-[10px] text-neutral-400 uppercase tracking-wide">{t('plan_qualification.client_label')}</p>
                        <input defaultValue={item.label_custom || item.label}
                          onBlur={e => handleUpdate(item.id, { label_custom: e.target.value || null })}
                          className="w-full text-[12px] px-3 py-2 border border-neutral-200 rounded-lg bg-white focus:outline-none focus:border-primary-500" />
                      </div>
                      <div>
                        <p className="m-0 mb-1 text-[10px] text-neutral-400 uppercase tracking-wide">{t('plan_qualification.client_description')}</p>
                        <textarea rows={2}
                          defaultValue={item.description_custom || item.description || ''}
                          onBlur={e => handleUpdate(item.id, { description_custom: e.target.value || null })}
                          className="w-full text-[12px] px-3 py-2 border border-neutral-200 rounded-lg bg-white resize-none focus:outline-none focus:border-primary-500" />
                      </div>
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-neutral-400 uppercase tracking-wide">Effort</span>
                          <EIToggle value={item.effort} options={EFFORT_OPTS} styles={EFFORT_STYLES}
                            onChange={v => handleUpdate(item.id, { effort: v })} />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-neutral-400 uppercase tracking-wide">Impact</span>
                          <EIToggle value={item.impact} options={EFFORT_OPTS} styles={IMPACT_STYLES}
                            onChange={v => handleUpdate(item.id, { impact: v })} />
                        </div>
                      </div>
                      {item.template_impacts?.length > 0 && (
                        <div>
                          <p className="m-0 mb-1 text-[10px] text-neutral-400 uppercase tracking-wide flex items-center gap-1">
                            Cibles maturité <span className="text-[9px] text-neutral-300">🔒</span>
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {item.template_impacts.map(ti => (
                              <span key={ti.subdomain_id} className="text-[10px] px-2 py-0.5 rounded bg-neutral-100 text-neutral-500 font-medium">
                                {ti.subdomain_code} → {ti.maturity_target}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Exclus */}
        {excludedItems.length > 0 && (
          <div className="px-5 pt-3 pb-4 border-t border-neutral-100">
            <SectionTitle>{t('plan_qualification.excluded')} ({excludedItems.length})</SectionTitle>
            {excludedItems.map(item => (
              <div key={item.id} className="flex items-center gap-3 py-1.5">
                <span className="text-[12px] text-neutral-300 flex-1 truncate">{item.label}</span>
                <button onClick={() => handleRestore(item.id)}
                  className="border-none bg-transparent cursor-pointer text-[11px] text-neutral-400 p-0 hover:text-primary-700 transition-colors">
                  {t('plan_qualification.restore')}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {activeItems.length > 0 && (
          <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between">
            <p className="m-0 text-[11px] text-neutral-400">
              Rewordez les intitulés pour les adapter au contexte client
            </p>
            <Button variant="success" size="sm" onClick={() => navigate(`/campaigns/${id}/roadmap`)}>
              Valider et voir la roadmap →
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
