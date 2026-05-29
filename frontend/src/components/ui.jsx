// ─── Badge ────────────────────────────────────────────────────────────────────
export function Badge({ children, variant = 'neutral', className = '' }) {
  const variants = {
    primary:  'bg-primary-50 text-primary-700 border border-primary-500',
    success:  'bg-success-50 text-success-700 border border-success-500',
    warning:  'bg-warning-50 text-warning-700 border border-warning-500',
    danger:   'bg-danger-50  text-danger-700  border border-danger-500',
    info:     'bg-info-50    text-info-700    border border-info-500',
    neutral:  'bg-neutral-100 text-neutral-700 border border-neutral-200',
    // Score buckets
    critical: 'bg-score-critical-bg text-score-critical-text',
    weak:     'bg-score-weak-bg     text-score-weak-text',
    moderate: 'bg-score-moderate-bg text-score-moderate-text',
    good:     'bg-score-good-bg     text-score-good-text',
    none:     'bg-neutral-100 text-neutral-500',
    // Effort / impact
    'effort-faible': 'bg-success-50 text-success-700',
    'effort-moyen':  'bg-warning-50 text-warning-700',
    'effort-fort':   'bg-danger-50  text-danger-700',
    'impact-faible': 'bg-neutral-100 text-neutral-700',
    'impact-moyen':  'bg-primary-50  text-primary-700',
    'impact-fort':   'bg-success-50  text-success-700',
    // Status campagne
    DRAFT:       'bg-neutral-100 text-neutral-500',
    IN_PROGRESS: 'bg-info-50     text-info-700',
    COMPLETED:   'bg-success-50  text-success-700',
    ARCHIVED:    'bg-neutral-100 text-neutral-500',
  }
  return (
    <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded ${variants[variant] || variants.neutral} ${className}`}>
      {children}
    </span>
  )
}

// ─── Button ───────────────────────────────────────────────────────────────────
export function Button({ children, variant = 'default', size = 'md', disabled, onClick, className = '', type = 'button' }) {
  const variants = {
    default:  'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50',
    primary:  'bg-primary-50 border border-primary-500 text-primary-700 font-medium hover:bg-primary-100',
    success:  'bg-success-50 border border-success-500 text-success-700 font-medium hover:bg-success-100',
    ghost:    'bg-transparent border border-neutral-200 text-neutral-500 hover:bg-neutral-50',
    danger:   'bg-danger-50  border border-danger-500  text-danger-700  hover:bg-danger-100',
  }
  const sizes = {
    sm: 'text-xs px-3 py-1.5 rounded-md',
    md: 'text-[13px] px-4 py-2 rounded-lg',
    lg: 'text-sm px-5 py-2.5 rounded-lg',
  }
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 cursor-pointer transition-colors
        ${variants[variant]} ${sizes[size]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}`}
    >
      {children}
    </button>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className = '', padding = true }) {
  return (
    <div className={`bg-white border border-neutral-200 rounded-xl shadow-sm ${padding ? 'p-5' : ''} ${className}`}>
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
    <div className={`w-full ${height} bg-neutral-100 rounded-full overflow-hidden`}>
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
      <p className="text-[11px] text-neutral-500 mb-1">{label}</p>
      <p className="text-2xl font-medium text-primary-700">{value}</p>
      {sub && <p className="text-[10px] text-neutral-400 mt-0.5">{sub}</p>}
    </Card>
  )
}

// ─── SectionTitle ─────────────────────────────────────────────────────────────
export function SectionTitle({ children, className = '' }) {
  return (
    <p className={`text-[11px] font-medium text-neutral-500 uppercase tracking-wider mb-3 ${className}`}>
      {children}
    </p>
  )
}

// ─── Alert ────────────────────────────────────────────────────────────────────
export function Alert({ children, variant = 'danger' }) {
  const styles = {
    danger:  'bg-danger-50  border-danger-500  text-danger-700',
    warning: 'bg-warning-50 border-warning-500 text-warning-700',
    info:    'bg-info-50    border-info-500    text-info-700',
  }
  return (
    <div className={`border rounded-lg px-4 py-2.5 text-[13px] mb-4 ${styles[variant]}`}>
      {children}
    </div>
  )
}

// ─── Input / Textarea ─────────────────────────────────────────────────────────
export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full text-[13px] px-3 py-2 border border-neutral-200 rounded-md bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-primary-500 ${className}`}
      {...props}
    />
  )
}

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`w-full text-[13px] px-3 py-2 border border-neutral-200 rounded-md bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-primary-500 resize-y ${className}`}
      {...props}
    />
  )
}

export function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`w-full text-[13px] px-3 py-2 border border-neutral-200 rounded-md bg-white text-neutral-900 focus:outline-none focus:border-primary-500 ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}

export function Label({ children, className = '' }) {
  return (
    <label className={`block text-[12px] font-medium text-neutral-700 mb-1 ${className}`}>
      {children}
    </label>
  )
}

// ─── ScoreButton ──────────────────────────────────────────────────────────────
const SCORE_ACTIVE = [
  'bg-danger-50  border-danger-500  text-danger-700',
  'bg-warning-50 border-warning-500 text-warning-700',
  'bg-info-50    border-info-500    text-info-700',
  'bg-success-50 border-success-500/70 text-success-700',
  'bg-success-50 border-success-500 text-success-700',
]
export const SCORE_LABELS = ['Absent', 'Partiel', 'Formalisé', 'Mesuré', 'Optimisé']

export function ScoreButton({ score, active, onClick }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        onClick={onClick}
        title={SCORE_LABELS[score]}
        className={`w-8 h-8 rounded-full text-[12px] font-medium cursor-pointer transition-all border
          ${active ? SCORE_ACTIVE[score] : 'bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50'}`}
      >
        {score}
      </button>
      <span className="text-[9px] text-neutral-400 text-center leading-tight w-8">
        {SCORE_LABELS[score].substring(0, 4)}
      </span>
    </div>
  )
}

// ─── ScoreBucketBadge ─────────────────────────────────────────────────────────
export function ScoreBucketBadge({ score, bucket }) {
  const variantMap = { critical: 'critical', weak: 'weak', moderate: 'moderate', good: 'good', none: 'none' }
  return (
    <Badge variant={variantMap[bucket] || 'none'}>
      {score !== null && score !== undefined ? `${score}/4` : '—'}
    </Badge>
  )
}
