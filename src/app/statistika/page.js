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
  pill: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', marginBottom: 8 },
  badge: { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 999, padding: '4px 12px', fontSize: 13 },
}

function FormDot({ r }) {
  const bg = r === 'W' ? 'var(--win)' : r === 'D' ? 'var(--draw)' : 'var(--loss)'
  return <span style={{ width: 22, height: 22, borderRadius: 5, background: bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#000', marginRight: 3, flexShrink: 0 }}>{r}</span>
}

const CHART_OPTS = {
  plugins: { legend: { labels: { color: '#9ab', font: { size: 11 }, boxWidth: 12 } } },
  scales: {
    y: { beginAtZero: true, ticks: { color: '#6b8299', font: { size: 10 } }, grid: { color: '#1e2e42' } },
    x: { ticks: { color: '#9ab', font: { size: 10 }, maxRotation: 45 }, grid: { display: false } }
  }
}

export default function Statistika() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: ps } = await supabase.from('players').select('*').eq('active', true)
    const { data: matches } = await supabase.from('matches').select('*').order('played_at')
    const { data: matchPlayers } = await supabase.from('match_players').select('*')
    const { data: goals } = await supabase.from('goals').select('*')

    if (!ps || !matches) { setLoading(false); return }

    const stats = {}
    ps.forEach(p => { stats[p.id] = { id: p.id, name: p.name, played: 0, W: 0, D: 0, L: 0, goals: 0, form: [] } })

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
    ;(goals || []).forEach(g => { if (stats[g.player_id]) stats[g.player_id].goals += g.count })

    const playerList = Object.values(stats).map(s => ({
      ...s, points: s.W * 3 + s.D, amount: s.L * 3 + s.D * 2,
      attendancePct: matches.length > 0 ? s.played / matches.length * 100 : 0,
    }))

    const kitty = playerList.reduce((sum, s) => sum + s.amount, 0)
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
          if (won) pairs[k].w++; else if (m.winner !== 'nerijeseno') pairs[k].l++
        }
      }
      const black = (matchPlayers || []).filter(mp => mp.match_id === m.id && mp.team === 'crni' && !mp.is_guest).map(mp => mp.player_id)
      const white = (matchPlayers || []).filter(mp => mp.match_id === m.id && mp.team === 'bijeli' && !mp.is_guest).map(mp => mp.player_id)
      addPair(black, m.winner === 'crni')
      addPair(white, m.winner === 'bijeli')
    })
    const getName = id => ps.find(p => p.id === id)?.name || '?'
    const pArr = Object.values(pairs).map(p => ({ ...p, aName: getName(p.a), bName: getName(p.b) }))
    const duoBest = [...pArr].sort((a, b) => b.w - a.w || a.l - b.l).slice(0, 3)
    const duoWorst = [...pArr].sort((a, b) => b.l - a.l || a.w - b.w).slice(0, 3)

    setData({ playerList, kitty, totalMatches: matches.length, blackWins, whiteWins, draws, duoBest, duoWorst })
    setLoading(false)
  }

  if (loading) return <AppLayout><div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Učitavanje...</div></AppLayout>
  if (!data) return <AppLayout><div style={{ padding: 20, color: 'var(--loss)' }}>Greška pri učitavanju.</div></AppLayout>

  const { playerList, kitty, totalMatches, blackWins, whiteWins, draws, duoBest, duoWorst } = data

  const top10att = [...playerList].sort((a, b) => b.attendancePct - a.attendancePct).slice(0, 10)
  const top10wl = [...playerList].sort((a, b) => b.W - a.W).slice(0, 10)
  const top5form = [...playerList].map(p => ({ ...p, formScore: p.form.reduce((a, c) => a + (c === 'W' ? 3 : c === 'D' ? 1 : 0), 0) })).sort((a, b) => b.formScore - a.formScore).slice(0, 5)
  const worst5form = [...playerList].filter(p => p.form.length > 0).map(p => ({ ...p, formScore: p.form.reduce((a, c) => a + (c === 'W' ? 3 : c === 'D' ? 1 : 0), 0) })).sort((a, b) => a.formScore - b.formScore).slice(0, 5)
  const calcStreak = (form, type) => { let c = 0; for (let i = form.length - 1; i >= 0; i--) { if (form[i] === type) c++; else break }; return c }
  const wStreaks = playerList.map(p => ({ name: p.name, n: calcStreak(p.form, 'W') })).filter(x => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 5)
  const lStreaks = playerList.map(p => ({ name: p.name, n: calcStreak(p.form, 'L') })).filter(x => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 5)
  const dots = (n, color, letter) => Array.from({ length: n }).map((_, i) => (
    <span key={i} style={{ width: 20, height: 20, borderRadius: 4, background: color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#000', marginRight: 2 }}>{letter}</span>
  ))

  return (
    <AppLayout>
      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { val: `${kitty.toFixed(0)} €`, lbl: 'Blagajna' },
          { val: totalMatches, lbl: 'Termini' },
          { val: new Date().getFullYear(), lbl: 'Sezona' },
        ].map((k, i) => (
          <div key={i} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{k.val}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{k.lbl}</div>
          </div>
        ))}
      </div>

      {/* Ishodi */}
      <div style={s.card}>
        <div style={s.cardTitle}>Ishod sezone</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ ...s.badge, borderColor: '#166534', background: '#052e16', color: 'var(--win)' }}>⬛ Crni: {blackWins}</span>
          <span style={{ ...s.badge, borderColor: '#713f12', background: '#1c1002', color: 'var(--draw)' }}>🤝 Nerij: {draws}</span>
          <span style={{ ...s.badge, borderColor: '#1e3a8a', background: '#0c1a3a', color: '#60a5fa' }}>⬜ Bijeli: {whiteWins}</span>
        </div>
      </div>

      {/* Grafovi — jedan ispod drugog na mobitelu */}
      <div style={s.card}>
        <div style={s.cardTitle}>Dolaznost — Top 10</div>
        <Bar
          data={{ labels: top10att.map(p => p.name), datasets: [{ data: top10att.map(p => p.attendancePct.toFixed(1)), backgroundColor: '#38bdf8', borderRadius: 4 }] }}
          options={{ ...CHART_OPTS, plugins: { legend: { display: false } } }}
        />
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>Pobjede / Porazi — Top 10</div>
        <Bar
          data={{ labels: top10wl.map(p => p.name), datasets: [{ label: 'Pobjede', data: top10wl.map(p => p.W), backgroundColor: '#22c55e', borderRadius: 4 }, { label: 'Porazi', data: top10wl.map(p => p.L), backgroundColor: '#ef4444', borderRadius: 4 }] }}
          options={CHART_OPTS}
        />
      </div>

      {/* Forma */}
      <div style={s.card}>
        <div style={s.cardTitle}>Najbolja forma — Top 5</div>
        {top5form.map(p => (
          <div key={p.id} style={s.pill}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{p.name}</div>
            <div style={{ display: 'flex' }}>{p.form.map((r, i) => <FormDot key={i} r={r} />)}</div>
          </div>
        ))}
      </div>

      {/* Najlošija forma */}
      <div style={s.card}>
        <div style={s.cardTitle}>Najlošija forma — Top 5</div>
        {worst5form.map(p => (
          <div key={p.id} style={{ ...s.pill, borderColor: '#7f1d1d' }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{p.name}</div>
            <div style={{ display: 'flex' }}>{p.form.map((r, i) => <FormDot key={i} r={r} />)}</div>
          </div>
        ))}
      </div>

      {/* Duo */}
      <div style={s.card}>
        <div style={s.cardTitle}>Duo statistika</div>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--win)' }}>🤝 Najbolji duo</div>
        {duoBest.map((p, i) => (
          <div key={i} style={{ ...s.pill, borderColor: '#166534' }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{p.aName} & {p.bName}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{p.w} zajedničkih pobjeda</span>
              <div style={{ display: 'flex' }}>{dots(Math.min(p.w, 6), 'var(--win)', 'W')}</div>
            </div>
          </div>
        ))}

        <div style={{ fontWeight: 700, fontSize: 13, margin: '12px 0 8px', color: 'var(--loss)' }}>💀 Najlošiji duo</div>
        {duoWorst.map((p, i) => (
          <div key={i} style={{ ...s.pill, borderColor: '#7f1d1d' }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{p.aName} & {p.bName}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{p.l} zajedničkih poraza</span>
              <div style={{ display: 'flex' }}>{dots(Math.min(p.l, 6), 'var(--loss)', 'L')}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Streakovi */}
      <div style={s.card}>
        <div style={s.cardTitle}>Streakovi</div>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--win)' }}>🔥 W-streak</div>
        {wStreaks.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>Nema aktivnih streak-ova</div>}
        {wStreaks.map((x, i) => (
          <div key={i} style={{ ...s.pill, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontWeight: 600 }}>{x.name}</span>
            <span style={{ background: '#052e16', border: '1px solid #166534', color: 'var(--win)', borderRadius: 8, padding: '3px 10px', fontSize: 13, fontWeight: 700 }}>✅ {x.n} zaredom</span>
          </div>
        ))}

        <div style={{ fontWeight: 700, fontSize: 13, margin: '12px 0 8px', color: 'var(--loss)' }}>❄️ L-streak</div>
        {lStreaks.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>Nema aktivnih streak-ova</div>}
        {lStreaks.map((x, i) => (
          <div key={i} style={{ ...s.pill, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontWeight: 600 }}>{x.name}</span>
            <span style={{ background: '#1c0202', border: '1px solid #7f1d1d', color: 'var(--loss)', borderRadius: 8, padding: '3px 10px', fontSize: 13, fontWeight: 700 }}>❌ {x.n} zaredom</span>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}
