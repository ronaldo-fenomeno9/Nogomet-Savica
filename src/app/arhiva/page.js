'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'
import { getAllSeasons, seasonOf } from '@/lib/season'

const card = { background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 14 }
const cardTitle = { fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }

export default function Arhiva() {
  const [raw, setRaw] = useState(null)
  const [seasons, setSeasons] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: players } = await supabase.from('players').select('*')
    const { data: matches } = await supabase.from('matches').select('*').order('played_at')
    const { data: matchPlayers } = await supabase.from('match_players').select('*')
    const { data: goals } = await supabase.from('goals').select('*')

    if (!players || !matches) { setLoading(false); return }

    const allSeasons = getAllSeasons(matches)
    setSeasons(allSeasons)
    setSelected(allSeasons[0])
    setRaw({ players, matches, matchPlayers: matchPlayers || [], goals: goals || [] })
    setLoading(false)
  }

  // Izračun sve statistike za odabranu sezonu
  function computeSeason(seasonYear) {
    const { players, matches, matchPlayers, goals } = raw
    const playerMap = {}
    players.forEach(p => { playerMap[p.id] = p.name })

    const sMatches = matches.filter(m => seasonOf(m.played_at) === seasonYear)
    const sIds = new Set(sMatches.map(m => m.id))
    const sGoals = goals.filter(g => sIds.has(g.match_id))

    // Statistika po igraču
    const stats = {}
    players.forEach(p => { stats[p.id] = { id: p.id, name: p.name, played: 0, W: 0, D: 0, L: 0, goals: 0, seq: [] } })

    sMatches.forEach(m => {
      const black = matchPlayers.filter(mp => mp.match_id === m.id && mp.team === 'crni' && !mp.is_guest).map(mp => mp.player_id)
      const white = matchPlayers.filter(mp => mp.match_id === m.id && mp.team === 'bijeli' && !mp.is_guest).map(mp => mp.player_id)
      const apply = (pid, res) => {
        if (!stats[pid]) return
        stats[pid].played++; stats[pid][res]++; stats[pid].seq.push(res)
      }
      if (m.winner === 'crni') { black.forEach(p => apply(p, 'W')); white.forEach(p => apply(p, 'L')) }
      else if (m.winner === 'bijeli') { white.forEach(p => apply(p, 'W')); black.forEach(p => apply(p, 'L')) }
      else { [...black, ...white].forEach(p => apply(p, 'D')) }
    })
    sGoals.forEach(g => { if (stats[g.player_id]) stats[g.player_id].goals += g.count })

    const list = Object.values(stats)
      .map(s => ({
        ...s,
        points: s.W * 3 + s.D,
        amount: s.L * 3 + s.D * 2,
        attendancePct: sMatches.length > 0 ? Math.round(s.played / sMatches.length * 100) : 0,
        successPct: s.played > 0 ? Math.round((s.W * 3 + s.D) / (s.played * 3) * 100) : 0,
      }))
      .filter(s => s.played > 0)
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (a.played !== b.played) return a.played - b.played
        return b.W - a.W
      })

    // Max streak (W i L) kroz cijelu sezonu
    const maxStreak = (seq, type) => {
      let max = 0, cur = 0
      seq.forEach(r => { if (r === type) { cur++; max = Math.max(max, cur) } else cur = 0 })
      return max
    }
    const withStreaks = list.map(p => ({ ...p, maxW: maxStreak(p.seq, 'W'), maxL: maxStreak(p.seq, 'L') }))

    // Strijelci — prosjek se računa od prve utakmice s golovima
    const firstGoalDate = sMatches.filter(m => sGoals.some(g => g.match_id === m.id))
      .reduce((min, m) => (min === null || m.played_at < min) ? m.played_at : min, null)
    const goalPlayedMap = {}
    matchPlayers.forEach(mp => {
      if (mp.is_guest) return
      const m = sMatches.find(sm => sm.id === mp.match_id)
      if (!m) return
      if (firstGoalDate && m.played_at >= firstGoalDate) {
        goalPlayedMap[mp.player_id] = (goalPlayedMap[mp.player_id] || 0) + 1
      }
    })
    const scorers = [...list].filter(p => p.goals > 0)
      .map(p => ({ ...p, goalPlayed: goalPlayedMap[p.id] || 0, goalAvg: goalPlayedMap[p.id] ? (p.goals / goalPlayedMap[p.id]) : 0 }))
      .sort((a, b) => b.goals - a.goals)

    // Duo
    const pairs = {}
    sMatches.forEach(m => {
      const addPair = (team, won) => {
        const t = team
        for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) {
          const [a, b] = [t[i], t[j]].sort((x, y) => x - y)
          const k = `${a}|${b}`
          if (!pairs[k]) pairs[k] = { a, b, w: 0, l: 0, total: 0 }
          pairs[k].total++
          if (won) pairs[k].w++; else if (m.winner !== 'nerijeseno') pairs[k].l++
        }
      }
      const black = matchPlayers.filter(mp => mp.match_id === m.id && mp.team === 'crni' && !mp.is_guest).map(mp => mp.player_id)
      const white = matchPlayers.filter(mp => mp.match_id === m.id && mp.team === 'bijeli' && !mp.is_guest).map(mp => mp.player_id)
      addPair(black, m.winner === 'crni')
      addPair(white, m.winner === 'bijeli')
    })
    const pArr = Object.values(pairs).filter(p => p.total >= 3).map(p => ({ ...p, aName: playerMap[p.a], bName: playerMap[p.b] }))
    const bestDuo = [...pArr].sort((a, b) => b.w - a.w || a.l - b.l)[0]
    const worstDuo = [...pArr].sort((a, b) => b.l - a.l || a.w - b.w)[0]

    // Duo s najboljim/najlošijim POSTOTKOM pobjeda (min 4 zajedno)
    const pArrPct = Object.values(pairs).filter(p => p.total >= 4).map(p => ({
      ...p, aName: playerMap[p.a], bName: playerMap[p.b],
      winPct: Math.round(p.w / p.total * 100),
    }))
    const magicDuo = [...pArrPct].sort((a, b) => b.winPct - a.winPct)[0]
    const cursedDuo = [...pArrPct].sort((a, b) => a.winPct - b.winPct)[0]

    // Golmanski kandidat — najniži prosjek golova (min 5 utakmica od firstGoalDate)
    const gkCandidate = scorers.length > 0
      ? [...scorers].filter(p => p.goalPlayed >= 5).sort((a, b) => a.goalAvg - b.goalAvg)[0]
      : null

    // Kralj remija
    const drawKing = [...list].sort((a, b) => b.D - a.D)[0]

    // Najveći dužnik blagajne
    const biggestDebtor = [...list].sort((a, b) => b.amount - a.amount)[0]

    // Ishodi i zanimljivosti
    const blackWins = sMatches.filter(m => m.winner === 'crni').length
    const whiteWins = sMatches.filter(m => m.winner === 'bijeli').length
    const draws = sMatches.filter(m => m.winner === 'nerijeseno').length
    const kitty = list.reduce((sum, s) => sum + s.amount, 0)

    // Najviše golova u utakmici / najveća razlika
    let highestScoring = null, biggestMargin = null
    sMatches.forEach(m => {
      const total = m.score_black + m.score_white
      const margin = Math.abs(m.score_black - m.score_white)
      if (!highestScoring || total > highestScoring.total) highestScoring = { ...m, total }
      if (!biggestMargin || margin > biggestMargin.margin) biggestMargin = { ...m, margin }
    })

    const dateFrom = sMatches.length ? sMatches[0].played_at : null
    const dateTo = sMatches.length ? sMatches[sMatches.length - 1].played_at : null

    return {
      seasonYear, list: withStreaks, scorers, bestDuo, worstDuo,
      blackWins, whiteWins, draws, kitty, played: sMatches.length,
      highestScoring, biggestMargin, dateFrom, dateTo, firstGoalDate,
      gkCandidate, magicDuo, cursedDuo, drawKing, biggestDebtor,
    }
  }

  function generateReport() {
    const d = computeSeason(selected)
    if (d.played === 0) { setReport('Nema odigranih termina u ovoj sezoni.'); return }

    const champ = d.list[0]
    const runnerUp = d.list[1]
    const topScorer = d.scorers[0]
    const bestSuccess = [...d.list].filter(p => p.attendancePct >= 50).sort((a, b) => b.successPct - a.successPct)[0]
    const attendanceKing = [...d.list].sort((a, b) => b.played - a.played)[0]
    const bestWStreak = [...d.list].sort((a, b) => b.maxW - a.maxW)[0]
    const worstLStreak = [...d.list].sort((a, b) => b.maxL - a.maxL)[0]

    const lines = []
    lines.push(`⚽ SEZONA ${d.seasonYear} — HNB SAVICA`)
    lines.push('═══════════════════════════════')
    lines.push('')
    lines.push(`Odigrano je ukupno ${d.played} termina, od ${d.dateFrom} do ${d.dateTo}. Kroz sezonu se u ekipi izmijenilo ${d.list.length} igrača.`)
    lines.push('')

    // Prvak
    lines.push('🏆 PRVAK SEZONE')
    lines.push(`Naslov najboljeg igrača sezone odnosi ${champ.name} s ${champ.points} bodova (${champ.W}-${champ.D}-${champ.L}) i uspješnošću od ${champ.successPct}%.`)
    if (runnerUp) {
      const diff = champ.points - runnerUp.points
      if (diff === 0) lines.push(`Bila je to dramatična završnica — ${runnerUp.name} je završio izjednačen po bodovima, ali je prvak odlučen dodatnim kriterijima!`)
      else if (diff <= 3) lines.push(`Borba je bila tijesna — ${runnerUp.name} je zaostao svega ${diff} ${diff === 1 ? 'bod' : 'boda'} na drugom mjestu.`)
      else lines.push(`Drugo mjesto pripalo je igraču ${runnerUp.name} (${runnerUp.points} bodova), uz zaostatak od ${diff} boda.`)
    }
    lines.push('')

    // Strijelac
    if (topScorer) {
      lines.push('👑 KRALJ STRIJELACA')
      lines.push(`${topScorer.name} je zatresao mrežu ${topScorer.goals} puta i proglašen je najboljim strijelcem sezone (prosjek ${topScorer.goalAvg ? topScorer.goalAvg.toFixed(2) : '—'} gola po utakmici).`)
      if (d.scorers[1]) lines.push(`Slijede ga ${d.scorers[1].name} (${d.scorers[1].goals}) i ${d.scorers[2] ? `${d.scorers[2].name} (${d.scorers[2].goals})` : '...'}.`)
      lines.push('')
    }

    // Najefikasniji
    if (bestSuccess) {
      lines.push('📈 NAJEFIKASNIJI')
      lines.push(`Najbolji omjer imao je ${bestSuccess.name} — uspješnost ${bestSuccess.successPct}% uz ${bestSuccess.played} odigranih utakmica. Kad je on na terenu, njegova ekipa rijetko gubi.`)
      lines.push('')
    }

    // Serije
    lines.push('🔥 SERIJE SEZONE')
    if (bestWStreak && bestWStreak.maxW >= 2) lines.push(`Najduži niz pobjeda: ${bestWStreak.name} s ${bestWStreak.maxW} vezanih pobjeda — pravi pobjednički mentalitet.`)
    if (worstLStreak && worstLStreak.maxL >= 2) lines.push(`Najduži niz poraza: ${worstLStreak.name} s ${worstLStreak.maxL} vezanih poraza — sezona za zaborav u jednom periodu.`)
    lines.push('')

    // Dolaznost
    if (attendanceKing) {
      lines.push('🎽 ŽELJEZNI ČOVJEK')
      lines.push(`Najviše se žrtvovao ${attendanceKing.name} — pojavio se na ${attendanceKing.played} od ${d.played} termina (${attendanceKing.attendancePct}% dolaznost). Na njega se uvijek moglo računati.`)
      lines.push('')
    }

    // Duo
    if (d.bestDuo) {
      lines.push('🤝 DUO SEZONE')
      lines.push(`${d.bestDuo.aName} i ${d.bestDuo.bName} bili su ubojita kombinacija — zajedno su upisali ${d.bestDuo.w} pobjeda.`)
      if (d.worstDuo && d.worstDuo !== d.bestDuo) lines.push(`S druge strane, ${d.worstDuo.aName} i ${d.worstDuo.bName} baš i nisu imali sreće jedan uz drugoga — ${d.worstDuo.l} zajedničkih poraza.`)
      lines.push('')
    }

    // Zanimljivosti
    lines.push('📊 BROJKE I ZANIMLJIVOSTI')
    lines.push(`• Crni su slavili ${d.blackWins} puta, Bijeli ${d.whiteWins} puta, a ${d.draws} ${d.draws === 1 ? 'termin je završio' : 'termina su završila'} neriješeno.`)
    if (d.highestScoring) lines.push(`• Najviše golova palo je ${d.highestScoring.played_at} — čak ${d.highestScoring.total} (rezultat ${d.highestScoring.score_black}:${d.highestScoring.score_white}).`)
    if (d.biggestMargin && d.biggestMargin.margin >= 2) lines.push(`• Najuvjerljivija pobjeda: ${d.biggestMargin.played_at}, razlika od ${d.biggestMargin.margin} gola (${d.biggestMargin.score_black}:${d.biggestMargin.score_white}).`)
    lines.push(`• U blagajnu je kroz kazne (porazi i remiji) skupljeno ${d.kitty.toFixed(2)} €.`)
    lines.push('')

    // 🎭 ZA SMIJEH
    const funLines = []

    // Golmanski kandidat — najniži prosjek golova (min 5 utakmica od kad se broje golovi)
    if (d.gkCandidate) {
      funLines.push(`🧤 Kandidat za golmansku karijeru: ${d.gkCandidate.name} — samo ${d.gkCandidate.goalAvg.toFixed(2)} gola po utakmici. Možda je vrijeme za rukavice?`)
    }
    // Zagarantirana pobjeda — duo s najboljim postotkom pobjeda (min 4 zajedno)
    if (d.magicDuo) {
      funLines.push(`✨ Kad zajedno igraju ${d.magicDuo.aName} i ${d.magicDuo.bName}, pobjeda je skoro zagarantirana — ${d.magicDuo.winPct}% pobjeda u ${d.magicDuo.total} zajedničkih termina!`)
    }
    // Prokletstvo — duo s najlošijim postotkom (min 4 zajedno)
    if (d.cursedDuo) {
      funLines.push(`💀 A kad se spoje ${d.cursedDuo.aName} i ${d.cursedDuo.bName}... bježite! Samo ${d.cursedDuo.winPct}% pobjeda zajedno. Prokletstvo ekipe.`)
    }
    // Remi kralj
    if (d.drawKing && d.drawKing.D >= 3) {
      funLines.push(`🤝 ${d.drawKing.name} je kralj remija — čak ${d.drawKing.D} neriješenih. Diplomat terena, nikog ne želi uvrijediti.`)
    }
    // Nula bodova / najveći dužnik blagajne
    if (d.biggestDebtor && d.biggestDebtor.amount > 0) {
      funLines.push(`💸 Najviše je u blagajnu "udijelio" ${d.biggestDebtor.name} — ${d.biggestDebtor.amount.toFixed(2)} €. Hvala na doprinosu za team building!`)
    }

    if (funLines.length > 0) {
      lines.push('🎭 ZA SMIJEH')
      funLines.forEach(l => lines.push('• ' + l))
      lines.push('')
    }

    lines.push('═══════════════════════════════')
    lines.push('Vidimo se sljedeće sezone! 🖤🤍')

    setReport(lines.join('\n'))
    setCopied(false)
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(report)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {}
  }

  if (loading) return <AppLayout><div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Učitavanje...</div></AppLayout>
  if (!raw) return <AppLayout><div style={{ padding: 20, color: 'var(--loss)' }}>Greška pri učitavanju.</div></AppLayout>

  const data = selected ? computeSeason(selected) : null

  return (
    <AppLayout>
      {/* Odabir sezone */}
      <div style={card}>
        <div style={cardTitle}>Arhiva sezona</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {seasons.map(y => (
            <button
              key={y}
              onClick={() => { setSelected(y); setReport('') }}
              style={{
                padding: '8px 18px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${selected === y ? 'var(--accent)' : 'var(--border)'}`,
                background: selected === y ? 'var(--accent)' : 'var(--card)',
                color: selected === y ? '#000' : 'var(--text)',
              }}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {data && data.played === 0 && (
        <div style={{ ...card, textAlign: 'center', color: 'var(--muted)' }}>Nema podataka za sezonu {selected}.</div>
      )}

      {data && data.played > 0 && (
        <>
          {/* Sažetak sezone */}
          <div style={card}>
            <div style={cardTitle}>Sezona {selected} — sažetak</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
              <Stat label="Termina" value={data.played} />
              <Stat label="Blagajna" value={`${data.kitty.toFixed(0)} €`} />
              <Stat label="Prvak" value={data.list[0]?.name || '—'} />
              <Stat label="Kralj strijelaca" value={data.scorers[0]?.name || '—'} />
            </div>
          </div>

          {/* Generiraj report */}
          <div style={card}>
            <div style={cardTitle}>Report sezone</div>
            <button
              onClick={generateReport}
              style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#3dd6ff,#0ea5e9)', color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
            >
              ✨ Generiraj report za sezonu {selected}
            </button>

            {report && (
              <div style={{ marginTop: 14 }}>
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6, fontFamily: 'inherit' }}>
                  {report}
                </div>
                <button
                  onClick={copyReport}
                  style={{ marginTop: 10, width: '100%', padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  {copied ? '✅ Kopirano!' : '📋 Kopiraj report'}
                </button>
              </div>
            )}
          </div>

          {/* Ljestvica sezone */}
          <div style={card}>
            <div style={cardTitle}>Konačna ljestvica {selected}</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['#', 'Igrač', 'Ut', 'W', 'D', 'L', 'Bod', 'Usp.'].map(h => (
                      <th key={h} style={{ color: 'var(--muted)', fontSize: 11, textAlign: 'left', padding: '6px 4px', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.list.map((p, i) => (
                    <tr key={p.id}>
                      <td style={{ padding: '8px 4px', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>{i + 1}</td>
                      <td style={{ padding: '8px 4px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{p.name}</td>
                      <td style={{ padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>{p.played}</td>
                      <td style={{ padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>{p.W}</td>
                      <td style={{ padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>{p.D}</td>
                      <td style={{ padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>{p.L}</td>
                      <td style={{ padding: '8px 4px', borderBottom: '1px solid var(--border)', fontWeight: 700, color: 'var(--accent)' }}>{p.points}</td>
                      <td style={{ padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>{p.successPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  )
}

function Stat({ label, value }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  )
}
