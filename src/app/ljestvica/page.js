'use client'
import { useEffect, useState, useRef } from 'react'
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

function ResultChip({ r }) {
  const bg = r === 'W' ? 'var(--win)' : r === 'D' ? 'var(--draw)' : 'var(--loss)'
  const label = r === 'W' ? 'Pobjeda' : r === 'D' ? 'Neriješeno' : 'Poraz'
  return (
    <span style={{ background: bg, color: '#000', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{label}</span>
  )
}

export default function Ljestvica() {
  const [players, setPlayers] = useState([])
  const [totalMatches, setTotalMatches] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)
  const shareRef = useRef(null)
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [playerMatches, setPlayerMatches] = useState([])
  const [allMatches, setAllMatches] = useState([])
  const [allMatchPlayers, setAllMatchPlayers] = useState([])
  const [allGoals, setAllGoals] = useState([])
  const [playerMap, setPlayerMap] = useState({})

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: ps } = await supabase.from('players').select('*').eq('active', true)
    const { data: matches } = await supabase.from('matches').select('*').order('played_at')
    const { data: matchPlayers } = await supabase.from('match_players').select('*')
    const { data: goals } = await supabase.from('goals').select('*')

    if (!ps || !matches) { setLoading(false); return }

    const pMap = {}
    ps.forEach(p => { pMap[p.id] = p.name })
    setPlayerMap(pMap)
    setAllMatches(matches)
    setAllMatchPlayers(matchPlayers || [])
    setAllGoals(goals || [])

    const stats = {}
    ps.forEach(p => { stats[p.id] = { id: p.id, name: p.name, played: 0, W: 0, D: 0, L: 0, form: [] } })

    matches.forEach(m => {
      const black = (matchPlayers || []).filter(mp => mp.match_id === m.id && mp.team === 'crni' && !mp.is_guest).map(mp => mp.player_id)
      const white = (matchPlayers || []).filter(mp => mp.match_id === m.id && mp.team === 'bijeli' && !mp.is_guest).map(mp => mp.player_id)
      const apply = (pid, res) => {
        if (!stats[pid]) return
        stats[pid].played++; stats[pid][res]++
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
      winPct: s.played > 0 ? Math.round(s.W / s.played * 100) : 0,
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

  async function shareStandings() {
    if (!shareRef.current) return
    setSharing(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(shareRef.current, {
        backgroundColor: '#0f1720',
        scale: 2,
        useCORS: true,
      })
      canvas.toBlob(async (blob) => {
        const file = new File([blob], 'ljestvica-savica.png', { type: 'image/png' })
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ title: 'HNB Savica — Ljestvica', files: [file] })
        } else {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url; a.download = 'ljestvica-savica.png'; a.click()
          URL.revokeObjectURL(url)
        }
        setSharing(false)
      }, 'image/png')
    } catch (e) {
      console.error(e)
      setSharing(false)
    }
  }

  function openPlayerModal(player) {
    setSelectedPlayer(player)
    const matchIds = allMatchPlayers
      .filter(mp => mp.player_id === player.id && !mp.is_guest)
      .map(mp => mp.match_id)

    const played = allMatches
      .filter(m => matchIds.includes(m.id))
      .sort((a, b) => b.played_at.localeCompare(a.played_at))
      .map(m => {
        const parts = allMatchPlayers.filter(mp => mp.match_id === m.id)
        const goalsList = allGoals.filter(g => g.match_id === m.id)
        const onBlack = parts.some(mp => mp.player_id === player.id && mp.team === 'crni')
        let result = 'D'
        if (m.winner === 'crni' && onBlack) result = 'W'
        else if (m.winner === 'bijeli' && !onBlack) result = 'W'
        else if (m.winner === 'crni' && !onBlack) result = 'L'
        else if (m.winner === 'bijeli' && onBlack) result = 'L'

        const chipName = (mp) => ({
          name: mp.is_guest ? mp.guest_name : (playerMap[mp.player_id] || '?'),
          goals: goalsList.find(g => g.player_id === mp.player_id)?.count || 0,
          isGuest: mp.is_guest,
          isMe: mp.player_id === player.id,
        })

        return {
          ...m,
          result,
          black: parts.filter(mp => mp.team === 'crni').map(chipName),
          white: parts.filter(mp => mp.team === 'bijeli').map(chipName),
        }
      })

    setPlayerMatches(played)
  }

  function closeModal() {
    setSelectedPlayer(null)
    setPlayerMatches([])
  }

  if (loading) {
    return (
      <AppLayout>
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Učitavanje...</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      {/* Share gumb */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button
          onClick={shareStandings}
          disabled={sharing || players.length === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 10,
            border: '1px solid var(--border)', background: 'var(--panel)',
            color: sharing ? 'var(--muted)' : 'var(--text)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          {sharing ? '⏳ Generiranje...' : '📤 Podijeli ljestvicu'}
        </button>
      </div>

      {/* Ljestvica — ovaj div ide na screenshot */}
      <div ref={shareRef} style={{ background: '#0f1720', borderRadius: 14, padding: 4 }}>

        {players.length === 0 && (
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
            Nema igrača. Dodaj ih u Admin.
          </div>
        )}

        {players.map((p, i) => (
          <div
            key={p.id}
            onClick={() => openPlayerModal(p)}
            style={{
              background: 'var(--panel)',
              border: `1px solid ${i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : 'var(--border)'}`,
              borderRadius: 14, padding: '12px 10px', marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 8,
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            }}
          >
            {/* Rank */}
            <div style={{
              fontSize: i < 3 ? 20 : 14, fontWeight: 700,
              color: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : 'var(--muted)',
              minWidth: 26, textAlign: 'center', flexShrink: 0,
            }}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
            </div>

            {/* Ime + forma + stats */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{p.name}</div>
              <div style={{ display: 'flex', flexWrap: 'nowrap', marginBottom: 5 }}>
                {p.form.map((r, j) => <FormDot key={j} r={r} />)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.8 }}>
                <div>{p.played}/{totalMatches} odigranih · {p.attendancePct}% dolaznost</div>
                <div style={{ color: p.winPct >= 50 ? 'var(--win)' : 'var(--loss)' }}>{p.winPct}% uspješnost</div>
              </div>
            </div>

            {/* W/D/L + Bodovi */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>W/D/L</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  <span style={{ color: 'var(--win)' }}>{p.W}</span>
                  <span style={{ color: 'var(--muted)' }}>/</span>
                  <span style={{ color: 'var(--draw)' }}>{p.D}</span>
                  <span style={{ color: 'var(--muted)' }}>/</span>
                  <span style={{ color: 'var(--loss)' }}>{p.L}</span>
                </div>
              </div>
              <div style={{ textAlign: 'center', minWidth: 34 }}>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>Bod</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{p.points}</div>
              </div>
            </div>
          </div>
        ))}

        {/* Legenda */}
        {players.length > 0 && (
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginTop: 4 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Legenda</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, color: 'var(--muted)' }}>
              <span>W = Pobjeda (3 boda)</span>
              <span>D = Neriješeno (1 bod)</span>
              <span>L = Poraz (0 bodova)</span>
              <span>Forma = zadnjih 5 utakmica</span>
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
              💡 Klikni na igrača za pregled njegovih termina
            </div>
          </div>
        )}

      </div>
      {/* kraj shareRef div-a */}

      {/* MODAL — klizi odozdo */}
      {selectedPlayer && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--panel)',
              borderRadius: '18px 18px 0 0',
              border: '1px solid var(--border)',
              width: '100%', maxWidth: 600,
              maxHeight: '82vh', overflowY: 'auto',
              padding: 20,
            }}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{selectedPlayer.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {playerMatches.length} odigranih · {selectedPlayer.W}W / {selectedPlayer.D}D / {selectedPlayer.L}L · {selectedPlayer.points} bod.
                </div>
              </div>
              <button
                onClick={closeModal}
                style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--muted)', fontSize: 20, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >×</button>
            </div>

            {playerMatches.length === 0 && (
              <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 24 }}>Nema odigranih termina.</div>
            )}

            {playerMatches.map(m => (
              <div key={m.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{m.played_at}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{m.score_black}:{m.score_white}</span>
                    <ResultChip r={m.result} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[{ label: '⬛ Crni', team: m.black }, { label: '⬜ Bijeli', team: m.white }].map(({ label, team }) => (
                    <div key={label}>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
                      {team.map((pl, idx) => (
                        <span key={idx} style={{
                          display: 'inline-block', fontSize: 12,
                          padding: '2px 7px', borderRadius: 6,
                          marginRight: 3, marginBottom: 3,
                          background: pl.isMe ? 'rgba(61,214,255,0.15)' : 'var(--panel)',
                          border: `1px ${pl.isGuest ? 'dashed' : 'solid'} ${pl.isMe ? 'var(--accent)' : 'var(--border)'}`,
                          color: pl.isMe ? 'var(--accent)' : pl.isGuest ? 'var(--muted)' : 'var(--text)',
                          fontWeight: pl.isMe ? 700 : 400,
                        }}>
                          {pl.name}{pl.goals > 0 ? ' ' + '⚽'.repeat(pl.goals) : ''}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
                {m.note && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', background: 'var(--panel)', borderRadius: 8, padding: '6px 10px', borderLeft: '3px solid var(--accent)' }}>
                    💬 {m.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  )
}
