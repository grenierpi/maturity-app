import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { Button, Card, Input, Textarea, Label, Alert, Badge } from '../../components/ui'

const EFFORT_OPTS = ['faible', 'moyen', 'fort']
const IMPACT_OPTS = ['faible', 'moyen', 'fort']
const EFFORT_DISPLAY = { faible: 'Low', moyen: 'Medium', fort: 'High' }

export default function TemplateEdit() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const isNew    = id === 'new'

  const [framework, setFramework] = useState([])
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)
  const [form, setForm] = useState({
    label: '', description: '',
    effort_default: 'moyen', impact_default: 'moyen',
    impacts: [],   // [{subdomain_id, subdomain_code, subdomain_label, domain_code, maturity_target}]
  })

  useEffect(() => {
    api.framework.get().then(fw => setFramework(fw))
    if (!isNew) {
      api.templates.get(id).then(t => {
        setForm({
          label:          t.label,
          description:    t.description || '',
          effort_default:   t.effort_default,
          impact_default:   t.impact_default,
          maturity_minimum: t.maturity_minimum || null,
          impacts:          t.impacts.map(i => ({
            subdomain_id:    i.subdomain_id,
            subdomain_code:  i.subdomain_code,
            subdomain_label: i.subdomain_label,
            domain_code:     i.domain_code,
            maturity_target:   i.maturity_target,
          })),
        })
      })
    }
  }, [id])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleImpact = (sd) => {
    const exists = form.impacts.find(i => i.subdomain_id === sd.id)
    if (exists) {
      set('impacts', form.impacts.filter(i => i.subdomain_id !== sd.id))
    } else {
      set('impacts', [...form.impacts, {
        subdomain_id:    sd.id,
        subdomain_code:  sd.code,
        subdomain_label: sd.label,
        domain_code:     sd.domain_code,
        maturity_target:   0.5,
      }])
    }
  }

  const setGain = (subdomain_id, val) => {
    const gain = Math.min(4, Math.max(0, parseFloat(val) || 0))
    set('impacts', form.impacts.map(i =>
      i.subdomain_id === subdomain_id ? { ...i, maturity_target: gain } : i
    ))
  }

  const handleSubmit = async () => {
    setError(null)
    if (!form.label.trim()) return setError('Le label est obligatoire')
    setSaving(true)
    try {
      const payload = {
        label:            form.label,
        description:      form.description,
        effort_default:   form.effort_default,
        impact_default:   form.impact_default,
        maturity_minimum: form.maturity_minimum ? parseFloat(form.maturity_minimum) : null,
        impacts:          form.impacts.map(i => ({
          subdomain_id:  i.subdomain_id,
          maturity_target: i.maturity_target,
        })),
      }
      if (isNew) {
        await api.templates.create(payload)
      } else {
        await api.templates.update(id, payload)
      }
      navigate('/admin/templates')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center mb-6">
        <div>
          <p className="m-0 mb-0.5 text-[12px] text-neutral-500">
            <button onClick={() => navigate('/admin/templates')}
              className="bg-transparent border-none cursor-pointer text-neutral-500 text-[12px] p-0 hover:text-neutral-700">
              Catalogue
            </button> ›
          </p>
          <h1 className="m-0 text-xl font-medium">
            {isNew ? 'Nouveau chantier' : 'Éditer le chantier'}
          </h1>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="flex flex-col gap-4">
        {/* Infos principales */}
        <Card>
          <p className="m-0 mb-4 text-[13px] font-medium">Informations</p>
          <div className="mb-3">
            <Label>Label</Label>
            <Input placeholder="Ex: Formaliser un processus S&OP mensuel"
              value={form.label} onChange={e => set('label', e.target.value)} />
          </div>
          <div className="mb-4">
            <Label>Description (optionnel)</Label>
            <Textarea rows={2} placeholder="Description concise, 2 phrases max"
              value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Effort par défaut</Label>
              <div className="flex gap-2">
                {EFFORT_OPTS.map(opt => (
                  <button key={opt} onClick={() => set('effort_default', opt)}
                    className={`flex-1 text-[12px] py-1.5 rounded-md border cursor-pointer transition-colors
                      ${form.effort_default === opt
                        ? 'bg-warning-50 border-warning-500 text-warning-700 font-medium'
                        : 'bg-white border-neutral-200 text-neutral-500'}`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Impact par défaut</Label>
              <div className="flex gap-2">
                {IMPACT_OPTS.map(opt => (
                  <button key={opt} onClick={() => set('impact_default', opt)}
                    className={`flex-1 text-[12px] py-1.5 rounded-md border cursor-pointer transition-colors
                      ${form.impact_default === opt
                        ? 'bg-primary-50 border-primary-500 text-primary-700 font-medium'
                        : 'bg-white border-neutral-200 text-neutral-500'}`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Impacts par sous-domaine */}
        <Card>
          <p className="m-0 mb-1 text-[13px] font-medium">Gains de maturité par sous-domaine</p>
          <p className="m-0 mb-4 text-[12px] text-neutral-500">
            Sélectionnez les sous-domaines impactés et estimez le gain (0–4)
          </p>
          {framework.map(domain => (
            <div key={domain.code} className="mb-4">
              <p className="m-0 mb-2 text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
                {domain.label}
              </p>
              <div className="flex flex-col gap-1.5">
                {domain.subdomains.map(sd => {
                  const sdWithDomain = { ...sd, domain_code: domain.code }
                  const impact = form.impacts.find(i => i.subdomain_id === sd.id)
                  return (
                    <div key={sd.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors
                        ${impact
                          ? 'bg-primary-50 border-primary-500'
                          : 'bg-white border-neutral-200 hover:border-neutral-300'}`}>
                      <input type="checkbox" checked={!!impact}
                        onChange={() => toggleImpact(sdWithDomain)}
                        className="cursor-pointer accent-primary-700" />
                      <span className="flex-1 text-[12px] text-neutral-900">{sd.label}</span>
                      {impact && (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-neutral-500">Gain</span>

                          <input
                            type="number" min="0" max="4" step="1"
                            value={impact.maturity_target}
                            onChange={e => setGain(sd.id, e.target.value)}
                            onClick={e => e.stopPropagation()}
                            className="w-16 text-[12px] px-2 py-1 border border-primary-500 rounded-md
                              bg-white text-center focus:outline-none"
                          />
                          <span className="text-[11px] text-neutral-400">/ 4</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => navigate('/admin/templates')}>Annuler</Button>
          <Button variant="primary" disabled={saving} onClick={handleSubmit}>
            {saving ? 'Enregistrement…' : isNew ? 'Créer le chantier' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </div>
  )
}
