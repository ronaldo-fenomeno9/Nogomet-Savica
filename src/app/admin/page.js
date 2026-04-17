'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'

const ADMIN_PASSWORD = 'savica2025'

const s = {
  card: { background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 14 },
  cardTitle: { fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 },
  input: { width: '100%', padding: '10px 12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none' },
  btn: (color = '#22c55e') => ({ padding: '10px 20px', borderRadius: 10, border: 'none', background: color, color: color === '#22c55e' ? '#000' : '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }),
  scoreInput: { width: 64, height: 52, fontSize: 24, fontWeight: 700, textAlign: 'center', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', outline: 'none' },
}

export default function Admin() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [pwError, setPwError] = useState(false)

  // Players management
  const [players, setPlayers] = useState([])
  const [newPlayerName, setNewPlayerName] = useState('')
  const [savingPlayer, setSavingPlayer] = useState(false)

  // Match entry
  const [matchDate, setMatchDate] = useState(new Date().toISOString().split('T')[0])
  const [playerStates, setPlayerStates] = useState({}) // id -> 0=none,1=crni,2=bijeli,3=gost
  const [guestNames, setGuestNames] = useState(['', '', '']) // do 3 gosta
  const [scoreBlack, setScoreBlack] = useState(0)
  const [scoreWhite, setScoreWhite] = useState(0)
  const [goals, setGoals] = useState({}) // player_id -> count
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (authed) loadPlayers()
  }, [authed])

  async function loadPlayers() {
    const { data } = await supabase.from('players').select('*').eq('active', true).order('name')
    setPlayers(data || [])
    const states = {}
    ;(data || []).forEach(p => { states[p.id] = 0 })
    setPlayerStates(states)
  }

  function login() {
    if (pw === ADMIN_PASSWORD) { setAuthed(true); setPwError(false) }
    else { setPwError(true) }
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

  function cyclePlayer(id) {
    setPlayerStates(prev => ({ ...prev, [id]: (prev[id] + 1) % 4 }))
  }

  function changeGoal(pid, delta) {
    setGoals(prev => ({ ...prev, [pid]: Math.max(0, (prev[pid] || 0) + delta) }))
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function saveMatch() {
    const blackIds = players.filter(p => playerStates[p.id] === 1).map(p => p.id)
    const whiteIds = players.filter(p => playerStates[p.id] === 2).map(p => p.id)
    const guestList = guestNames.filter(g => g.trim() !== '')

    if (blackIds.length === 0 || whiteIds.length === 0) {
      alert('Moraš odabrati barem jednog igrača za svaku ekipu!'); return
    }

    const sb = parseInt(scoreBlack)
    const sw = parseInt(scoreWhite)
    const winner = sb > sw ? 'crni' : sw > sb ? 'bijeli' : 'nerijeseno'

    setSaving(true)

    // Spremi utakmicu
    const { data: match, error } = await supabase.from('matches').insert({
      played_at: matchDate,
      score_black: sb,
      score_white: sw,
      winner,
    }).select().single()

    if (error || !match) { alert('Greška pri spremanju!'); setSaving(false); return }

    // Spremi sudionike
    const participants = [
      ...blackIds.map(id => ({ match_id: match.id, player_id: id, team: 'crni', is_guest: false })),
      ...whiteIds.map(id => ({ match_id: match.id, player_id: id, team: 'bijeli', is_guest: false })),
    ]

    // Gosti - crni
    const guestBlack = guestNames[0]?.trim()
    const guestWhite = guestNames[1]?.trim()
    if (guestBlack) participants.push({ match_id: match.id, player_id: null, team: 'crni', is_guest: true, guest_name: guestBlack })
    if (guestWhite) participants.push({ match_id: match.id, player_id: null, team: 'bijeli', is_guest: true, guest_name: guestWhite })

    await supabase.from('match_players').insert(participants)

    // Spremi golove
    const goalEntries = Object.entries(goals).filter(([, c]) => c > 0).map(([pid, count]) => ({
      match_id: match.id, player_id: parseInt(pid), count
    }))
    if (goalEntries.length > 0) await supabase.from('goals').insert(goalEntries)

    // Reset
    setPlayerStates(prev => { const s = { ...prev }; Object.keys(s).forEach(k => s[k] = 0); return s })
    setGoals({})
    setScoreBlack(0)
    setScoreWhite(0)
    setGuestNames(['', '', ''])
    setSaving(false)
    showToast('Termin spremljen! ⚽')
  }

  // LOGIN SCREEN
  if (!authed) return (
    <AppLayout>
      <div style={{ ...s.card, maxWidth: 360, margin: '40px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔐</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Admin pristup</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>Samo za administratora ekipe</div>
        <input
          style={{ ...s.input, marginBottom: 10, textAlign: 'center', fontSize: 18, letterSpacing: 4 }}
          type="password"
          placeholder="Lozinka"
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()}
        />
        {pwError && <div style={{ color: 'var(--loss)', fontSize: 13, marginBottom: 8 }}>Pogrešna lozinka!</div>}
        <button style={{ ...s.btn(), width: '100%', padding: 12 }} onClick={login}>Prijava</button>
      </div>
    </AppLayout>
  )

  const blackPlayers = players.filter(p => playerStates[p.id] === 1)
  const whitePlayers = players.filter(p => playerStates[p.id] === 2)

  return (
    <AppLayout>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#22c55e', color: '#000', fontWeight: 700, padding: '12px 24px', borderRadius: 12, fontSize: 14, zIndex: 200 }}>
          {toast}
        </div>
      )}

      {/* Upravljanje igračima */}
      <div style={s.card}>
        <div style={s.cardTitle}>Igrači ekipe</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input style={s.input} placeholder="Ime igrača..." value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPlayer()} />
          <button style={s.btn()} onClick={addPlayer} disabled={savingPlayer}>Dodaj</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {players.map(p => (
            <div key={p.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              {p.name}
              <span style={{ cursor: 'pointer', color: 'var(--loss)', fontSize: 16, lineHeight: 1 }} onClick={() => removePlayer(p.id)}>×</span>
            </div>
          ))}
        </div>
      </div>

      {/* Unos termina */}
      <div style={s.card}>
        <div style={s.cardTitle}>Novi termin</div>

        {/* Datum */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Datum</div>
          <input style={{ ...s.input, width: 'auto' }} type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)} />
        </div>

        {/* Odabir igrača */}
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
          Klikni igrača: 1× = ⬛ Crni · 2× = ⬜ Bijeli · 3× = 👤 Gost · 4× = isključi
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {players.map(p => {
            const st = playerStates[p.id] || 0
            let bg = 'var(--card)', border = '1px solid var(--border)', color = 'var(--text)', prefix = ''
            if (st === 1) { bg = '#111'; border = '1px solid #555'; prefix = '⬛ ' }
            if (st === 2) { bg = '#dbeafe'; border = '1px solid #93c5fd'; color = '#0f1720'; prefix = '⬜ ' }
            if (st === 3) { border = '1px dashed var(--border)'; color = 'var(--muted)'; prefix = '👤 ' }
            return (
              <button key={p.id} onClick={() => cyclePlayer(p.id)} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, border, background: bg, color, cursor: 'pointer', transition: 'all 0.15s' }}>
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
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Gosti (opcija)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input style={{ ...s.input, width: 160 }} placeholder="Gost za Crne..." value={guestNames[0]} onChange={e => setGuestNames(prev => [e.target.value, prev[1], prev[2]])} />
            <input style={{ ...s.input, width: 160 }} placeholder="Gost za Bijele..." value={guestNames[1]} onChange={e => setGuestNames(prev => [prev[0], e.target.value, prev[2]])} />
          </div>
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

            {blackPlayers.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af' }}>⬛ CRNI</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
                {blackPlayers.map(p => <GoalRow key={p.id} name={p.name} count={goals[p.id] || 0} onChange={d => changeGoal(p.id, d)} />)}
              </>
            )}

            {whitePlayers.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd' }}>⬜ BIJELI</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
                {whitePlayers.map(p => <GoalRow key={p.id} name={p.name} count={goals[p.id] || 0} onChange={d => changeGoal(p.id, d)} />)}
              </>
            )}
          </div>
        )}

        <button
          style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#000', fontSize: 16, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
          onClick={saveMatch}
          disabled={saving}
        >
          {saving ? 'Spremanje...' : '💾 Spremi termin'}
        </button>
      </div>
    </AppLayout>
  )
}

function GoalRow({ name, count, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 10px', background: 'var(--card)', border: `1px solid ${count > 0 ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 10, marginBottom: 6, transition: 'border-color 0.15s' }}>
      <span style={{ fontSize: 14, fontWeight: 500 }}>{name}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => onChange(-1)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
        <span style={{ fontSize: 18, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{count}</span>
        <button onClick={() => onChange(1)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--win)', color: '#000', fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
      </div>
    </div>
  )
}
