import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import WorkflowNav from '../components/WorkflowNav'
import { Badge, Button, Card, StatBox, ScoreBucketBadge } from '../components/ui'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Tooltip, ResponsiveContainer
} from 'recharts'
import { useT } from '../i18n'

function scoreBucket(s) {
  if (s === null || s === undefined) return 'none'
  if (s < 1) return 'critical'
  if (s < 2) return 'weak'
  if (s < 3) return 'moderate'
  return 'good'
}

function RadarTick({ x, y, payload, textAnchor }) {
  return (
    <text x={x} y={y} textAnchor={textAnchor} fill="#888780" fontSize={11}>
      {payload.value}
    </text>
  )
}

export default function Synthesis() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { t, tf } = useT()
  const [synthesis,   setSynthesis]   = useState(null)
  const [weakPoints,  setWeakPoints]  = useState([])
  const [loading,     setLoading]     = useState(true)
  const [tobe,        setTobe]        = useState(null)
  const [notes,       setNotes]       = useState('')
  const [notesTimer,  setNotesTimer]  = useState(null)

  const BUCKET_STYLES = {
    critical: { bg: '#FCEBEB', color: '#791F1F', label: t('score.critical') },
    weak:     { bg: '#FAEEDA', color: '#633806', label: t('score.weak') },
    moderate: { bg: '#E6F1FB', color: '#0C447C', label: t('score.moderate') },
    good:     { bg: '#E1F5EE', color: '#085041', label: t('score.good') },
    none:     { bg: '#F1EFE8', color: '#888780', label: '—' },
  }

  useEffect(() => {
    Promise.all([
      api.synthesis.synthesis(id),
      api.assessment.weakPoints(id),
      api.plan.tobe(id),
    ]).then(([s, wp, tb]) => {
      setSynthesis(s)
      setWeakPoints(wp)
      setTobe(tb)
      setNotes(s.campaign.synthesis_notes || '')
    }).finally(() => setLoading(false))
  }, [id])

  const handleNotes = (val) => {
    setNotes(val)
    clearTimeout(notesTimer)
    setNotesTimer(setTimeout(() => api.synthesis.saveNotes(id, val), 1000))
  }

  if (loading)    return <p className="text-neutral-500 text-[13px]">{t('common.loading')}</p>
  if (!synthesis) return null

  const { campaign, supplier, stats, radar, heatmap } = synthesis

  // Spider global (domaines)
  const radarGlobal = radar.map(d => ({
    domain: (tf('domains', d.domain_code) || d.domain_label)?.substring(0, 14) || d.domain_code,
    score:  d.score || 0,
  }))

  // Spider détaillé — sous-domaines ordonnés par domaine via tobe (même ordre que roadmap)
  const DOMAIN_COLORS_DETAIL = {
    ORG:  { stroke: '#7F77DD', fill: '#EEEDFE' },
    PLAN: { stroke: '#1D9E75', fill: '#E1F5EE' },
    SIM:  { stroke: '#BA7517', fill: '#FAEEDA' },
    IQ:   { stroke: '#E24B4A', fill: '#FCEBEB' },
    ME:   { stroke: '#378ADD', fill: '#E6F1FB' },
  }
  const radarDetail = tobe?.domains?.flatMap(d =>
    (d.subdomains || []).map(s => ({
      domain:     s.subdomain_code,
      fullLabel:  tf('subdomains', s.subdomain_code) || s.subdomain_label,
      domainCode: d.domain_code,
      score:      s.as_is || 0,
    }))
  ) || heatmap.flatMap(d => d.subdomains).map(sd => ({
    domain:    sd.subdomain_code,
    fullLabel: tf('subdomains', sd.subdomain_code) || sd.subdomain_label,
    score:     sd.score || 0,
  }))

  return (
    <div className="max-w-4xl">

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-1">
          <p className="m-0 mb-0.5 text-[11px] text-neutral-400">
            <button onClick={() => navigate(`/campaigns/${id}`)}
              className="bg-transparent border-none cursor-pointer text-neutral-400 text-[11px] p-0 hover:text-neutral-600">
              {campaign.title}
            </button>
            <span className="mx-1.5">›</span>{t('workflow.synthesis')}
          </p>
          <h1 className="m-0 text-[18px] font-semibold text-neutral-900 tracking-tight">
            {t('synthesis.title')} {supplier.name}
          </h1>
          <p className="m-0 mt-1 text-[12px] text-neutral-400">
            {supplier.sector && `${supplier.sector} · `}{stats.completion_pct}% {t('synthesis.completed')}
            {stats.criteria_flagged > 0 && ` · ${stats.criteria_flagged} ${t('synthesis.flagged')}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href={`/api/campaigns/${id}/report.pdf`} target="_blank" className="no-underline">
            <Button variant="default" size="sm">{t('common.export_pdf')}</Button>
          </a>
          <Button variant="success" onClick={() => navigate(`/campaigns/${id}/plan-selection`)}>
            {t('synthesis.projects_btn')}
          </Button>
        </div>
      </div>
      <div className="mb-5"><WorkflowNav current="synthesis" /></div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatBox label={t('synthesis.completion')}       value={`${stats.completion_pct}%`} sub={`${stats.criteria_answered} ${t('synthesis.assessed_criteria')}`} />
        <StatBox label={t('synthesis.general_observations')}  value={stats.criteria_flagged}     sub={`${t('synthesis.flagged')}`} />
        <StatBox label={t('synthesis.audited_domains')} value={campaign.domain_scope?.length} sub={t('synthesis.in_scope')} />
      </div>

      {/* Spiders côte à côte */}
      <div className="grid grid-cols-2 gap-4 mb-5">

        {/* Spider global — domaines */}
        <Card>
          <p className="m-0 mb-1 text-[13px] font-medium">{t('synthesis.global_maturity')}</p>
          <p className="m-0 mb-3 text-[11px] text-neutral-400">{t('synthesis.domain_view')}</p>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarGlobal} margin={{ top: 20, right: 35, bottom: 20, left: 35 }}>
              <PolarGrid stroke="#F1EFE8" strokeDasharray="3 3" />
              <PolarAngleAxis dataKey="domain" tick={<RadarTick />} />
              <PolarRadiusAxis domain={[0, 4]} tick={{ fontSize: 9, fill: '#D3D1C7' }} tickCount={5} axisLine={false} />
              <Radar dataKey="score" stroke="#7F77DD" fill="#EEEDFE" fillOpacity={0.6} strokeWidth={2} />
              <Tooltip formatter={v => typeof v === 'number' ? v.toFixed(1) + '/4' : v}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '0.5px solid #D3D1C7' }} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>

        {/* Spider détaillé — sous-domaines triés par domaine */}
        <Card>
          <p className="m-0 mb-1 text-[13px] font-medium">{t('synthesis.detailed_maturity')}</p>
          <p className="m-0 mb-3 text-[11px] text-neutral-400">{t('synthesis.subdomain_view')}</p>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarDetail} margin={{ top: 20, right: 45, bottom: 20, left: 45 }}>
              <PolarGrid stroke="#F1EFE8" strokeDasharray="3 3" />
              <PolarAngleAxis dataKey="domain" tick={{ fontSize: 9, fill: '#888780' }} />
              <PolarRadiusAxis domain={[0, 4]} tick={{ fontSize: 8, fill: '#D3D1C7' }} tickCount={5} axisLine={false} />
              <Radar dataKey="score" stroke="#7F77DD" fill="#EEEDFE" fillOpacity={0.55} strokeWidth={1.5} />
              <Tooltip
                formatter={v => typeof v === 'number' ? v.toFixed(1) + '/4' : v}
                labelFormatter={label => radarDetail.find(d => d.domain === label)?.fullLabel || label}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '0.5px solid #D3D1C7' }} />
            </RadarChart>
          </ResponsiveContainer>
          {/* Légende domaines */}
          <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
            {tobe?.domains?.map(d => {
              const dc = DOMAIN_COLORS_DETAIL[d.domain_code] || { stroke: '#888780', fill: '#F1EFE8' }
              return (
                <span key={d.domain_code} className="flex items-center gap-1 text-[9px] text-neutral-500">
                  <span className="w-2 h-2 rounded-sm flex-shrink-0"
                    style={{ background: dc.fill, border: `1px solid ${dc.stroke}` }} />
                  {tf('domains', d.domain_code) || d.domain_label}
                </span>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Notes consultant */}
      <Card className="mb-5">
        <p className="m-0 mb-2 text-[13px] font-medium">{t('synthesis.consultant_notes')}</p>
        <textarea rows={3} value={notes} onChange={e => handleNotes(e.target.value)}
          placeholder={t('synthesis.notes_placeholder')}
          className="w-full text-[12px] px-3 py-2 border border-neutral-200 rounded-lg bg-white
            text-neutral-900 placeholder-neutral-400 resize-y font-[inherit]
            focus:outline-none focus:border-primary-500" />
      </Card>

      {/* Table maturité + points faibles */}
      <Card padding={false}>
        <div className="px-5 py-4 border-b border-neutral-100">
          <p className="m-0 text-[13px] font-medium">{t('synthesis.weak_points_title')}</p>
          <p className="m-0 mt-0.5 text-[11px] text-neutral-400">
            {t('synthesis.weak_points_hint')}
          </p>
        </div>

        {heatmap.map(domain => (
          <div key={domain.domain_code}>
            {/* Header domaine */}
            <div className="px-5 py-2 bg-neutral-50 border-b border-neutral-100 flex items-center gap-3">
              <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider">
                {tf('domains', domain.domain_code) || domain.domain_label}
              </span>
              <span className="text-[11px] text-neutral-400">
                {(radar.find(d => d.domain_code === domain.domain_code)?.score ?? 0).toFixed(1)}/4
              </span>
            </div>

            {domain.subdomains.map(sd => {
              const wp = weakPoints.find(w => w.subdomain_code === sd.subdomain_code)
              const bucket = scoreBucket(sd.score)
              const bs = BUCKET_STYLES[bucket]

              return (
                <div key={sd.subdomain_code}
                  className="grid border-b border-neutral-50 last:border-0"
                  style={{ gridTemplateColumns: '220px 80px 1fr' }}>

                  {/* Sous-domaine */}
                  <div className="px-5 py-3 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: bs.color }} />
                    <span className="text-[12px] text-neutral-800">{tf('subdomains', sd.subdomain_code) || sd.subdomain_label}</span>
                  </div>

                  {/* Score */}
                  <div className="py-3 flex items-center">
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: bs.bg, color: bs.color }}>
                      {sd.score !== null ? `${sd.score}/4` : '—'}
                    </span>
                  </div>

                  {/* Points faibles */}
                  <div className="px-4 py-2.5 flex flex-col gap-1.5">
                    {wp?.weak_points?.length > 0 ? (
                      wp.weak_points.map((pt, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 font-medium
                            ${pt.score === 0 ? 'bg-danger-50 text-danger-700'
                              : pt.score === 1 ? 'bg-warning-50 text-warning-700'
                              : 'bg-info-50 text-info-700'}`}>
                            {pt.score}/4
                          </span>
                          {pt.flagged && (
                            <span className="text-[9px] text-warning-500 flex-shrink-0 mt-0.5">⚑</span>
                          )}
                          <span className="text-[11px] text-neutral-600 leading-relaxed">
                            {pt.criterion_text}
                            {pt.comment && (
                              <span className="text-neutral-400 italic"> — {pt.comment}</span>
                            )}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-[11px] text-neutral-300 italic">
                        {sd.score !== null ? t('synthesis.no_weak_points') : t('synthesis.not_assessed')}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </Card>

      {/* CTA bas de page */}
      <div className="flex justify-end mt-5">
        <Button variant="success" onClick={() => navigate(`/campaigns/${id}/plan-selection`)}>
          {t('synthesis.validate_btn')}
        </Button>
      </div>
    </div>
  )
}
