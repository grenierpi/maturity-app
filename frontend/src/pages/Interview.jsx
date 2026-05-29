import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import WorkflowNav from '../components/WorkflowNav'
import { Badge, Button, ProgressBar, ScoreButton } from '../components/ui'
import { useT } from '../i18n'

const DOMAIN_COLORS = {
  ORG:  '#7F77DD', PLAN: '#1D9E75', SIM: '#BA7517',
  IQ:   '#E24B4A', ME:  '#378ADD',
}

function groupByDomain(questions) {
  const map = {}
  questions.forEach(q => {
    if (!map[q.domain_code]) {
      map[q.domain_code] = { code: q.domain_code, label: q.domain_label, questions: [], answered: 0, total: 0 }
    }
    map[q.domain_code].questions.push(q)
    map[q.domain_code].answered += q.answered
    map[q.domain_code].total    += q.total
  })
  return map
}

export default function Interview() {
  const { id, questionId } = useParams()
  const navigate            = useNavigate()
  const { t, tf }           = useT()
  const [questions, setQuestions]   = useState([])
  const [detail, setDetail]         = useState(null)
  const [loading, setLoading]       = useState(true)
  const [saved, setSaved]           = useState(false)
  const [openDomains, setOpenDomains] = useState({})
  const commentTimers               = useRef({})
  const savedTimer                  = useRef(null)

  useEffect(() => {
    api.interview.questions(id).then(qs => {
      setQuestions(qs)
      if (!questionId && qs.length > 0) {
        const resume = qs.find(q => q.pct < 100) || qs[0]
        navigate(`/campaigns/${id}/interview/${resume.id}`, { replace: true })
      }
      // Ouvrir les domaines incomplets, fermer les complétés
      const grouped = groupByDomain(qs)
      const initial = {}
      Object.entries(grouped).forEach(([code, d]) => {
        initial[code] = d.total === 0 || d.answered < d.total
      })
      setOpenDomains(initial)
    })
  }, [id])

  // Toujours garder ouvert le domaine de la question active
  useEffect(() => {
    if (!questionId || !questions.length) return
    const activeQ = questions.find(q => q.id === questionId)
    if (activeQ) setOpenDomains(prev => ({ ...prev, [activeQ.domain_code]: true }))
  }, [questionId, questions])

  useEffect(() => {
    if (!questionId) return
    setLoading(true)
    api.interview.question(id, questionId)
      .then(setDetail)
      .finally(() => setLoading(false))
  }, [id, questionId])

  // Feedback visuel "Sauvegardé" pendant 2s après chaque écriture
  const flashSaved = () => {
    setSaved(true)
    clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 2000)
  }

  const saveField = useCallback(async (responseId, field, value) => {
    try {
      await api.interview.saveResponse(id, responseId, { [field]: value })
      setDetail(d => ({
        ...d,
        criteria_responses: d.criteria_responses.map(r =>
          r.response_id === responseId ? { ...r, [field]: value } : r
        ),
      }))
      // Mettre à jour le statut de la question dans la sidebar
      setQuestions(qs => qs.map(q =>
        q.id === questionId
          ? { ...q, answered: q.answered + (field === 'score' ? 1 : 0) }
          : q
      ))
      flashSaved()
    } catch (e) { console.error('Save failed:', e) }
  }, [id, questionId])

  const handleComment = useCallback((responseId, value) => {
    setDetail(d => ({
      ...d,
      criteria_responses: d.criteria_responses.map(r =>
        r.response_id === responseId ? { ...r, comment: value } : r
      ),
    }))
    clearTimeout(commentTimers.current[responseId])
    commentTimers.current[responseId] = setTimeout(() => {
      api.interview.saveResponse(id, responseId, { comment: value })
        .then(flashSaved)
    }, 800)
  }, [id])

  const handleProofUpload = async (responseId, file) => {
    try {
      const proof = await api.interview.uploadProof(id, responseId, file)
      setDetail(d => ({
        ...d,
        criteria_responses: d.criteria_responses.map(r =>
          r.response_id === responseId ? { ...r, proofs: [...r.proofs, proof] } : r
        ),
      }))
      flashSaved()
    } catch (e) { alert(`Upload échoué : ${e.message}`) }
  }

  const handleProofDelete = async (responseId, proofId) => {
    await api.interview.deleteProof(id, responseId, proofId)
    setDetail(d => ({
      ...d,
      criteria_responses: d.criteria_responses.map(r =>
        r.response_id === responseId
          ? { ...r, proofs: r.proofs.filter(p => p.id !== proofId) } : r
      ),
    }))
  }

  const go = (qId) => qId && navigate(`/campaigns/${id}/interview/${qId}`)

  if (!detail && loading) return <p className="text-neutral-500">{t('common.loading')}</p>
  if (!detail) return null

  const { question, criteria_responses: responses, navigation: nav } = detail
  const scored        = responses.filter(r => r.score !== null)
  const questionScore = scored.length
    ? (scored.reduce((s, r) => s + r.score, 0) / scored.length).toFixed(1)
    : null
  const allAnswered   = scored.length === responses.length

  return (
    <div>
    <div className="mb-5"><WorkflowNav current="interview" /></div>
    <div className="grid grid-cols-[200px_1fr] gap-5 items-start">

      {/* Sidebar */}
      <div className="bg-white border border-neutral-200 rounded-xl p-3 sticky top-5 max-h-[calc(100vh-80px)] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <p className="m-0 text-[11px] font-medium text-neutral-500 uppercase tracking-wider">{t('interview.questions')}</p>
          <span className={`text-[10px] transition-opacity duration-300 ${saved ? 'text-success-500 opacity-100' : 'opacity-0'}`}>
            {t('common.saved')}
          </span>
        </div>

        {Object.values(groupByDomain(questions)).map(domain => {
          const isOpen    = !!openDomains[domain.code]
          const domainPct = domain.total > 0 ? Math.round(domain.answered / domain.total * 100) : 0
          const color     = DOMAIN_COLORS[domain.code] || '#888780'
          const allDone   = domainPct === 100
          const toggle    = () => setOpenDomains(prev => ({ ...prev, [domain.code]: !prev[domain.code] }))

          return (
            <div key={domain.code} className="mb-1">

              {/* Header domaine */}
              <button onClick={toggle}
                className="w-full text-left px-2 py-1.5 rounded-lg border-none cursor-pointer
                  hover:bg-neutral-50 transition-colors flex items-center gap-2">
                <span className="text-[10px] text-neutral-400 flex-shrink-0">{isOpen ? '▾' : '▸'}</span>
                <span className="text-[11px] font-semibold truncate flex-1"
                  style={{ color }}>{tf('domains', domain.code) || domain.label}</span>
                <span className={`text-[9px] flex-shrink-0 font-medium ${allDone ? 'text-success-600' : 'text-neutral-400'}`}>
                  {domain.answered}/{domain.total}
                </span>
              </button>

              {/* Barre de progression du domaine */}
              <div className="mx-2 mb-1 h-0.5 bg-neutral-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${domainPct}%`, background: allDone ? '#1D9E75' : color }} />
              </div>

              {/* Questions du domaine */}
              {isOpen && domain.questions.map((q) => {
                const isActive = q.id === questionId
                const globalIdx = questions.findIndex(qq => qq.id === q.id)
                const dotColor  = q.pct === 100  ? 'bg-success-500'
                                : q.flagged      ? 'bg-warning-500'
                                : q.answered > 0 ? 'bg-info-500'
                                : 'bg-neutral-200'
                return (
                  <button key={q.id} onClick={() => go(q.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg border-none cursor-pointer mb-0.5 transition-colors
                      ${isActive ? 'bg-primary-50' : 'bg-transparent hover:bg-neutral-50'}`}>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
                      <div className="flex items-center gap-1 min-w-0">
                        <span className={`text-[11px] truncate ${isActive ? 'text-primary-700 font-medium' : 'text-neutral-700'}`}>
                          {tf('subdomains', q.subdomain_code) || q.subdomain_label}
                        </span>
                        {q.priority === 'P0' && <span className="text-[9px] px-1 py-0.5 rounded flex-shrink-0 font-medium" style={{background:'#FCEBEB',color:'#791F1F'}}>P0</span>}
                        {q.priority === 'P2' && <span className="text-[9px] px-1 py-0.5 rounded flex-shrink-0" style={{background:'#F1EFE8',color:'#888780'}}>P2</span>}
                      </div>
                    </div>
                    <p className="m-0 mt-0.5 ml-3 text-[10px] text-neutral-400">
                      Q{globalIdx + 1} · {q.answered}/{q.total}
                    </p>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Panneau principal */}
      <div>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="primary">{tf('domains', question.domain.code) || question.domain.label}</Badge>
          <span className="text-neutral-300 text-[11px]">›</span>
          <Badge variant="neutral">{tf('subdomains', question.subdomain.code) || question.subdomain.label}</Badge>
          <div className="ml-auto flex items-center gap-2">
            {question.priority && (
              <span className="text-[10px] px-2 py-0.5 rounded font-medium"
                style={{'P0':{background:'#FCEBEB',color:'#791F1F'},'P1':{background:'#FAEEDA',color:'#633806'},'P2':{background:'#F1EFE8',color:'#444441'}}[question.priority]}>
                {detail.question.priority}
              </span>
            )}
            <span className="text-[11px] text-neutral-400">
              {nav.current_index + 1} / {nav.total}
            </span>
          </div>
        </div>

        {/* Question */}
        <div className="bg-neutral-50 rounded-lg px-4 py-3 mb-4">
          <p className="m-0 mb-1 text-[14px] font-medium text-neutral-900">{question.text}</p>
          {question.guidance && (
            <p className="m-0 text-[12px] text-neutral-500 leading-relaxed">{question.guidance}</p>
          )}
        </div>

        {/* Critères */}
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100">
            <p className="m-0 text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
              {t('interview.criteria_to_assess')}
            </p>
          </div>

          {responses.map((r, idx) => (
            <div key={r.response_id}
              className={`px-4 py-4 ${idx < responses.length - 1 ? 'border-b border-neutral-100' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="m-0 mb-0.5 text-[13px] text-neutral-900">{r.criterion.text}</p>
                  {r.criterion.verification_hint && (
                    <p className="m-0 text-[11px] text-neutral-400">{r.criterion.verification_hint}</p>
                  )}
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  {[0,1,2,3,4].map(s => (
                    <ScoreButton key={s} score={s} active={r.score === s}
                      onClick={() => saveField(r.response_id, 'score', s)} />
                  ))}
                </div>
              </div>

              <div className="flex gap-2 mt-2">
                <textarea rows={1}
                  placeholder={t('interview.comment_placeholder')}
                  value={r.comment || ''}
                  onChange={e => handleComment(r.response_id, e.target.value)}
                  className="flex-1 text-[12px] px-2.5 py-1.5 border border-neutral-200 rounded-md bg-white
                    text-neutral-900 placeholder-neutral-400 resize-y min-h-[32px] font-[inherit]
                    focus:outline-none focus:border-primary-500"
                />
                <button onClick={() => saveField(r.response_id, 'flagged', !r.flagged)}
                  className={`text-[11px] px-3 py-1.5 rounded-md border cursor-pointer transition-colors flex-shrink-0 whitespace-nowrap
                    ${r.flagged
                      ? 'bg-warning-50 border-warning-500 text-warning-700'
                      : 'bg-white border-neutral-200 text-neutral-400 hover:border-neutral-300'}`}>
                  {r.flagged ? t('interview.flagged') : t('interview.to_review')}
                </button>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                {r.proofs.map(p => (
                  <span key={p.id} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded
                    border border-neutral-200 bg-neutral-50 text-neutral-600">
                    {p.filename}
                    <button onClick={() => handleProofDelete(r.response_id, p.id)}
                      className="border-none bg-none cursor-pointer text-neutral-400 text-[12px] leading-none p-0 ml-0.5">
                      ×
                    </button>
                  </span>
                ))}
                <label className="cursor-pointer">
                  <input type="file" className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls"
                    onChange={e => e.target.files[0] && handleProofUpload(r.response_id, e.target.files[0])} />
                  <span className="text-[11px] text-neutral-400 underline hover:text-neutral-600">
                    {t('interview.attachment')}
                  </span>
                </label>
              </div>
            </div>
          ))}

          {/* Footer navigation */}
          <div className="px-4 py-3 border-t border-neutral-100 bg-neutral-50 flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] text-neutral-500">{t('interview.question_score')}</span>
                <span className="text-[13px] font-medium text-primary-700">
                  {questionScore !== null ? `${questionScore}/4` : '—'}
                </span>
                {allAnswered && (
                  <span className="text-[10px] text-success-500 font-medium">{t('interview.complete')}</span>
                )}
              </div>
              <ProgressBar pct={questionScore !== null ? (questionScore / 4) * 100 : 0} height="h-1" color="bg-primary-500" />
            </div>
            <Button variant="ghost" size="sm" disabled={!nav.prev_id} onClick={() => go(nav.prev_id)}>
              {t('common.previous')}
            </Button>
            {nav.next_id ? (
              <Button variant="primary" size="sm" onClick={() => go(nav.next_id)}>
                {t('common.next')}
              </Button>
            ) : (
              <Button variant="success" size="sm" onClick={() => navigate(`/campaigns/${id}/synthesis`)}>
                {t('interview.view_synthesis')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}
