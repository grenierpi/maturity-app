import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Button, Card, Input, Select, Label, Alert } from '../components/ui'
import { useT } from '../i18n'

export default function CampaignNew() {
  const [framework, setFramework]     = useState([])
  const [suppliers, setSuppliers]     = useState([])
  const [newSupplier, setNewSupplier] = useState(false)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState(null)
  const navigate = useNavigate()
  const { t, tf } = useT()

  const [form, setForm] = useState({
    supplier_id: '', supplier_name: '', supplier_sector: '',
    title: '', consultant_name: '', domain_scope: [],
  })

  useEffect(() => {
    Promise.all([api.framework.get(), api.suppliers.list()])
      .then(([fw, sup]) => { setFramework(fw); setSuppliers(sup) })
      .catch(e => setError(e.message))
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleDomain = (code) =>
    set('domain_scope', form.domain_scope.includes(code)
      ? form.domain_scope.filter(c => c !== code)
      : [...form.domain_scope, code])

  const handleSubmit = async () => {
    setError(null)
    if (!form.title.trim()) return setError(t('campaign_new.title_required'))
    if (!form.domain_scope.length) return setError(t('campaign_new.domains_required'))
    setSaving(true)
    try {
      let supplier_id = form.supplier_id
      if (newSupplier) {
        if (!form.supplier_name.trim()) throw new Error(t('campaign_new.supplier_required'))
        const s = await api.suppliers.create({ name: form.supplier_name, sector: form.supplier_sector })
        supplier_id = s.id
      }
      if (!supplier_id) throw new Error(t('campaign_new.select_supplier'))
      const campaign = await api.campaigns.create({
        supplier_id, title: form.title,
        consultant_name: form.consultant_name,
        domain_scope: form.domain_scope,
      })
      await api.campaigns.initialize(campaign.id)
      navigate(`/campaigns/${campaign.id}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-medium mb-6">{t('campaign_new.title')}</h1>
      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        {/* Fournisseur */}
        <div className="mb-4">
          <Label>{t('campaign_new.supplier')}</Label>
          <div className="flex gap-2 mb-2">
            {[t('campaign_new.existing'), t('campaign_new.new_supplier')].map((label, i) => (
              <button key={label} onClick={() => setNewSupplier(i === 1)}
                className={`text-[12px] px-3 py-1.5 rounded-md border cursor-pointer transition-colors
                  ${(i === 1) === newSupplier
                    ? 'bg-primary-50 border-primary-500 text-primary-700'
                    : 'bg-white border-neutral-200 text-neutral-500'}`}>
                {label}
              </button>
            ))}
          </div>
          {newSupplier ? (
            <div className="flex gap-2">
              <Input className="flex-[2]" placeholder={t('campaign_new.supplier_name')}
                value={form.supplier_name} onChange={e => set('supplier_name', e.target.value)} />
              <Input className="flex-1" placeholder={t('campaign_new.sector')}
                value={form.supplier_sector} onChange={e => set('supplier_sector', e.target.value)} />
            </div>
          ) : (
            <Select value={form.supplier_id} onChange={e => set('supplier_id', e.target.value)}>
              <option value="">{t('campaign_new.select')}</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}{s.sector ? ` (${s.sector})` : ''}</option>
              ))}
            </Select>
          )}
        </div>

        {/* Titre */}
        <div className="mb-4">
          <Label>{t('campaign_new.campaign_title')}</Label>
          <Input placeholder={t('campaign_new.title_placeholder')}
            value={form.title} onChange={e => set('title', e.target.value)} />
        </div>

        {/* Consultant */}
        <div className="mb-5">
          <Label>{t('campaign_new.consultant')}</Label>
          <Input placeholder={t('campaign_new.consultant_placeholder')}
            value={form.consultant_name} onChange={e => set('consultant_name', e.target.value)} />
        </div>

        {/* Domaines */}
        <div className="mb-6">
          <Label>{t('campaign_new.domains_to_audit')}</Label>
          <div className="flex flex-wrap gap-2">
            {framework.map(d => {
              const sel = form.domain_scope.includes(d.code)
              return (
                <button key={d.code} onClick={() => toggleDomain(d.code)}
                  className={`text-[12px] px-3 py-1.5 rounded-md border cursor-pointer transition-colors
                    ${sel ? 'bg-primary-50 border-primary-500 text-primary-700 font-medium'
                          : 'bg-white border-neutral-200 text-neutral-500'}`}>
                  {tf('domains', d.code) || d.label}
                  <span className="text-[10px] ml-1 opacity-60">({d.subdomains.length})</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => navigate('/campaigns')}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={saving} onClick={handleSubmit}>
            {saving ? t('campaign_new.creating') : t('campaign_new.create')}
          </Button>
        </div>
      </Card>
    </div>
  )
}
