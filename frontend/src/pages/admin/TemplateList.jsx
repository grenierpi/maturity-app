import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { Button } from '../../components/ui'

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

export default function TemplateList() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading]     = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const navigate = useNavigate()

  const load = () => {
    setLoading(true)
    api.templates.list(!showInactive).then(setTemplates).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [showInactive])

  const handleDelete = async (id) => {
    if (!confirm('Archiver ce chantier ?')) return
    await api.templates.delete(id)
    load()
  }

  if (loading) return <p className="text-neutral-500 text-[13px]">Chargement…</p>

  return (
    <div className="max-w-3xl">

      {/* Header compact */}
      <div className="flex items-center mb-5">
        <div>
          <h1 className="text-[17px] font-semibold m-0 text-neutral-900 tracking-tight">Catalogue de chantiers</h1>
          <p className="m-0 mt-0.5 text-[12px] text-neutral-400">
            {templates.length} chantier{templates.length > 1 ? 's' : ''} · réutilisables sur toutes les campagnes
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setShowInactive(v => !v)}
            className={`text-[11px] px-2.5 py-1 rounded border cursor-pointer transition-colors
              ${showInactive ? 'bg-neutral-100 border-neutral-300 text-neutral-600' : 'bg-white border-neutral-200 text-neutral-400 hover:text-neutral-600'}`}>
            {showInactive ? 'Masquer archivés' : 'Archivés'}
          </button>
          <Button variant="primary" size="sm" onClick={() => navigate('/admin/templates/new')}>
            + Nouveau chantier
          </Button>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-14 border border-dashed border-neutral-200 rounded-xl text-neutral-400">
          <p className="text-[13px]">Catalogue vide — les chantiers générés par Claude apparaissent ici</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-neutral-100 bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
          {templates.map((t, idx) => (
            <div key={t.id}
              className={`flex items-center gap-4 px-4 py-3 hover:bg-neutral-50 transition-colors group
                ${!t.active ? 'opacity-40' : ''}`}>

              {/* Effort dot */}
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-0.5"
                style={{ background: EFFORT_STYLES[t.effort_default]?.color }} />

              {/* Contenu principal */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className="m-0 text-[13px] font-medium text-neutral-900 truncate">{t.label}</p>
                  {t.source !== 'manual' && (
                    <span className="text-[10px] text-neutral-300 flex-shrink-0">{t.source}</span>
                  )}
                </div>
                {t.description && (
                  <p className="m-0 mt-0.5 text-[11px] text-neutral-400 truncate">{t.description}</p>
                )}
              </div>

              {/* Badges effort / impact */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={EFFORT_STYLES[t.effort_default]}>
                  {t.effort_default}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={IMPACT_STYLES[t.impact_default]}>
                  {t.impact_default}
                </span>
              </div>

              {/* Sous-domaines impactés */}
              {t.impacts.length > 0 && (
                <div className="hidden md:flex gap-1 flex-shrink-0">
                  {t.impacts.slice(0, 3).map(i => (
                    <span key={i.id} className="text-[10px] px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 font-medium">
                      {i.subdomain_code} → {i.maturity_target}
                    </span>
                  ))}
                  {t.impacts.length > 3 && (
                    <span className="text-[10px] text-neutral-400">+{t.impacts.length - 3}</span>
                  )}
                </div>
              )}

              {/* Actions — visibles au hover */}
              <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => navigate(`/admin/templates/${t.id}`)}
                  className="text-[11px] px-2.5 py-1 rounded border border-neutral-200 bg-white text-neutral-600 cursor-pointer hover:border-neutral-300 transition-colors">
                  Éditer
                </button>
                {t.active && (
                  <button onClick={() => handleDelete(t.id)}
                    className="text-[11px] px-2.5 py-1 rounded border border-neutral-200 bg-white text-neutral-400 cursor-pointer hover:text-danger-700 hover:border-danger-500 transition-colors">
                    Archiver
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
