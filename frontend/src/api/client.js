const BASE = '/api'

async function req(method, path, body, isFormData = false) {
  const opts = {
    method,
    headers: isFormData ? {} : { 'Content-Type': 'application/json' },
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  }
  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Framework ────────────────────────────────────────────────────────────────
export const api = {
  framework: {
    get:          ()       => req('GET', '/framework'),
    getQuestion:  (id)     => req('GET', `/framework/questions/${id}`),
  },

  // ── Suppliers ──────────────────────────────────────────────────────────────
  suppliers: {
    list:   (q)    => req('GET', `/suppliers${q ? `?q=${q}` : ''}`),
    get:    (id)   => req('GET', `/suppliers/${id}`),
    create: (body) => req('POST', '/suppliers', body),
  },

  // ── Campaigns ─────────────────────────────────────────────────────────────
  campaigns: {
    list:       (params = {}) => {
      const qs = new URLSearchParams(params).toString()
      return req('GET', `/campaigns${qs ? `?${qs}` : ''}`)
    },
    get:        (id)        => req('GET', `/campaigns/${id}`),
    create:     (body)      => req('POST', '/campaigns', body),
    update:     (id, body)  => req('PATCH', `/campaigns/${id}`, body),
    archive:    (id)        => req('DELETE', `/campaigns/${id}`),
    initialize: (id)        => req('POST', `/campaigns/${id}/initialize`),
    complete:   (id)        => req('POST', `/campaigns/${id}/complete`),
    progress:   (id)        => req('GET', `/campaigns/${id}/progress`),
  },

  // ── Interview ─────────────────────────────────────────────────────────────
  interview: {
    questions:      (campaignId)             =>
      req('GET', `/campaigns/${campaignId}/interview/questions`),
    question:       (campaignId, questionId) =>
      req('GET', `/campaigns/${campaignId}/interview/questions/${questionId}`),
    saveResponse:   (campaignId, responseId, body) =>
      req('PATCH', `/campaigns/${campaignId}/responses/${responseId}`, body),
    uploadProof:    (campaignId, responseId, file) => {
      const fd = new FormData()
      fd.append('file', file)
      return req('POST', `/campaigns/${campaignId}/responses/${responseId}/proofs`, fd, true)
    },
    deleteProof:    (campaignId, responseId, proofId) =>
      req('DELETE', `/campaigns/${campaignId}/responses/${responseId}/proofs/${proofId}`),
  },

  // ── Scoring & Synthèse ────────────────────────────────────────────────────
  synthesis: {
    radar:        (id)   => req('GET', `/campaigns/${id}/scores/radar`),
    scores:       (id)   => req('GET', `/campaigns/${id}/scores`),
    generate:     (id)   => req('POST', `/campaigns/${id}/generate`),
    items:        (id)   => req('GET', `/campaigns/${id}/transformation-items`),
    updateItem:   (campaignId, itemId, body) =>
      req('PATCH', `/campaigns/${campaignId}/transformation-items/${itemId}`, body),
    synthesis:    (id)   => req('GET', `/campaigns/${id}/synthesis`),
    saveNotes:    (id, notes) =>
      req('PATCH', `/campaigns/${id}/synthesis/notes`, { synthesis_notes: notes }),
    recompute:    (id)   => req('POST', `/campaigns/${id}/scores/recompute`),
  },
}

// ── Templates (catalogue global) ─────────────────────────────────────────────
api.templates = {
  list:   (activeOnly = true) => req('GET', `/templates?active_only=${activeOnly}`),
  get:    (id)                => req('GET', `/templates/${id}`),
  create: (body)              => req('POST', '/templates', body),
  update: (id, body)          => req('PATCH', `/templates/${id}`, body),
  delete: (id)                => req('DELETE', `/templates/${id}`),
}

// ── Plan de transformation par campagne ───────────────────────────────────────
api.plan = {
  list:         (campaignId)              => req('GET',    `/campaigns/${campaignId}/plan`),
  create:       (campaignId, body)        => req('POST',   `/campaigns/${campaignId}/plan`, body),
  update:       (campaignId, itemId, body)=> req('PATCH',  `/campaigns/${campaignId}/plan/${itemId}`, body),
  delete:       (campaignId, itemId)      => req('DELETE', `/campaigns/${campaignId}/plan/${itemId}`),
  fromTemplate: (campaignId, templateId)  => req('POST',   `/campaigns/${campaignId}/plan/from-template/${templateId}`),
  linkTemplate: (campaignId, itemId, templateId) =>
    req('POST', `/campaigns/${campaignId}/plan/${itemId}/link-template?template_id=${templateId}`),
  tobe:         (campaignId)              => req('GET',    `/campaigns/${campaignId}/tobe`),
}

// ── Framework admin ───────────────────────────────────────────────────────────
api.frameworkAdmin = {
  full:              ()                   => req('GET',    '/framework/admin/full'),
  // Domains
  createDomain:      (body)               => req('POST',   '/framework/admin/domains', body),
  updateDomain:      (id, body)           => req('PATCH',  `/framework/admin/domains/${id}`, body),
  deleteDomain:      (id)                 => req('DELETE', `/framework/admin/domains/${id}`),
  // Subdomains
  createSubdomain:   (domainId, body)     => req('POST',   `/framework/admin/domains/${domainId}/subdomains`, body),
  updateSubdomain:   (id, body)           => req('PATCH',  `/framework/admin/subdomains/${id}`, body),
  deleteSubdomain:   (id)                 => req('DELETE', `/framework/admin/subdomains/${id}`),
  // Questions
  createQuestion:    (subdomainId, body)  => req('POST',   `/framework/admin/subdomains/${subdomainId}/questions`, body),
  updateQuestion:    (id, body)           => req('PATCH',  `/framework/admin/questions/${id}`, body),
  deleteQuestion:    (id)                 => req('DELETE', `/framework/admin/questions/${id}`),
  // Criteria
  createCriterion:   (questionId, body)   => req('POST',   `/framework/admin/questions/${questionId}/criteria`, body),
  updateCriterion:   (id, body)           => req('PATCH',  `/framework/admin/criteria/${id}`, body),
  deleteCriterion:   (id)                 => req('DELETE', `/framework/admin/criteria/${id}`),
}

// ── Assessment (weak points, templates by subdomain, targets) ─────────────────
api.assessment = {
  weakPoints:          (id)           => req('GET',   `/campaigns/${id}/weak-points`),
  templatesBySubdomain:(id)           => req('GET',   `/campaigns/${id}/templates-by-subdomain`),
  updateTargets:       (id, targets)  => req('PATCH', `/campaigns/${id}/subdomain-targets`, { targets }),
}

// ── Gantt ────────────────────────────────────────────────────────────────────
api.gantt = {
  get:            (id)                    => req('GET',   `/campaigns/${id}/gantt`),
  updateSchedule: (id, itemId, body)      => req('PATCH', `/campaigns/${id}/gantt/${itemId}`, body),
}

// ── Sheets ───────────────────────────────────────────────────────────────────
api.sheets = {
  getForTemplate:  (templateId)           => req('GET',  `/templates/${templateId}/sheet`),
  upsertForTemplate:(templateId, body)    => req('PUT',  `/templates/${templateId}/sheet`, body),
  generateForTemplate:(templateId)        => req('POST', `/templates/${templateId}/sheet/generate`),
  getCampaignSheets:(campaignId)          => req('GET',  `/campaigns/${campaignId}/sheets`),
}
