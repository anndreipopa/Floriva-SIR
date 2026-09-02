import {
  Plant,
  SlidersHorizontal,
  SunHorizon,
} from '@phosphor-icons/react'
import { NavLink, Outlet } from 'react-router-dom'

const navigationItem =
  'flex min-h-12 w-12 items-center justify-center gap-3 rounded-xl ' +
  'border border-transparent px-3 text-[17px] font-bold ' +
  'text-sidebar-text/75 transition-colors ' +
  'md:w-full md:justify-start'

export function AppShell() {
  return (
    <div className="min-h-screen bg-canvas md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      <aside
        className="
          sticky top-0 z-20 flex items-center justify-between
          border-b border-white/20
          bg-gradient-to-br from-forest-dark via-forest to-forest-hover
          px-4 py-3 text-sidebar-text
          md:h-screen md:flex-col md:items-stretch md:justify-start
          md:border-b-0 md:border-r md:border-white/20 md:px-4 md:py-6
        "
      >
        <div
          className="
            flex items-center rounded-xl
            bg-white/8 px-3 py-3 backdrop-blur-sm
            md:min-h-[58px] md:justify-center
          "
        >
          <p className="m-0 text-2xl font-extrabold tracking-tight">
            S.I.R
          </p>
        </div>

        <nav
          className="flex gap-1 md:mt-8 md:grid md:gap-2"
          aria-label="Primary navigation"
        >
          <NavLink
            className={({ isActive }) =>
              `${navigationItem} ${
                isActive
                  ? 'border-mint/60 bg-forest-hover text-sidebar-text shadow-[0_6px_18px_-10px_rgba(93,224,178,0.9)]'
                  : 'hover:bg-forest-hover hover:text-sidebar-text'
              }`
            }
            to="/environment"
            aria-label="Environment"
          >
            <SunHorizon size={24} weight="bold" />
            <span className="hidden md:inline">Environment</span>
          </NavLink>

          <span
            className={`${navigationItem} cursor-default opacity-45`}
            aria-label="Plants coming soon"
          >
            <Plant size={24} weight="bold" />
            <span className="hidden md:inline">Plants</span>
          </span>

          <span
            className={`${navigationItem} cursor-default opacity-45`}
            aria-label="Settings coming soon"
          >
            <SlidersHorizontal size={24} weight="bold" />
            <span className="hidden md:inline">Settings</span>
          </span>
        </nav>
      </aside>

      <div className="min-w-0 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <Outlet />
      </div>
    </div>
  )
}