'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const row1 = [
  { href: '/ljestvica', label: '🏆 Ljestvica' },
  { href: '/statistika', label: '📊 Statistika' },
  { href: '/termini', label: '📅 Termini' },
]
const row2 = [
  { href: '/strijelci', label: '⚽ Strijelci' },
  { href: '/obracuni', label: '💰 Obračuni' },
  { href: '/admin', label: '🔐 Admin' },
]

function TabRow({ tabs, path }) {
  return (
    <div style={{
      display: 'flex',
      borderTop: '1px solid var(--border)',
    }}>
      {tabs.map(t => (
        <Link key={t.href} href={t.href} style={{
          flex: 1,
          textAlign: 'center',
          padding: '10px 6px',
          fontSize: 13,
          fontWeight: 500,
          color: path === t.href ? 'var(--accent)' : 'var(--muted)',
          borderBottom: path === t.href ? '2px solid var(--accent)' : '2px solid transparent',
          whiteSpace: 'nowrap',
          transition: 'all 0.15s',
          textDecoration: 'none',
        }}>
          {t.label}
        </Link>
      ))}
    </div>
  )
}

export default function Nav() {
  const path = usePathname()

  return (
    <nav style={{
      background: 'var(--panel)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{
        padding: '10px 16px 6px',
        fontWeight: 700,
        fontSize: 15,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        ⚽ HNB Savica
      </div>
      <TabRow tabs={row1} path={path} />
      <TabRow tabs={row2} path={path} />
    </nav>
  )
}
