import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import WorkflowNav from '../components/WorkflowNav'
import { Button, Card, StatBox } from '../components/ui'
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
const DOMAIN_COLORS = {
  ORG:   { bg: '#EEEDFE', border: '#7F77DD', text: '#3C3489', dot: '#7F77DD' },
  PLAN:  { bg: '#E1F5EE', border: '#1D9E75', text: '#085041', dot: '#1D9E75' },
  SIM:   { bg: '#FAEEDA', border: '#BA7517', text: '#633806', dot: '#BA7517' },
  IQ:    { bg: '#FCEBEB', border: '#E24B4A', text: '#791F1F', dot: '#E24B4A' },
  ME:    { bg: '#E6F1FB', border: '#378ADD', text: '#0C447C', dot: '#378ADD' },
}
const DEFAULT_DC = { bg: '#F1EFE8', border: '#888780', text: '#444441', dot: '#888780' }

const BUCKET_STYLES = {
  critical: { background: '#FCEBEB', color: '#791F1F' },
  weak:     { background: '#FAEEDA', color: '#633806' },
  moderate: { background: '#E6F1FB', color: '#0C447C' },
  good:     { background: '#E1F5EE', color: '#085041' },
  none:     { background: '#F1EFE8', color: '#888780' },
}
function scoreBucket(s) {
  if (s === null || s === undefined) return 'none'
  if (s < 1) return 'critical'; if (s < 2) return 'weak'
  if (s < 3) return 'moderate'; return 'good'
}

// Quadrant effort/impact → position matrice
function getQuadrant(effort, impact) {
  const effortHigh = effort === 'fort'
  const impactHigh = impact === 'fort' || impact === 'moyen'
  if (!effortHigh &&  impactHigh) return 'qs'   // Quick wins
  if ( effortHigh &&  impactHigh) return 'mj'   // Chantiers majeurs
  if (!effortHigh && !impactHigh) return 'fi'   // Petits gains
  return 'dp'                                    // Déprioritiser
}

const QUADRANTS = [
  { id: 'qs', label: 'Quick wins',        sub: 'Effort ↓  Impact ↑', headerBg: '#E1F5EE', headerColor: '#085041', border: '#6DCAAA' },
  { id: 'mj', label: 'Chantiers majeurs', sub: 'Effort ↑  Impact ↑', headerBg: '#EEEDFE', headerColor: '#3C3489', border: '#AFA9EC' },
  { id: 'fi', label: 'Petits gains',      sub: 'Effort ↓  Impact ↓', headerBg: '#F1EFE8', headerColor: '#5F5E5A', border: '#C2C0B6' },
  { id: 'dp', label: 'À déprioritiser',   sub: 'Effort ↑  Impact ↓', headerBg: '#FEF3F2', headerColor: '#791F1F', border: '#F0A8A7' },
]

function RadarTickSmall({ x, y, payload, textAnchor }) {
  return <text x={x} y={y} textAnchor={textAnchor} fill="#888780" fontSize={9}>{payload.value}</text>
}
function RadarTickMedium({ x, y, payload, textAnchor }) {
  return <text x={x} y={y} textAnchor={textAnchor} fill="#888780" fontSize={10}>{payload.value}</text>
}

export default function Roadmap() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { t, tf } = useT()
  const [campaign,  setCampaign]  = useState(null)
  const [items,     setItems]     = useState([])
  const [tobe,      setTobe]      = useState(null)
  const [synthesis, setSynthesis] = useState(null)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      api.campaigns.get(id),
      api.plan.list(id),
      api.plan.tobe(id),
      api.synthesis.synthesis(id),
    ]).then(([c, it, tb, sy]) => {
      setCampaign(c); setItems(it); setTobe(tb); setSynthesis(sy)
    }).finally(() => setLoading(false))
  }, [id])

  if (loading)   return <p className="text-neutral-500 text-[13px]">{t('common.loading')}</p>
  if (!campaign) return null

  const activeItems = items.filter(i => i.status !== 'excluded')
  const supplier    = synthesis?.supplier || {}

  // Numérotation globale des chantiers
  const numberedItems = activeItems.map((item, i) => ({ ...item, num: i + 1 }))

  // Spider global
  const radarGlobal = tobe?.domains?.map(d => ({
    domain:  (tf('domains', d.domain_code) || d.domain_label)?.substring(0, 12) || d.domain_code,
    'As-is': d.as_is  || 0,
    'To-be': d.tobe   || d.as_is || 0,
  })) || []

  // Spider détaillé — sous-domaines ordonnés par domaine
  const radarDetail = tobe?.domains?.flatMap(d =>
    (d.subdomains || []).map(s => ({
      domain:  s.subdomain_code || s.subdomain_label?.substring(0, 8),
      label:   tf('subdomains', s.subdomain_code) || s.subdomain_label,
      domainCode: d.domain_code,
      'As-is': s.as_is  || 0,
      'To-be': s.tobe   || s.as_is || 0,
    }))
  ) || []

  // Regrouper par domaine
  const byDomain = {}
  numberedItems.forEach(item => {
    const code = (item.domain_codes || [])[0] || 'AUTRE'
    if (!byDomain[code]) byDomain[code] = []
    byDomain[code].push(item)
  })
  const domainOrder = tobe?.domains?.map(d => d.domain_code) || []
  const sortedDomains = [
    ...domainOrder.filter(c => byDomain[c]),
    ...Object.keys(byDomain).filter(c => !domainOrder.includes(c))
  ]

  // Matrice effort/impact par quadrant
  const byQuadrant = { qs: [], mj: [], fi: [], dp: [] }
  numberedItems.forEach(item => {
    const q = getQuadrant(item.effort, item.impact)
    byQuadrant[q].push(item)
  })

  return (
    <div className="max-w-4xl">

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-1">
          <p className="m-0 mb-0.5 text-[11px] text-neutral-400">
            <button onClick={() => navigate(`/campaigns/${id}/plan`)}
              className="bg-transparent border-none cursor-pointer text-neutral-400 text-[11px] p-0 hover:text-neutral-600">
              {t('plan_qualification.title')}
            </button>
            <span className="mx-1.5">›</span>Synthèse finale
          </p>
          <h1 className="m-0 text-[18px] font-semibold text-neutral-900 tracking-tight">
            Synthèse de transformation
          </h1>
          <p className="m-0 mt-1 text-[12px] text-neutral-400">
            {supplier.name}{supplier.sector ? ` · ${supplier.sector}` : ''}
            {campaign.consultant_name ? ` · ${campaign.consultant_name}` : ''}
          </p>
        </div>
        <a href={`/api/campaigns/${id}/report-roadmap.pdf`} target="_blank" className="no-underline">
          <Button variant="default" size="sm">{t('common.export_pdf')}</Button>
        </a>
      </div>
      <div className="mb-5"><WorkflowNav current="roadmap" /></div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatBox label="Chantiers retenus" value={activeItems.length} />
        <StatBox label="Complétion audit"  value={`${synthesis?.stats?.completion_pct || 0}%`} />
        <StatBox label="Domaines couverts" value={campaign.domain_scope?.length || 0} />
      </div>

      {/* Deux spiders côte à côte */}
      {radarGlobal.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-5">

          <Card>
            <p className="m-0 mb-0.5 text-[13px] font-medium">Vue globale</p>
            <p className="m-0 mb-3 text-[11px] text-neutral-400">As-is vs To-be par domaine</p>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarGlobal} margin={{ top: 15, right: 35, bottom: 15, left: 35 }}>
                <PolarGrid stroke="#F1EFE8" strokeDasharray="3 3" />
                <PolarAngleAxis dataKey="domain" tick={<RadarTickMedium />} />
                <PolarRadiusAxis domain={[0, 4]} tick={{ fontSize: 8, fill: '#D3D1C7' }} tickCount={5} axisLine={false} />
                <Radar name="As-is" dataKey="As-is" stroke="#C2C0B6" fill="#F1EFE8" fillOpacity={0.5} strokeWidth={1.5} />
                <Radar name="To-be" dataKey="To-be" stroke="#7F77DD" fill="#EEEDFE" fillOpacity={0.6} strokeWidth={2} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <Tooltip formatter={v => typeof v === 'number' ? v.toFixed(1)+'/4' : v}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '0.5px solid #D3D1C7' }} />
              </RadarChart>
            </ResponsiveContainer>
          </Card>

          {/* Spider détaillé avec séparateurs visuels par domaine */}
          <Card>
            <p className="m-0 mb-0.5 text-[13px] font-medium">Vue détaillée</p>
            <p className="m-0 mb-3 text-[11px] text-neutral-400">As-is vs To-be par sous-domaine</p>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarDetail} margin={{ top: 20, right: 45, bottom: 20, left: 45 }}>
                <PolarGrid stroke="#F1EFE8" strokeDasharray="3 3" />
                <PolarAngleAxis dataKey="domain" tick={<RadarTickSmall />} />
                <PolarRadiusAxis domain={[0, 4]} tick={{ fontSize: 8, fill: '#D3D1C7' }} tickCount={5} axisLine={false} />
                <Radar name="As-is" dataKey="As-is" stroke="#C2C0B6" fill="#F1EFE8" fillOpacity={0.4} strokeWidth={1.5} />
                <Radar name="To-be" dataKey="To-be" stroke="#E24B4A" fill="#FCEBEB" fillOpacity={0.35} strokeWidth={2} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <Tooltip
                  formatter={v => typeof v === 'number' ? v.toFixed(1)+'/4' : v}
                  labelFormatter={label => {
                    const sd = radarDetail.find(d => d.domain === label)
                    return sd?.label || label
                  }}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '0.5px solid #D3D1C7' }} />
              </RadarChart>
            </ResponsiveContainer>
            {/* Légende domaines pour le spider détaillé */}
            <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
              {tobe?.domains?.map(d => {
                const dc = DOMAIN_COLORS[d.domain_code] || DEFAULT_DC
                return (
                  <span key={d.domain_code} className="flex items-center gap-1 text-[9px]"
                    style={{ color: dc.text }}>
                    <span className="w-2 h-2 rounded-sm flex-shrink-0"
                      style={{ background: dc.bg, border: `1px solid ${dc.border}` }} />
                    {tf('domains', d.domain_code) || d.domain_label}
                  </span>
                )
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Matrice effort / impact */}
      {activeItems.length > 0 && (
        <Card className="mb-5">
          <p className="m-0 mb-1 text-[13px] font-medium">Matrice effort / impact</p>
          <p className="m-0 mb-4 text-[11px] text-neutral-400">
            Les numéros correspondent à l'ordre des chantiers dans le plan
          </p>
          <div className="grid grid-cols-2 gap-3">
            {QUADRANTS.map(q => {
              const qItems = byQuadrant[q.id]
              return (
                <div key={q.id} className="rounded-xl overflow-hidden border"
                  style={{ borderColor: q.border }}>
                  <div className="px-3 py-2 flex items-baseline gap-2"
                    style={{ background: q.headerBg }}>
                    <p className="m-0 text-[12px] font-semibold" style={{ color: q.headerColor }}>
                      {q.label}
                    </p>
                    <p className="m-0 text-[9px] opacity-60" style={{ color: q.headerColor }}>
                      {q.sub}
                    </p>
                    <span className="ml-auto text-[10px] font-medium opacity-70"
                      style={{ color: q.headerColor }}>
                      {qItems.length}
                    </span>
                  </div>
                  <div className="p-2 min-h-[80px] bg-white">
                    {qItems.length === 0 ? (
                      <p className="text-[11px] text-neutral-300 text-center py-4 m-0">—</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {qItems.map(item => {
                          const dc = DOMAIN_COLORS[(item.domain_codes || [])[0]] || DEFAULT_DC
                          return (
                            <div key={item.id}
                              className="flex items-start gap-1.5 rounded-lg px-2 py-1.5 border text-[11px]"
                              style={{ background: dc.bg, borderColor: dc.border, maxWidth: '100%' }}>
                              {/* Numéro */}
                              <span className="flex-shrink-0 w-4 h-4 rounded-full text-[9px] font-bold
                                flex items-center justify-center mt-0.5"
                                style={{ background: dc.border, color: '#fff' }}>
                                {item.num}
                              </span>
                              <span className="leading-snug" style={{ color: dc.text }}>
                                {item.label}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {/* Légende couleurs domaines */}
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-neutral-100">
            <span className="text-[10px] text-neutral-400 mr-1">Domaines :</span>
            {sortedDomains.map(code => {
              const dc = DOMAIN_COLORS[code] || DEFAULT_DC
              const d  = tobe?.domains?.find(d => d.domain_code === code)
              return (
                <span key={code} className="flex items-center gap-1 text-[10px]"
                  style={{ color: dc.text }}>
                  <span className="w-2.5 h-2.5 rounded-sm"
                    style={{ background: dc.bg, border: `1px solid ${dc.border}` }} />
                  {tf('domains', code) || d?.domain_label || code}
                </span>
              )
            })}
          </div>
        </Card>
      )}

      {/* Chantiers groupés par domaine */}
      {activeItems.length === 0 ? (
        <Card>
          <p className="text-neutral-400 text-[13px] text-center py-4 m-0">
            Aucun chantier —{' '}
            <button onClick={() => navigate(`/campaigns/${id}/plan-selection`)}
              className="bg-transparent border-none cursor-pointer text-primary-700 p-0 hover:underline text-[13px]">
              retourner à la sélection
            </button>
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {sortedDomains.map(domainCode => {
            const domainItems = byDomain[domainCode] || []
            const domainData  = tobe?.domains?.find(d => d.domain_code === domainCode)
            const dc          = DOMAIN_COLORS[domainCode] || DEFAULT_DC
            const gain        = domainData?.tobe && domainData?.as_is
              ? domainData.tobe - domainData.as_is : 0

            return (
              <div key={domainCode}
                className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 border-b border-neutral-100"
                  style={{ borderLeft: `3px solid ${dc.dot}` }}>
                  <div className="flex-1">
                    <p className="m-0 text-[14px] font-semibold" style={{ color: dc.text }}>
                      {tf('domains', domainCode) || domainData?.domain_label || domainCode}
                    </p>
                    <p className="m-0 mt-0.5 text-[11px] text-neutral-400">
                      {domainItems.length} chantier{domainItems.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  {domainData && (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="m-0 text-[10px] text-neutral-400">As-is</p>
                        <p className="m-0 text-[13px] font-medium text-neutral-600">
                          {domainData.as_is?.toFixed(1) ?? '—'}/4
                        </p>
                      </div>
                      <span className="text-neutral-300">→</span>
                      <div className="text-right">
                        <p className="m-0 text-[10px] text-neutral-400">To-be</p>
                        <p className="m-0 text-[13px] font-medium" style={{ color: dc.dot }}>
                          {domainData.tobe?.toFixed(1) ?? '—'}/4
                        </p>
                      </div>
                      {gain > 0.05 && (
                        <span className="text-[10px] px-2 py-0.5 rounded font-medium"
                          style={{ background: dc.bg, color: dc.text }}>
                          +{gain.toFixed(1)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="divide-y divide-neutral-50">
                  {domainItems.map(item => (
                    <div key={item.id} className="flex items-start gap-3 px-5 py-3">
                      {/* Numéro */}
                      <span className="flex-shrink-0 w-5 h-5 rounded-full text-[9px] font-bold
                        flex items-center justify-center mt-0.5"
                        style={{ background: dc.dot, color: '#fff' }}>
                        {item.num}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="m-0 mb-1 text-[13px] font-medium text-neutral-900 leading-snug">
                          {item.label}
                        </p>
                        {item.description && (
                          <p className="m-0 mb-2 text-[11px] text-neutral-500 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] px-2 py-0.5 rounded font-medium"
                            style={EFFORT_STYLES[item.effort]}>Effort : {t(`effort_impact.${item.effort}`)}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded font-medium"
                            style={IMPACT_STYLES[item.impact]}>Impact : {t(`effort_impact.${item.impact}`)}</span>
                          {item.template_impacts?.map(ti => (
                            <span key={ti.subdomain_id}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 font-medium">
                              {ti.subdomain_code} → {ti.maturity_target}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tableau maturité */}
      {synthesis?.heatmap && tobe && (
        <Card className="mt-5" padding={false}>
          <div className="px-5 py-3 border-b border-neutral-100 grid"
            style={{ gridTemplateColumns: '1fr 80px 80px 60px' }}>
            <p className="m-0 text-[12px] font-medium text-neutral-700">Sous-domaine</p>
            <p className="m-0 text-[10px] text-neutral-400 font-medium">As-is</p>
            <p className="m-0 text-[10px] text-neutral-400 font-medium">To-be</p>
            <p className="m-0 text-[10px] text-neutral-400 font-medium">Δ</p>
          </div>
          {synthesis.heatmap.map(domain => {
            const dc = DOMAIN_COLORS[domain.domain_code] || DEFAULT_DC
            return (
              <div key={domain.domain_code}>
                <div className="px-5 py-1.5 border-b border-neutral-100"
                  style={{ background: dc.bg, borderLeft: `3px solid ${dc.border}` }}>
                  <span className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: dc.text }}>{tf('domains', domain.domain_code) || domain.domain_label}</span>
                </div>
                {domain.subdomains.map(sd => {
                  const tobeSD = tobe?.domains
                    ?.find(d => d.domain_code === domain.domain_code)
                    ?.subdomains?.find(s => s.subdomain_code === sd.subdomain_code)
                  const gain = tobeSD?.tobe && tobeSD?.as_is ? tobeSD.tobe - tobeSD.as_is : 0
                  return (
                    <div key={sd.subdomain_code}
                      className="grid border-b border-neutral-50 last:border-0 px-5"
                      style={{ gridTemplateColumns: '1fr 80px 80px 60px' }}>
                      <div className="py-2.5 flex items-center">
                        <span className="text-[11px] text-neutral-700">{tf('subdomains', sd.subdomain_code) || sd.subdomain_label}</span>
                      </div>
                      <div className="py-2.5 flex items-center">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                          style={BUCKET_STYLES[scoreBucket(sd.score)]}>
                          {sd.score !== null ? `${sd.score}/4` : '—'}
                        </span>
                      </div>
                      <div className="py-2.5 flex items-center">
                        {tobeSD?.tobe ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                            style={BUCKET_STYLES[scoreBucket(tobeSD.tobe)]}>
                            {tobeSD.tobe.toFixed(1)}/4
                          </span>
                        ) : <span className="text-[10px] text-neutral-300">—</span>}
                      </div>
                      <div className="py-2.5 flex items-center">
                        {gain > 0.05 && (
                          <span className="text-[10px] text-success-600 font-medium">+{gain.toFixed(1)}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}
