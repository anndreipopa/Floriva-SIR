import type { Icon } from '@phosphor-icons/react'
import { Plant, Scales, SlidersHorizontal, SunHorizon } from '@phosphor-icons/react'
import { NavLink, Outlet } from 'react-router-dom'

const navigationItem =
  'flex min-h-10 items-center gap-2 rounded-xl border border-transparent px-3 ' +
  'text-[15px] font-bold transition-colors duration-200 sm:px-4'

const activeItem =
  'border-mint/60 bg-gradient-to-br from-forest-dark via-forest to-forest-hover ' +
  'text-sidebar-text shadow-[0_6px_18px_-10px_rgba(93,224,178,0.9)]'

function NavItem({ to, label, icon: ItemIcon }: { to: string; label: string; icon: Icon }) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      className={({ isActive }) =>
        `${navigationItem} ${isActive ? activeItem : 'text-muted hover:bg-white/80 hover:text-ink'}`
      }
    >
      <ItemIcon size={20} weight="bold" aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </NavLink>
  )
}

function ComingSoon({ label, icon: ItemIcon }: { label: string; icon: Icon }) {
  return (
    <span
      className={`${navigationItem} cursor-default text-muted/70`}
      aria-label={`${label} (coming soon)`}
    >
      <ItemIcon size={20} weight="bold" aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
      <span className="hidden rounded-md bg-mint-soft px-1.5 py-px text-[10px] font-extrabold uppercase tracking-wide text-forest md:inline">
        soon
      </span>
    </span>
  )
}

/**
 * Top bar + page area. On desktop the page area is exactly one screen tall
 * (minus the bar) so the dashboard never scrolls; very short windows fall
 * back to scrolling instead of clipping.
 */
export function AppShell() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/85 bg-white/70 shadow-[0_10px_30px_-24px_rgba(20,110,105,0.6)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <NavLink
            to="/environment"
            className="rounded-lg text-2xl font-extrabold tracking-tight text-forest"
          >
            Floriva
          </NavLink>

          <nav className="flex items-center gap-1" aria-label="Primary navigation">
            <NavItem to="/environment" label="Environment" icon={SunHorizon} />
            <NavItem to="/scale" label="Scale" icon={Scales} />
            <ComingSoon label="Plants" icon={Plant} />
            <NavItem to="/settings" label="Settings" icon={SlidersHorizontal} />
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 lg:h-[calc(100dvh-3.5rem)] lg:min-h-[660px] lg:px-8">
        <Outlet />
      </div>
    </div>
  )
}
