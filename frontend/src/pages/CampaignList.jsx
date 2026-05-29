import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api/client'
import { Badge, Button, ProgressBar } from '../components/ui'
import { useT } from '../i18n'

export default function CampaignList() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const navigate = useNavigate()
  const { t } = useT()

  useEffect(() => {
    api.campaigns.list()
      .then(setCampaigns)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-neutral-500">{t('common.loading')}</p>
  if (error)   return <p className="text-danger-700">{t('common.error')} : {error}</p>

  return (
    <div>
      <div className="flex items-center mb-6">
        <h1 className="text-xl font-medium m-0">{t('campaigns.title')}</h1>
        <Button variant="primary" className="ml-auto" onClick={() => navigate('/campaigns/new')}>
          {t('campaigns.new')}
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-neutral-200 rounded-xl text-neutral-500">
          <p className="text-[15px] mb-1">{t('campaigns.empty')}</p>
          <p className="text-[13px]">{t('campaigns.empty_hint')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {campaigns.map(c => (
            <Link key={c.id} to={`/campaigns/${c.id}`} className="no-underline">
              <div className="bg-white border border-neutral-200 rounded-xl px-5 py-4 flex items-center gap-4 hover:border-neutral-300 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="m-0 font-medium text-[14px] text-neutral-900">{c.title}</p>
                  <p className="m-0 mt-0.5 text-[12px] text-neutral-500">
                    {c.supplier.name}
                    {c.consultant_name ? ` · ${c.consultant_name}` : ''}
                    {' · '}{new Date(c.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <Badge variant={c.status}>{t(`status.${c.status}`)}</Badge>
                <div className="text-right min-w-[56px]">
                  <p className="m-0 text-[14px] font-medium text-primary-700">{c.progress.pct}%</p>
                  <p className="m-0 text-[11px] text-neutral-400">{c.progress.answered}/{c.progress.total}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
