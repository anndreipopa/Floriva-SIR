import { useState, type ReactNode } from 'react'
import { CheckCircle, Drop, Scales, Timer, WarningCircle } from '@phosphor-icons/react'
import type { CalibrationAction } from '../../api/calibrationApi'
import {
  calibrationStep,
  describeCalibrationError,
  formatCountdown,
  isUsableForPoint,
  POINT_READING_MAX_AGE_MS,
  SETTLE_MS,
  STEP_LABELS,
  stepIndex,
  type CalibrationStep,
} from '../../lib/calibration'
import { formatDateTime, timeOf } from '../../lib/weight'
import type { Calibration } from '../../types/calibration'
import type { WeightReading } from '../../types/weight'
import { GlassPanel } from '../GlassPanel'

interface CalibrationCardProps {
  calibration: Calibration
  latestReading: WeightReading | null
  now: number
  pendingAction: CalibrationAction | null
  actionError: string | null
  onAction: (action: CalibrationAction) => void
}

/**
 * Guides the user through one calibration session (design D3) and shows the result.
 * All rules live in the backend; this card only shows the current step and its buttons.
 */
export function CalibrationCard({
  calibration,
  latestReading,
  now,
  pendingAction,
  actionError,
  onAction,
}: CalibrationCardProps) {
  const step = calibrationStep(calibration, now)
  const session = calibration.session
  const isCalibrated = calibration.dryGrams !== null && calibration.wetGrams !== null
  const busy = pendingAction !== null

  return (
    <GlassPanel
      as="section"
      className="flex flex-col gap-4 bg-gradient-to-br from-cyan/10 via-white/40 to-white/20 p-5"
      aria-labelledby={`calibration-heading-${calibration.pot}`}
    >
      <header className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan/15 text-humidity">
          <Drop size={22} weight="duotone" aria-hidden="true" />
        </span>
        <h2
          id={`calibration-heading-${calibration.pot}`}
          className="m-0 flex-1 text-lg font-extrabold text-ink"
        >
          Moisture calibration
        </h2>
        <StatusChip session={session !== null} calibrated={isCalibrated} />
      </header>

      <CalibrationSummary calibration={calibration} />

      {session && step.kind !== 'idle' && step.kind !== 'failed' && (
        <StepList current={stepIndex(step)} />
      )}

      <div className="rounded-xl bg-white/55 p-4" aria-live="polite">
        <StepBody
          step={step}
          sessionId={session?.id ?? null}
          isCalibrated={isCalibrated}
          latestReading={latestReading}
          now={now}
          busy={busy}
          pendingAction={pendingAction}
          onAction={onAction}
        />
      </div>

      {actionError && (
        <p
          role="alert"
          className="m-0 flex items-start gap-2 rounded-xl bg-accent/10 px-3 py-2 text-sm font-semibold text-ink"
        >
          <WarningCircle size={18} weight="duotone" className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
          {actionError}
        </p>
      )}
    </GlassPanel>
  )
}

function StatusChip({ session, calibrated }: { session: boolean; calibrated: boolean }) {
  const [label, tone] = session
    ? ['In progress', 'bg-cyan/15 text-forest']
    : calibrated
      ? ['Calibrated', 'bg-success/15 text-success']
      : ['Not calibrated', 'bg-warning/15 text-warning']
  return (
    <span className={`rounded-lg px-2 py-0.5 text-xs font-extrabold uppercase ${tone}`}>{label}</span>
  )
}

/** The saved result: what 0 % and 100 % mean for this pot. */
function CalibrationSummary({ calibration }: { calibration: Calibration }) {
  if (calibration.dryGrams === null || calibration.wetGrams === null) {
    return (
      <p className="m-0 text-sm text-muted">
        Teach Floriva what “needs water” and “just watered” weigh for this plant. It takes one
        watering, about 40 minutes in total.
      </p>
    )
  }

  return (
    <dl className="m-0 grid grid-cols-3 gap-2">
      <Figure label="Dry (0 %)" value={`${calibration.dryGrams.toLocaleString()} g`} />
      <Figure label="Wet (100 %)" value={`${calibration.wetGrams.toLocaleString()} g`} />
      <Figure
        label="Calibrated"
        value={calibration.calibratedAtUtc ? formatDateTime(Date.parse(calibration.calibratedAtUtc)) : '—'}
      />
    </dl>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/55 px-3 py-2">
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="m-0 text-base font-extrabold text-ink tabular">{value}</dd>
    </div>
  )
}

/** The four steps, with the current one highlighted. */
function StepList({ current }: { current: number }) {
  return (
    <ol className="m-0 grid list-none grid-cols-2 gap-1.5 p-0 sm:grid-cols-4">
      {STEP_LABELS.map((label, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'todo'
        return (
          <li
            key={label}
            aria-current={state === 'current' ? 'step' : undefined}
            className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold ${
              state === 'current'
                ? 'bg-white text-forest shadow-[0_3px_10px_-5px_rgba(20,110,105,0.45)]'
                : state === 'done'
                  ? 'text-success'
                  : 'text-muted'
            }`}
          >
            {state === 'done' ? (
              <CheckCircle size={16} weight="duotone" aria-hidden="true" />
            ) : (
              <span className="tabular" aria-hidden="true">
                {index + 1}.
              </span>
            )}
            {label}
            {state === 'done' && <span className="sr-only">(done)</span>}
          </li>
        )
      })}
    </ol>
  )
}

interface StepBodyProps {
  step: CalibrationStep
  sessionId: string | null
  isCalibrated: boolean
  latestReading: WeightReading | null
  now: number
  busy: boolean
  pendingAction: CalibrationAction | null
  onAction: (action: CalibrationAction) => void
}

/** Instructions + buttons for the current step. */
function StepBody({
  step,
  sessionId,
  isCalibrated,
  latestReading,
  now,
  busy,
  pendingAction,
  onAction,
}: StepBodyProps) {
  const cancel = (
    <SecondaryButton disabled={busy} onClick={() => onAction('cancel')}>
      {pendingAction === 'cancel' ? 'Cancelling…' : 'Cancel'}
    </SecondaryButton>
  )
  const live = sessionId ? <LiveWeight reading={latestReading} sessionId={sessionId} now={now} /> : null

  switch (step.kind) {
    case 'idle':
      return (
        <StepLayout
          text="When the plant needs water, start a calibration. First the robot zeroes the empty scale, then it weighs the dry pot and, after watering, the wet pot."
          actions={
            <PrimaryButton disabled={busy} onClick={() => onAction('start')}>
              {pendingAction === 'start' ? 'Starting…' : isCalibrated ? 'Recalibrate' : 'Start calibration'}
            </PrimaryButton>
          }
        />
      )

    case 'no_answer':
      return (
        <StepLayout
          tone="warning"
          text="No answer from the robot. Is it powered and online? You can send the start again."
          actions={
            <>
              <PrimaryButton disabled={busy} onClick={() => onAction('start')}>
                Try again
              </PrimaryButton>
              {cancel}
            </>
          }
        />
      )

    case 'preparing': {
      const text =
        step.deviceState === 'taring'
          ? 'Zeroing the empty scale. Do not touch it.'
          : step.deviceState === 'warming_up'
            ? 'Lift the pot off the scale and let go. The scale must be empty and still.'
            : 'Waiting for the robot to answer…'
      return (
        <StepLayout
          text={text}
          extra={
            step.deviceState === 'warming_up' && step.secondsLeft !== null ? (
              <BigCountdown label="Zeroing in" value={formatCountdown(step.secondsLeft * 1000)} />
            ) : null
          }
          actions={cancel}
        />
      )
    }

    case 'place_dry':
      // Own component: its settle timer resets whenever this step is entered again.
      return (
        <PlaceDryStep
          live={live}
          canSave={sessionId !== null && isUsableForPoint(latestReading, sessionId, now)}
          now={now}
          busy={busy}
          saving={pendingAction === 'dry'}
          onSave={() => onAction('dry')}
          cancel={cancel}
        />
      )

    case 'watering':
      return (
        <StepLayout
          text={`Dry point saved (${step.dryGrams.toLocaleString()} g). Now water the plant as you normally do, with the pot on the scale.`}
          extra={live}
          actions={
            <>
              <PrimaryButton disabled={busy} onClick={() => onAction('watered')}>
                {pendingAction === 'watered' ? 'Saving…' : 'Done watering'}
              </PrimaryButton>
              {cancel}
            </>
          }
        />
      )

    case 'draining':
      return (
        <StepLayout
          text="Let the extra water drain off. Leave the pot on the scale and do not touch it."
          extra={
            <>
              <BigCountdown label="Wet point unlocks in" value={formatCountdown(step.msLeft)} />
              {live}
            </>
          }
          actions={cancel}
        />
      )

    case 'save_wet': {
      const canSave = sessionId !== null && isUsableForPoint(latestReading, sessionId, now)
      return (
        <StepLayout
          text="Drained. Save the wet point to finish."
          extra={live}
          actions={
            <>
              <PrimaryButton disabled={busy || !canSave} onClick={() => onAction('wet')}>
                {pendingAction === 'wet' ? 'Saving…' : 'Save wet point'}
              </PrimaryButton>
              {cancel}
            </>
          }
          hint={canSave ? undefined : 'Waiting for a stable reading…'}
        />
      )
    }

    case 'failed':
      return (
        <StepLayout
          tone="warning"
          text={describeCalibrationError(step.error)}
          actions={
            <>
              <PrimaryButton disabled={busy} onClick={() => onAction('start')}>
                {pendingAction === 'start' ? 'Starting…' : 'Start again'}
              </PrimaryButton>
              <SecondaryButton disabled={busy} onClick={() => onAction('cancel')}>
                Dismiss
              </SecondaryButton>
            </>
          }
        />
      )
  }
}

/**
 * "Place the dry pot": the save button unlocks SETTLE_MS after the user confirms the pot is
 * on the scale, and only while a fresh stable reading exists (the backend checks the same).
 */
function PlaceDryStep({
  live,
  canSave,
  now,
  busy,
  saving,
  onSave,
  cancel,
}: {
  live: ReactNode
  canSave: boolean
  now: number
  busy: boolean
  saving: boolean
  onSave: () => void
  cancel: ReactNode
}) {
  const [placedAt, setPlacedAt] = useState<number | null>(null)
  const settleLeft = placedAt === null ? null : placedAt + SETTLE_MS - now

  if (placedAt === null) {
    return (
      <StepLayout
        text="Scale zeroed. Place the pot on the scale now: this is the weight at which you would normally water it."
        extra={live}
        actions={
          <>
            <PrimaryButton disabled={busy} onClick={() => setPlacedAt(Date.now())}>
              The pot is on the scale
            </PrimaryButton>
            {cancel}
          </>
        }
      />
    )
  }

  const settling = settleLeft !== null && settleLeft > 0
  return (
    <StepLayout
      text="Hands off while the reading settles."
      extra={
        <>
          {settling && <BigCountdown label="Settling" value={formatCountdown(settleLeft)} />}
          {live}
        </>
      }
      actions={
        <>
          <PrimaryButton disabled={busy || settling || !canSave} onClick={onSave}>
            {saving ? 'Saving…' : 'Save dry point'}
          </PrimaryButton>
          {cancel}
        </>
      }
      hint={!settling && !canSave ? 'Waiting for a stable reading…' : undefined}
    />
  )
}

/** The scale, live: newest reading of this session, or a waiting message. */
function LiveWeight({
  reading,
  sessionId,
  now,
}: {
  reading: WeightReading | null
  sessionId: string
  now: number
}) {
  const current =
    reading && reading.sessionId === sessionId && now - timeOf(reading) <= POINT_READING_MAX_AGE_MS
      ? reading
      : null

  return (
    <div className="flex items-center gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-forest/10 text-forest">
        <Scales size={20} weight="duotone" aria-hidden="true" />
      </span>
      {current ? (
        <p className="m-0 flex flex-wrap items-baseline gap-2 text-ink">
          <span className="text-3xl font-extrabold tracking-tight tabular">
            {current.grams.toLocaleString()}
          </span>
          <span className="text-lg font-bold text-muted">g</span>
          <span
            className={`rounded-lg px-2 py-0.5 text-xs font-extrabold uppercase ${
              current.stable ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
            }`}
          >
            {current.stable ? 'Stable' : 'Settling'}
          </span>
        </p>
      ) : (
        <p className="m-0 text-sm font-semibold text-muted">Waiting for a live reading…</p>
      )}
    </div>
  )
}

function BigCountdown({ label, value }: { label: string; value: string }) {
  return (
    <p className="m-0 flex items-center gap-2 text-ink">
      <Timer size={20} weight="duotone" className="text-forest" aria-hidden="true" />
      <span className="text-sm font-semibold text-muted">{label}</span>
      <span className="text-2xl font-extrabold tabular">{value}</span>
    </p>
  )
}

function StepLayout({
  text,
  extra,
  actions,
  hint,
  tone = 'normal',
}: {
  text: string
  extra?: ReactNode
  actions: ReactNode
  hint?: string
  tone?: 'normal' | 'warning'
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className={`m-0 text-sm font-semibold ${tone === 'warning' ? 'text-ink' : 'text-ink/90'}`}>
        {tone === 'warning' && (
          <WarningCircle
            size={18}
            weight="duotone"
            className="mr-1.5 inline-block align-[-3px] text-warning"
            aria-hidden="true"
          />
        )}
        {text}
      </p>
      {extra}
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
      {hint && <p className="m-0 text-xs font-semibold text-muted">{hint}</p>}
    </div>
  )
}

const buttonBase =
  'min-h-10 rounded-xl px-4 text-sm font-extrabold transition-colors duration-200 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

function PrimaryButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${buttonBase} bg-gradient-to-br from-forest-dark via-forest to-forest-hover text-sidebar-text shadow-[0_6px_18px_-10px_rgba(93,224,178,0.9)]`}
    >
      {children}
    </button>
  )
}

function SecondaryButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${buttonBase} bg-white/60 text-muted hover:bg-white/90 hover:text-ink`}
    >
      {children}
    </button>
  )
}
