import type { CSSProperties } from 'react'
import { clamp, daylightFactor, mixHex } from '../lib/conditions'

/**
 * Decorative illustration for the hero: a window looking out over hills,
 * with the three Floriva pots on the sill under the rail and carriage.
 * The sky follows the measured light, the mist follows humidity.
 * Purely visual – every value it shows is also given as text elsewhere.
 */
interface WindowSceneProps {
  lux: number
  humidity: number
}

/** [night colour, day colour] for every part of the scene. */
// Night end is deep teal, day end is the dashboard's aqua / mint / forest.
const palette = {
  skyTop: ['#0b2a33', '#8fd9e6'],
  skyBottom: ['#1f4a52', '#eefbf7'],
  hillFar: ['#173f3f', '#c2ecdf'],
  hillMid: ['#123533', '#8ed8bd'],
  hillNear: ['#0e2c2a', '#5cc39c'],
  sillTop: ['#2a4042', '#f6fcfb'],
  sillFront: ['#1c3133', '#d5ecea'],
  pot: ['#6c3a30', '#e07a5f'],
  potRim: ['#7b4437', '#ec8f74'],
  leafDark: ['#0d3029', '#145448'],
  leaf: ['#123a32', '#1b6d5d'],
  leafLight: ['#1a4a3e', '#35a37c'],
  rail: ['#3f5658', '#9fb8b8'],
  carriage: ['#8aa0a0', '#ffffff'],
} as const

type PaletteKey = keyof typeof palette

const STARS: [number, number, number][] = [
  [80, 40, 1.4], [160, 92, 1], [238, 30, 1.2], [310, 120, 0.9],
  [372, 58, 1.5], [455, 26, 1], [520, 104, 1.1], [610, 46, 0.9],
  [672, 132, 1.3], [744, 34, 1], [820, 76, 1.4], [905, 28, 0.9],
  [980, 64, 1.2], [1046, 22, 1], [1120, 88, 1.3], [1176, 44, 0.9],
  [126, 150, 0.8], [418, 168, 0.8], [570, 172, 0.9], [1010, 150, 0.8],
]

const POT_CENTERS = [760, 910, 1060] as const
const SILL_Y = 338
const POT_TOP_Y = 282
const RAIL_Y = 104
const FOREGROUND_SCALE = 0.8

const SNAKE_LEAVES = [
  { dx: -22, height: 108, tilt: -15, tone: 'leafDark' },
  { dx: 20, height: 94, tilt: 17, tone: 'leaf' },
  { dx: -8, height: 150, tilt: -4, tone: 'leaf' },
  { dx: 6, height: 132, tilt: 7, tone: 'leafLight' },
] as const

const PILEA_LEAVES = [
  { x: -34, y: 240, r: 13 }, { x: 30, y: 236, r: 13 },
  { x: -48, y: 210, r: 17 }, { x: 44, y: 202, r: 18 },
  { x: 0, y: 222, r: 14 }, { x: -20, y: 182, r: 15 },
  { x: 16, y: 172, r: 16 },
] as const

const POTHOS_LEAVES = [
  [1000, 200, -40], [1012, 222, -20], [1030, 240, -50], [1046, 256, 10],
  [1062, 250, -5], [1074, 236, 15], [1120, 220, 30], [1104, 240, 60],
  [1086, 258, 20], [1116, 300, 80], [1122, 326, 100], [1117, 350, 70],
] as const

function snakeLeafPath(cx: number, dx: number, height: number, tilt: number) {
  const x = cx + dx
  const base = POT_TOP_Y
  const tip = base - height

  return [
    `M ${x - 7} ${base}`,
    `C ${x - 10} ${base - height * 0.5} ${x - 4 + tilt * 0.7} ${tip + height * 0.12} ${x + tilt} ${tip}`,
    `C ${x + 4 + tilt * 0.7} ${tip + height * 0.12} ${x + 10} ${base - height * 0.5} ${x + 7} ${base}`,
    'Z',
  ].join(' ')
}

function Pot({ cx, color }: { cx: number; color: (key: PaletteKey) => string }) {
  return (
    <g>
      <ellipse cx={cx} cy={SILL_Y + 3} rx={42} ry={4} fill="#000" opacity={0.14} />
      <path
        d={`M ${cx - 36} ${POT_TOP_Y} L ${cx + 36} ${POT_TOP_Y} L ${cx + 27} ${SILL_Y} L ${cx - 27} ${SILL_Y} Z`}
        fill={color('pot')}
      />
      {/* a soft vertical highlight gives the clay some roundness */}
      <path
        d={`M ${cx - 24} ${POT_TOP_Y + 6} L ${cx - 14} ${POT_TOP_Y + 6} L ${cx - 12} ${SILL_Y - 4} L ${cx - 19} ${SILL_Y - 4} Z`}
        fill="#fff"
        opacity={0.12}
      />
      <rect
        x={cx - 41}
        y={POT_TOP_Y - 9}
        width={82}
        height={13}
        rx={3}
        fill={color('potRim')}
      />
    </g>
  )
}

export function WindowScene({ lux, humidity }: WindowSceneProps) {
  const day = daylightFactor(lux)
  const color = (key: PaletteKey) =>
    mixHex(palette[key][0], palette[key][1], day)

  const sunOpacity = clamp((day - 0.12) / 0.25, 0, 1)
  const moonOpacity = 1 - sunOpacity
  const sunY = 250 - day * 95
  const mistOpacity = clamp((humidity - 45) / 55, 0, 1) * 0.55

  const [potA, potB, potC] = POT_CENTERS

  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 1200 400"
      preserveAspectRatio="xMaxYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="scene-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color('skyTop')} />
          <stop offset="70%" stopColor={color('skyBottom')} />
        </linearGradient>

        <radialGradient id="scene-sun-glow">
          <stop offset="0%" stopColor="#fff4c8" stopOpacity={0.9} />
          <stop offset="35%" stopColor="#ffe8a3" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#ffe8a3" stopOpacity={0} />
        </radialGradient>

        <linearGradient id="scene-mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="55%" stopColor="#ffffff" stopOpacity={1} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
        </linearGradient>

        <mask id="scene-moon-mask">
          <rect width="1200" height="400" fill="#fff" />
          <circle cx={572} cy={82} r={22} fill="#000" />
        </mask>
      </defs>

      <rect width="1200" height="400" fill="url(#scene-sky)" />

      {/* Night sky */}
      <g opacity={moonOpacity}>
        {STARS.map(([x, y, r], index) => (
          <circle
            key={`${x}-${y}`}
            className="animate-twinkle"
            style={{ animationDelay: `${(index % 7) * 0.6}s` }}
            cx={x}
            cy={y}
            r={r}
            fill="#f4f1dc"
          />
        ))}
        <circle
          cx={560}
          cy={90}
          r={24}
          fill="#ece9d2"
          mask="url(#scene-moon-mask)"
        />
      </g>

      {/* Sun climbs with the light reading */}
      <g opacity={sunOpacity}>
        <circle cx={520} cy={sunY} r={130} fill="url(#scene-sun-glow)" />
        <circle cx={520} cy={sunY} r={30} fill="#fff6d6" />
      </g>

      <path
        d="M0 260 C 160 220 320 240 470 228 C 640 214 760 180 930 196 C 1050 207 1130 222 1200 216 L1200 400 L0 400 Z"
        fill={color('hillFar')}
      />
      <rect
        x="0"
        y="180"
        width="1200"
        height="130"
        fill="url(#scene-mist)"
        opacity={mistOpacity}
      />
      <path
        d="M0 292 C 140 268 300 284 450 276 C 620 266 780 248 940 262 C 1060 272 1140 280 1200 276 L1200 400 L0 400 Z"
        fill={color('hillMid')}
      />
      <path
        d="M0 318 C 180 300 360 316 540 306 C 720 296 900 300 1200 312 L1200 400 L0 400 Z"
        fill={color('hillNear')}
      />

      {/* Window sill */}
      <rect x="0" y={SILL_Y} width="1200" height="14" fill={color('sillTop')} />
      <rect x="0" y={SILL_Y + 14} width="1200" height="48" fill={color('sillFront')} />
      <rect x="0" y={SILL_Y + 14} width="1200" height="2" fill="#000" opacity={0.08} />

      {/* Foreground scaled down around the sill so wide heroes don't crop the rail */}
      <g transform={`translate(1160 ${SILL_Y}) scale(${FOREGROUND_SCALE}) translate(-1160 -${SILL_Y})`}>
      {/* Rail with its two posts */}
      <rect x={686} y={RAIL_Y} width={8} height={SILL_Y - RAIL_Y} rx={3} fill={color('rail')} />
      <rect x={1136} y={RAIL_Y} width={8} height={SILL_Y - RAIL_Y} rx={3} fill={color('rail')} />
      <rect x={680} y={RAIL_Y} width={470} height={9} rx={4} fill={color('rail')} />

      {/* Plant 1: snake plant */}
      <g className="animate-sway" style={{ animationDelay: '-1s' }}>
        {SNAKE_LEAVES.map((leaf) => (
          <path
            key={leaf.dx}
            d={snakeLeafPath(potA, leaf.dx, leaf.height, leaf.tilt)}
            fill={color(leaf.tone)}
          />
        ))}
      </g>

      {/* Plant 2: pilea, the one being watered */}
      <g className="animate-sway" style={{ animationDelay: '-3.5s' }}>
        {PILEA_LEAVES.map((leaf) => (
          <path
            key={`stem-${leaf.x}-${leaf.y}`}
            d={`M ${potB} ${POT_TOP_Y} Q ${potB + leaf.x * 0.2} ${(POT_TOP_Y + leaf.y) / 2} ${potB + leaf.x} ${leaf.y}`}
            stroke={color('leafDark')}
            strokeWidth={2.2}
            fill="none"
          />
        ))}
        {PILEA_LEAVES.map((leaf, index) => (
          <circle
            key={`leaf-${leaf.x}-${leaf.y}`}
            cx={potB + leaf.x}
            cy={leaf.y}
            r={leaf.r}
            fill={color(index % 2 === 0 ? 'leaf' : 'leafLight')}
          />
        ))}
      </g>

      {/* Plant 3: trailing pothos */}
      <g className="animate-sway" style={{ animationDelay: '-5.5s' }}>
        <path
          d={`M ${potC} 278 C 1040 240 1010 230 1000 200 M ${potC + 6} 278 C 1090 250 1110 245 1120 220 M ${potC + 32} 280 C 1118 290 1124 320 1120 352`}
          stroke={color('leafDark')}
          strokeWidth={2.4}
          fill="none"
        />
        {POTHOS_LEAVES.map(([x, y, angle], index) => (
          <ellipse
            key={`${x}-${y}`}
            cx={x}
            cy={y}
            rx={12}
            ry={7.5}
            transform={`rotate(${angle} ${x} ${y})`}
            fill={color(index % 3 === 0 ? 'leafLight' : 'leaf')}
          />
        ))}
      </g>

      <Pot cx={potA} color={color} />
      <Pot cx={potB} color={color} />
      <Pot cx={potC} color={color} />

      {/* Carriage parked over the middle pot, nozzle and a falling drop */}
      <g>
        <rect x={potB - 27} y={RAIL_Y - 12} width={54} height={30} rx={7} fill={color('carriage')} />
        <rect x={potB - 27} y={RAIL_Y + 12} width={54} height={6} rx={3} fill="#000" opacity={0.1} />
        <circle cx={potB + 16} cy={RAIL_Y} r={3} fill="var(--color-mint)" />
        <rect x={potB - 4} y={RAIL_Y + 18} width={8} height={14} rx={2} fill={color('rail')} />
        <path
          className="animate-drip"
          style={{ '--drip-distance': '118px' } as CSSProperties}
          d={`M ${potB} ${RAIL_Y + 36} C ${potB + 4} ${RAIL_Y + 43} ${potB + 6} ${RAIL_Y + 47} ${potB + 6} ${RAIL_Y + 50} A 6 6 0 0 1 ${potB - 6} ${RAIL_Y + 50} C ${potB - 6} ${RAIL_Y + 47} ${potB - 4} ${RAIL_Y + 43} ${potB} ${RAIL_Y + 36} Z`}
          fill="var(--color-cyan)"
        />
      </g>
      </g>
    </svg>
  )
}
