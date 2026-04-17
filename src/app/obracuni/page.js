'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'

const s = {
  card: { background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 14 },
  tbl: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { color: 'var(--muted)', fontSize: 11, textAlign: 'left', padding: '6px 4px', borderBottom: '1px solid var(--border)' },
  td: { padding: '8px 4px', borderBottom: '1px solid var(--border)' },
}

export default function Obracuni() {
  const [months, setMonths] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: players } = await supabase.from('players').select('*').eq('active', true)
    const { data: matches } = await supabase.from('matches').select('*').order('played_at')
    const { data: matchPlayers } = await supabase.from('match_players').select('*')

    if (!matches || !players) { setLoading(false); return }

    const monthly = {}

    matches.forEach(m => {
      const ym = m.played_at.slice(0, 7)
      if (!monthly[ym]) {
        monthly[ym] = { month: ym, played: 0, table: {} }
        players.forEach(p => { monthly[ym].table[p.id] = { id: p.id, name: p.name, W: 0, D: 0, L: 0 } })
      }

      const black = (matchPlayers || []).filter(mp => mp.match_id === m.id && mp.team === 'crni' && !mp.is_guest).map(mp => mp.player_id)
      const white = (matchPlayers || []).filter(mp => mp.match_id === m.id && mp.team === 'bijeli' && !mp.is_guest).map(mp => mp.player_id)
      const t = monthly[ym].table

      if (m.winner === 'crni') { black.forEach(p => t[p] && t[p].W++); white.forEach(p => t[p] && t[p].L++) }
      else if (m.winner === 'bijeli') { white.forEach(p => t[p] && t[p].W++); black.forEach(p => t[p] && t[p].L++) }
      else { [...black, ...white].forEach(p => t[p] && t[p].D++) }

      monthly[ym].played++
    })

    const result = Object.values(monthly).map(mo => {
      let kitty = 0
      const rows = Object.values(mo.table)
        .map(p => {
          const points = p.W * 3 + p.D
          const amount = p.L * 3 + p.D * 2
          kitty += amount
          return { ...p, points, amount }
        })
        .filter(p => p.W + p.D + p.L > 0)
        .sort((a, b) => b.amount - a.amount)

      const top3 = [...rows].sort((a, b) => b.points - a.points).slice(0, 3)
      return { ...mo, kitty, rows, top3 }
    }).reverse()

    setMonths(result)
    setLoading(false)
  }

  if (loading) return <AppLayout><div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Učitavanje...</div></AppLayout>

  return (
    <AppLayout>
      {months.length === 0 && (
        <div style={{ ...s.card, textAlign: 'center', color: 'var(--muted)' }}>Nema podataka.</div>
      )}

      {months.map(mo => (
        <div key={mo.month} style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{mo.month}</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{mo.played} termina</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 999, padding: '5px 12px', fontSize: 13, fontWeight: 600 }}>
                🏦 {mo.kitty.toFixed(2)} €
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Top 3: {mo.top3.map(p => `${p.name} (${p.points})`).join(', ')}
              </div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={s.tbl}>
              <thead>
                <tr>
                  <th style={s.th}>Igrač</th>
                  <th style={s.th}>W</th>
                  <th style={s.th}>D</th>
                  <th style={s.th}>L</th>
                  <th style={s.th}>Bodovi</th>
                  <th style={s.th}>Uplata (€)</th>
                </tr>
              </thead>
              <tbody>
                {mo.rows.map(p => (
                  <tr key={p.id}>
                    <td style={{ ...s.td, fontWeight: 500 }}>{p.name}</td>
                    <td style={s.td}>{p.W}</td>
                    <td style={s.td}>{p.D}</td>
                    <td style={s.td}>{p.L}</td>
                    <td style={{ ...s.td, fontWeight: 700, color: 'var(--accent)' }}>{p.points}</td>
                    <td style={{ ...s.td, color: p.amount > 0 ? 'var(--loss)' : 'var(--muted)', fontWeight: p.amount > 0 ? 600 : 400 }}>
                      {p.amount > 0 ? `${p.amount.toFixed(2)} €` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </AppLayout>
  )
}
