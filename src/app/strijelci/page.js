'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'

export default function Strijelci() {
  const [scorers, setScorers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: players } = await supabase.from('players').select('*').eq('active', true)
    const { data: goals } = await supabase.from('goals').select('*')
    const { data: matchPlayers } = await supabase.from('match_players').select('*').eq('is_guest', false)

    const playerMap = {}
    ;(players || []).forEach(p => playerMap[p.id] = p)

    // Ukupni golovi po igraču
    const goalMap = {}
    ;(goals || []).forEach(g => { goalMap[g.player_id] = (goalMap[g.player_id] || 0) + g.count })

    // Broj utakmica po igraču
    const playedMap = {}
    ;(matchPlayers || []).forEach(mp => { playedMap[mp.player_id] = (playedMap[mp.player_id] || 0) + 1 })

    const list = (players || [])
      .map(p => ({
        id: p.id,
        name: p.name,
        goals: goalMap[p.id] || 0,
        played: playedMap[p.id] || 0,
        avg: playedMap[p.id] ? ((goalMap[p.id] || 0) / playedMap[p.id]).toFixed(2) : '0.00'
      }))
      .filter(p => p.goals > 0)
      .sort((a, b) => b.goals - a.goals)

    setScorers(list)
    setLoading(false)
  }

  const medals = ['🥇', '🥈', '🥉']

  if (loading) return <AppLayout><div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Učitavanje...</div></AppLayout>

  return (
    <AppLayout>
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
          Strijelci sezone
        </div>

        {scorers.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>
            Nema zabilježenih golova. Unesi ih pri dodavanju termina u Admin.
          </div>
        )}

        {scorers.map((p, i) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < scorers.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16 }}>{medals[i] || <span style={{ width: 22, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>{i + 1}</span>}</span>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, paddingLeft: 28 }}>
                {p.played} utakmica · {p.avg} gol/ut
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)' }}>
              {p.goals} ⚽
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}
