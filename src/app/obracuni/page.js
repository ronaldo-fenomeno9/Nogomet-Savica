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
  const [kittyBalance, setKittyBalance] = useState(0)
  const [transactions, setTransactions] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: players } = await supabase.from('players').select('*').eq('active', true)
    const { data: matches } = await supabase.from('matches').select('*').order('played_at')
    const { data: matchPlayers } = await supabase.from('match_players').select('*')
    const { data: txs } = await supabase.from('kitty_transactions').select('*').order('date', { ascending: false })

    if (!matches || !players) { setLoading(false); return }

    // Stanje blagajne — samo ručne transakcije
    const txBalance = (txs || []).reduce((sum, t) => sum + (t.type === 'uplata' ? Number(t.amount) : -Number(t.amount)), 0)
    setKittyBalance(txBalance)
    setTransactions(txs || [])

    // Mjesečni obračuni
    const monthly = {}
    matches.forEach(m => {
      const ym = m.played_at.slice(0, 7)
      if (!monthly[ym]) {
        monthly[ym] = { month: ym, played: 0, kitty: 0, table: {} }
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
      {/* STANJE BLAGAJNE — klikabilno */}
      <div
        onClick={() => setShowModal(true)}
        style={{
          background: 'linear-gradient(135deg, #052e16, #0f1720)',
          border: '1px solid #166534',
          borderRadius: 16, padding: 20, marginBottom: 16,
          cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
        }}
      >
        <div style={{ fontSize: 12, color: '#4ade80', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          🏦 Stanje blagajne
        </div>
        <div style={{ fontSize: 36, fontWeight: 800, color: kittyBalance >= 0 ? '#22c55e' : '#ef4444' }}>
          {kittyBalance.toFixed(2)} €
        </div>
        <div style={{ fontSize: 11, color: '#166534', marginTop: 8 }}>
          💡 Klikni za povijest transakcija
        </div>
      </div>

      {/* MJESEČNI OBRAČUNI */}
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

      {/* MODAL — povijest transakcija */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--panel)', borderRadius: '18px 18px 0 0', border: '1px solid var(--border)', width: '100%', maxWidth: 600, maxHeight: '80vh', overflowY: 'auto', padding: 20 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>🏦 Povijest blagajne</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  Stanje: <strong style={{ color: kittyBalance >= 0 ? 'var(--win)' : 'var(--loss)' }}>{kittyBalance.toFixed(2)} €</strong>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--muted)', fontSize: 20, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>

            {/* Ručne transakcije */}
            {transactions.length === 0 && (
              <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 24, fontSize: 13 }}>
                Nema transakcija. Dodaj ih u Admin → Blagajna.
              </div>
            )}

            {transactions.map(t => (
              <div key={t.id} style={{ background: 'var(--card)', border: `1px solid ${t.type === 'uplata' ? '#166534' : '#7f1d1d'}`, borderRadius: 12, padding: 12, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {t.type === 'uplata' ? '💵 Uplata' : '💸 Trošak'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{t.date}</div>
                    {t.note && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>💬 {t.note}</div>}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: t.type === 'uplata' ? 'var(--win)' : 'var(--loss)' }}>
                    {t.type === 'uplata' ? '+' : '-'}{Number(t.amount).toFixed(2)} €
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  )
}
