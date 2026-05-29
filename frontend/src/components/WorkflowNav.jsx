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
    <div className="flex items-center gap-0.5">
      {STEPS.map((step, i) => {
        const isDone    = i < currentIdx
        const isCurrent = i === currentIdx
        const isNext    = i === currentIdx + 1
        const isLocked  = !!locks[step.key]

        return (
          <div key={step.key} className="flex items-center">
            {i > 0 && (
              <div className={`w-4 h-px flex-shrink-0 ${isDone && !isLocked ? 'bg-primary-500' : 'bg-neutral-200'}`} />
            )}
            <button
              onClick={() => !isLocked && navigate(step.path(id))}
              title={isLocked ? t('lock_tooltip') : step.label}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] border transition-all
                ${isLocked
                  ? 'bg-neutral-50 border-neutral-200 text-neutral-300 cursor-not-allowed'
                  : isCurrent
                  ? 'bg-primary-50 border-primary-500 text-primary-700 font-semibold cursor-pointer'
                  : isDone
                  ? 'bg-white border-success-500 text-success-700 hover:bg-success-50 cursor-pointer'
                  : isNext
                  ? 'bg-white border-neutral-300 text-neutral-600 hover:border-primary-400 hover:text-primary-700 cursor-pointer'
                  : 'bg-white border-neutral-200 text-neutral-400 hover:border-neutral-300 cursor-pointer'}`}>
              {isDone && !isLocked && <span className="text-[9px]">✓</span>}
              {isLocked && <span className="text-[9px]">○</span>}
              {step.label}
            </button>
          </div>
        )
      })}
    </div>
  )
}
