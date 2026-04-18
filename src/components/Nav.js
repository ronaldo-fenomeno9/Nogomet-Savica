'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/ljestvica', label: '🏆 Ljestvica' },
  { href: '/statistika', label: '📊 Statistika' },
  { href: '/termini', label: '📅 Termini' },
  { href: '/strijelci', label: '⚽ Strijelci' },
  { href: '/obracuni', label: '💰 Obračuni' },
  { href: '/admin', label: '🔐 Admin' },
]

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
      {/* Logo */}
      <div style={{
        padding: '12px 16px 8px',
        fontWeight: 700,
        fontSize: 15,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        ⚽ HNB Savica
      </div>

      {/* Tabs — horizontalni scroll */}
      <div style={{
        display: 'flex',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
        borderTop: '1px solid var(--border)',
      }}>
        {tabs.map(t => (
          <Link key={t.href} href={t.href} style={{
            padding: '10px 14px',
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
    </nav>
  )
}
