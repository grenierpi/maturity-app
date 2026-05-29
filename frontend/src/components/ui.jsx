// ─── Badge ────────────────────────────────────────────────────────────────────
export function Badge({ children, variant = 'neutral', className = '' }) {
  const variants = {
    primary:  'bg-primary-50 text-primary-700 border border-primary-500/40',
    success:  'bg-success-50 text-success-700 border border-success-500/40',
    warning:  'bg-warning-50 text-warning-700 border border-warning-500/40',
    danger:   'bg-danger-50  text-danger-700  border border-danger-500/40',
    info:     'bg-info-50    text-info-700    border border-info-500/40',
    neutral:  'bg-neutral-100 text-neutral-700 border border-neutral-200',
    critical: 'bg-score-critical-bg text-score-critical-text',
    weak:     'bg-score-weak-bg     text-score-weak-text',
    moderate: 'bg-score-moderate-bg text-score-moderate-text',
    good:     'bg-score-good-bg     text-score-good-text',
    none:     'bg-neutral-100 text-neutral-500',
    'effort-faible': 'bg-success-50 text-success-700',
    'effort-moyen':  'bg-warning-50 text-warning-700',
    'effort-fort':   'bg-danger-50  text-danger-700',
    'impact-faible': 'bg-neutral-100 text-neutral-700',
    'impact-moyen':  'bg-primary-50  text-primary-700',
    'impact-fort':   'bg-success-50  text-success-700',
    DRAFT:       'bg-neutral-100 text-neutral-500',
    IN_PROGRESS: 'bg-info-50     text-info-700',
    COMPLETED:   'bg-success-50  text-success-700',
    ARCHIVED:    'bg-neutral-100 text-neutral-500',
  }
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md ${variants[variant] || variants.neutral} ${className}`}
      style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}>
      {children}
    </span>
  )
}

// ─── Button ───────────────────────────────────────────────────────────────────
export function Button({ children, variant = 'default', size = 'md', disabled, onClick, className = '', type = 'button' }) {
  const variants = {
    default: 'bg-surface border border-hairline text-fg-2 hover:bg-surface-2',
    primary: 'bg-primary-50 border border-primary-500/50 text-primary-700 font-medium hover:bg-primary-100',
    success: 'bg-success-50 border border-success-500/50 text-success-700 font-medium hover:bg-success-100',
    ghost:   'bg-transparent border border-hairline text-fg-3 hover:bg-surface-2',
    danger:  'bg-danger-50  border border-danger-500/50  text-danger-700  hover:bg-danger-50',
  }
  const sizes = {
    sm: 'text-[12px] px-3 py-1.5 rounded-md',
    md: 'text-[13px] px-4 py-2 rounded-lg',
    lg: 'text-[13.5px] px-5 py-2.5 rounded-lg',
  }
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 cursor-pointer transition-all
        ${variants[variant]} ${sizes[size]}
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
        ${className}`}
      style={{ boxShadow: disabled ? 'none' : 'var(--shadow-1)' }}
    >
      {children}
    </button>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className = '', padding = true }) {
  return (
    <div
      className={`bg-surface border border-hairline rounded-xl ${padding ? 'p-5' : ''} ${className}`}
      style={{ boxShadow: 'var(--shadow-2)' }}
    >
      {children}
    </div>
  )
}

// ─── ProgressBar ──────────────────────────────────────────────────────────────
export function ProgressBar({ pct, height = 'h-1.5', color }) {
  const bg = pct >= 100 ? 'bg-success-500'
           : pct > 50   ? 'bg-info-500'
           : 'bg-primary-500'
  return (
    <div className={`w-full ${height} bg-neutral-200 rounded-full overflow-hidden`}>
      <div
        className={`h-full rounded-full transition-all duration-300 ${color || bg}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  )
}

// ─── StatBox ──────────────────────────────────────────────────────────────────
export function StatBox({ label, value, sub }) {
  return (
    <Card className="text-center">
      <p className="eyebrow mb-2">{label}</p>
      <p className="stat-num text-primary-700">{value}</p>
      {sub && <p className="text-[11px] text-neutral-500 mt-1">{sub}</p>}
    </Card>
  )
}

// ─── SectionTitle ─────────────────────────────────────────────────────────────
export function SectionTitle({ children, className = '' }) {
  return (
    <p className={`eyebrow mb-3 ${className}`}>
      {children}
    </p>
  )
}

// ─── Alert ────────────────────────────────────────────────────────────────────
export function Alert({ children, variant = 'danger' }) {
  const styles = {
    danger:  'bg-danger-50  border-danger-500/40  text-danger-700',
    warning: 'bg-warning-50 border-warning-500/40 text-warning-700',
    info:    'bg-info-50    border-info-500/40    text-info-700',
  }
  return (
    <div className={`border rounded-lg px-4 py-2.5 text-[13px] mb-4 ${styles[variant]}`}>
      {children}
    </div>
  )
}

// ─── Input / Textarea / Select / Label ───────────────────────────────────────
export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full text-[13px] px-3 py-2 border border-hairline rounded-lg bg-surface text-fg placeholder-neutral-400 focus:outline-none focus:border-primary-500 transition-colors ${className}`}
      {...props}
    />
  )
}

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`w-full text-[13px] px-3 py-2 border border-hairline rounded-lg bg-surface text-fg placeholder-neutral-400 focus:outline-none focus:border-primary-500 resize-y transition-colors ${className}`}
      {...props}
    />
  )
}

export function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`w-full text-[13px] px-3 py-2 border border-hairline rounded-lg bg-surface text-fg focus:outline-none focus:border-primary-500 transition-colors ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}

export function Label({ children, className = '' }) {
  return (
    <label className={`block text-[11.5px] font-medium text-fg-3 mb-1 ${className}`}
      style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
      {children}
    </label>
  )
}

// ─── ScoreButton ──────────────────────────────────────────────────────────────
const SCORE_ACTIVE = [
  'bg-danger-50  border-danger-500/60  text-danger-700',
  'bg-warning-50 border-warning-500/60 text-warning-700',
  'bg-info-50    border-info-500/60    text-info-700',
  'bg-success-50 border-success-500/50 text-success-700',
  'bg-success-50 border-success-500    text-success-700',
]
export const SCORE_LABELS = ['Absent', 'Partiel', 'Formalisé', 'Mesuré', 'Optimisé']

export function ScoreButton({ score, active, onClick }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        onClick={onClick}
        title={SCORE_LABELS[score]}
        className={`w-8 h-8 rounded-full text-[12px] font-medium cursor-pointer transition-all border
          ${active ? SCORE_ACTIVE[score] : 'bg-surface border-hairline text-neutral-500 hover:bg-surface-2'}`}
        style={active ? {} : { boxShadow: 'var(--shadow-1)' }}
      >
        {score}
      </button>
      <span className="text-[9px] text-neutral-400 text-center leading-tight w-8"
        style={{ fontFamily: 'var(--font-mono)' }}>
        {SCORE_LABELS[score].substring(0, 4)}
      </span>
    </div>
  )
}

// ─── ScoreBucketBadge ─────────────────────────────────────────────────────────
export function ScoreBucketBadge({ score, bucket }) {
  return (
    <Badge variant={bucket || 'none'}>
      {score !== null && score !== undefined ? `${score}/4` : '—'}
    </Badge>
  )
}
