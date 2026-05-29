import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useT } from '../i18n'

export default function WorkflowNav({ current }) {
  const navigate = useNavigate()
  const { id }   = useParams()
  const { t }    = useT()
  const [locks, setLocks] = useState({})

  const STEPS = [
    { key: 'interview',      label: t('workflow.interview'),     path: id => `/campaigns/${id}/interview` },
    { key: 'synthesis',      label: t('workflow.synthesis'),     path: id => `/campaigns/${id}/synthesis` },
    { key: 'plan-selection', label: t('workflow.projects'),      path: id => `/campaigns/${id}/plan-selection` },
    { key: 'plan',           label: t('workflow.qualification'), path: id => `/campaigns/${id}/plan` },
    { key: 'roadmap',        label: t('workflow.roadmap'),       path: id => `/campaigns/${id}/roadmap` },
    { key: 'gantt',          label: t('workflow.planning'),      path: id => `/campaigns/${id}/gantt` },
    { key: 'sheets',         label: t('workflow.sheets'),        path: id => `/campaigns/${id}/sheets` },
  ]

  useEffect(() => {
    if (!id) return
    Promise.allSettled([
      api.campaigns.progress(id),
      api.plan.list(id),
    ]).then(([progressRes, planRes]) => {
      const progress = progressRes.status === 'fulfilled' ? progressRes.value : null
      const plan     = planRes.status     === 'fulfilled' ? planRes.value     : []
      if (!progress) return
      const interviewDone = progress.mandatory_unanswered === 0 && progress.global.total > 0
      const planCount     = plan.filter(i => i.status !== 'excluded').length
      setLocks({
        interview:        false,
        synthesis:        !interviewDone,
        'plan-selection': !interviewDone,
        plan:             planCount === 0,
        roadmap:          planCount === 0,
        gantt:            planCount === 0,
        sheets:           planCount === 0,
      })
    })
  }, [id])

  const currentIdx = STEPS.findIndex(s => s.key === current)

  return (
    <div className="workflow-strip">
      {STEPS.map((step, i) => {
        const isDone    = i < currentIdx
        const isCurrent = i === currentIdx
        const isNext    = i === currentIdx + 1
        const isLocked  = !!locks[step.key]

        let cls = 'wf-step '
        if (isLocked)       cls += 'locked'
        else if (isCurrent) cls += 'current'
        else if (isDone)    cls += 'done'
        else if (isNext)    cls += 'next'
        else                cls += 'future'

        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && <div className={`wf-connector ${isDone && !isLocked ? 'done' : ''}`} />}
            <button
              className={cls}
              onClick={() => !isLocked && navigate(step.path(id))}
              title={isLocked ? t('lock_tooltip') : step.label}
            >
              {isDone && !isLocked && (
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="1.5,6 4.5,9 10.5,3"/>
                </svg>
              )}
              {isLocked && <span style={{ fontSize: 9, opacity: 0.5 }}>○</span>}
              {step.label}
            </button>
          </div>
        )
      })}
    </div>
  )
}
