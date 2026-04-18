'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'

function FormDot({ r }) {
  const bg = r === 'W' ? 'var(--win)' : r === 'D' ? 'var(--draw)' : 'var(--loss)'
  return (
    <span style={{
      width: 22, height: 22, borderRadius: 5,
      background: bg, display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center',
      fontSize: 10, fontWeight: 700, color: '#000',
      marginRight: 2, flexShrink: 0,
    }}>{r}</span>
  )
}

export default function Ljestvica() {
  const [players, setPlayers] = useState([])
  const [totalMatches, setTotalMatches] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: ps } = await supabase.from('players').select('*').eq('active', true)
    const { data: matches } = await supabase.from('matches').select('*').order('played_at')
    const { data: matchPlayers } = await supabase.from('match_players').select('*')

    if (!ps || !matches) { setLoading(false); return }

    const stats = {}
    ps.forEach(p => { stats[p.id] = { id: p.id, name: p.name, played: 0, W: 0, D: 0, L: 0, form: [], points: 0, amount: 0, attendancePct: 0 } })

    matches.forEach(m => {
      const black = (matchPlayers || []).filter(mp => mp.match_id === m.id && mp.team === 'crni' && !mp.is_guest).map(mp => mp.player_id)
      const white = (matchPlayers || []).filter(mp => mp.match_id === m.id && mp.team === 'bijeli' && !mp.is_guest).map(mp => mp.player_id)

      const apply = (pid, res) => {
        if (!stats[pid]) return
        stats[pid].played++
        stats[pid][res]++
        stats[pid].form.push(res)
        if (stats[pid].form.length > 5) stats[pid].form.shift()
      }

      if (m.winner === 'crni') { black.forEach(p => apply(p, 'W')); white.forEach(p => apply(p, 'L')) }
      else if (m.winner === 'bijeli') { white.forEach(p => apply(p, 'W')); black.forEach(p => apply(p, 'L')) }
      else { [...black, ...white].forEach(p => apply(p, 'D')) }
    })

    const list = Object.values(stats).map(s => ({
      ...s,
      points: s.W * 3 + s.D,
      amount: s.L * 3 + s.D * 2,
      attendancePct: matches.length > 0 ? Math.round(s.played / matches.length * 100) : 0,
    })).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (a.played !== b.played) return a.played - b.played
      if (b.W !== a.W) return b.W - a.W
      return (b.W / (b.played || 1)) - (a.W / (a.played || 1))
    })

    setPlayers(list)
    setTotalMatches(matches.length)
    setLoading(false)
  }

  if (loading) return <AppLayout><div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Učitavanje...</div></AppLayout>

  return (
    <AppLayout>
      {/* Svaki igrač = kartica */}
      {players.length === 0 && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
          Nema igrača. Dodaj ih u Admin.
        </div>
      )}

      {players.map((p, i) => (
        <div key={p.id} style={{
          background: 'var(--panel)',
          border: `1px solid ${i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : 'var(--border)'}`,
          borderRadius: 14,
          padding: '12px 14px',
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          {/* Rank */}
          <div style={{
            fontSize: i < 3 ? 22 : 15,
            fontWeight: 700,
            color: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : 'var(--muted)',
            minWidth: 28,
            textAlign: 'center',
          }}>
            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
          </div>

          {/* Ime + forma */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 5 }}>{p.name}</div>
            <div style={{ display: 'flex', flexWrap: 'nowrap' }}>
              {p.form.map((r, j) => <FormDot key={j} r={r} />)}
            </div>
          </div>

          {/* Statistike */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* W/D/L */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>W/D/L</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                <span style={{ color: 'var(--win)' }}>{p.W}</span>
                <span style={{ color: 'var(--muted)' }}>/</span>
                <span style={{ color: 'var(--draw)' }}>{p.D}</span>
                <span style={{ color: 'var(--muted)' }}>/</span>
                <span style={{ color: 'var(--loss)' }}>{p.L}</span>
              </div>
            </div>

            {/* Bodovi */}
            <div style={{ textAlign: 'center', minWidth: 36 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Bod</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{p.points}</div>
            </div>
          </div>
        </div>
      ))}

      {/* Legenda */}
      {players.length > 0 && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginTop: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Legenda</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 12, color: 'var(--muted)' }}>
            <span>W = Pobjeda (3 boda)</span>
            <span>D = Neriješeno (1 bod)</span>
            <span>L = Poraz (0 bodova)</span>
            <span>Forma = zadnjih 5 utakmica</span>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
            Razrješavanje izjednačenja: bodovi → manje utakmica → više pobjeda
          </div>
        </div>
      )}
    </AppLayout>
  )
}
