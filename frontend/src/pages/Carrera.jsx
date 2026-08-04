import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { personasApi } from '../services/api'
import { NIVELES, NIVEL_COLOR } from '../utils/constants'
import clsx from 'clsx'
import Panel from '../components/Panel'
import QuizContent from '../components/QuizModal'
import BehaviorContent from '../components/BehaviorForm'
import { SCORE_LABEL } from '../data/questionsBank'

// ── Framework de competencias por perfil ──────────────────────────────────────
const PERFILES = ['UX Research', 'UX Design', 'UI Design', 'Product Design', 'Service Design']

const COMPETENCIAS = {
  'UX Research': [
    'Research Planning & Strategy', 'Qualitative Methods', 'Quantitative Methods',
    'Synthesis & Artifacts', 'Communication & Storytelling',
    'AI Tool Fluency', 'AI Applied to Research', 'AI Critical Judgment',
  ],
  'UX Design': [
    'User Research & Empathy', 'Interaction Design & Flows', 'Information Architecture',
    'Design Systems & Consistency', 'Prototyping & Fidelity', 'Accessibility (WCAG)',
    'Design-to-Code Collaboration', 'AI Tool Fluency', 'AI Applied to Design', 'AI Critical Judgment',
  ],
  'UI Design': [
    'Visual Hierarchy & Aesthetics', 'Design Systems & Tokens', 'Interaction Feedback',
    'Accessibility & Inclusion', 'Responsive Design',
    'AI Tool Fluency', 'AI Applied to Design Systems', 'AI Critical Judgment',
  ],
  'Product Design': [
    'User Research & Validation', 'Problem Framing & Strategy', 'Interaction Design & Prototyping',
    'Metrics & Analytics', 'Design Systems Thinking', 'Stakeholder Management', 'Business Acumen & ROI',
    'AI Tool Fluency', 'AI Applied to Product', 'AI Critical Judgment',
  ],
  'Service Design': [
    'Service Blueprinting & Journey Mapping', 'Facilitation & Co-design', 'Systems Thinking',
    'Research Integration', 'Service Measurement & KPIs', 'Organizational Design & Change',
    'AI Tool Fluency', 'AI Applied to Service Design', 'AI Critical Judgment',
  ],
}

const PERSPECTIVAS      = ['self', 'manager', 'peer']
const PERSPECTIVA_LABEL = { self: 'Auto', manager: 'Manager', peer: 'Par' }
const PERIODOS = ['Q1 2026','Q2 2026','Q3 2026','Q4 2026','Q1 2025','Q2 2025','Q3 2025','Q4 2025']
const GAP_THRESHOLD = 1.5

// ── Helpers ───────────────────────────────────────────────────────────────────
function detectarPerfil(rol = '') {
  const r = rol.toLowerCase()
  if (r.includes('research')) return 'UX Research'
  if (r.includes('service'))  return 'Service Design'
  if (r.includes('product'))  return 'Product Design'
  if (r.includes('ui'))       return 'UI Design'
  return 'UX Design'
}

function scoresPorCompetencia(eval_, comp) {
  return PERSPECTIVAS.map(p => eval_?.[p]?.[comp]).filter(v => v != null)
}

function consenso(eval_, comp) {
  const s = scoresPorCompetencia(eval_, comp)
  return s.length ? (s.reduce((a, b) => a + b, 0) / s.length) : null
}

function tieneGap(eval_, comp) {
  const s = scoresPorCompetencia(eval_, comp)
  if (s.length < 2) return false
  return Math.max(...s) - Math.min(...s) >= GAP_THRESHOLD
}

function promedioGeneral(eval_, perfil) {
  if (!eval_) return null
  const comps = COMPETENCIAS[perfil] ?? []
  const scores = comps.map(c => consenso(eval_, c)).filter(v => v != null)
  if (!scores.length) return null
  return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
}

function promedioPerspectiva(eval_, perfil, perspectiva) {
  if (!eval_) return null
  const comps = COMPETENCIAS[perfil] ?? []
  const vals = comps.map(c => eval_?.[perspectiva]?.[c]).filter(v => v != null)
  if (!vals.length) return null
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
}

function scoreClass(v) {
  if (!v) return 'text-gray-300'
  const n = Number(v)
  if (n >= 4.5) return 'text-emerald-700 font-bold'
  if (n >= 3.5) return 'text-blue-700 font-semibold'
  if (n >= 2.5) return 'text-yellow-700'
  return 'text-red-600'
}

function ScoreBadge({ value, small }) {
  if (!value && value !== 0) return <span className="text-gray-300 text-xs">—</span>
  const n = Math.round(Number(value))
  const colors = {
    5: 'bg-emerald-100 text-emerald-700',
    4: 'bg-blue-100 text-blue-700',
    3: 'bg-yellow-100 text-yellow-700',
    2: 'bg-orange-100 text-orange-700',
    1: 'bg-red-100 text-red-700',
  }
  return (
    <span className={clsx(
      'inline-flex items-center justify-center rounded-full font-bold',
      small ? 'w-5 h-5 text-xs' : 'w-7 h-7 text-sm',
      colors[n] ?? 'bg-gray-100 text-gray-600'
    )}>
      {Number(value).toFixed ? Number(value).toFixed(1).replace('.0','') : value}
    </span>
  )
}

// ── Modos de evaluación por perspectiva ───────────────────────────────────────
// self → test  |  manager/peer → cuestionario
const EVAL_MODE = { self: 'test', manager: 'questionnaire', peer: 'questionnaire' }

// ── Vista de evaluación completa ──────────────────────────────────────────────
function EvalDetail({ eval_, perfil }) {
  const comps       = COMPETENCIAS[perfil] ?? []
  const avg         = promedioGeneral(eval_, perfil)
  const gaps        = comps.filter(c => tieneGap(eval_, c))
  const fortalezas  = [...comps].sort((a, b) => (consenso(eval_, b) ?? 0) - (consenso(eval_, a) ?? 0)).slice(0, 3)
  const desarrollo  = [...comps].sort((a, b) => (consenso(eval_, a) ?? 0) - (consenso(eval_, b) ?? 0)).slice(0, 3)

  // Indicador del método usado
  const selfMode = eval_?.self_mode   // 'test' | 'manual'
  const mgrMode  = eval_?.manager_mode
  const peerMode = eval_?.peer_mode

  const ModeTag = ({ mode }) => mode === 'test'
    ? <span className="badge bg-brand-50 text-brand-600 text-xs ml-1">test</span>
    : mode === 'questionnaire'
    ? <span className="badge bg-purple-50 text-purple-600 text-xs ml-1">cuestionario</span>
    : null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className={clsx('text-2xl font-bold', scoreClass(avg))}>{avg ?? '—'}</span>
          <span className="text-xs text-gray-400">/ 5 consenso</span>
        </div>
        {PERSPECTIVAS.map(p => {
          const v = promedioPerspectiva(eval_, perfil, p)
          const modeMap = { self: selfMode, manager: mgrMode, peer: peerMode }
          return v ? (
            <div key={p} className="flex items-center gap-1">
              <span className="text-xs text-gray-500">{PERSPECTIVA_LABEL[p]}:</span>
              <span className={clsx('text-sm font-semibold', scoreClass(v))}>{v}</span>
              <ModeTag mode={modeMap[p]} />
            </div>
          ) : null
        })}
        {eval_?.perfil && (
          <span className="badge bg-brand-50 text-brand-700 ml-auto">{eval_.perfil}</span>
        )}
        {eval_?.nps != null && (
          <span className="badge bg-purple-50 text-purple-700 ml-1">NPS par: {eval_.nps}</span>
        )}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 text-gray-500 font-semibold">Competencia</th>
              {PERSPECTIVAS.map(p => (
                <th key={p} className="text-center px-2 py-2 text-gray-500 font-semibold w-14">
                  {PERSPECTIVA_LABEL[p]}
                </th>
              ))}
              <th className="text-center px-2 py-2 text-gray-500 font-semibold w-16">Cons.</th>
            </tr>
          </thead>
          <tbody>
            {comps.map(comp => {
              const con = consenso(eval_, comp)
              const gap = tieneGap(eval_, comp)
              return (
                <tr key={comp} className={clsx('border-t border-gray-50', gap && 'bg-orange-50')}>
                  <td className="px-3 py-1.5 text-gray-700">
                    {comp}
                    {gap && <span className="ml-1.5 text-orange-500" title="Gap significativo">⚠</span>}
                  </td>
                  {PERSPECTIVAS.map(p => (
                    <td key={p} className="px-2 py-1.5 text-center">
                      <ScoreBadge value={eval_?.[p]?.[comp]} small />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center">
                    <span className={clsx('font-semibold', scoreClass(con?.toFixed(1)))}>
                      {con ? con.toFixed(1) : '—'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-emerald-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-emerald-700 mb-1.5">💪 Fortalezas</p>
          {fortalezas.map(c => (
            <div key={c} className="flex items-center justify-between mb-0.5">
              <span className="text-xs text-emerald-800 truncate mr-1">{c}</span>
              <span className={clsx('text-xs font-bold shrink-0', scoreClass(consenso(eval_, c)?.toFixed(1)))}>
                {consenso(eval_, c)?.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-blue-700 mb-1.5">📈 Desarrollo</p>
          {desarrollo.map(c => (
            <div key={c} className="flex items-center justify-between mb-0.5">
              <span className="text-xs text-blue-800 truncate mr-1">{c}</span>
              <span className={clsx('text-xs font-bold shrink-0', scoreClass(consenso(eval_, c)?.toFixed(1)))}>
                {consenso(eval_, c)?.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
        <div className={clsx('rounded-lg p-3', gaps.length > 0 ? 'bg-orange-50' : 'bg-gray-50')}>
          <p className={clsx('text-xs font-semibold mb-1.5', gaps.length > 0 ? 'text-orange-700' : 'text-gray-500')}>
            {gaps.length > 0 ? `⚠ ${gaps.length} gap(s)` : '✓ Sin gaps significativos'}
          </p>
          {gaps.map(c => <p key={c} className="text-xs text-orange-700 truncate">· {c}</p>)}
          {gaps.length === 0 && <p className="text-xs text-gray-400">Perspectivas alineadas</p>}
        </div>
      </div>

      {eval_?.notas_generales && (
        <p className="text-xs text-gray-500 italic border-t border-gray-100 pt-2">
          {eval_.notas_generales}
        </p>
      )}
    </div>
  )
}

// ── Formulario de nueva evaluación (orquestador de los 3 módulos) ─────────────
// Se renderiza dentro de un Panel. El quiz y los cuestionarios se muestran
// inline, reemplazando la vista principal sin abrir ningún contenedor adicional.
function EvalOrchestrator({ persona, onClose }) {
  const qc = useQueryClient()

  const perfilDetectado = detectarPerfil(persona.rol)
  const [perfil, setPerfil]   = useState(persona.evaluacion_ultima?.perfil ?? perfilDetectado)
  const [periodo, setPeriodo] = useState(PERIODOS[0])
  const [notas, setNotas]     = useState('')

  const [evalData, setEvalData] = useState({
    self: null, manager: null, peer: null,
    self_mode: null, manager_mode: null, peer_mode: null, nps: null,
  })

  // Vista activa dentro del panel: 'main' | { type:'quiz', comp } | { type:'behavior', role }
  const [view, setView] = useState('main')

  const comps = COMPETENCIAS[perfil] ?? []

  const update = useMutation({
    mutationFn: data => personasApi.update(persona.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['personas'] }); onClose() },
  })

  const handleQuizComplete = (comp, score) => {
    setEvalData(d => ({ ...d, self: { ...(d.self ?? {}), [comp]: score }, self_mode: 'test' }))
    setView('main')
  }

  const handleBehaviorComplete = (role, scores, nps) => {
    setEvalData(d => ({
      ...d,
      [role]: scores,
      [`${role}_mode`]: 'questionnaire',
      ...(role === 'peer' && nps != null ? { nps } : {}),
    }))
    setView('main')
  }

  const selfComps      = evalData.self ? Object.keys(evalData.self) : []
  const selfComplete   = selfComps.length === comps.length
  const managerComplete = !!evalData.manager
  const peerComplete    = !!evalData.peer
  const selfPct = Math.round((selfComps.length / Math.max(comps.length, 1)) * 100)
  const hasAny  = evalData.self || evalData.manager || evalData.peer

  const resetPerfil = p => {
    setPerfil(p)
    setEvalData({ self: null, manager: null, peer: null, self_mode: null, manager_mode: null, peer_mode: null, nps: null })
    setView('main')
  }

  const submit = () => {
    const nuevaEval = {
      periodo, fecha: new Date().toISOString().split('T')[0], perfil,
      notas_generales: notas,
      self: evalData.self, manager: evalData.manager, peer: evalData.peer,
      self_mode: evalData.self_mode, manager_mode: evalData.manager_mode, peer_mode: evalData.peer_mode,
      nps: evalData.nps,
    }
    const historico = [...(persona.evaluacion_historico ?? []), persona.evaluacion_ultima].filter(Boolean)
    update.mutate({ evaluacion_ultima: nuevaEval, evaluacion_historico: historico })
  }

  // ── Vista: quiz inline ────────────────────────────────────────────────────
  if (view?.type === 'quiz') {
    return (
      <QuizContent
        perfil={perfil}
        competencia={view.comp}
        onComplete={(score, detail) => handleQuizComplete(view.comp, score, detail)}
        onBack={() => setView('main')}
      />
    )
  }

  // ── Vista: cuestionario inline ────────────────────────────────────────────
  if (view?.type === 'behavior') {
    return (
      <BehaviorContent
        perfil={perfil}
        role={view.role}
        evaluadoNombre={persona.nombre}
        onComplete={(scores, nps) => handleBehaviorComplete(view.role, scores, nps)}
        onBack={() => setView('main')}
      />
    )
  }

  // ── Vista: formulario principal ───────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Meta */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">Perfil</label>
          <select className="input" value={perfil} onChange={e => resetPerfil(e.target.value)}>
            {PERFILES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Período</label>
          <select className="input" value={periodo} onChange={e => setPeriodo(e.target.value)}>
            {PERIODOS.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* Tres módulos */}
      <div className="space-y-3">
        {/* Auto-evaluación */}
        <div className={clsx('border rounded-xl p-4', selfComplete ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200')}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                🎯 Auto-evaluación
                {selfComplete && <span className="ml-2 text-emerald-600 text-xs">✓ Completada</span>}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Test práctico-teórico · {comps.length} competencias · 3 preguntas c/u
              </p>
            </div>
            <span className="text-xs text-gray-400">{selfComps.length}/{comps.length}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full mb-3 overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${selfPct}%` }} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {comps.map(comp => {
              const score = evalData.self?.[comp]
              const done  = score != null
              return (
                <button key={comp} type="button"
                  onClick={() => setView({ type: 'quiz', comp })}
                  className={clsx(
                    'px-2.5 py-1 rounded-lg border text-xs font-medium transition-all',
                    done
                      ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:bg-brand-50'
                  )}>
                  {done ? `✓ ${comp} (${score})` : comp}
                </button>
              )
            })}
          </div>
        </div>

        {/* Evaluación de manager */}
        <div className={clsx('border rounded-xl p-4', managerComplete ? 'border-blue-200 bg-blue-50' : 'border-gray-200')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                👤 Evaluación de manager
                {managerComplete && <span className="ml-2 text-blue-600 text-xs">✓ Completada</span>}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Cuestionario de comportamientos · 3 afirmaciones por competencia
              </p>
            </div>
            <button type="button" onClick={() => setView({ type: 'behavior', role: 'manager' })}
              className={clsx(
                'text-xs font-medium px-3 py-1.5 rounded-lg border transition-all',
                managerComplete
                  ? 'border-blue-300 text-blue-600 hover:bg-blue-100'
                  : 'border-brand-300 bg-brand-50 text-brand-600 hover:bg-brand-100'
              )}>
              {managerComplete ? '✎ Repetir' : 'Iniciar →'}
            </button>
          </div>
          {managerComplete && (
            <p className="text-xs text-blue-600 mt-2">
              Score promedio: {(Object.values(evalData.manager).filter(Boolean).reduce((a, b) => a + b, 0) / Object.values(evalData.manager).filter(Boolean).length).toFixed(1)} / 5
            </p>
          )}
        </div>

        {/* Evaluación de par */}
        <div className={clsx('border rounded-xl p-4', peerComplete ? 'border-purple-200 bg-purple-50' : 'border-gray-200')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                👥 Evaluación de par
                {peerComplete && <span className="ml-2 text-purple-600 text-xs">✓ Completada</span>}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Cuestionario · 2 afirmaciones por competencia + NPS técnico
              </p>
            </div>
            <button type="button" onClick={() => setView({ type: 'behavior', role: 'peer' })}
              className={clsx(
                'text-xs font-medium px-3 py-1.5 rounded-lg border transition-all',
                peerComplete
                  ? 'border-purple-300 text-purple-600 hover:bg-purple-100'
                  : 'border-brand-300 bg-brand-50 text-brand-600 hover:bg-brand-100'
              )}>
              {peerComplete ? '✎ Repetir' : 'Iniciar →'}
            </button>
          </div>
          {peerComplete && (
            <p className="text-xs text-purple-600 mt-2">
              Score promedio: {(Object.values(evalData.peer).filter(Boolean).reduce((a, b) => a + b, 0) / Object.values(evalData.peer).filter(Boolean).length).toFixed(1)} / 5
              {evalData.nps != null && ` · NPS: ${evalData.nps}/10`}
            </p>
          )}
        </div>
      </div>

      {/* Notas */}
      <div>
        <label className="form-label">Notas generales</label>
        <textarea rows={2} className="input resize-none" value={notas}
          onChange={e => setNotas(e.target.value)}
          placeholder="Contexto, logros del período, plan de desarrollo..." />
      </div>

      {update.error && <p className="text-xs text-red-500">Error: {update.error.message}</p>}

      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
        <button type="button" onClick={submit} disabled={!hasAny || update.isPending}
          className="btn-primary disabled:opacity-50">
          {update.isPending ? 'Guardando...' : 'Guardar evaluación'}
        </button>
      </div>
    </div>
  )
}

// ── Fila expandible ───────────────────────────────────────────────────────────
function PersonaRow({ persona }) {
  const [open, setOpen]     = useState(false)
  const [adding, setAdding] = useState(false)

  const ultima    = persona.evaluacion_ultima
  const historico = persona.evaluacion_historico ?? []
  const perfil    = ultima?.perfil ?? detectarPerfil(persona.rol)
  const avg       = promedioGeneral(ultima, perfil)
  const gaps      = ultima
    ? (COMPETENCIAS[perfil] ?? []).filter(c => tieneGap(ultima, c)).length
    : 0

  // Badges de método
  const ModeIndicator = ({ eval_ }) => {
    if (!eval_) return null
    const modes = [
      eval_.self_mode === 'test' && '🎯',
      eval_.manager_mode === 'questionnaire' && '👤',
      eval_.peer_mode === 'questionnaire' && '👥',
    ].filter(Boolean)
    return modes.length ? (
      <span className="text-xs text-gray-400 ml-1">{modes.join(' ')}</span>
    ) : null
  }

  return (
    <>
      <tr
        className={clsx(
          'border-b border-gray-100 cursor-pointer transition-colors',
          open ? 'bg-gray-50' : 'hover:bg-gray-50'
        )}
        onClick={() => setOpen(o => !o)}
      >
        <td className="py-3 pr-4 pl-1">
          <p className="font-medium text-gray-900 text-sm">{persona.nombre}</p>
          <p className="text-xs text-gray-400">{persona.rol}</p>
        </td>
        <td className="py-3 pr-4">
          <span className={clsx('badge', NIVEL_COLOR[persona.nivel_seniority])}>
            {persona.nivel_seniority}
          </span>
        </td>
        <td className="py-3 pr-4">
          <span className="badge bg-gray-100 text-gray-600 text-xs">{perfil}</span>
        </td>
        <td className="py-3 pr-4">
          {ultima ? (
            <div>
              <p className="text-xs font-medium text-gray-700">{ultima.periodo}</p>
              <p className="text-xs text-gray-400">{ultima.fecha}</p>
              <ModeIndicator eval_={ultima} />
            </div>
          ) : (
            <span className="text-xs text-gray-300">Sin evaluación</span>
          )}
        </td>
        <td className="py-3 pr-4 text-center">
          {avg ? <ScoreBadge value={avg} /> : <span className="text-xs text-gray-300">—</span>}
        </td>
        <td className="py-3 pr-4 text-center">
          {gaps > 0 ? (
            <span className="badge bg-orange-100 text-orange-700">{gaps} gaps</span>
          ) : ultima ? (
            <span className="text-xs text-emerald-600">✓</span>
          ) : null}
        </td>
        <td className="py-3 text-center text-xs text-gray-400">{historico.length}</td>
        <td className="py-3 pr-2 text-right text-xs text-gray-400">{open ? '▲' : '▼'}</td>
      </tr>

      {open && (
        <tr className="bg-gray-50">
          <td colSpan={8} className="px-4 pb-5 pt-3">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Evaluación {ultima ? `— ${ultima.periodo}` : ''}
                </p>
                <button
                  onClick={e => { e.stopPropagation(); setAdding(true) }}
                  className="btn-primary !text-xs !py-1.5"
                >
                  + Nueva evaluación
                </button>
              </div>

              {ultima ? (
                <EvalDetail eval_={ultima} perfil={ultima.perfil ?? perfil} />
              ) : (
                <p className="text-sm text-gray-400 py-2">
                  Sin evaluaciones. Haz click en "+ Nueva evaluación" para comenzar.
                </p>
              )}

              {historico.length > 0 && (
                <details>
                  <summary className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer select-none">
                    Historial anterior ({historico.length} evaluaciones)
                  </summary>
                  <div className="mt-3 space-y-4">
                    {[...historico].reverse().map((ev, i) => (
                      <div key={i} className="border border-gray-100 rounded-xl p-4">
                        <p className="text-xs font-semibold text-gray-600 mb-3">
                          {ev.periodo ?? `Evaluación ${historico.length - i}`} · {ev.fecha}
                        </p>
                        <EvalDetail eval_={ev} perfil={ev.perfil ?? perfil} />
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </td>
        </tr>
      )}

      {adding && (
        <Panel title={`Nueva evaluación · ${persona.nombre}`} onClose={() => setAdding(false)} width="lg">
          <EvalOrchestrator persona={persona} onClose={() => setAdding(false)} />
        </Panel>
      )}
    </>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function Carrera() {
  const [nivelFilter, setNivelFilter] = useState('')
  const [search, setSearch]           = useState('')

  const { data: personas = [], isLoading } = useQuery({
    queryKey: ['personas'],
    queryFn: () => personasApi.list(),
  })

  const filtered = personas.filter(p => {
    const q = search.toLowerCase()
    return (
      (!search || p.nombre.toLowerCase().includes(q)) &&
      (!nivelFilter || p.nivel_seniority === nivelFilter)
    )
  })

  const conEval   = personas.filter(p => p.evaluacion_ultima).length
  const sinEval   = personas.length - conEval
  const promedios = personas.map(p => {
    const perf = p.evaluacion_ultima?.perfil ?? detectarPerfil(p.rol)
    return Number(promedioGeneral(p.evaluacion_ultima, perf))
  }).filter(Boolean)
  const avgGeneral = promedios.length
    ? (promedios.reduce((a, b) => a + b, 0) / promedios.length).toFixed(1)
    : null

  const totalGaps = personas.reduce((acc, p) => {
    if (!p.evaluacion_ultima) return acc
    const perf = p.evaluacion_ultima?.perfil ?? detectarPerfil(p.rol)
    return acc + (COMPETENCIAS[perf] ?? []).filter(c => tieneGap(p.evaluacion_ultima, c)).length
  }, 0)

  return (
    <div className="pt-0 pl-[1px] pr-[2px] pb-8 space-y-8 w-full">
      <div
        className="p-8 text-white"
        style={{
          background: "linear-gradient(195deg, #101a2e 0%, #0c1424 100%)",
        }}
      >
        <p className="text-xs font-semibold text-white/70 uppercase tracking-widest mb-2">
          Somos DX
        </p>
        <h2 className="text-2xl font-bold tracking-tight">
          Seguimiento de Carrera
        </h2>
        <p className="text-sm text-white/60 mt-1 font-medium">
          Evaluaciones tripartitas — 🎯 Test · 👤 Manager · 👥 Par
        </p>
      </div>

      <div className="px-8 space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-gray-900">{conEval}</p>
          <p className="text-xs text-gray-500 mt-0.5">Evaluados</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-orange-500">{sinEval}</p>
          <p className="text-xs text-gray-500 mt-0.5">Sin evaluar</p>
        </div>
        <div className="card text-center">
          <p className={clsx('text-2xl font-bold', scoreClass(avgGeneral))}>{avgGeneral ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-0.5">Score promedio / 5</p>
        </div>
        <div className={clsx('card text-center', totalGaps > 0 && 'border-orange-200 bg-orange-50')}>
          <p className={clsx('text-2xl font-bold', totalGaps > 0 ? 'text-orange-600' : 'text-gray-900')}>
            {totalGaps}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Gaps detectados</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar persona..." className="input max-w-xs" />
        <select value={nivelFilter} onChange={e => setNivelFilter(e.target.value)} className="input w-40">
          <option value="">Todas las categorías</option>
          {NIVELES.map(n => <option key={n}>{n}</option>)}
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 uppercase text-left border-b border-gray-100">
                <th className="pb-3 pr-4 pl-1">Persona</th>
                <th className="pb-3 pr-4">Nivel</th>
                <th className="pb-3 pr-4">Perfil</th>
                <th className="pb-3 pr-4">Última eval.</th>
                <th className="pb-3 pr-4 text-center">Score</th>
                <th className="pb-3 pr-4 text-center">Gaps</th>
                <th className="pb-3 text-center">Historial</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => <PersonaRow key={p.id} persona={p} />)}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
  )
}
