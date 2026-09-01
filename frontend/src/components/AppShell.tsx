import {
  Plant,
  SlidersHorizontal,
  SunHorizon,
} from '@phosphor-icons/react'
import { NavLink, Outlet } from 'react-router-dom'

const navigationItem =
  'flex min-h-12 w-12 items-center justify-center gap-3 border-l-2 ' +
  'border-transparent px-3 text-[17px] font-medium text-white/65 ' +
  'transition-colors md:w-full md:justify-start'

export function AppShell() {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 z-10 flex items-center justify-between bg-forest-dark px-4 py-3 text-white md:h-screen md:flex-col md:items-stretch md:justify-start md:py-7">
        <div className="md:border-b md:border-white/10 md:px-3 md:pb-6">
          <p className="m-0 text-2xl font-bold leading-none">S.I.R</p>
        </div>

        <nav
          className="flex gap-1 md:mt-7 md:grid md:gap-2"
          aria-label="Primary navigation"
        >
          <NavLink
            className={({ isActive }) =>
              `${navigationItem} ${
              isActive
                ? 'border-accent bg-forest-hover text-sidebar-text'
                : 'hover:bg-forest-hover hover:text-sidebar-text'
              }`
            }
            to="/environment"
          >
            <SunHorizon size={23} weight="bold" />
            <span className="hidden md:inline">Environment</span>
          </NavLink>

          <span className={`${navigationItem} cursor-default opacity-40`}>
            <Plant size={23} weight="bold" />
            <span className="hidden md:inline">Plants</span>
          </span>

          <span className={`${navigationItem} cursor-default opacity-40`}>
            <SlidersHorizontal size={23} weight="bold" />
            <span className="hidden md:inline">Settings</span>
          </span>
        </nav>
      </aside>

      <div className="min-w-0 px-5 py-7 md:px-8 md:py-9 2xl:px-12">
        <Outlet />
      </div>
    </div>
  )
}