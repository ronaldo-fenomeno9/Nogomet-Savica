'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'

const badgeStyle = (winner) => {
  if (winner === 'crni') return { borderColor: '#166534', background: '#052e16', color: '#22c55e' }
  if (winner === 'bijeli') return { borderColor: '#1e3a8a', background: '#0c1a3a', color: '#60a5fa' }
  return { borderColor: '#713f12', background: '#1c1002', color: '#eab308' }
}
const badgeText = (winner) => winner === 'crni' ? 'Crni pobijedili' : winner === 'bijeli' ? 'Bijeli pobijedili' : 'Neriješeno'

const chipStyle = (isGuest, hasGoals) => ({
  display: 'inline-block',
  background: 'var(--panel)',
  border: `1px ${isGuest ? 'dashed' : 'solid'} ${hasGoals ? 'var(--gold)' : 'var(--border)'}`,
  borderRadius: 6,
  padding: '2px 7px',
  fontSize: 12,
  margin: '2px 3px 0 0',
  color: isGuest ? 'var(--muted)' : hasGoals ? 'var(--gold)' : 'var(--text)',
})

export default function Termini() {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: ms } = await supabase.from('matches').select('*').order('played_at', { ascending: false })
    const { data: ps } = await supabase.from('players').select('*')
    const { data: mps } = await supabase.from('match_players').select('*')
    const { data: goals } = await supabase.from('goals').select('*')

    const playerMap = {}
    ;(ps || []).forEach(p => playerMap[p.id] = p.name)

    const enriched = (ms || []).map(m => {
      const participants = (mps || []).filter(mp => mp.match_id === m.id)
      const goalMap = {}
      ;(goals || []).filter(g => g.match_id === m.id).forEach(g => { goalMap[g.player_id] = g.count })

      const mapPlayer = (mp) => ({
        name: mp.is_guest ? mp.guest_name : playerMap[mp.player_id],
        isGuest: mp.is_guest,
        goals: mp.is_guest ? 0 : (goalMap[mp.player_id] || 0),
      })

      return {
        ...m,
        black: participants.filter(mp => mp.team === 'crni').map(mapPlayer),
        white: participants.filter(mp => mp.team === 'bijeli').map(mapPlayer),
      }
    })

    setMatches(enriched)
    setLoading(false)
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
        <div key={m.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{m.played_at}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid', borderRadius: 999, padding: '3px 10px', fontSize: 12, ...badgeStyle(m.winner) }}>
              {badgeText(m.winner)}
            </span>
          </div>

          {/* Rezultat */}
          <div style={{ textAlign: 'center', fontSize: 24, fontWeight: 800, margin: '6px 0 10px', letterSpacing: 2 }}>
            {m.score_black} : {m.score_white}
          </div>

          {/* Ekipe */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>⬛ Crni</div>
              {m.black.map((p, i) => (
                <span key={i} style={chipStyle(p.isGuest, p.goals > 0)}>
                  {p.name}{p.goals > 0 ? ' ' + '⚽'.repeat(p.goals) : ''}
                  {p.isGuest && <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 3 }}>gost</span>}
                </span>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>⬜ Bijeli</div>
              {m.white.map((p, i) => (
                <span key={i} style={chipStyle(p.isGuest, p.goals > 0)}>
                  {p.name}{p.goals > 0 ? ' ' + '⚽'.repeat(p.goals) : ''}
                  {p.isGuest && <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 3 }}>gost</span>}
                </span>
              ))}
            </div>
          </div>

          {/* Komentar */}
          {m.note && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)', background: 'var(--panel)', borderRadius: 8, padding: '7px 10px', borderLeft: '3px solid var(--accent)' }}>
              💬 {m.note}
            </div>
          )}
        </div>
      ))}
    </AppLayout>
  )
}
