import React from 'react'

/* Warli (Warali) folk-art motifs, drawn as inline SVG so they scale crisply and
   need no image assets. Authentic Warli painting is monochrome: white (rice-paste)
   figures on an earthy terracotta/geru wall. The characteristic human figure is
   two triangles joined at the waist (an hourglass) with a circle head and stick
   arms/legs; dancers hold hands in chains and spirals (the tarpa dance).

   Two palettes are used:
     • CREAM  — white figures for the terracotta mural band (footer).
     • currentColor — accent-toned figures for the subtle border / divider /
       backdrop, so they inherit the theme accent and stay low-contrast.        */

const CREAM = '#fdf5ea'

/* --------------------------------------------------------- primitive motifs */

// A single Warli dancer. Local coords: feet at y=0, head top ~ y=-48.
// `reach` is how far the hands extend (used to join hands with neighbours).
function Figure({ x = 0, y = 0, s = 1, reach = 15, raise = -8, stroke = CREAM, sw = 1.7 }) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${s})`}
      fill="none" stroke={stroke} strokeWidth={sw}
      strokeLinecap="round" strokeLinejoin="round"
    >
      <circle cx="0" cy="-44" r="4" />
      <path d="M-6 -40 L6 -40 L0 -26 Z" />
      <path d="M0 -26 L-6 -12 L6 -12 Z" />
      <path d={`M-6 -38 L${-reach} ${-38 + raise} M6 -38 L${reach} ${-38 + raise}`} />
      <path d="M-6 -12 L-9 0 M6 -12 L9 0" />
    </g>
  )
}

// A chain of dancers holding hands. `reach` is auto-computed from the spacing so
// adjacent hands always meet, whatever the scale or count.
function DanceChain({ from, to, count, y, s = 1, raise = -8, stroke = CREAM, sw = 1.7 }) {
  const step = (to - from) / Math.max(1, count - 1)
  const reach = (step / 2) / s
  const figs = []
  for (let i = 0; i < count; i += 1) {
    figs.push(
      <Figure key={i} x={from + i * step} y={y} s={s} reach={reach} raise={raise} stroke={stroke} sw={sw} />
    )
  }
  return <g>{figs}</g>
}

function Sun({ x = 0, y = 0, r = 14, stroke = CREAM, sw = 1.7, rays = 12 }) {
  const out = []
  for (let i = 0; i < rays; i += 1) {
    const a = (i / rays) * Math.PI * 2
    out.push(
      <line
        key={i}
        x1={x + Math.cos(a) * (r + 4)} y1={y + Math.sin(a) * (r + 4)}
        x2={x + Math.cos(a) * (r + 11)} y2={y + Math.sin(a) * (r + 11)}
      />
    )
  }
  return (
    <g fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round">
      <circle cx={x} cy={y} r={r} />
      {out}
    </g>
  )
}

function Moon({ x = 0, y = 0, r = 13, stroke = CREAM, sw = 1.7 }) {
  return (
    <path
      d={`M ${x + 4} ${y - r} A ${r} ${r} 0 1 0 ${x + 4} ${y + r} A ${r * 0.78} ${r * 0.78} 0 1 1 ${x + 4} ${y - r} Z`}
      fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round"
    />
  )
}

// Tree of life: a curved trunk with a fan of radiating fronds.
function Tree({ x = 0, y = 0, s = 1, stroke = CREAM, sw = 1.7 }) {
  const fronds = []
  for (let i = -3; i <= 3; i += 1) {
    const a = (i * 26) * Math.PI / 180
    const ex = Math.sin(a) * 27
    const ey = -40 - Math.cos(a) * 27
    const cx = Math.sin(a) * 13
    const cy = -40 - Math.cos(a) * 13
    fronds.push(<path key={i} d={`M0 -40 Q ${cx} ${cy} ${ex} ${ey}`} />)
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="none" stroke={stroke}
       strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M0 0 C -3 -14 3 -26 0 -40" />
      {fronds}
    </g>
  )
}

function Hut({ x = 0, y = 0, s = 1, stroke = CREAM, sw = 1.7 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="none" stroke={stroke}
       strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round">
      <path d="M-27 -20 L0 -46 L27 -20 Z" />
      <path d="M-20 -20 L-20 0 L20 0 L20 -20" />
      <path d="M-5 0 L-5 -13 L5 -13 L5 0" />
      <path d="M-19 -27 L19 -27 M-13 -34 L13 -34" />
    </g>
  )
}

// Stylized Warli deer/animal: oval body, stick legs, neck, head with antlers.
function Animal({ x = 0, y = 0, s = 1, flip = false, stroke = CREAM, sw = 1.7 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} fill="none" stroke={stroke}
       strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round">
      <path d="M-16 -22 Q0 -28 16 -22 L16 -15 Q0 -9 -16 -15 Z" />
      <path d="M-11 -13 L-12 0 M-4 -11 L-4 0 M5 -11 L5 0 M12 -13 L13 0" />
      <path d="M15 -21 L23 -32" />
      <circle cx="25" cy="-34" r="3.2" />
      <path d="M24 -37 L21 -45 M27 -37 L30 -45" />
      <path d="M-16 -20 L-23 -25" />
    </g>
  )
}

function Birds({ x = 0, y = 0, s = 1, stroke = CREAM, sw = 1.5 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="none" stroke={stroke}
       strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M0 0 L6 -6 L12 0" />
      <path d="M20 6 L26 0 L32 6" />
      <path d="M-16 8 L-10 2 L-4 8" />
    </g>
  )
}

/* ------------------------------------------------------------ compositions */

// Thin triangle strip that frames the very top of the page.
export function WarliBorder() {
  const step = 26
  const tris = []
  for (let x = -step; x < 1000 + step; x += step) {
    tris.push(<path key={x} d={`M${x} 18 L${x + step / 2} 5 L${x + step} 18`} vectorEffect="non-scaling-stroke" />)
  }
  return (
    <svg className="warli-top" viewBox="0 0 1000 22" preserveAspectRatio="none" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">{tris}</g>
    </svg>
  )
}

// A tarpa dance chain used as a section divider (accent-toned).
export function WarliDivider() {
  return (
    <svg className="warli-divider" viewBox="0 0 420 54" aria-hidden="true">
      <g stroke="currentColor" fill="none">
        <line x1="6" y1="50" x2="414" y2="50" strokeWidth="1.2" opacity="0.5" />
        <Sun x="14" y="16" r="7" stroke="currentColor" sw="1.4" rays="10" />
        <Moon x="402" y="16" r="8" stroke="currentColor" sw="1.4" />
        <DanceChain from={48} to={372} count={13} y={50} s={0.78} stroke="currentColor" sw={1.6} />
      </g>
    </svg>
  )
}

// The main painting: white-on-terracotta village scene (footer band).
export function WarliMural() {
  const step = 26
  const top = []
  const bottom = []
  for (let x = -step; x < 1000 + step; x += step) {
    top.push(<path key={`t${x}`} d={`M${x} 20 L${x + step / 2} 6 L${x + step} 20`} />)
    bottom.push(<path key={`b${x}`} d={`M${x} 234 L${x + step / 2} 220 L${x + step} 234`} />)
  }
  return (
    <div className="warli-mural">
      <svg viewBox="0 0 1000 240" role="img"
           aria-label="Warli painting: villagers performing the tarpa dance beneath the sun and moon, with a tree of life, a hut and a deer">
        <g stroke={CREAM} strokeWidth="1.5" fill="none" strokeLinejoin="round" opacity="0.9">
          {top}{bottom}
        </g>
        <Sun x={96} y={72} r={17} />
        <Moon x={906} y={66} r={14} />
        <Birds x={470} y={46} s={1} />
        <Birds x={556} y={62} s={0.8} />
        <Tree x={54} y={202} s={1.05} />
        <DanceChain from={168} to={784} count={17} y={200} s={1.06} />
        <Animal x={856} y={200} s={0.9} flip />
        <Hut x={932} y={202} s={0.95} />
      </svg>
    </div>
  )
}

// Faint full-page wall painting behind the app (very low opacity via CSS).
export function WarliBackdrop() {
  return (
    <svg className="warli-backdrop" viewBox="0 0 1200 820" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <Sun x={130} y={130} r={44} stroke="currentColor" sw={2.4} rays={14} />
        <Birds x={640} y={90} s={2} stroke="currentColor" sw={2.2} />
        <Tree x={1090} y={230} s={2.4} stroke="currentColor" sw={2.4} />
        <DanceChain from={70} to={540} count={9} y={740} s={1.7} stroke="currentColor" sw={2.2} />
        <Animal x={770} y={760} s={1.7} stroke="currentColor" sw={2.2} />
        <Hut x={1060} y={740} s={2} stroke="currentColor" sw={2.2} />
      </g>
    </svg>
  )
}
