'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'
import { getCurrentSeason, seasonOf } from '@/lib/season'

export default function Strijelci() {
  const [scorers, setScorers] = useState([])
  const [season, setSeason] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: players } = await supabase.from('players').select('*').eq('active', true)
    const { data: matches } = await supabase.from('matches').select('*')
    const { data: goals } = await supabase.from('goals').select('*')
    const { data: matchPlayers } = await supabase.from('match_players').select('*').eq('is_guest', false)

    if (!players || !matches) { setLoading(false); return }

    // Tekuća sezona
    const currentSeason = getCurrentSeason(matches)
    setSeason(currentSeason)

    // Utakmice tekuće sezone
    const seasonMatches = matches.filter(m => seasonOf(m.played_at) === currentSeason)
    const seasonMatchIds = new Set(seasonMatches.map(m => m.id))

    // Golovi tekuće sezone
    const seasonGoals = (goals || []).filter(g => seasonMatchIds.has(g.match_id))

    // Prva utakmica u kojoj su UOPĆE bilježeni golovi (od kad pratimo strijelce)
    const matchesWithGoals = seasonMatches.filter(m => seasonGoals.some(g => g.match_id === m.id))
    const firstGoalDate = matchesWithGoals.length > 0
      ? matchesWithGoals.reduce((min, m) => m.played_at < min ? m.played_at : min, matchesWithGoals[0].played_at)
      : null

    // Ukupni golovi po igraču
    const goalMap = {}
    seasonGoals.forEach(g => { goalMap[g.player_id] = (goalMap[g.player_id] || 0) + g.count })

    // Broj utakmica po igraču — SAMO od firstGoalDate nadalje (za realan prosjek)
    const playedMap = {}
    ;(matchPlayers || []).forEach(mp => {
      const m = seasonMatches.find(sm => sm.id === mp.match_id)
      if (!m) return
      if (firstGoalDate && m.played_at >= firstGoalDate) {
        playedMap[mp.player_id] = (playedMap[mp.player_id] || 0) + 1
      }
    })

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
          Strijelci sezone {season}
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

      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
        Prosjek se računa od prve utakmice u kojoj su bilježeni golovi.
      </div>
    </AppLayout>
  )
}
