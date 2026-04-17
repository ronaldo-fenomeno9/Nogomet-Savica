'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'

const s = {
  card: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 10 },
  badge: (type) => {
    const colors = {
      win: { borderColor: '#166534', background: '#052e16', color: '#22c55e' },
      draw: { borderColor: '#713f12', background: '#1c1002', color: '#eab308' },
      loss: { borderColor: '#1e3a8a', background: '#0c1a3a', color: '#60a5fa' },
    }
    return { display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid', borderRadius: 999, padding: '3px 10px', fontSize: 12, ...colors[type] }
  },
  chip: (type) => {
    const base = { display: 'inline-block', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 7px', fontSize: 12, margin: '2px 2px 0 0' }
    if (type === 'guest') return { ...base, color: 'var(--muted)', borderStyle: 'dashed' }
    if (type === 'goal') return { ...base, borderColor: 'var(--gold)', color: 'var(--gold)' }
    return base
  },
}

export default function Termini() {
  const [matches, setMatches] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: ms } = await supabase.from('matches').select('*').order('played_at', { ascending: false })
    const { data: ps } = await supabase.from('players').select('*')
    const { data: mps } = await supabase.from('match_players').select('*')
    const { data: goals } = await supabase.from('goals').select('*')

    const playerMap = {}
    ;(ps || []).forEach(p => playerMap[p.id] = p.name)
    const memberIds = new Set((ps || []).map(p => p.id))

    const enriched = (ms || []).map(m => {
      const participants = (mps || []).filter(mp => mp.match_id === m.id)
      const goalMap = {}
      ;(goals || []).filter(g => g.match_id === m.id).forEach(g => { goalMap[g.player_id] = g.count })

      const black = participants.filter(mp => mp.team === 'crni').map(mp => ({
        name: mp.is_guest ? mp.guest_name : playerMap[mp.player_id],
        isGuest: mp.is_guest,
        goals: mp.is_guest ? 0 : (goalMap[mp.player_id] || 0),
      }))
      const white = participants.filter(mp => mp.team === 'bijeli').map(mp => ({
        name: mp.is_guest ? mp.guest_name : playerMap[mp.player_id],
        isGuest: mp.is_guest,
        goals: mp.is_guest ? 0 : (goalMap[mp.player_id] || 0),
      }))

      return { ...m, black, white }
    })

    setMatches(enriched)
    setPlayers(ps || [])
    setLoading(false)
  }

  const badgeType = (winner) => winner === 'crni' ? 'win' : winner === 'bijeli' ? 'loss' : 'draw'
  const badgeText = (winner) => winner === 'crni' ? 'Crni pobijedili' : winner === 'bijeli' ? 'Bijeli pobijedili' : 'Neriješeno'

  const PlayerChip = ({ p }) => {
    const type = p.isGuest ? 'guest' : p.goals > 0 ? 'goal' : 'normal'
    return (
      <span style={s.chip(type)}>
        {p.name}
        {p.goals > 0 && ' ' + '⚽'.repeat(p.goals)}
        {p.isGuest && <span style={{ fontSize: 10, color: 'var(--muted)', background: 'var(--card)', border: '1px dashed var(--border)', borderRadius: 4, padding: '1px 4px', marginLeft: 4 }}>gost</span>}
      </span>
    )
  }

  if (loading) return <AppLayout><div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Učitavanje...</div></AppLayout>

  return (
    <AppLayout>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 0 12px' }}>
        Svi termini — od najnovijeg
      </div>

      {matches.length === 0 && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
          Nema odigranih termina. Dodaj ih u Admin.
        </div>
      )}

      {matches.map(m => (
        <div key={m.id} style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{m.played_at}</span>
            <span style={s.badge(badgeType(m.winner))}>{badgeText(m.winner)}</span>
          </div>
          <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, margin: '8px 0' }}>
            {m.score_black} : {m.score_white}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>⬛ Crni</div>
              {m.black.map((p, i) => <PlayerChip key={i} p={p} />)}
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>⬜ Bijeli</div>
              {m.white.map((p, i) => <PlayerChip key={i} p={p} />)}
            </div>
          </div>
        </div>
      ))}
    </AppLayout>
  )
}
