import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../api/client'
import { Button, Card, StatBox, ProgressBar, Badge } from '../components/ui'
import { useT } from '../i18n'

export default function CampaignDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState(null)
  const [progress, setProgress] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const { t, tf } = useT()

  useEffect(() => {
    Promise.all([api.campaigns.get(id), api.campaigns.progress(id)])
      .then(([c, p]) => { setCampaign(c); setProgress(p) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <p className="text-neutral-500">{t('common.loading')}</p>
  if (error)   return <p className="text-danger-700">{t('common.error')} : {error}</p>
  if (!campaign) return null

  const global = progress?.global || campaign.progress

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-1">
          <p className="m-0 mb-0.5 text-[12px] text-neutral-500">
            <Link to="/campaigns" className="text-neutral-500 no-underline hover:text-neutral-700">{t('campaigns.title')}</Link> ›
          </p>
          <h1 className="m-0 text-xl font-medium">{campaign.title}</h1>
          <p className="m-0 mt-1 text-[13px] text-neutral-500">
            {campaign.supplier.name}{campaign.consultant_name ? ` · ${campaign.consultant_name}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => navigate(`/campaigns/${id}/interview`)}>
            {t('campaigns.continue_interview')}
          </Button>
          <Button variant="default" onClick={() => navigate(`/campaigns/${id}/synthesis`)}>
            {t('campaigns.synthesis')}
          </Button>
          <Button variant="primary"
            onClick={() => {
              if (progress?.mandatory_unanswered > 0) {
                alert(`${progress.mandatory_unanswered} questions P0/P1 non complètes — répondez-y avant de passer au plan.`)
                return
              }
              navigate(`/campaigns/${id}/plan-selection`)
            }}>
            {t('campaigns.plan')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatBox label={t('campaigns.completion')} value={`${global.pct}%`} sub={`${global.answered}/${global.total} ${t('campaigns.criteria')}`} />
        <StatBox label={t('campaigns.to_review')} value={global.flagged || 0} sub={t('campaigns.flagged_criteria')} />
        <StatBox label={t('campaigns.domains')} value={campaign.domain_scope.length} sub={t('campaigns.in_scope')} />
      </div>

      {/* Progression globale */}
      <Card className="mb-3">
        <div className="flex justify-between mb-2">
          <span className="text-[13px] font-medium">{t('campaigns.global_progress')}</span>
          <span className="text-[13px] text-primary-700 font-medium">{global.pct}%</span>
        </div>
        <ProgressBar pct={global.pct} height="h-2" />
      </Card>

      {/* Par domaine */}
      {progress?.by_domain?.length > 0 && (
        <Card>
          <p className="m-0 mb-4 text-[13px] font-medium">{t('campaigns.by_domain')}</p>
          <div className="flex flex-col gap-3">
            {progress.by_domain.map(d => (
              <div key={d.domain_code}>
                <div className="flex justify-between mb-1">
                  <span className="text-[12px] text-neutral-900">{tf('domains', d.domain_code) || d.domain_label}</span>
                  <span className="text-[12px] text-neutral-500 flex items-center gap-2">
                    {d.answered}/{d.total}
                    {d.flagged > 0 && (
                      <Badge variant="warning">{d.flagged} {t('campaigns.flagged')}</Badge>
                    )}
                  </span>
                </div>
                <ProgressBar pct={d.pct} height="h-1" />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
