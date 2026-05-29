import { useState, useEffect, useRef } from 'react'
import { api } from '../../api/client'

// ─── Constantes ──────────────────────────────────────────────────────────────

const EFFORT_OPTS = ['faible', 'moyen', 'fort']
const EFFORT_STYLES = {
  faible: { background: '#EAF3DE', color: '#27500A' },
  moyen:  { background: '#FAEEDA', color: '#633806' },
  fort:   { background: '#FCEBEB', color: '#791F1F' },
}

// ─── Composants utilitaires ───────────────────────────────────────────────────

function InlineInput({ value, onSave, placeholder, multiline = false, className = '' }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(value || '')
  const ref                   = useRef()

  useEffect(() => { setVal(value || '') }, [value])
  useEffect(() => { if (editing && ref.current) ref.current.focus() }, [editing])

  const save = () => {
    setEditing(false)
    if (val.trim() !== (value || '').trim()) onSave(val.trim())
  }

  if (!editing) return (
    <span
      onClick={e => { e.stopPropagation(); setEditing(true) }}
      title="Cliquer pour modifier"
      className={`cursor-text hover:bg-neutral-100 rounded px-1 -ml-1 transition-colors ${className} ${!val ? 'text-neutral-300 italic' : ''}`}>
      {val || placeholder}
    </span>
  )

  const props = {
    ref, value: val,
    onChange: e => setVal(e.target.value),
    onBlur: save,
    onKeyDown: e => {
      if (e.key === 'Enter' && !multiline) { e.preventDefault(); save() }
      if (e.key === 'Escape') { setVal(value || ''); setEditing(false) }
    },
    className: `border border-primary-500 rounded px-1.5 py-0.5 text-neutral-900 bg-white focus:outline-none w-full ${className}`,
    placeholder,
  }

  return multiline
    ? <textarea {...props} rows={2} style={{ resize: 'vertical', minHeight: 36 }} />
    : <input {...props} />
}

function DeleteButton({ onDelete, label }) {
  const [confirm, setConfirm] = useState(false)
  if (!confirm) return (
    <button onClick={() => setConfirm(true)}
      className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] px-2 py-0.5 rounded border border-neutral-200 bg-white text-neutral-400 hover:text-danger-700 hover:border-danger-400 cursor-pointer">
      ×
    </button>
  )
  return (
    <span className="flex items-center gap-1">
      <span className="text-[10px] text-danger-700">Supprimer ?</span>
      <button onClick={onDelete}
        className="text-[10px] px-2 py-0.5 rounded bg-danger-50 border border-danger-500 text-danger-700 cursor-pointer">
        Oui
      </button>
      <button onClick={() => setConfirm(false)}
        className="text-[10px] px-2 py-0.5 rounded border border-neutral-200 bg-white text-neutral-500 cursor-pointer">
        Non
      </button>
    </span>
  )
}

// ─── Criterion row ────────────────────────────────────────────────────────────

function CriterionRow({ criterion, onUpdate, onDelete }) {
  return (
    <div className="group flex items-start gap-2 py-1.5 px-3 rounded-lg hover:bg-neutral-50 transition-colors ml-8">
      <span className="text-neutral-300 text-[11px] mt-0.5 flex-shrink-0">·</span>
      <div className="flex-1 min-w-0">
        <InlineInput
          value={criterion.text}
          onSave={v => onUpdate(criterion.id, { text: v })}
          placeholder="Texte du critère"
          className="text-[12px] text-neutral-800 block w-full"
        />
        <InlineInput
          value={criterion.verification_hint}
          onSave={v => onUpdate(criterion.id, { verification_hint: v })}
          placeholder="Hint de vérification…"
          className="text-[11px] text-neutral-400 block w-full mt-0.5"
        />
        <InlineInput
          value={criterion.recommendation_label}
          onSave={v => onUpdate(criterion.id, { recommendation_label: v })}
          placeholder="Recommandation (chantier associé)…"
          className="text-[11px] text-neutral-400 block w-full mt-0.5"
        />
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
        {EFFORT_OPTS.map(opt => (
          <button key={opt} onClick={() => onUpdate(criterion.id, { effort_default: opt })}
            style={criterion.effort_default === opt ? EFFORT_STYLES[opt] : {}}
            className={`text-[9px] px-1.5 py-0.5 rounded border cursor-pointer transition-colors
              ${criterion.effort_default === opt
                ? 'font-medium'
                : 'bg-white border-neutral-200 text-neutral-400 hover:border-neutral-300'}`}>
            {opt}
          </button>
        ))}
        <span className="text-neutral-200 text-[10px] ml-0.5">|</span>
        {EFFORT_OPTS.map(opt => (
          <button key={opt} onClick={() => onUpdate(criterion.id, { impact_default: opt })}
            style={criterion.impact_default === opt ? EFFORT_STYLES[opt] : {}}
            className={`text-[9px] px-1.5 py-0.5 rounded border cursor-pointer transition-colors
              ${criterion.impact_default === opt
                ? 'font-medium'
                : 'bg-white border-neutral-200 text-neutral-400 hover:border-neutral-300'}`}>
            {opt}
          </button>
        ))}
      </div>
      <DeleteButton onDelete={() => onDelete(criterion.id)} label="critère" />
    </div>
  )
}

// ─── Question block ───────────────────────────────────────────────────────────

const PRIORITY_STYLES = {
  P0: { background: '#FCEBEB', color: '#791F1F', border: '0.5px solid #E24B4A' },
  P1: { background: '#FAEEDA', color: '#633806', border: '0.5px solid #BA7517' },
  P2: { background: '#F1EFE8', color: '#444441', border: '0.5px solid #888780' },
}

function QuestionBlock({ question, onUpdate, onDelete, onUpdateCriterion, onDeleteCriterion, onAddCriterion }) {
  const [open, setOpen] = useState(false)
  const priority = question.priority || 'P1'

  return (
    <div className="ml-6 border-l-2 border-neutral-100 pl-3 mt-1">
      <div className="group flex items-start gap-2 py-1.5 rounded-lg hover:bg-neutral-50 px-2 transition-colors">
        <button onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
          className="text-neutral-400 hover:text-neutral-600 flex-shrink-0 mt-0.5 border-none bg-transparent cursor-pointer text-[12px] w-4">
          {open ? '▾' : '▸'}
        </button>
        <div className="flex-1 min-w-0">
          <InlineInput
            value={question.text}
            onSave={v => onUpdate(question.id, { text: v })}
            placeholder="Texte de la question"
            multiline
            className="text-[13px] font-medium text-neutral-800 block w-full"
          />
          {open && (
            <InlineInput
              value={question.guidance}
              onSave={v => onUpdate(question.id, { guidance: v })}
              placeholder="Guidance pour le consultant…"
              multiline
              className="text-[12px] text-neutral-500 block w-full mt-1"
            />
          )}
        </div>
        {/* Sélecteur priorité */}
        <div className="flex gap-1 flex-shrink-0 mt-0.5">
          {['P0','P1','P2'].map(p => (
            <button key={p} onClick={() => onUpdate(question.id, { priority: p })}
              style={priority === p ? PRIORITY_STYLES[p] : {}}
              className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition-colors font-medium
                ${priority === p ? '' : 'bg-white border border-neutral-200 text-neutral-300 hover:border-neutral-300'}`}>
              {p}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-neutral-300 flex-shrink-0 mt-1">
          {question.criteria?.length || 0}c
        </span>
        <DeleteButton onDelete={() => onDelete(question.id)} label="question" />
      </div>

      {open && (
        <div className="mt-1 mb-2">
          {question.criteria?.map(c => (
            <CriterionRow key={c.id} criterion={c}
              onUpdate={onUpdateCriterion}
              onDelete={onDeleteCriterion} />
          ))}
          <button onClick={() => onAddCriterion(question.id)}
            className="ml-10 mt-1 text-[11px] text-primary-700 border-none bg-transparent cursor-pointer hover:underline p-0">
            + Ajouter un critère
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Subdomain block ──────────────────────────────────────────────────────────

function SubdomainBlock({ subdomain, onUpdate, onDelete, onAddQuestion, onUpdateQuestion, onDeleteQuestion, onUpdateCriterion, onDeleteCriterion, onAddCriterion }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="ml-4 border-l-2 border-neutral-100 pl-3 mt-1">
      <div className="group flex items-center gap-2 py-1.5 rounded-lg hover:bg-neutral-50 px-2 transition-colors">
        <button onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
          className="text-neutral-400 hover:text-neutral-600 flex-shrink-0 border-none bg-transparent cursor-pointer text-[12px] w-4">
          {open ? '▾' : '▸'}
        </button>
        <span className="text-[10px] font-mono text-neutral-400 flex-shrink-0">{subdomain.code}</span>
        <InlineInput
          value={subdomain.label}
          onSave={v => onUpdate(subdomain.id, { label: v })}
          placeholder="Label sous-domaine"
          className="text-[13px] font-medium text-neutral-700 flex-1"
        />
        <span className="text-[10px] text-neutral-300 flex-shrink-0">
          {subdomain.questions?.length || 0} questions
        </span>
        <DeleteButton onDelete={() => onDelete(subdomain.id)} label="sous-domaine" />
      </div>

      {open && (
        <div className="mb-2">
          {subdomain.questions?.map(q => (
            <QuestionBlock key={q.id} question={q}
              onUpdate={onUpdateQuestion}
              onDelete={onDeleteQuestion}
              onUpdateCriterion={onUpdateCriterion}
              onDeleteCriterion={onDeleteCriterion}
              onAddCriterion={onAddCriterion}
            />
          ))}
          <button onClick={() => onAddQuestion(subdomain.id)}
            className="ml-8 mt-1 text-[11px] text-primary-700 border-none bg-transparent cursor-pointer hover:underline p-0">
            + Ajouter une question
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Domain block ─────────────────────────────────────────────────────────────

function DomainBlock({ domain, onUpdate, onDelete, onAddSubdomain, ...rest }) {
  const [open, setOpen] = useState(false)

  const DOMAIN_DOTS = {
    ORG: '#7F77DD', PLAN: '#1D9E75', SIM: '#BA7517',
    IQ: '#E24B4A',  ME: '#378ADD',
  }
  const dot = DOMAIN_DOTS[domain.code] || '#B4B2A9'

  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm mb-3">
      <div className="group flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors cursor-pointer"
        onClick={() => setOpen(v => !v)}>
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: dot }} />
        <span className="text-[11px] font-mono text-neutral-400 flex-shrink-0">{domain.code}</span>
        <InlineInput
          value={domain.label}
          onSave={v => { onUpdate(domain.id, { label: v }) }}
          placeholder="Label domaine"
          className="text-[15px] font-semibold text-neutral-900 flex-1"
        />
        <span className="text-[11px] text-neutral-400 flex-shrink-0">
          {domain.subdomains?.length || 0} sous-domaines · {' '}
          {domain.subdomains?.reduce((n, sd) => n + (sd.questions?.length || 0), 0)} questions
        </span>
        <button
          onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
          className="text-neutral-400 border-none bg-transparent cursor-pointer text-[12px] flex-shrink-0">
          {open ? '▾' : '▸'}
        </button>
        <span onClick={e => e.stopPropagation()}>
          <DeleteButton onDelete={() => onDelete(domain.id)} label="domaine" />
        </span>
      </div>

      {open && (
        <div className="px-4 pb-3 pt-1 border-t border-neutral-100">
          {domain.subdomains?.map(sd => (
            <SubdomainBlock key={sd.id} subdomain={sd}
              onUpdate={rest.onUpdateSubdomain}
              onDelete={rest.onDeleteSubdomain}
              onAddQuestion={rest.onAddQuestion}
              onUpdateQuestion={rest.onUpdateQuestion}
              onDeleteQuestion={rest.onDeleteQuestion}
              onUpdateCriterion={rest.onUpdateCriterion}
              onDeleteCriterion={rest.onDeleteCriterion}
              onAddCriterion={rest.onAddCriterion}
            />
          ))}
          <button onClick={() => onAddSubdomain(domain.id)}
            className="ml-6 mt-2 text-[11px] text-primary-700 border-none bg-transparent cursor-pointer hover:underline p-0">
            + Ajouter un sous-domaine
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function FrameworkAdmin() {
  const [framework, setFramework] = useState([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)

  const load = () => {
    setLoading(true)
    api.frameworkAdmin.full().then(setFramework).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // Helpers pour mettre à jour l'état local sans recharger toute l'arborescence

  const updateLocal = (setter) => { setFramework(setter) }

  // ── Domains ────────────────────────────────────────────────────────────────

  const handleUpdateDomain = async (id, body) => {
    await api.frameworkAdmin.updateDomain(id, body)
    updateLocal(fw => fw.map(d => d.id === id ? { ...d, ...body } : d))
  }

  const handleDeleteDomain = async (id) => {
    await api.frameworkAdmin.deleteDomain(id)
    updateLocal(fw => fw.filter(d => d.id !== id))
  }

  const handleAddDomain = async () => {
    const code  = prompt('Code du domaine (ex: NEW) :')
    if (!code) return
    const label = prompt('Label du domaine :')
    if (!label) return
    const d = await api.frameworkAdmin.createDomain({ code: code.toUpperCase().trim(), label })
    updateLocal(fw => [...fw, { ...d, subdomains: [] }])
  }

  // ── Subdomains ─────────────────────────────────────────────────────────────

  const handleUpdateSubdomain = async (id, body) => {
    await api.frameworkAdmin.updateSubdomain(id, body)
    updateLocal(fw => fw.map(d => ({
      ...d,
      subdomains: d.subdomains.map(sd => sd.id === id ? { ...sd, ...body } : sd)
    })))
  }

  const handleDeleteSubdomain = async (id) => {
    await api.frameworkAdmin.deleteSubdomain(id)
    updateLocal(fw => fw.map(d => ({
      ...d,
      subdomains: d.subdomains.filter(sd => sd.id !== id)
    })))
  }

  const handleAddSubdomain = async (domainId) => {
    const code  = prompt('Code du sous-domaine (ex: ORG_NEW) :')
    if (!code) return
    const label = prompt('Label du sous-domaine :')
    if (!label) return
    const sd = await api.frameworkAdmin.createSubdomain(domainId, {
      code: code.toUpperCase().trim(), label
    })
    updateLocal(fw => fw.map(d =>
      d.id === domainId ? { ...d, subdomains: [...d.subdomains, { ...sd, questions: [] }] } : d
    ))
  }

  // ── Questions ──────────────────────────────────────────────────────────────

  const handleUpdateQuestion = async (id, body) => {
    await api.frameworkAdmin.updateQuestion(id, body)
    updateLocal(fw => fw.map(d => ({
      ...d,
      subdomains: d.subdomains.map(sd => ({
        ...sd,
        questions: sd.questions.map(q => q.id === id ? { ...q, ...body } : q)
      }))
    })))
  }

  const handleDeleteQuestion = async (id) => {
    await api.frameworkAdmin.deleteQuestion(id)
    updateLocal(fw => fw.map(d => ({
      ...d,
      subdomains: d.subdomains.map(sd => ({
        ...sd,
        questions: sd.questions.filter(q => q.id !== id)
      }))
    })))
  }

  const handleAddQuestion = async (subdomainId) => {
    const text = prompt('Texte de la question :')
    if (!text) return
    const q = await api.frameworkAdmin.createQuestion(subdomainId, { text })
    updateLocal(fw => fw.map(d => ({
      ...d,
      subdomains: d.subdomains.map(sd =>
        sd.id === subdomainId
          ? { ...sd, questions: [...sd.questions, { ...q, criteria: [] }] }
          : sd
      )
    })))
  }

  // ── Criteria ───────────────────────────────────────────────────────────────

  const handleUpdateCriterion = async (id, body) => {
    await api.frameworkAdmin.updateCriterion(id, body)
    updateLocal(fw => fw.map(d => ({
      ...d,
      subdomains: d.subdomains.map(sd => ({
        ...sd,
        questions: sd.questions.map(q => ({
          ...q,
          criteria: q.criteria?.map(c => c.id === id ? { ...c, ...body } : c) || []
        }))
      }))
    })))
  }

  const handleDeleteCriterion = async (id) => {
    await api.frameworkAdmin.deleteCriterion(id)
    updateLocal(fw => fw.map(d => ({
      ...d,
      subdomains: d.subdomains.map(sd => ({
        ...sd,
        questions: sd.questions.map(q => ({
          ...q,
          criteria: q.criteria?.filter(c => c.id !== id) || []
        }))
      }))
    })))
  }

  const handleAddCriterion = async (questionId) => {
    const text = prompt('Texte du critère :')
    if (!text) return
    const c = await api.frameworkAdmin.createCriterion(questionId, { text })
    updateLocal(fw => fw.map(d => ({
      ...d,
      subdomains: d.subdomains.map(sd => ({
        ...sd,
        questions: sd.questions.map(q =>
          q.id === questionId
            ? { ...q, criteria: [...(q.criteria || []), c] }
            : q
        )
      }))
    })))
  }

  const totalQuestions = framework.reduce((n, d) =>
    n + d.subdomains?.reduce((m, sd) => m + (sd.questions?.length || 0), 0), 0)
  const totalCriteria = framework.reduce((n, d) =>
    n + d.subdomains?.reduce((m, sd) =>
      m + sd.questions?.reduce((k, q) => k + (q.criteria?.length || 0), 0), 0), 0)

  if (loading) return <p className="text-neutral-500 text-[13px]">Chargement…</p>

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center mb-6">
        <div>
          <h1 className="text-[17px] font-semibold m-0 text-neutral-900 tracking-tight">Framework</h1>
          <p className="m-0 mt-0.5 text-[12px] text-neutral-400">
            {framework.length} domaines · {framework.reduce((n, d) => n + (d.subdomains?.length || 0), 0)} sous-domaines · {totalQuestions} questions · {totalCriteria} critères
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={load}
            className="text-[11px] px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-500 cursor-pointer hover:border-neutral-300 transition-colors">
            ↺ Recharger
          </button>
          <button onClick={handleAddDomain}
            className="text-[11px] px-3 py-1.5 rounded-lg border border-primary-500 bg-primary-50 text-primary-700 font-medium cursor-pointer hover:bg-primary-100 transition-colors">
            + Domaine
          </button>
        </div>
      </div>

      {/* Légende édition inline */}
      <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-neutral-50 rounded-lg border border-neutral-100">
        <span className="text-[10px] text-neutral-400">✏️</span>
        <p className="m-0 text-[11px] text-neutral-400">
          Cliquez sur n'importe quel texte pour l'éditer · Entrée pour valider · Échap pour annuler · Les modifications sont sauvegardées immédiatement
        </p>
      </div>

      {/* Arbre */}
      {framework.map(domain => (
        <DomainBlock key={domain.id} domain={domain}
          onUpdate={handleUpdateDomain}
          onDelete={handleDeleteDomain}
          onAddSubdomain={handleAddSubdomain}
          onUpdateSubdomain={handleUpdateSubdomain}
          onDeleteSubdomain={handleDeleteSubdomain}
          onAddQuestion={handleAddQuestion}
          onUpdateQuestion={handleUpdateQuestion}
          onDeleteQuestion={handleDeleteQuestion}
          onAddCriterion={handleAddCriterion}
          onUpdateCriterion={handleUpdateCriterion}
          onDeleteCriterion={handleDeleteCriterion}
        />
      ))}

      {framework.length === 0 && (
        <div className="text-center py-14 border border-dashed border-neutral-200 rounded-xl text-neutral-400">
          <p className="text-[13px]">Framework vide — chargez un seed ou ajoutez un domaine</p>
        </div>
      )}
    </div>
  )
}
