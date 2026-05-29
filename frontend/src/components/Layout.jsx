import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useT } from '../i18n'

function CampaignsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )
}

function CatalogueIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/>
      <path d="M9 12h6M9 16h4"/>
    </svg>
  )
}

function FrameworkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14M12 2v2M12 20v2M2 12h2M20 12h2"/>
    </svg>
  )
}

const ROUTE_LABELS = {
  '/campaigns':      'Campagnes',
  '/admin/templates':'Catalogue',
  '/admin/framework':'Framework',
}

function useBreadcrumb() {
  const loc = useLocation()
  const path = loc.pathname
  if (path.startsWith('/campaigns/') && path.includes('/interview'))  return ['Campagnes', 'Interview']
  if (path.startsWith('/campaigns/') && path.includes('/synthesis'))  return ['Campagnes', 'Synthèse']
  if (path.startsWith('/campaigns/') && path.includes('/plan-selection')) return ['Campagnes', 'Chantiers']
  if (path.startsWith('/campaigns/') && path.includes('/plan'))       return ['Campagnes', 'Qualification']
  if (path.startsWith('/campaigns/') && path.includes('/roadmap'))    return ['Campagnes', 'Roadmap']
  if (path.startsWith('/campaigns/') && path.includes('/gantt'))      return ['Campagnes', 'Planning']
  if (path.startsWith('/campaigns/') && path.includes('/sheets'))     return ['Campagnes', 'Fiches']
  if (path.startsWith('/campaigns/'))                                  return ['Campagnes', 'Détail']
  for (const [p, label] of Object.entries(ROUTE_LABELS)) {
    if (path.startsWith(p)) return [label]
  }
  return ['Maturity App']
}

export default function Layout() {
  const { t, lang, setLang } = useT()
  const crumbs = useBreadcrumb()

  return (
    <div className="app-shell">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-wordmark">
          <div className="sidebar-logo">
            M<span className="slash">/</span>A
          </div>
          <div className="sidebar-tag">
            MATURITY <em>app</em>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section">Navigation</div>
          <NavLink to="/campaigns" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <CampaignsIcon />
            {t('nav.campaigns')}
          </NavLink>
          <NavLink to="/admin/templates" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <CatalogueIcon />
            {t('nav.catalogue')}
          </NavLink>
          <NavLink to="/admin/framework" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <FrameworkIcon />
            {t('nav.framework')}
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="lang-toggle">
            <button className={`lang-btn ${lang === 'fr' ? 'active' : ''}`} onClick={() => setLang('fr')}>FR</button>
            <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
          </div>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────── */}
      <div className="main-area">
        <header className="topbar">
          <div className="topbar-crumb">
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {i > 0 && <span className="sep">›</span>}
                {i === crumbs.length - 1 ? <strong>{c}</strong> : <span>{c}</span>}
              </span>
            ))}
          </div>
        </header>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
