'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'

const ADMIN_PASSWORD = 'savica2025'

const s = {
  card: { background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 14 },
  cardTitle: { fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 },
  input: { width: '100%', padding: '10px 12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none' },
  btn: (color = '#22c55e', text = '#000') => ({ padding: '10px 20px', borderRadius: 10, border: 'none', background: color, color: text, fontWeight: 700, fontSize: 14, cursor: 'pointer' }),
  scoreInput: { width: 64, height: 52, fontSize: 24, fontWeight: 700, textAlign: 'center', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', outline: 'none' },
  tab: (active) => ({ padding: '8px 16px', borderRadius: 8, border: 'none', background: active ? 'var(--accent)' : 'var(--card)', color: active ? '#000' : 'var(--muted)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }),
}

// ——— FORMA ZA UNOS / UREĐIVANJE TERMINA ———
function MatchForm({ players, existing, onSave, onCancel }) {
  const [matchDate, setMatchDate] = useState(existing?.played_at || new Date().toISOString().split('T')[0])
  const [playerStates, setPlayerStates] = useState(() => {
    const st = {}
    players.forEach(p => { st[p.id] = 0 })
    if (existing) {
      existing.black.filter(p => !p.isGuest).forEach(p => { st[p.player_id] = 1 })
      existing.white.filter(p => !p.isGuest).forEach(p => { st[p.player_id] = 2 })
    }
    return st
  })
  const [scoreBlack, setScoreBlack] = useState(existing?.score_black ?? 0)
  const [scoreWhite, setScoreWhite] = useState(existing?.score_white ?? 0)
  const [goals, setGoals] = useState(() => {
    const g = {}
    if (existing) existing.goalsList?.forEach(gl => { g[gl.player_id] = gl.count })
    return g
  })
  // Gosti: { name, team }
  const [guests, setGuests] = useState(() => {
    if (!existing) return []
    return [
      ...existing.black.filter(p => p.isGuest).map(p => ({ name: p.name, team: 'crni' })),
      ...existing.white.filter(p => p.isGuest).map(p => ({ name: p.name, team: 'bijeli' })),
    ]
  })
  const [note, setNote] = useState(existing?.note || '')
  const [saving, setSaving] = useState(false)

  function cyclePlayer(id) {
    setPlayerStates(prev => ({ ...prev, [id]: (prev[id] + 1) % 3 }))
    // 0=nije, 1=crni, 2=bijeli (bez gost opcije — gosti su posebno)
  }

  function changeGoal(pid, delta) {
    setGoals(prev => ({ ...prev, [pid]: Math.max(0, (prev[pid] || 0) + delta) }))
  }

  function addGuest() {
    setGuests(prev => [...prev, { name: '', team: 'crni' }])
  }

  function updateGuest(i, field, val) {
    setGuests(prev => prev.map((g, idx) => idx === i ? { ...g, [field]: val } : g))
  }

  function removeGuest(i) {
    setGuests(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSave() {
    const blackIds = players.filter(p => playerStates[p.id] === 1).map(p => p.id)
    const whiteIds = players.filter(p => playerStates[p.id] === 2).map(p => p.id)

    if (blackIds.length === 0 || whiteIds.length === 0) {
      alert('Moraš odabrati barem jednog igrača za svaku ekipu!'); return
    }

    const sb = parseInt(scoreBlack) || 0
    const sw = parseInt(scoreWhite) || 0
    const winner = sb > sw ? 'crni' : sw > sb ? 'bijeli' : 'nerijeseno'

    setSaving(true)

    let matchId = existing?.id

    if (existing) {
      // UPDATE
      await supabase.from('matches').update({ played_at: matchDate, score_black: sb, score_white: sw, winner, note: note.trim() || null }).eq('id', matchId)
      await supabase.from('match_players').delete().eq('match_id', matchId)
      await supabase.from('goals').delete().eq('match_id', matchId)
    } else {
      // INSERT
      const { data: match } = await supabase.from('matches').insert({ played_at: matchDate, score_black: sb, score_white: sw, winner, note: note.trim() || null }).select().single()
      matchId = match.id
    }

    // Sudionici
    const participants = [
      ...blackIds.map(id => ({ match_id: matchId, player_id: id, team: 'crni', is_guest: false, guest_name: null })),
      ...whiteIds.map(id => ({ match_id: matchId, player_id: id, team: 'bijeli', is_guest: false, guest_name: null })),
      ...guests.filter(g => g.name.trim()).map(g => ({ match_id: matchId, player_id: null, team: g.team, is_guest: true, guest_name: g.name.trim() })),
    ]
    await supabase.from('match_players').insert(participants)

    // Golovi
    const goalEntries = Object.entries(goals).filter(([, c]) => c > 0).map(([pid, count]) => ({ match_id: matchId, player_id: parseInt(pid), count }))
    if (goalEntries.length > 0) await supabase.from('goals').insert(goalEntries)

    setSaving(false)
    onSave()
  }

  const blackPlayers = players.filter(p => playerStates[p.id] === 1)
  const whitePlayers = players.filter(p => playerStates[p.id] === 2)

  return (
    <div style={s.card}>
      <div style={s.cardTitle}>{existing ? '✏️ Uredi termin' : '➕ Novi termin'}</div>

      {/* Datum */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Datum</div>
        <input style={{ ...s.input, width: 'auto' }} type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)} />
      </div>

      {/* Odabir igrača */}
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
        Klikni igrača: 1× = ⬛ Crni · 2× = ⬜ Bijeli · 3× = isključi
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {players.map(p => {
          const st = playerStates[p.id] || 0
          let bg = 'var(--card)', border = '1px solid var(--border)', color = 'var(--text)', prefix = ''
          if (st === 1) { bg = '#111'; border = '1px solid #555'; prefix = '⬛ ' }
          if (st === 2) { bg = '#dbeafe'; border = '1px solid #93c5fd'; color = '#0f1720'; prefix = '⬜ ' }
          return (
            <button key={p.id} onClick={() => cyclePlayer(p.id)} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, border, background: bg, color, cursor: 'pointer' }}>
              {prefix}{p.name}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
        <span>⬛ Crni: <strong>{blackPlayers.length}</strong></span>
        <span>⬜ Bijeli: <strong>{whitePlayers.length}</strong></span>
      </div>

      {/* Gosti */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Gosti</div>
          <button onClick={addGuest} style={{ ...s.btn('#1a2636', 'var(--accent)'), padding: '5px 12px', fontSize: 12, border: '1px solid var(--accent)' }}>+ Dodaj gosta</button>
        </div>
        {guests.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Nema gostiju za ovaj termin.</div>}
        {guests.map((g, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <input
              style={{ ...s.input, flex: 1 }}
              placeholder="Ime gosta..."
              value={g.name}
              onChange={e => updateGuest(i, 'name', e.target.value)}
            />
            <select
              value={g.team}
              onChange={e => updateGuest(i, 'team', e.target.value)}
              style={{ padding: '10px 8px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, outline: 'none' }}
            >
              <option value="crni">⬛ Crni</option>
              <option value="bijeli">⬜ Bijeli</option>
            </select>
            <button onClick={() => removeGuest(i)} style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: '#7f1d1d', color: '#fff', fontSize: 18, cursor: 'pointer' }}>×</button>
          </div>
        ))}
      </div>

      {/* Rezultat */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Rezultat</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>⬛ Crni</div>
            <input style={s.scoreInput} type="number" min="0" value={scoreBlack} onChange={e => setScoreBlack(e.target.value)} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--muted)' }}>:</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>⬜ Bijeli</div>
            <input style={s.scoreInput} type="number" min="0" value={scoreWhite} onChange={e => setScoreWhite(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Golovi */}
      {(blackPlayers.length > 0 || whitePlayers.length > 0) && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Golovi po igraču</div>
          {blackPlayers.length > 0 && <>
            <Divider label="⬛ CRNI" color="#9ca3af" />
            {blackPlayers.map(p => <GoalRow key={p.id} name={p.name} count={goals[p.id] || 0} onChange={d => changeGoal(p.id, d)} />)}
          </>}
          {whitePlayers.length > 0 && <>
            <Divider label="⬜ BIJELI" color="#93c5fd" />
            {whitePlayers.map(p => <GoalRow key={p.id} name={p.name} count={goals[p.id] || 0} onChange={d => changeGoal(p.id, d)} />)}
          </>}
        </div>
      )}

      {/* Komentar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Komentar (opcija)</div>
        <input
          style={s.input}
          placeholder="npr. Kiša, igrano u dvorani..."
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        {onCancel && (
          <button onClick={onCancel} style={{ ...s.btn('#1e2e42', 'var(--muted)'), flex: 1 }}>Odustani</button>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ flex: 2, padding: 14, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#000', fontSize: 16, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Spremanje...' : existing ? '💾 Spremi izmjene' : '💾 Spremi termin'}
        </button>
      </div>
    </div>
  )
}

function Divider({ label, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

function GoalRow({ name, count, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 10px', background: 'var(--card)', border: `1px solid ${count > 0 ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 10, marginBottom: 6, transition: 'border-color 0.15s' }}>
      <span style={{ fontSize: 14, fontWeight: 500 }}>{name}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => onChange(-1)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted)', fontSize: 18, cursor: 'pointer' }}>−</button>
        <span style={{ fontSize: 18, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{count}</span>
        <button onClick={() => onChange(1)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--win)', color: '#000', fontSize: 18, fontWeight: 700, cursor: 'pointer' }}>+</button>
      </div>
    </div>
  )
}

// ——— GLAVNA ADMIN STRANICA ———
export default function Admin() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [pwError, setPwError] = useState(false)
  const [activeTab, setActiveTab] = useState('novi')

  const [players, setPlayers] = useState([])
  const [newPlayerName, setNewPlayerName] = useState('')
  const [savingPlayer, setSavingPlayer] = useState(false)

  const [matches, setMatches] = useState([])
  const [editingMatch, setEditingMatch] = useState(null)
  const [toast, setToast] = useState('')

  // Blagajna
  const [kittyTxs, setKittyTxs] = useState([])
  const [kittyDate, setKittyDate] = useState(new Date().toISOString().split('T')[0])
  const [kittyAmount, setKittyAmount] = useState('')
  const [kittyType, setKittyType] = useState('uplata')
  const [kittyNote, setKittyNote] = useState('')
  const [savingKitty, setSavingKitty] = useState(false)

  useEffect(() => { if (authed) { loadPlayers(); loadMatches(); loadKitty() } }, [authed])

  async function loadPlayers() {
    const { data } = await supabase.from('players').select('*').eq('active', true).order('name')
    setPlayers(data || [])
  }

  async function loadMatches() {
    const { data: ms } = await supabase.from('matches').select('*').order('played_at', { ascending: false })
    const { data: mps } = await supabase.from('match_players').select('*')
    const { data: goals } = await supabase.from('goals').select('*')
    const { data: ps } = await supabase.from('players').select('*')
    const playerMap = {}
    ;(ps || []).forEach(p => playerMap[p.id] = p.name)

    const enriched = (ms || []).map(m => {
      const parts = (mps || []).filter(mp => mp.match_id === m.id)
      const goalsList = (goals || []).filter(g => g.match_id === m.id)
      const black = parts.filter(mp => mp.team === 'crni').map(mp => ({ player_id: mp.player_id, name: mp.is_guest ? mp.guest_name : playerMap[mp.player_id], isGuest: mp.is_guest }))
      const white = parts.filter(mp => mp.team === 'bijeli').map(mp => ({ player_id: mp.player_id, name: mp.is_guest ? mp.guest_name : playerMap[mp.player_id], isGuest: mp.is_guest }))
      return { ...m, black, white, goalsList }
    })
    setMatches(enriched)
  }

  async function addPlayer() {
    const name = newPlayerName.trim()
    if (!name) return
    setSavingPlayer(true)
    await supabase.from('players').insert({ name, active: true })
    setNewPlayerName('')
    await loadPlayers()
    setSavingPlayer(false)
    showToast('Igrač dodan! ✅')
  }

  async function removePlayer(id) {
    if (!confirm('Ukloniti igrača? Statistika ostaje.')) return
    await supabase.from('players').update({ active: false }).eq('id', id)
    await loadPlayers()
  }

  async function loadKitty() {
    const { data } = await supabase.from('kitty_transactions').select('*').order('date', { ascending: false })
    setKittyTxs(data || [])
  }

  async function saveKittyTx() {
    const amount = parseFloat(kittyAmount)
    if (!amount || amount <= 0) { alert('Upiši ispravan iznos!'); return }
    setSavingKitty(true)
    await supabase.from('kitty_transactions').insert({
      date: kittyDate,
      amount,
      type: kittyType,
      note: kittyNote.trim() || null,
    })
    setKittyAmount('')
    setKittyNote('')
    await loadKitty()
    setSavingKitty(false)
    showToast(kittyType === 'uplata' ? '💵 Uplata dodana!' : '💸 Trošak dodan!')
  }

  async function deleteKittyTx(id) {
    if (!confirm('Obrisati transakciju?')) return
    await supabase.from('kitty_transactions').delete().eq('id', id)
    await loadKitty()
  }

  async function deleteMatch(id) {
    if (!confirm('Obrisati ovaj termin? Ovo se ne može poništiti!')) return
    await supabase.from('matches').delete().eq('id', id)
    await loadMatches()
    showToast('Termin obrisan!')
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function handleSaved() {
    await loadMatches()
    setEditingMatch(null)
    setActiveTab('termini')
    showToast('Spremljeno! ✅')
  }

  function login() {
    if (pw === ADMIN_PASSWORD) { setAuthed(true); setPwError(false) }
    else { setPwError(true) }
  }

  const badgeStyle = (winner) => {
    if (winner === 'crni') return { background: '#052e16', color: '#22c55e', border: '1px solid #166534' }
    if (winner === 'bijeli') return { background: '#0c1a3a', color: '#60a5fa', border: '1px solid #1e3a8a' }
    return { background: '#1c1002', color: '#eab308', border: '1px solid #713f12' }
  }
  const badgeText = (winner) => winner === 'crni' ? 'Crni' : winner === 'bijeli' ? 'Bijeli' : 'Nerij.'

  // LOGIN
  if (!authed) return (
    <AppLayout>
      <div style={{ ...s.card, maxWidth: 360, margin: '40px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔐</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Admin pristup</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>Samo za administratora ekipe</div>
        <input style={{ ...s.input, marginBottom: 10, textAlign: 'center', fontSize: 18, letterSpacing: 4 }} type="password" placeholder="Lozinka" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} />
        {pwError && <div style={{ color: 'var(--loss)', fontSize: 13, marginBottom: 8 }}>Pogrešna lozinka!</div>}
        <button style={{ ...s.btn(), width: '100%', padding: 12 }} onClick={login}>Prijava</button>
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#22c55e', color: '#000', fontWeight: 700, padding: '12px 24px', borderRadius: 12, fontSize: 14, zIndex: 200 }}>
          {toast}
        </div>
      )}

      {/* Tabovi */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button style={s.tab(activeTab === 'novi')} onClick={() => { setActiveTab('novi'); setEditingMatch(null) }}>➕ Novi termin</button>
        <button style={s.tab(activeTab === 'termini')} onClick={() => { setActiveTab('termini'); setEditingMatch(null) }}>📋 Termini</button>
        <button style={s.tab(activeTab === 'igraci')} onClick={() => setActiveTab('igraci')}>👥 Igrači</button>
        <button style={s.tab(activeTab === 'blagajna')} onClick={() => setActiveTab('blagajna')}>🏦 Blagajna</button>
      </div>

      {/* NOVI TERMIN */}
      {activeTab === 'novi' && (
        <MatchForm players={players} onSave={handleSaved} />
      )}

      {/* TERMINI — lista s edit/delete */}
      {activeTab === 'termini' && (
        <>
          {editingMatch ? (
            <MatchForm
              players={players}
              existing={editingMatch}
              onSave={handleSaved}
              onCancel={() => setEditingMatch(null)}
            />
          ) : (
            <>
              {matches.length === 0 && <div style={{ ...s.card, color: 'var(--muted)', textAlign: 'center' }}>Nema termina.</div>}
              {matches.map(m => (
                <div key={m.id} style={s.card}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontWeight: 700 }}>{m.played_at}</span>
                      <span style={{ fontSize: 18, fontWeight: 700 }}>{m.score_black}:{m.score_white}</span>
                      <span style={{ ...badgeStyle(m.winner), borderRadius: 999, padding: '2px 8px', fontSize: 11 }}>{badgeText(m.winner)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setEditingMatch(m)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--accent)', fontSize: 13, cursor: 'pointer' }}>✏️ Uredi</button>
                      <button onClick={() => deleteMatch(m.id)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #7f1d1d', background: '#1c0202', color: 'var(--loss)', fontSize: 13, cursor: 'pointer' }}>🗑️</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                    <div>
                      <div style={{ color: 'var(--muted)', marginBottom: 3 }}>⬛ Crni</div>
                      {m.black.map((p, i) => {
                        const g = m.goalsList?.find(gl => gl.player_id === p.player_id)
                        return <span key={i} style={{ display: 'inline-block', background: 'var(--card)', border: '1px solid var(--border)', borderStyle: p.isGuest ? 'dashed' : 'solid', borderRadius: 6, padding: '2px 7px', marginRight: 4, marginBottom: 4, color: p.isGuest ? 'var(--muted)' : 'var(--text)', fontSize: 12 }}>{p.name}{g ? ' ⚽'.repeat(g.count) : ''}</span>
                      })}
                    </div>
                    <div>
                      <div style={{ color: 'var(--muted)', marginBottom: 3 }}>⬜ Bijeli</div>
                      {m.white.map((p, i) => {
                        const g = m.goalsList?.find(gl => gl.player_id === p.player_id)
                        return <span key={i} style={{ display: 'inline-block', background: 'var(--card)', border: '1px solid var(--border)', borderStyle: p.isGuest ? 'dashed' : 'solid', borderRadius: 6, padding: '2px 7px', marginRight: 4, marginBottom: 4, color: p.isGuest ? 'var(--muted)' : 'var(--text)', fontSize: 12 }}>{p.name}{g ? ' ⚽'.repeat(g.count) : ''}</span>
                      })}
                    </div>
                  </div>
                  {m.note && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', background: 'var(--card)', borderRadius: 8, padding: '6px 10px', borderLeft: '3px solid var(--accent)' }}>
                      💬 {m.note}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </>
      )}

      {/* IGRAČI */}
      {activeTab === 'igraci' && (
        <div style={s.card}>
          <div style={s.cardTitle}>Igrači ekipe</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input style={s.input} placeholder="Ime igrača..." value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPlayer()} />
            <button style={s.btn()} onClick={addPlayer} disabled={savingPlayer}>Dodaj</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {players.map(p => (
              <div key={p.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                {p.name}
                <span style={{ cursor: 'pointer', color: 'var(--loss)', fontSize: 18, lineHeight: 1 }} onClick={() => removePlayer(p.id)}>×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BLAGAJNA */}
      {activeTab === 'blagajna' && (
        <div>
          <div style={s.card}>
            <div style={s.cardTitle}>Nova transakcija</div>

            {/* Tip */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button
                onClick={() => setKittyType('uplata')}
                style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${kittyType === 'uplata' ? '#166534' : 'var(--border)'}`, background: kittyType === 'uplata' ? '#052e16' : 'var(--card)', color: kittyType === 'uplata' ? 'var(--win)' : 'var(--muted)', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
              >
                💵 Uplata
              </button>
              <button
                onClick={() => setKittyType('trosak')}
                style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${kittyType === 'trosak' ? '#7f1d1d' : 'var(--border)'}`, background: kittyType === 'trosak' ? '#1c0202' : 'var(--card)', color: kittyType === 'trosak' ? 'var(--loss)' : 'var(--muted)', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
              >
                💸 Trošak
              </button>
            </div>

            {/* Datum */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Datum</div>
              <input style={{ ...s.input, width: 'auto' }} type="date" value={kittyDate} onChange={e => setKittyDate(e.target.value)} />
            </div>

            {/* Iznos */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Iznos (€)</div>
              <input style={s.input} type="number" min="0" step="0.01" placeholder="npr. 300.00" value={kittyAmount} onChange={e => setKittyAmount(e.target.value)} />
            </div>

            {/* Komentar */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Komentar (opcija)</div>
              <input style={s.input} placeholder="npr. Tim building, piknik..." value={kittyNote} onChange={e => setKittyNote(e.target.value)} />
            </div>

            <button
              onClick={saveKittyTx}
              disabled={savingKitty}
              style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: kittyType === 'uplata' ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#ef4444,#b91c1c)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: savingKitty ? 0.7 : 1 }}
            >
              {savingKitty ? 'Spremanje...' : kittyType === 'uplata' ? '💵 Dodaj uplatu' : '💸 Dodaj trošak'}
            </button>
          </div>

          {/* Historia transakcija */}
          <div style={s.card}>
            <div style={s.cardTitle}>Povijest transakcija</div>
            {kittyTxs.length === 0 && (
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>Nema transakcija.</div>
            )}
            {kittyTxs.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {t.type === 'uplata' ? '💵' : '💸'} {t.date}
                  </div>
                  {t.note && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{t.note}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: t.type === 'uplata' ? 'var(--win)' : 'var(--loss)' }}>
                    {t.type === 'uplata' ? '+' : '-'}{Number(t.amount).toFixed(2)} €
                  </span>
                  <button onClick={() => deleteKittyTx(t.id)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #7f1d1d', background: '#1c0202', color: 'var(--loss)', fontSize: 12, cursor: 'pointer' }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  )
}
