'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Legend, Tooltip } from 'chart.js'
ChartJS.register(CategoryScale, LinearScale, BarElement, Legend, Tooltip)

const s = {
  card: { background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 14 },
  cardTitle: { fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 },
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 },
  kpi: { background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 10px', textAlign: 'center' },
  kpiVal: { fontSize: 22, fontWeight: 700 },
  kpiLbl: { fontSize: 11, color: 'var(--muted)', marginTop: 2 },
  tbl: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { color: 'var(--muted)', fontSize: 11, textAlign: 'left', padding: '6px 4px', borderBottom: '1px solid var(--border)' },
  td: { padding: '9px 4px', borderBottom: '1px solid var(--border)' },
  pts: { fontWeight: 700, color: 'var(--accent)' },
  badge: { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 999, padding: '3px 10px', fontSize: 12 },
  pill: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 10 },
}

function FormDot({ r }) {
  const bg = r === 'W' ? 'var(--win)' : r === 'D' ? 'var(--draw)' : 'var(--loss)'
  return <span style={{ width: 20, height: 20, borderRadius: 5, background: bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#000', marginRight: 3 }}>{r}</span>
}

const CHART_OPTS = {
  plugins: { legend: { labels: { color: '#9ab', font: { size: 11 } } } },
  scales: {
    y: { beginAtZero: true, ticks: { color: '#6b8299', font: { size: 10 } }, grid: { color: '#1e2e42' } },
    x: { ticks: { color: '#9ab', font: { size: 10 } }, grid: { display: false } }
  }
}

export default function Statistika() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    // Dohvati igrače
    const { data: players } = await supabase.from('players').select('*').eq('active', true).order('name')
    // Dohvati utakmice
    const { data: matches } = await supabase.from('matches').select('*').order('played_at')
    // Dohvati sudionike
    const { data: matchPlayers } = await supabase.from('match_players').select('*')
    // Dohvati golove
    const { data: goals } = await supabase.from('goals').select('*')

    if (!players || !matches) { setLoading(false); return }

    const totalMatches = matches.length

    // Izračunaj statistiku po igraču
    const stats = {}
    players.forEach(p => {
      stats[p.id] = { id: p.id, name: p.name, played: 0, W: 0, D: 0, L: 0, goals: 0, form: [], amount: 0 }
    })

    matches.forEach(m => {
      const black = (matchPlayers || []).filter(mp => mp.match_id === m.id && mp.team === 'crni' && !mp.is_guest).map(mp => mp.player_id)
      const white = (matchPlayers || []).filter(mp => mp.match_id === m.id && mp.team === 'bijeli' && !mp.is_guest).map(mp => mp.player_id)

      const applyResult = (pid, res) => {
        if (!stats[pid]) return
        stats[pid].played++
        stats[pid][res]++
        stats[pid].form.push(res)
        if (stats[pid].form.length > 5) stats[pid].form.shift()
      }

      if (m.winner === 'crni') { black.forEach(p => applyResult(p, 'W')); white.forEach(p => applyResult(p, 'L')) }
      else if (m.winner === 'bijeli') { white.forEach(p => applyResult(p, 'W')); black.forEach(p => applyResult(p, 'L')) }
      else { [...black, ...white].forEach(p => applyResult(p, 'D')) }
    })

    ;(goals || []).forEach(g => {
      if (stats[g.player_id]) stats[g.player_id].goals += g.count
    })

    Object.values(stats).forEach(s => {
      s.points = s.W * 3 + s.D
      s.amount = s.L * 3 + s.D * 2
      s.attendancePct = totalMatches > 0 ? (s.played / totalMatches * 100) : 0
    })

    const playerList = Object.values(stats).sort((a, b) => {
  if (b.points !== a.points) return b.points - a.points
  if (a.played !== b.played) return a.played - b.played
  if (b.W !== a.W) return b.W - a.W
  return (b.W / (b.played || 1)) - (a.W / (a.played || 1))
    })

    // Blagajna
    const kitty = Object.values(stats).reduce((sum, s) => sum + s.amount, 0)

    // Ishodi
    const blackWins = matches.filter(m => m.winner === 'crni').length
    const whiteWins = matches.filter(m => m.winner === 'bijeli').length
    const draws = matches.filter(m => m.winner === 'nerijeseno').length

    // Duo
    const pairs = {}
    matches.forEach(m => {
      const addPair = (team, won) => {
        const t = team
        for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) {
          const [a, b] = [t[i], t[j]].sort((x, y) => x - y)
          const k = `${a}|${b}`
          if (!pairs[k]) pairs[k] = { a, b, w: 0, l: 0 }
          if (won) pairs[k].w++
          else if (m.winner !== 'nerijeseno') pairs[k].l++
        }
      }
      const black = (matchPlayers || []).filter(mp => mp.match_id === m.id && mp.team === 'crni' && !mp.is_guest).map(mp => mp.player_id)
      const white = (matchPlayers || []).filter(mp => mp.match_id === m.id && mp.team === 'bijeli' && !mp.is_guest).map(mp => mp.player_id)
      addPair(black, m.winner === 'crni')
      addPair(white, m.winner === 'bijeli')
    })

    const getName = id => players.find(p => p.id === id)?.name || '?'
    const pArr = Object.values(pairs).map(p => ({ ...p, aName: getName(p.a), bName: getName(p.b) }))
    const duoBest = [...pArr].sort((a, b) => b.w - a.w || a.l - b.l).slice(0, 3)
    const duoWorst = [...pArr].sort((a, b) => b.l - a.l || a.w - b.w).slice(0, 3)

    setData({ playerList, kitty, totalMatches, blackWins, whiteWins, draws, duoBest, duoWorst })
    setLoading(false)
  }

  if (loading) return <AppLayout><div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Učitavanje...</div></AppLayout>
  if (!data) return <AppLayout><div style={{ padding: 20, color: 'var(--loss)' }}>Greška pri učitavanju.</div></AppLayout>

  const { playerList, kitty, totalMatches, blackWins, whiteWins, draws, duoBest, duoWorst } = data

  const top10att = [...playerList].sort((a, b) => b.attendancePct - a.attendancePct).slice(0, 10)
  const top10wl = [...playerList].sort((a, b) => b.W - a.W).slice(0, 10)
  const top5form = [...playerList].map(p => ({ ...p, formScore: p.form.reduce((a, c) => a + (c === 'W' ? 3 : c === 'D' ? 1 : 0), 0) })).sort((a, b) => b.formScore - a.formScore).slice(0, 5)

  const calcStreak = (form, type) => { let c = 0; for (let i = form.length - 1; i >= 0; i--) { if (form[i] === type) c++; else break }; return c }
  const wStreaks = playerList.map(p => ({ name: p.name, n: calcStreak(p.form, 'W') })).filter(x => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 5)
  const lStreaks = playerList.map(p => ({ name: p.name, n: calcStreak(p.form, 'L') })).filter(x => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 5)

  const dots = (n, color) => Array.from({ length: n }).map((_, i) => (
    <span key={i} style={{ width: 18, height: 18, borderRadius: 4, background: color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#000', marginRight: 2 }}>{color === 'var(--win)' ? 'W' : 'L'}</span>
  ))

  return (
    <AppLayout>
      {/* KPI */}
      <div style={s.kpiRow}>
        <div style={s.kpi}><div style={s.kpiVal}>{kitty.toFixed(2)} €</div><div style={s.kpiLbl}>Blagajna</div></div>
        <div style={s.kpi}><div style={s.kpiVal}>{totalMatches}</div><div style={s.kpiLbl}>Termini</div></div>
        <div style={s.kpi}><div style={s.kpiVal}>{new Date().getFullYear()}</div><div style={s.kpiLbl}>Sezona</div></div>
      </div>

      {/* Ishodi */}
      <div style={s.card}>
        <div style={s.cardTitle}>Ishod sezone</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ ...s.badge, borderColor: '#166534', background: '#052e16', color: 'var(--win)' }}>⬛ Crni: {blackWins}</span>
          <span style={{ ...s.badge, borderColor: '#713f12', background: '#1c1002', color: 'var(--draw)' }}>🤝 Neriješeno: {draws}</span>
          <span style={{ ...s.badge, borderColor: '#1e3a8a', background: '#0c1a3a', color: '#60a5fa' }}>⬜ Bijeli: {whiteWins}</span>
        </div>
      </div>

      {/* Grafovi */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div style={{ ...s.card, marginBottom: 0 }}>
          <div style={s.cardTitle}>Dolaznost Top 10</div>
          <Bar data={{ labels: top10att.map(p => p.name), datasets: [{ data: top10att.map(p => p.attendancePct.toFixed(1)), backgroundColor: '#38bdf8', borderRadius: 4 }] }} options={{ ...CHART_OPTS, plugins: { legend: { display: false } } }} />
        </div>
        <div style={{ ...s.card, marginBottom: 0 }}>
          <div style={s.cardTitle}>Pobjede / Porazi</div>
          <Bar data={{ labels: top10wl.map(p => p.name), datasets: [{ label: 'Pobjede', data: top10wl.map(p => p.W), backgroundColor: '#22c55e', borderRadius: 4 }, { label: 'Porazi', data: top10wl.map(p => p.L), backgroundColor: '#ef4444', borderRadius: 4 }] }} options={CHART_OPTS} />
        </div>
      </div>

      {/* Forma + Duo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div style={{ ...s.card, marginBottom: 0 }}>
          <div style={s.cardTitle}>Najbolja forma — Top 5</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {top5form.map(p => (
              <div key={p.id} style={s.pill}>
                <strong>{p.name}</strong>&nbsp;&nbsp;
                <span style={{ display: 'inline-flex' }}>{p.form.map((r, i) => <FormDot key={i} r={r} />)}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ ...s.card, marginBottom: 0 }}>
          <div style={s.cardTitle}>Duo — Top 3</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Najbolji</div>
              {duoBest.map((p, i) => (
                <div key={i} style={{ ...s.pill, marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{p.aName} — {p.bName}</div>
                  <div style={{ display: 'flex', marginTop: 4 }}>{dots(p.w, 'var(--win)')}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Najlošiji</div>
              {duoWorst.map((p, i) => (
                <div key={i} style={{ ...s.pill, marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{p.aName} — {p.bName}</div>
                  <div style={{ display: 'flex', marginTop: 4 }}>{dots(p.l, 'var(--loss)')}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Streakovi */}
      <div style={s.card}>
        <div style={s.cardTitle}>Streakovi — Top 5</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>W-streak</div>
            {wStreaks.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>Nema podataka</div>}
            {wStreaks.map((x, i) => <div key={i} style={{ ...s.badge, display: 'flex', padding: '7px 10px', borderRadius: 8, marginBottom: 6 }}>✅ W-streak: {x.n} — {x.name}</div>)}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>L-streak</div>
            {lStreaks.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>Nema podataka</div>}
            {lStreaks.map((x, i) => <div key={i} style={{ ...s.badge, display: 'flex', padding: '7px 10px', borderRadius: 8, marginBottom: 6 }}>❌ L-streak: {x.n} — {x.name}</div>)}
          </div>
        </div>
      </div>

      {/* Ljestvica */}
      <div style={s.card}>
        <div style={s.cardTitle}>Ljestvica</div>
        {playerList.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>Nema igrača. Dodaj ih u Admin → Igrači.</div>}
        <div style={{ overflowX: 'auto' }}>
          <table style={s.tbl}>
            <thead>
              <tr>
                <th style={s.th}>#</th>
                <th style={s.th}>Igrač</th>
                <th style={s.th}>Ut</th>
                <th style={s.th}>W</th>
                <th style={s.th}>D</th>
                <th style={s.th}>L</th>
                <th style={s.th}>Bod</th>
                <th style={s.th}>€</th>
                <th style={s.th}>Forma</th>
              </tr>
            </thead>
            <tbody>
              {playerList.map((p, i) => (
                <tr key={p.id}>
                  <td style={{ ...s.td, color: 'var(--muted)', fontSize: 12 }}>{i + 1}</td>
                  <td style={{ ...s.td, fontWeight: 600 }}>{p.name}</td>
                  <td style={s.td}>{p.played}</td>
                  <td style={s.td}>{p.W}</td>
                  <td style={s.td}>{p.D}</td>
                  <td style={s.td}>{p.L}</td>
                  <td style={{ ...s.td, ...s.pts }}>{p.points}</td>
                  <td style={{ ...s.td, color: p.amount > 0 ? 'var(--loss)' : 'var(--muted)' }}>{p.amount.toFixed(2)}</td>
                  <td style={s.td}><span style={{ display: 'inline-flex' }}>{p.form.map((r, j) => <FormDot key={j} r={r} />)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  )
}
