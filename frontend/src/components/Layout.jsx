import { Outlet, NavLink } from 'react-router-dom'
import { useT } from '../i18n'

export default function Layout() {
  const { t, lang, setLang } = useT()
  return (
    <div className="min-h-screen bg-neutral-50">
      <nav className="bg-white border-b border-neutral-200 px-6 flex items-center gap-6 h-14">
        <span className="font-semibold text-[15px] text-primary-900 tracking-tight">
          Maturity App
        </span>
        <NavLink to="/campaigns"
          className={({ isActive }) =>
            `text-[13px] no-underline ${isActive ? 'text-primary-700 font-medium' : 'text-neutral-500 hover:text-neutral-700'}`}>
          {t('nav.campaigns')}
        </NavLink>
        <NavLink to="/admin/templates"
          className={({ isActive }) =>
            `text-[13px] no-underline ${isActive ? 'text-primary-700 font-medium' : 'text-neutral-500 hover:text-neutral-700'}`}>
          {t('nav.catalogue')}
        </NavLink>
        <NavLink to="/admin/framework"
          className={({ isActive }) =>
            `text-[13px] no-underline ${isActive ? 'text-primary-700 font-medium' : 'text-neutral-500 hover:text-neutral-700'}`
          }>
          {t('nav.framework')}
        </NavLink>
        <div className="ml-auto flex items-center">
          <button onClick={() => setLang('fr')}
            className={`text-[11px] px-2 py-0.5 rounded-l border transition-colors cursor-pointer
              ${lang === 'fr' ? 'bg-primary-50 border-primary-400 text-primary-700 font-medium' : 'bg-white border-neutral-200 text-neutral-400 hover:text-neutral-600'}`}>
            FR
          </button>
          <button onClick={() => setLang('en')}
            className={`text-[11px] px-2 py-0.5 rounded-r border-t border-b border-r transition-colors cursor-pointer
              ${lang === 'en' ? 'bg-primary-50 border-primary-400 text-primary-700 font-medium' : 'bg-white border-neutral-200 text-neutral-400 hover:text-neutral-600'}`}>
            EN
          </button>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
