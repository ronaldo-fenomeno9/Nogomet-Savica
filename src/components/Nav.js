'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/statistika', label: 'Statistika' },
  { href: '/termini', label: 'Termini' },
  { href: '/strijelci', label: 'Strijelci' },
  { href: '/obracuni', label: 'Obračuni' },
  { href: '/admin', label: 'Admin' },
]

export default function Nav() {
  const path = usePathname()

  return (
    <nav style={{
      background: 'var(--panel)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      overflowX: 'auto',
    }}>
      <div style={{
        fontWeight: 700,
        fontSize: 15,
        padding: '14px 0',
        marginRight: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        whiteSpace: 'nowrap',
      }}>
        ⚽ HNB Savica
      </div>

      {tabs.map(t => (
        <Link key={t.href} href={t.href} style={{
          padding: '14px 14px',
          fontSize: 13,
          fontWeight: 500,
          color: path === t.href ? 'var(--accent)' : 'var(--muted)',
          borderBottom: path === t.href ? '2px solid var(--accent)' : '2px solid transparent',
          whiteSpace: 'nowrap',
          transition: 'all 0.15s',
        }}>
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
