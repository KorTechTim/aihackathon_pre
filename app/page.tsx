"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameCanvas, OperationPhase } from "@/components/GameCanvas";
import { PixelButton } from "@/components/PixelButton";
import { RobotCard } from "@/components/RobotCard";
import { StageViewport } from "@/components/StageViewport";
import {
  FALLBACK_PLAN,
  calculateGameStats,
  canComplete,
  deriveWorldSnapshot,
  isIncidentId,
  isOperationCallbackAllowed,
  normalizePriority,
  normalizeRescuePlan,
  type FinishReason,
  type GameStats,
  type IncidentId,
  type RescuePlan,
  type RobotId,
  type WorldSnapshot,
} from "@/lib/game-state";

type Screen = "loading" | "title" | "play" | "result";
type ResultKind = "success" | "fail";
type PlanSource = "openai" | "fallback";

declare global {
  interface Window {
    __PIXEL_PANIC_DEBUG__?: {
      phase: OperationPhase;
      completedIncidents: IncidentId[];
      worldSnapshot: WorldSnapshot;
      finishReason: FinishReason | null;
    };
  }
}

const ASSET = "/assets/pixel-panic";

const quickCommands = [
  { icon: "quick_fire_first", label: "불부터 꺼줘", command: "AQUA는 빵집 불을 끄고, FIX는 다리를 수리하고, BUDDY는 고양이를 구조해줘." },
  { icon: "quick_rescue_first", label: "구조 우선", command: "BUDDY는 고양이를 먼저 구조하고, AQUA는 화재를 진압해줘." },
  { icon: "quick_nearest", label: "가까운 곳부터", command: "각 로봇은 가장 가까운 사고부터 해결해줘." },
  { icon: "quick_high_risk", label: "위험도 우선", command: "위험도가 높은 화재와 발전기부터 처리해줘." },
];

const incidents = [
  { id: "fire", name: "빵집 화재", risk: "위험", color: "danger" },
  { id: "bridge", name: "파손된 다리", risk: "높음", color: "warning" },
  { id: "cat", name: "옥상 고양이", risk: "보통", color: "buddy" },
  { id: "generator", name: "발전기 고장", risk: "높음", color: "fix" },
] as const;

const incidentNames: Record<IncidentId, string> = {
  fire: "화재",
  bridge: "다리",
  cat: "고양이",
  generator: "발전기",
};

const robotNames: Record<RobotId, string> = { aqua: "AQUA", fix: "FIX", buddy: "BUDDY" };

const essentialAssets = [
  `${ASSET}/ui/screens/pp_ui_screen_title_final.webp`,
  `${ASSET}/ui/screens/pp_ui_screen_result_success_final.webp`,
  `${ASSET}/ui/screens/pp_ui_screen_result_fail_final.webp`,
  `${ASSET}/world/maps/pp_stage_01_preview.webp`,
  ...["aqua", "fix", "buddy"].flatMap((robot) => ["ready", "busy", "fail"].map((state) => `${ASSET}/ui/portraits/pp_ui_portrait_${robot}_${state}.png`)),
];

const executionPhases: OperationPhase[] = ["fire", "bridge", "cat", "generator", "complete"];
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
const planUrl = apiBase ? `${apiBase}/v1/plan` : "/api/plan";
const debugEnabled = process.env.NEXT_PUBLIC_ENABLE_TEST_DEBUG === "1";
const ANALYSIS_TIMEOUT_MS = 7_500;

export default function Home() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [resultKind, setResultKind] = useState<ResultKind>("success");
  const [phase, setPhase] = useState<OperationPhase>("idle");
  const [command, setCommand] = useState(quickCommands[0].command);
  const [seconds, setSeconds] = useState(90);
  const [showHelp, setShowHelp] = useState(false);
  const [showPause, setShowPause] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [gameError, setGameError] = useState<string | null>(null);
  const [aiPlan, setAiPlan] = useState<RescuePlan | null>(null);
  const [planSource, setPlanSource] = useState<PlanSource | null>(null);
  const [completedIncidents, setCompletedIncidents] = useState<IncidentId[]>([]);
  const [commandsUsed, setCommandsUsed] = useState(0);
  const [usedFallback, setUsedFallback] = useState(false);
  const [finishReason, setFinishReason] = useState<FinishReason | null>(null);
  const [resultStats, setResultStats] = useState<GameStats | null>(null);
  const sequenceTimers = useRef<number[]>([]);
  const analysisRequestId = useRef(0);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const operationRunId = useRef(0);
  const resultCommitted = useRef(false);
  const operationStepMsRef = useRef(2_600);
  const currentPhaseRef = useRef<OperationPhase>(phase);
  const liveStateRef = useRef({ seconds: 90, commandsUsed: 0, completedIncidents: [] as IncidentId[], usedFallback: false });

  const clearAsyncWork = useCallback(() => {
    operationRunId.current += 1;
    analysisRequestId.current += 1;
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    sequenceTimers.current.forEach(window.clearTimeout);
    sequenceTimers.current = [];
  }, []);

  const finishGame = useCallback((kind: ResultKind, reason: FinishReason, overrides: Partial<typeof liveStateRef.current> = {}) => {
    if (resultCommitted.current) return;
    resultCommitted.current = true;
    const finalState = { ...liveStateRef.current, ...overrides };
    liveStateRef.current = finalState;
    clearAsyncWork();
    setShowPause(false);
    setSeconds(finalState.seconds);
    setCompletedIncidents(finalState.completedIncidents);
    const stats = calculateGameStats({
      secondsRemaining: finalState.seconds,
      commandsUsed: finalState.commandsUsed,
      completedIncidents: finalState.completedIncidents,
      usedFallback: finalState.usedFallback,
      finishReason: reason,
    });
    setResultStats(stats);
    setResultKind(kind);
    setFinishReason(reason);
    setScreen("result");
  }, [clearAsyncWork]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("screen");
    if (requested === "play") {
      setScreen("play");
      if (debugEnabled) {
        const testSeconds = Number(params.get("testSeconds"));
        if (Number.isInteger(testSeconds) && testSeconds > 0 && testSeconds <= 90) {
          liveStateRef.current.seconds = testSeconds;
          setSeconds(testSeconds);
        }
        const stepMs = Number(params.get("stepMs"));
        if (Number.isFinite(stepMs) && stepMs >= 200 && stepMs <= 2_600) operationStepMsRef.current = stepMs;
      }
      const requestedCompleted = (params.get("completed") ?? "").split(",").filter(isIncidentId);
      if (requestedCompleted.length) {
        const uniqueCompleted = [...new Set(requestedCompleted)];
        liveStateRef.current.completedIncidents = uniqueCompleted;
        setCompletedIncidents(uniqueCompleted);
      }
      const requestedPhase = params.get("phase") as OperationPhase | null;
      if (["idle", "analyzing", "preview", ...executionPhases].includes(requestedPhase ?? "" as OperationPhase)) {
        setPhase(requestedPhase ?? "idle");
      }
      return;
    }
    if (requested === "result") {
      const kind = params.get("result") === "fail" ? "fail" : "success";
      const completed = kind === "success" ? normalizePriority(null) : ["fire", "bridge"] as IncidentId[];
      const reason: FinishReason = kind === "success" ? "completed" : "timeout";
      setResultKind(kind);
      setFinishReason(reason);
      setResultStats(calculateGameStats({ secondsRemaining: kind === "success" ? 52 : 0, commandsUsed: kind === "success" ? 1 : 4, completedIncidents: completed, usedFallback: false, finishReason: reason }));
      setScreen("result");
      return;
    }

    let cancelled = false;
    setScreen("loading");
    setLoadError(null);
    setLoadProgress(0);
    let settled = 0;
    const jobs = essentialAssets.map((url) => new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(url));
      image.src = url;
    }).finally(() => {
      settled += 1;
      if (!cancelled) setLoadProgress(Math.round((settled / essentialAssets.length) * 100));
    }));
    void Promise.all(jobs).then(() => {
      if (!cancelled) window.setTimeout(() => !cancelled && setScreen("title"), 240);
    }).catch((error: Error) => {
      if (!cancelled) setLoadError(`필수 그래픽을 불러오지 못했습니다: ${error.message.split("/").at(-1)}`);
    });
    return () => { cancelled = true; };
  }, [loadAttempt]);

  useEffect(() => { currentPhaseRef.current = phase; }, [phase]);

  useEffect(() => {
    if (screen !== "play" || showPause || resultCommitted.current) return;
    const timer = window.setInterval(() => {
      if (currentPhaseRef.current === "complete") return;
      const next = Math.max(0, liveStateRef.current.seconds - 1);
      liveStateRef.current.seconds = next;
      setSeconds(next);
      if (next === 0) finishGame("fail", "timeout", { seconds: 0 });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [finishGame, screen, showPause]);

  useEffect(() => () => clearAsyncWork(), [clearAsyncWork]);

  useEffect(() => {
    if (!debugEnabled) return;
    window.__PIXEL_PANIC_DEBUG__ = { phase, completedIncidents: [...completedIncidents], worldSnapshot: deriveWorldSnapshot(completedIncidents), finishReason };
    return () => { delete window.__PIXEL_PANIC_DEBUG__; };
  }, [completedIncidents, finishReason, phase]);

  const timerText = useMemo(() => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`, [seconds]);
  const currentStats = useMemo(() => calculateGameStats({ secondsRemaining: seconds, commandsUsed, completedIncidents, usedFallback }), [commandsUsed, completedIncidents, seconds, usedFallback]);
  const resolvedCount = currentStats.completedIncidents.length;
  const operationRunning = executionPhases.includes(phase);
  const commandLocked = operationRunning || phase === "analyzing";
  const activePlan = aiPlan ?? FALLBACK_PLAN;

  const startGame = () => {
    clearAsyncWork();
    resultCommitted.current = false;
    const params = new URLSearchParams(window.location.search);
    const requestedSeconds = debugEnabled ? Number(params.get("testSeconds")) : 90;
    const initialSeconds = Number.isInteger(requestedSeconds) && requestedSeconds > 0 && requestedSeconds <= 90 ? requestedSeconds : 90;
    const requestedStepMs = debugEnabled ? Number(params.get("stepMs")) : 2_600;
    operationStepMsRef.current = Number.isFinite(requestedStepMs) && requestedStepMs >= 200 && requestedStepMs <= 2_600 ? requestedStepMs : 2_600;
    liveStateRef.current = { seconds: initialSeconds, commandsUsed: 0, completedIncidents: [], usedFallback: false };
    setSeconds(initialSeconds);
    setCommandsUsed(0);
    setUsedFallback(false);
    setFinishReason(null);
    setResultStats(null);
    setPhase("idle");
    setAiPlan(null);
    setPlanSource(null);
    setCompletedIncidents([]);
    setGameError(null);
    setScreen("play");
  };

  const analyze = async () => {
    if (!command.trim() || phase !== "idle") return;
    const requestId = ++analysisRequestId.current;
    const startedAt = Date.now();
    const controller = new AbortController();
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);
    const nextCommandsUsed = liveStateRef.current.commandsUsed + 1;
    liveStateRef.current.commandsUsed = nextCommandsUsed;
    setCommandsUsed(nextCommandsUsed);
    setPhase("analyzing");
    setAiPlan(null);
    setPlanSource(null);
    setCompletedIncidents([]);

    try {
      const response = await fetch(planUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: command.trim() }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Plan API HTTP ${response.status}`);
      const data = await response.json() as { plan?: RescuePlan; source?: PlanSource };
      const normalizedPlan = normalizeRescuePlan(data.plan);
      if (!normalizedPlan || data.source !== "openai" && data.source !== "fallback") throw new Error("Invalid plan response");
      if (analysisRequestId.current !== requestId) return;
      const fallback = data.source === "fallback";
      liveStateRef.current.usedFallback = fallback;
      setUsedFallback(fallback);
      setAiPlan(normalizedPlan);
      setPlanSource(data.source);
    } catch {
      if (analysisRequestId.current !== requestId) return;
      liveStateRef.current.usedFallback = true;
      setUsedFallback(true);
      setAiPlan(FALLBACK_PLAN);
      setPlanSource("fallback");
    } finally {
      window.clearTimeout(timeout);
      if (analysisAbortRef.current === controller) analysisAbortRef.current = null;
      const remainingDelay = Math.max(0, 900 - (Date.now() - startedAt));
      if (remainingDelay) await new Promise((resolve) => window.setTimeout(resolve, remainingDelay));
      if (analysisRequestId.current === requestId && !resultCommitted.current) setPhase("preview");
    }
  };

  const execute = () => {
    clearAsyncWork();
    const runId = operationRunId.current;
    const priority = normalizePriority(activePlan.priority);
    const stepMs = operationStepMsRef.current;
    liveStateRef.current.completedIncidents = [];
    setCompletedIncidents([]);
    setPhase(priority[0]);
    priority.slice(1).forEach((nextIncident, index) => {
      const completedCount = index + 1;
      sequenceTimers.current.push(window.setTimeout(() => {
        if (!isOperationCallbackAllowed(runId, operationRunId.current, resultCommitted.current)) return;
        const completed = priority.slice(0, completedCount);
        liveStateRef.current.completedIncidents = completed;
        setCompletedIncidents(completed);
        setPhase(nextIncident);
      }, completedCount * stepMs));
    });
    sequenceTimers.current.push(window.setTimeout(() => {
      if (!isOperationCallbackAllowed(runId, operationRunId.current, resultCommitted.current) || !canComplete(priority)) return;
      liveStateRef.current.completedIncidents = priority;
      setCompletedIncidents(priority);
      setPhase("complete");
    }, 4 * stepMs));
    sequenceTimers.current.push(window.setTimeout(() => {
      if (!isOperationCallbackAllowed(runId, operationRunId.current, resultCommitted.current) || !canComplete(priority)) return;
      finishGame("success", "completed", { completedIncidents: priority });
    }, 4 * stepMs + Math.max(180, Math.round(stepMs * 0.8))));
  };

  return (
    <main className="app-shell">
      <div className="rotate-overlay" role="status">
        <img src={`${ASSET}/brand/pp_brand_logo_mark.png`} alt="" />
        <strong>기기를 가로로 돌려주세요</strong>
        <span>PIXEL PANIC은 가로 화면에 최적화되어 있어요.</span>
      </div>

      <StageViewport>
        {screen === "loading" && <LoadingScreen progress={loadProgress} error={loadError} onRetry={() => setLoadAttempt((value) => value + 1)} />}
        {screen === "title" && (
          <TitleScreen soundOn={soundOn} onSound={() => setSoundOn((value) => !value)} onStart={startGame} onHelp={() => setShowHelp(true)} />
        )}
        {screen === "play" && (
          <section className="game-screen" aria-label="PIXEL PANIC 게임 화면" data-phase={phase} data-completed={completedIncidents.join(",")}>
            <GameCanvas phase={phase} completedIncidents={completedIncidents} onError={(message) => { setGameError(message); finishGame("fail", "runtime_error"); }} />

            <header className="top-hud pixel-panel">
              <div className="hud-brand"><img src={`${ASSET}/brand/pp_brand_logo_mark.png`} alt="" /><span><strong>PIXEL PANIC</strong><small>AI RESCUE HQ</small></span></div>
              <HudStat icon="timer" label="남은 시간" value={timerText} emphasized />
              <HudStat icon="village_hp" label="마을 보존율" value={`${currentStats.villagePreservation}%`} />
              <HudStat icon="incident_count" label="해결한 사건" value={`${resolvedCount}/4`} />
              <button className="icon-control" aria-label="일시정지" onClick={() => setShowPause(true)}><img src={`${ASSET}/ui/icons/pp_ui_icon_pause.png`} alt="" /></button>
            </header>

            <aside className="robot-panel pixel-panel" aria-label="구조 로봇 상태">
              <div className="panel-heading"><span>구조 로봇</span><small>ONLINE · 3</small></div>
              <RobotCard robot="aqua" name="AQUA" role="소방·냉각" phase={phase} completedIncidents={completedIncidents} />
              <RobotCard robot="fix" name="FIX" role="수리·건설" phase={phase} completedIncidents={completedIncidents} />
              <RobotCard robot="buddy" name="BUDDY" role="구조·운반" phase={phase} completedIncidents={completedIncidents} />
            </aside>

            <aside className="incident-panel pixel-alert" aria-label="활성 사건">
              <div className="panel-heading"><span>긴급 상황</span><small>{resolvedCount}/4 해결</small></div>
              <div className="incident-list">
                {incidents.map((incident) => {
                  const resolved = completedIncidents.includes(incident.id) || phase === "complete";
                  const active = phase === incident.id;
                  return (
                    <div className={`incident-row ${active ? "active" : ""} ${resolved ? "is-resolved" : ""}`} key={incident.id}>
                      <img src={`${ASSET}/ui/icons/pp_ui_icon_incident_${incident.id}.png`} alt="" />
                      <div><strong>{incident.name}</strong><span className={`risk ${incident.color}`}>{resolved ? "해결 완료" : active ? "처리 중" : incident.risk}</span></div>
                      <span className={`incident-check ${resolved ? "resolved" : ""}`}>{resolved ? "✓" : active ? "…" : "!"}</span>
                    </div>
                  );
                })}
              </div>
              {(phase === "preview" || operationRunning) && (
                <div className="plan-preview" aria-label="작전 미리보기">
                  <div className="plan-title"><b>{phase === "preview" ? "AI 작전 미리보기" : "AI 작전 실행 중"}</b><em className={planSource === "openai" ? "live" : "fallback"}>{planSource === "openai" ? "GPT LIVE" : "LOCAL"}</em></div>
                  <p>{activePlan.summary}</p>
                  {activePlan.assignments.map((assignment) => (
                    <span className={`${assignment.robot}-text`} title={assignment.reason} key={assignment.robot}>
                      {robotNames[assignment.robot]} → {assignment.incidents.map((id) => incidentNames[id]).join("·")}
                    </span>
                  ))}
                  <small>순서: {activePlan.priority.map((id) => incidentNames[id]).join(" → ")}</small>
                </div>
              )}
            </aside>

            <section className={`command-dock pixel-command ${phase === "analyzing" ? "is-analyzing" : ""}`}>
              <div className="quick-command-list" aria-label="추천 명령">
                {quickCommands.map((item) => (
                  <button key={item.label} disabled={commandLocked} onClick={() => { setCommand(item.command); setPhase("idle"); setAiPlan(null); setPlanSource(null); }}><img src={`${ASSET}/ui/icons/pp_ui_icon_${item.icon}.png`} alt="" />{item.label}</button>
                ))}
              </div>
              <div className="command-main">
                <label htmlFor="rescue-command"><img src={`${ASSET}/ui/icons/pp_ui_icon_ai.png`} alt="" />AI 작전 명령</label>
                <input id="rescue-command" value={command} maxLength={500} disabled={commandLocked} onChange={(event) => { setCommand(event.target.value); setPhase("idle"); setAiPlan(null); setPlanSource(null); }} onKeyDown={(event) => { if (event.key === "Enter") void analyze(); }} aria-describedby="command-status" />
                <span id="command-status" className="command-status" aria-live="polite"><CommandStatus phase={phase} /></span>
              </div>
              <PixelButton onClick={phase === "preview" ? execute : () => void analyze()} disabled={phase === "analyzing" || operationRunning}>
                {phase === "preview" ? "작전 실행" : phase === "analyzing" ? "분석 중…" : operationRunning ? `${resolvedCount}/4 구조 중` : "명령 분석"}
              </PixelButton>
              {phase === "analyzing" && <div className="ai-scanline" aria-hidden="true" />}
            </section>

            {gameError && <div className="runtime-error" role="alert"><strong>그래픽 로딩 오류</strong><span>{gameError}</span><button onClick={() => window.location.reload()}>다시 시도</button></div>}
            {showPause && (
              <Modal title="작전 일시정지" onClose={() => setShowPause(false)}>
                <p>타이머가 멈췄습니다. 준비되면 작전을 계속하세요.</p>
                <div className="modal-actions"><PixelButton onClick={() => setShowPause(false)}>계속하기</PixelButton><PixelButton variant="danger" onClick={() => finishGame("fail", "abandoned")}>작전 포기</PixelButton></div>
              </Modal>
            )}
          </section>
        )}
        {screen === "result" && <ResultScreen kind={resultKind} stats={resultStats ?? currentStats} finishReason={finishReason} onRetry={startGame} onTitle={() => { clearAsyncWork(); setScreen("title"); }} />}

        {showHelp && (
          <Modal title="플레이 방법" onClose={() => setShowHelp(false)}>
            <ol className="how-to-list"><li><b>1</b><span>추천 문장을 고르거나 자연어로 명령하세요.</span></li><li><b>2</b><span>AI가 나눈 로봇별 작전을 확인하세요.</span></li><li><b>3</b><span>90초 안에 네 사건을 모두 해결하세요!</span></li></ol>
            <PixelButton onClick={() => { setShowHelp(false); startGame(); }}>바로 시작</PixelButton>
          </Modal>
        )}
      </StageViewport>
    </main>
  );
}

function LoadingScreen({ progress, error, onRetry }: { progress: number; error: string | null; onRetry: () => void }) {
  return (
    <section className="loading-screen">
      <img className="screen-bg" src={`${ASSET}/ui/screens/pp_ui_screen_title_final.webp`} alt="" />
      <div className="loading-shade" />
      <div className="loading-card pixel-panel">
        <img className="loading-mark" src={`${ASSET}/brand/pp_brand_logo_mark.png`} alt="" />
        <span className="eyebrow">RESCUE NETWORK</span>
        <strong>{error ? "연결을 확인해주세요" : "구조 본부 연결 중"}</strong>
        {error ? <><p>{error}</p><PixelButton onClick={onRetry}>다시 시도</PixelButton></> : <><div className="loading-track"><i style={{ width: `${progress}%` }} /></div><small>{progress}% · 필수 그래픽 점검 중</small></>}
      </div>
    </section>
  );
}

function TitleScreen({ soundOn, onSound, onStart, onHelp }: { soundOn: boolean; onSound: () => void; onStart: () => void; onHelp: () => void }) {
  return (
    <section className="title-screen">
      <img className="screen-bg" src={`${ASSET}/ui/screens/pp_ui_screen_title_final.webp`} alt="AQUA, FIX, BUDDY가 출동을 준비하는 구조 마을" />
      <div className="title-vignette" />
      <button className="sound-button icon-control" onClick={onSound} aria-label={soundOn ? "소리 끄기" : "소리 켜기"}><img src={`${ASSET}/ui/icons/pp_ui_icon_sound_${soundOn ? "on" : "off"}.png`} alt="" /></button>
      <div className="title-content">
        <span className="title-kicker"><i /> NATURAL LANGUAGE RESCUE OPS <i /></span>
        <div className="title-lockup"><span>NHN AI HACKATHON</span><h1>PIXEL <em>PANIC</em></h1><b>AI 구조대</b></div>
        <p>당신의 한마디가 세 로봇의 작전이 됩니다.<br /><strong>90초 안에 마을의 네 사건을 해결하세요.</strong></p>
        <div className="title-actions"><PixelButton className="hero-button" onClick={onStart}>구조 작전 시작</PixelButton><PixelButton variant="secondary" onClick={onHelp}>플레이 방법</PixelButton></div>
      </div>
      <div className="role-pills" aria-label="구조 로봇 역할"><span className="aqua"><b>AQUA</b> FIRE & WATER</span><span className="fix"><b>FIX</b> REPAIR & POWER</span><span className="buddy"><b>BUDDY</b> RESCUE & CARE</span></div>
    </section>
  );
}

function ResultScreen({ kind, stats, finishReason, onRetry, onTitle }: { kind: ResultKind; stats: GameStats; finishReason: FinishReason | null; onRetry: () => void; onTitle: () => void }) {
  const success = kind === "success";
  const failTitle = finishReason === "timeout" ? "구조 시간이 종료됐어요" : finishReason === "abandoned" ? "작전을 종료했습니다" : "안전 모드로 전환했어요";
  const failCopy = finishReason === "timeout" ? "해결한 사건은 보존했습니다. 우선순위를 바꿔 다시 도전해보세요." : finishReason === "abandoned" ? "현재까지의 구조 기록을 저장했습니다." : "그래픽 실행 오류로 작전을 안전하게 종료했습니다.";
  return (
    <section className={`result-screen ${kind}`}>
      <img className="screen-bg" src={`${ASSET}/ui/screens/pp_ui_screen_result_${kind}_final.webp`} alt={success ? "마을 주민과 구조대가 함께 축하하는 모습" : "비 내리는 마을에서 다음 출동을 준비하는 구조대"} />
      <div className="result-vignette" />
      <div className={`result-card ${success ? "pixel-success" : "pixel-alert"}`}>
        <div className="result-copy"><span className="result-kicker">{success ? "MISSION COMPLETE" : "MISSION REPORT"}</span><img className="grade" src={`${ASSET}/ui/pp_ui_grade_${stats.grade.toLowerCase()}.png`} alt={`${stats.grade} 등급`} /><div><h1>{success ? stats.grade === "S" ? "완벽한 구조 작전!" : "구조 작전 성공!" : failTitle}</h1><p>{success ? "세 로봇의 협동으로 모든 사건을 해결했습니다." : failCopy}</p></div></div>
        <div className="result-stats"><ResultStat icon="rescued" label="구조" value={`${stats.rescuedCount}명`} /><ResultStat icon="incident_count" label="사건 해결" value={`${stats.completedIncidents.length}/4`} /><ResultStat icon="village_hp" label="마을 보존" value={`${stats.villagePreservation}%`} /><ResultStat icon="command_count" label="사용 명령" value={`${stats.commandsUsed}회`} /></div>
        <div className="result-actions"><PixelButton onClick={onRetry}>다시 출동</PixelButton><PixelButton variant="secondary" onClick={onTitle}>본부로</PixelButton></div>
      </div>
    </section>
  );
}

function CommandStatus({ phase }: { phase: OperationPhase }) {
  const messages: Record<OperationPhase, string> = { idle: "Enter 키로 AI에게 작전을 요청하세요.", analyzing: "명령의 의도와 우선순위를 분석하고 있어요…", preview: "역할 배정 완료! 작전을 실행하세요.", fire: "AQUA가 빵집 화재를 진압하고 있어요.", bridge: "FIX가 파손된 다리를 복구하고 있어요.", cat: "BUDDY가 옥상 고양이에게 접근하고 있어요.", generator: "FIX가 마을 전력을 복구하고 있어요.", complete: "모든 사건 해결! 구조 결과를 집계합니다." };
  return messages[phase];
}

function HudStat({ icon, label, value, emphasized = false }: { icon: string; label: string; value: string; emphasized?: boolean }) { return <div className={`hud-stat ${emphasized ? "emphasized" : ""}`}><img src={`${ASSET}/ui/icons/pp_ui_icon_${icon}.png`} alt="" /><span>{label}</span><strong>{value}</strong></div>; }
function ResultStat({ icon, label, value }: { icon: string; label: string; value: string }) { return <div className="result-stat"><img src={`${ASSET}/ui/icons/pp_ui_icon_${icon}.png`} alt="" /><span>{label}</span><strong>{value}</strong></div>; }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal-card pixel-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" onClick={onClose} aria-label="닫기">×</button><h2 id="modal-title">{title}</h2>{children}</section></div>;
}
