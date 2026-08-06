"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameCanvas, type OperationPhase } from "@/components/GameCanvas";
import { PixelButton } from "@/components/PixelButton";
import { StageViewport } from "@/components/StageViewport";
import { PixelPanicAudio, type PixelPanicSfx } from "@/lib/audio-engine";
import { DIALOGUE_EVENTS, buildDialogueRequest, dialogueForAction, type DialogueEventDefinition } from "@/lib/dialogue-events";
import { deriveWorldSnapshot, type IncidentId as LegacyIncidentId } from "@/lib/game-state";
import {
  ACTIONS,
  INCIDENTS,
  INCIDENT_IDS,
  ROBOT_IDS,
  WAVE_LABELS,
  abandonGame,
  advanceGame,
  applyDialogueChoice,
  createInitialGame,
  formatGameTime,
  getAvailableActions,
  getGrade,
  getIncidentProgress,
  getResolvedCount,
  getVisibleIncidents,
  selectIncident,
  selectRobot,
  startAction,
  type ActionId,
  type IncidentId,
  type RescueGameState,
  type RobotId,
} from "@/lib/rescue-engine";

type Screen = "loading" | "title" | "play" | "result";
type DialogueView = {
  definition: DialogueEventDefinition;
  text: string;
  source: "openai" | "fallback";
  pendingAction: { incidentId: IncidentId; actionId: ActionId };
};

declare global {
  interface Window {
    __PIXEL_PANIC_DEBUG__?: {
      phase: OperationPhase;
      completedIncidents: LegacyIncidentId[];
      worldSnapshot: ReturnType<typeof deriveWorldSnapshot>;
      game: RescueGameState;
      audio: () => ReturnType<PixelPanicAudio["getDebugState"]>;
    };
  }
}

const ASSET = "/assets/pixel-panic";
const ROBOT_META: Record<RobotId, { name: string; role: string; color: string }> = {
  aqua: { name: "AQUA", role: "소방 · 수위", color: "aqua" },
  fix: { name: "FIX", role: "전력 · 수리", color: "fix" },
  buddy: { name: "BUDDY", role: "대피 · 구조", color: "buddy" },
};

const essentialAssets = [
  `${ASSET}/ui/screens/pp_ui_screen_title_final.webp`,
  `${ASSET}/ui/screens/pp_ui_screen_result_success_final.webp`,
  `${ASSET}/ui/screens/pp_ui_screen_result_fail_final.webp`,
  `${ASSET}/world/maps/pp_stage_01_preview.webp`,
  ...ROBOT_IDS.flatMap((robot) => ["ready", "busy"].map((state) => `${ASSET}/ui/portraits/pp_ui_portrait_${robot}_${state}.png`)),
];

const debugEnabled = process.env.NEXT_PUBLIC_ENABLE_TEST_DEBUG === "1";

function legacyWorldState(game: RescueGameState): { phase: OperationPhase; completed: LegacyIncidentId[] } {
  const completed: LegacyIncidentId[] = [];
  if (["resolved", "contained"].includes(game.incidents.bakery_fire.status) && ["resolved", "contained"].includes(game.incidents.house_fire.status)) completed.push("fire");
  if (["resolved", "contained"].includes(game.incidents.bridge_damage.status)) completed.push("bridge");
  if (["resolved", "contained"].includes(game.incidents.cat_trapped.status)) completed.push("cat");
  if (["resolved", "contained"].includes(game.incidents.power_flood.status)) completed.push("generator");
  const pending = ROBOT_IDS.map((id) => game.robots[id].pendingAction).find(Boolean);
  if (!pending) return { phase: game.status === "success" ? "complete" : "idle", completed };
  if (pending.actionId === "build_bridge") return { phase: "bridge", completed };
  if (pending.actionId === "rescue_cat" || pending.actionId === "rescue_residents" || pending.actionId === "evacuate" || pending.actionId === "carry_parts") return { phase: "cat", completed };
  if (pending.actionId === "extinguish" || pending.actionId === "firebreak" || pending.actionId === "lower_water") return { phase: "fire", completed };
  return { phase: "generator", completed };
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [game, setGame] = useState<RescueGameState>(() => createInitialGame());
  const [soundOn, setSoundOn] = useState(true);
  const [paused, setPaused] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [gameError, setGameError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dialogue, setDialogue] = useState<DialogueView | null>(null);
  const dialogueAbortRef = useRef<AbortController | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const resultTimerRef = useRef<number | null>(null);
  const audioRef = useRef<PixelPanicAudio | null>(null);
  const previousWaveRef = useRef(game.wave);
  const previousResolvedRef = useRef(getResolvedCount(game));
  const previousComboRef = useRef(game.foundCombos.length);
  const previousStatusRef = useRef(game.status);

  const getAudio = useCallback(() => {
    audioRef.current ??= new PixelPanicAudio();
    return audioRef.current;
  }, []);

  const playSound = useCallback((effect: PixelPanicSfx) => {
    if (!soundOn) return;
    const audio = getAudio();
    audio.play(effect);
    if (screen === "play" && !paused && game.status === "playing") void audio.startMusic();
  }, [game.status, getAudio, paused, screen, soundOn]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("screen");
    if (requested === "play") {
      const initial = createInitialGame();
      if (debugEnabled && params.get("skipBriefing") === "1") initial.briefingMs = 0;
      if (debugEnabled && params.get("qaAll") === "1") {
        initial.wave = 3;
        initial.briefingMs = 0;
        initial.elapsedMs = 0;
        initial.remainingMs = 210_000;
        INCIDENT_IDS.forEach((id) => { initial.incidents[id].status = "warning"; });
      }
      setGame(initial);
      setScreen("play");
      return;
    }
    if (requested === "result") {
      const initial = createInitialGame();
      initial.status = params.get("result") === "fail" ? "failure" : "success";
      initial.finishReason = initial.status === "success" ? "completed" : "timeout";
      initial.villagePreservation = initial.status === "success" ? 91 : 42;
      initial.rescuedResidents = initial.status === "success" ? 9 : 3;
      initial.foundCombos = initial.status === "success" ? ["power_cut_fire", "parts_repair", "clear_firebreak"] : [];
      if (initial.status === "success") INCIDENT_IDS.forEach((id) => { initial.incidents[id].status = "resolved"; initial.incidents[id].progress = 100; });
      setGame(initial);
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
      if (!cancelled) window.setTimeout(() => !cancelled && setScreen("title"), 180);
    }).catch((error: Error) => {
      if (!cancelled) setLoadError(`필수 그래픽을 불러오지 못했습니다: ${error.message.split("/").at(-1)}`);
    });
    return () => { cancelled = true; };
  }, [loadAttempt]);

  useEffect(() => {
    if (screen !== "play" || paused || game.status !== "playing") {
      lastTickRef.current = null;
      return;
    }
    const tickScale = debugEnabled ? Math.max(1, Math.min(4, Number(new URLSearchParams(window.location.search).get("tickScale")) || 1)) : 1;
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = lastTickRef.current === null ? 250 : now - lastTickRef.current;
      lastTickRef.current = now;
      setGame((current) => advanceGame(current, delta, (dialogue ? 0.7 : 1) * tickScale));
    }, 250);
    return () => window.clearInterval(timer);
  }, [dialogue, game.status, paused, screen]);

  useEffect(() => {
    if (screen !== "play" || game.status === "playing") return;
    resultTimerRef.current = window.setTimeout(() => setScreen("result"), 700);
    return () => { if (resultTimerRef.current !== null) window.clearTimeout(resultTimerRef.current); };
  }, [game.status, screen]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2_000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (screen !== "play") return;
    const audio = getAudio();
    const resolved = getResolvedCount(game);
    const comboCount = game.foundCombos.length;

    if (game.wave !== previousWaveRef.current) audio.play("wave");
    if (comboCount > previousComboRef.current) audio.play("combo");
    else if (resolved > previousResolvedRef.current) audio.play("resolve");

    if (game.status !== previousStatusRef.current && game.status !== "playing") {
      audio.play(game.status === "success" ? "success" : "failure");
      audio.stopMusic();
    }

    previousWaveRef.current = game.wave;
    previousResolvedRef.current = resolved;
    previousComboRef.current = comboCount;
    previousStatusRef.current = game.status;
  }, [game, getAudio, screen]);

  const visual = useMemo(() => legacyWorldState(game), [game]);
  useEffect(() => {
    if (!debugEnabled) return;
    window.__PIXEL_PANIC_DEBUG__ = {
      phase: visual.phase,
      completedIncidents: visual.completed,
      worldSnapshot: deriveWorldSnapshot(visual.completed),
      game,
      audio: () => audioRef.current?.getDebugState() ?? { enabled: soundOn, musicRequested: false, musicPlaying: false, contextState: "uninitialized" },
    };
    return () => { delete window.__PIXEL_PANIC_DEBUG__; };
  }, [game, soundOn, visual]);

  useEffect(() => () => {
    dialogueAbortRef.current?.abort();
    if (resultTimerRef.current !== null) window.clearTimeout(resultTimerRef.current);
    audioRef.current?.dispose();
  }, []);

  const startGame = useCallback(() => {
    dialogueAbortRef.current?.abort();
    setDialogue(null);
    setPaused(false);
    setGameError(null);
    setToast(null);
    const initial = createInitialGame();
    previousWaveRef.current = initial.wave;
    previousResolvedRef.current = 0;
    previousComboRef.current = 0;
    previousStatusRef.current = "playing";
    setGame(initial);
    setScreen("play");
    if (soundOn) {
      const audio = getAudio();
      audio.play("dispatch");
      void audio.startMusic();
    }
  }, [getAudio, soundOn]);

  const openDialogue = useCallback((definition: DialogueEventDefinition, incidentId: IncidentId, actionId: ActionId) => {
    playSound("dialogue");
    dialogueAbortRef.current?.abort();
    const controller = new AbortController();
    dialogueAbortRef.current = controller;
    setDialogue({ definition, text: definition.fallbackDialogue, source: "fallback", pendingAction: { incidentId, actionId } });
    const timeout = window.setTimeout(() => controller.abort(), 4_800);
    void fetch("/api/dialogue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildDialogueRequest(definition, game)),
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as { dialogue?: unknown; source?: unknown };
      if (typeof data.dialogue !== "string" || data.dialogue.length > 160 || data.source !== "openai" && data.source !== "fallback") return;
      setDialogue((current) => current?.definition.id === definition.id ? { ...current, text: data.dialogue as string, source: data.source as "openai" | "fallback" } : current);
    }).catch(() => undefined).finally(() => window.clearTimeout(timeout));
  }, [game, playSound]);

  const requestAction = useCallback((actionId: ActionId) => {
    const incidentId = game.selectedIncidentId;
    if (!incidentId) return setToast("먼저 지도에서 사고를 선택하세요.");
    const action = ACTIONS[actionId];
    const event = dialogueForAction(game, incidentId, actionId, action.robotId);
    if (event) return openDialogue(event, incidentId, actionId);
    const result = startAction(game, incidentId, actionId);
    if (!result.ok) {
      playSound("failure");
      return setToast(result.error ?? "출동할 수 없습니다.");
    }
    playSound("dispatch");
    setGame(result.state);
  }, [game, openDialogue, playSound]);

  const chooseDialogue = useCallback((choiceId: string) => {
    if (!dialogue) return;
    playSound("dispatch");
    dialogueAbortRef.current?.abort();
    setGame((current) => {
      const decided = applyDialogueChoice(current, dialogue.definition.id, choiceId);
      const result = startAction(decided, dialogue.pendingAction.incidentId, dialogue.pendingAction.actionId);
      if (!result.ok) setToast(result.error ?? "출동할 수 없습니다.");
      return result.state;
    });
    setDialogue(null);
  }, [dialogue, playSound]);

  const toggleSound = useCallback(() => {
    const next = !soundOn;
    setSoundOn(next);
    const audio = getAudio();
    audio.setEnabled(next);
    if (next) {
      audio.play("button");
      if (screen === "play" && !paused && game.status === "playing") void audio.startMusic();
    }
  }, [game.status, getAudio, paused, screen, soundOn]);

  const chooseIncident = useCallback((id: IncidentId) => {
    playSound("select");
    setGame((current) => selectIncident(current, id));
  }, [playSound]);

  const chooseRobot = useCallback((id: RobotId) => {
    playSound("button");
    setGame((current) => selectRobot(current, id));
  }, [playSound]);

  const pauseGame = useCallback(() => {
    playSound("button");
    getAudio().stopMusic(true);
    setPaused(true);
  }, [getAudio, playSound]);

  const resumeGame = useCallback(() => {
    setPaused(false);
    playSound("button");
    if (soundOn) void getAudio().startMusic();
  }, [getAudio, playSound, soundOn]);

  const openHelp = useCallback(() => {
    playSound("button");
    setShowHelp(true);
  }, [playSound]);

  const closeHelp = useCallback(() => {
    playSound("button");
    setShowHelp(false);
  }, [playSound]);

  return (
    <main className="app-shell">
      <div className="rotate-overlay" role="status">
        <img src={`${ASSET}/brand/pp_brand_logo_mark.png`} alt="" />
        <strong>기기를 가로로 돌려주세요</strong>
        <span>PIXEL PANIC은 가로 화면에 최적화되어 있어요.</span>
      </div>
      <StageViewport>
        {screen === "loading" && <LoadingScreen progress={loadProgress} error={loadError} onRetry={() => setLoadAttempt((value) => value + 1)} />}
        {screen === "title" && <TitleScreen soundOn={soundOn} onSound={toggleSound} onStart={startGame} onHelp={openHelp} />}
        {screen === "play" && (
          <GameScreen
            game={game}
            visual={visual}
            paused={paused}
            soundOn={soundOn}
            gameError={gameError}
            toast={toast}
            onIncident={chooseIncident}
            onRobot={chooseRobot}
            onAction={requestAction}
            onPause={pauseGame}
            onSound={toggleSound}
            onHelp={openHelp}
            onGameError={setGameError}
          />
        )}
        {screen === "result" && <ResultScreen game={game} onRetry={startGame} onTitle={() => setScreen("title")} />}

        {game.briefingMs > 0 && screen === "play" && <WaveBriefing wave={game.wave} />}
        {game.comboBanner && screen === "play" && <div className="combo-banner"><small>PERFECT COMBO</small><strong>{game.comboBanner}</strong><span>+150</span></div>}
        {dialogue && screen === "play" && <DialogueModal view={dialogue} onChoose={chooseDialogue} />}
        {paused && screen === "play" && (
          <Modal title="작전 일시정지" onClose={resumeGame}>
            <p>모든 사고와 로봇 타이머가 멈췄습니다.</p>
            <div className="modal-actions"><PixelButton onClick={resumeGame}>계속하기</PixelButton><PixelButton variant="danger" onClick={() => { playSound("failure"); getAudio().stopMusic(); setGame((current) => abandonGame(current)); setPaused(false); }}>작전 포기</PixelButton></div>
          </Modal>
        )}
        {showHelp && (
          <Modal title="클릭 구조 매뉴얼" onClose={closeHelp}>
            <ol className="how-to-list"><li><b>1</b><span>지도나 왼쪽 목록에서 사고를 클릭합니다.</span></li><li><b>2</b><span>현장에 맞는 구조 로봇을 클릭합니다.</span></li><li><b>3</b><span>행동 순서를 조합해 콤보와 확산 차단을 노립니다.</span></li></ol>
            <PixelButton onClick={() => { closeHelp(); if (screen !== "play") startGame(); }}>확인</PixelButton>
          </Modal>
        )}
      </StageViewport>
    </main>
  );
}

function GameScreen({ game, visual, paused, soundOn, gameError, toast, onIncident, onRobot, onAction, onPause, onSound, onHelp, onGameError }: {
  game: RescueGameState;
  visual: { phase: OperationPhase; completed: LegacyIncidentId[] };
  paused: boolean;
  soundOn: boolean;
  gameError: string | null;
  toast: string | null;
  onIncident: (id: IncidentId) => void;
  onRobot: (id: RobotId) => void;
  onAction: (id: ActionId) => void;
  onPause: () => void;
  onSound: () => void;
  onHelp: () => void;
  onGameError: (message: string) => void;
}) {
  const resolvedCount = getResolvedCount(game);
  const visible = getVisibleIncidents(game);
  const selected = game.selectedIncidentId ? INCIDENTS[game.selectedIncidentId] : null;
  const selectedRuntime = selected ? game.incidents[selected.id] : null;
  const selectedProgress = selected ? getIncidentProgress(game, selected.id) : 0;
  const selectedRobot = game.selectedRobotId;
  const actions = selected && selectedRobot ? getAvailableActions(game, selected.id, selectedRobot) : [];
  const unresolvedVisible = visible.filter((incident) => !["resolved", "contained"].includes(game.incidents[incident.id].status));
  const listIncidents = [...unresolvedVisible, ...visible.filter((incident) => ["resolved", "contained"].includes(game.incidents[incident.id].status))].slice(0, 6);

  return (
    <section className="game-screen" aria-label="PIXEL PANIC 클릭 구조 작전" data-wave={game.wave} data-status={game.status} data-resolved={resolvedCount}>
      <GameCanvas phase={visual.phase} completedIncidents={visual.completed} onError={onGameError} />
      <header className="top-hud pixel-panel">
        <div className="hud-brand"><img src={`${ASSET}/brand/pp_brand_logo_mark.png`} alt="" /><span><strong>PIXEL PANIC</strong><small>CLICK RESCUE OPS</small></span></div>
        <HudStat icon="timer" label="남은 시간" value={formatGameTime(game.remainingMs)} emphasized />
        <HudStat icon="village_hp" label="마을 보존" value={`${game.villagePreservation}%`} />
        <HudStat icon="incident_count" label="해결 사고" value={`${resolvedCount}/${INCIDENT_IDS.length}`} />
        <div className="wave-chip"><small>WAVE {game.wave}/3</small><strong>{WAVE_LABELS[game.wave - 1]}</strong></div>
        <button className="icon-control" onClick={onSound} aria-label={soundOn ? "소리 끄기" : "소리 켜기"}><img src={`${ASSET}/ui/icons/pp_ui_icon_sound_${soundOn ? "on" : "off"}.png`} alt="" /></button>
        <button className="icon-control" onClick={onHelp} aria-label="도움말">?</button>
        <button className="icon-control" onClick={onPause} aria-label="일시정지"><img src={`${ASSET}/ui/icons/pp_ui_icon_pause.png`} alt="" /></button>
      </header>

      <aside className="incident-panel pixel-alert" aria-label="활성 사고 목록">
        <div className="panel-heading"><span>긴급 상황</span><small>{unresolvedVisible.length} ACTIVE</small></div>
        <div className="incident-list">
          {listIncidents.map((incident) => {
            const runtime = game.incidents[incident.id];
            const resolved = ["resolved", "contained"].includes(runtime.status);
            const active = game.selectedIncidentId === incident.id;
            return (
              <button className={`incident-row ${active ? "active" : ""} ${resolved ? "is-resolved" : ""}`} key={incident.id} onClick={() => onIncident(incident.id)}>
                <img src={`${ASSET}/ui/icons/pp_ui_icon_incident_${incident.icon}.png`} alt="" />
                <span><strong>{incident.label}</strong><small>{resolved ? "해결 완료" : runtime.status === "warning" ? "확산 경고" : `확산 ${Math.ceil(runtime.remainingSpreadMs / 1_000)}초`}</small><i><b style={{ width: `${Math.min(100, runtime.severity / incident.maxSeverity * 100)}%` }} /></i></span>
                <em>{resolved ? "✓" : runtime.severity}</em>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="map-hotspots" aria-label="사고 지도">
        {visible.filter((incident) => !["resolved", "contained"].includes(game.incidents[incident.id].status)).map((incident) => {
          const runtime = game.incidents[incident.id];
          return (
            <button
              key={incident.id}
              className={`incident-pin ${runtime.status} ${game.selectedIncidentId === incident.id ? "selected" : ""}`}
              style={{ left: incident.mapPosition[0], top: incident.mapPosition[1] }}
              onClick={() => onIncident(incident.id)}
              aria-label={`${incident.label}, 위험도 ${runtime.severity}`}
            >
              <img src={`${ASSET}/ui/icons/pp_ui_icon_incident_${incident.icon}.png`} alt="" /><span>{incident.shortLabel}</span><i>{Math.ceil(runtime.remainingSpreadMs / 1_000)}</i>
            </button>
          );
        })}
      </div>

      <aside className="robot-panel pixel-panel" aria-label="구조 로봇 선택">
        <div className="panel-heading"><span>2 · 로봇 선택</span><small>3 ONLINE</small></div>
        {ROBOT_IDS.map((robotId) => {
          const robot = game.robots[robotId];
          const meta = ROBOT_META[robotId];
          const assigned = Boolean(robot.pendingAction);
          const progress = assigned && robot.pendingAction ? 100 - robot.pendingAction.remainingMs / robot.pendingAction.totalMs * 100 : 0;
          const canHandle = selected ? INCIDENTS[selected.id].allowedActions.some((id) => ACTIONS[id].robotId === robotId && !selectedRuntime?.completedActions.includes(id)) : false;
          return (
            <button key={robotId} className={`robot-card ${meta.color} ${game.selectedRobotId === robotId ? "selected" : ""}`} disabled={assigned || !canHandle} onClick={() => onRobot(robotId)}>
              <img className="robot-portrait" src={`${ASSET}/ui/portraits/pp_ui_portrait_${robotId}_${assigned ? "busy" : "ready"}.png`} alt={`${meta.name} 초상화`} />
              <span><strong>{meta.name}</strong><small>{assigned ? `${ACTIONS[robot.currentAction!].label} ${Math.ceil((robot.remainingActionMs ?? 0) / 1_000)}초` : canHandle ? meta.role : "다른 로봇 필요"}</small>{assigned && <i><b style={{ width: `${progress}%` }} /></i>}</span>
              <em>{assigned ? "WORK" : canHandle ? "READY" : "—"}</em>
            </button>
          );
        })}
      </aside>

      <aside className="action-panel pixel-command" aria-label="행동 선택">
        <div className="panel-heading"><span>3 · 행동 선택</span><small>{selectedRobot ? ROBOT_META[selectedRobot].name : "ROBOT?"}</small></div>
        {selected && selectedRuntime ? (
          <>
            <div className="incident-detail"><span className={`severity severity-${selectedRuntime.severity}`}>위험 {selectedRuntime.severity}</span><strong>{selected.label}</strong><small>해결 진행 {selectedProgress}% · 연결 {selected.spreadsTo.length ? selected.spreadsTo.map((id) => INCIDENTS[id].shortLabel).join(" → ") : "없음"}</small><small>{selectedRuntime.status === "warning" ? "확산 전 선행 조치 가능" : `다음 확산까지 ${Math.ceil(selectedRuntime.remainingSpreadMs / 1_000)}초`}</small></div>
            {!selectedRobot && <p className="action-guide">위에서 출동할 로봇을 클릭하세요.</p>}
            <div className="action-buttons">
              {actions.map((action) => <button key={action.id} disabled={game.robots[action.robotId].status !== "idle"} onClick={() => onAction(action.id)}><span>{action.label}</span><small>{Math.ceil(action.durationMs / 1_000)}초 · {action.description}</small></button>)}
              {selectedRobot && actions.length === 0 && <p className="action-guide">이 로봇의 가능한 행동이 없습니다.</p>}
            </div>
          </>
        ) : <p className="action-guide">지도에서 사고를 선택하세요.</p>}
      </aside>

      <footer className="operation-dock pixel-command">
        <section className="mission-log"><strong>작전 로그</strong>{game.logs.slice(-3).map((log) => <span className={log.tone} key={log.id}>› {log.message}</span>)}</section>
        <section className="mission-flow"><span className={selected ? "done" : "active"}><b>1</b>{selected?.shortLabel ?? "사고 선택"}</span><i>→</i><span className={selectedRobot ? "done" : selected ? "active" : ""}><b>2</b>{selectedRobot ? ROBOT_META[selectedRobot].name : "로봇 선택"}</span><i>→</i><span className={selectedRobot ? "active" : ""}><b>3</b>행동 실행</span></section>
        <section className="score-box"><small>SCORE</small><strong>{Math.max(0, game.score).toLocaleString()}</strong><span>COMBO {game.foundCombos.length}/5 · MAX ×{game.maxCombo}</span></section>
      </footer>

      {toast && <div className="toast" role="status">{toast}</div>}
      {gameError && <div className="graphics-warning" role="status">그래픽 일부를 불러오지 못했지만 게임은 계속됩니다.</div>}
      {paused && <div className="pause-dim" />}
    </section>
  );
}

function DialogueModal({ view, onChoose }: { view: DialogueView; onChoose: (choiceId: string) => void }) {
  const robot = view.definition.speaker === "주민" ? "buddy" : view.definition.speaker.toLowerCase();
  const [incidentX, incidentY] = INCIDENTS[view.pendingAction.incidentId].mapPosition;
  const placeRight = incidentX < 640;
  const left = Math.max(278, Math.min(378, placeRight ? incidentX + 60 : incidentX - 580));
  const top = Math.max(80, Math.min(342, incidentY - 110));
  const pointerY = Math.max(42, Math.min(190, incidentY - top - 10));
  const position = { left, top, "--dialogue-pointer-y": `${pointerY}px` } as React.CSSProperties;
  return (
    <div className="modal-backdrop dialogue-backdrop" role="presentation">
      <section className={`dialogue-card pixel-panel pointer-${placeRight ? "left" : "right"}`} style={position} role="dialog" aria-modal="true" aria-labelledby="dialogue-title" data-incident={view.pendingAction.incidentId}>
        <img src={`${ASSET}/ui/portraits/pp_ui_portrait_${robot}_ready.png`} alt="" />
        <div className="dialogue-copy"><span><b>{view.definition.speaker}</b><em className={view.source}>{view.source === "openai" ? "GPT LIVE" : "LOCAL SAFE"}</em></span><h2 id="dialogue-title">{view.definition.title}</h2><p>{view.text}</p></div>
        <div className="dialogue-choices">{view.definition.choices.map((choice) => <button key={choice.id} onClick={() => onChoose(choice.id)}>{choice.label}</button>)}</div>
      </section>
    </div>
  );
}

function WaveBriefing({ wave }: { wave: 1 | 2 | 3 }) {
  return <div className="wave-briefing" role="status"><small>INCOMING</small><strong>WAVE {wave}</strong><span>{WAVE_LABELS[wave - 1]}</span><p>{wave === 1 ? "전력 차단 → 대피 → 가스 차단 → 진압" : wave === 2 ? "부품 운반 → 전력 복구 → 배수 → 다리 → 구조" : "화재와 구조 신호가 동시에 발생합니다."}</p></div>;
}

function LoadingScreen({ progress, error, onRetry }: { progress: number; error: string | null; onRetry: () => void }) {
  return <section className="loading-screen"><img className="screen-bg" src={`${ASSET}/ui/screens/pp_ui_screen_title_final.webp`} alt="" /><div className="loading-shade" /><div className="loading-card pixel-panel"><img className="loading-mark" src={`${ASSET}/brand/pp_brand_logo_mark.png`} alt="" /><span className="eyebrow">RESCUE NETWORK</span><strong>{error ? "연결을 확인해주세요" : "구조 본부 연결 중"}</strong>{error ? <><p>{error}</p><PixelButton onClick={onRetry}>다시 시도</PixelButton></> : <><div className="loading-track"><i style={{ width: `${progress}%` }} /></div><small>{progress}% · 필수 그래픽 점검 중</small></>}</div></section>;
}

function TitleScreen({ soundOn, onSound, onStart, onHelp }: { soundOn: boolean; onSound: () => void; onStart: () => void; onHelp: () => void }) {
  return (
    <section className="title-screen"><img className="screen-bg" src={`${ASSET}/ui/screens/pp_ui_screen_title_final.webp`} alt="AQUA, FIX, BUDDY가 출동을 준비하는 구조 마을" /><div className="title-vignette" /><button className="sound-button icon-control" onClick={onSound} aria-label={soundOn ? "소리 끄기" : "소리 켜기"}><img src={`${ASSET}/ui/icons/pp_ui_icon_sound_${soundOn ? "on" : "off"}.png`} alt="" /></button><div className="title-content"><span className="title-kicker"><i /> CLICK · PLAN · COMBO <i /></span><div className="title-lockup"><span>NHN AI HACKATHON</span><h1>PIXEL <em>PANIC</em></h1><b>AI 구조대</b></div><p>번지는 사고를 분석하고 세 로봇을 올바른 순서로 배치하세요.<br /><strong>키보드 없이 클릭만으로 마을을 구조합니다.</strong></p><div className="title-actions"><PixelButton className="hero-button" onClick={onStart}>구조 작전 시작</PixelButton><PixelButton variant="secondary" onClick={onHelp}>플레이 방법</PixelButton></div></div><div className="role-pills" aria-label="구조 로봇 역할"><span className="aqua"><b>AQUA</b> FIRE & WATER</span><span className="fix"><b>FIX</b> REPAIR & POWER</span><span className="buddy"><b>BUDDY</b> RESCUE & CARE</span></div></section>
  );
}

function ResultScreen({ game, onRetry, onTitle }: { game: RescueGameState; onRetry: () => void; onTitle: () => void }) {
  const success = game.status === "success";
  const grade = getGrade(game);
  const reason = game.finishReason === "timeout" ? "구조 시간이 종료됐어요" : game.finishReason === "village_lost" ? "마을 안전도가 0이 됐어요" : game.finishReason === "abandoned" ? "작전을 종료했습니다" : "구조 작전 완료!";
  return (
    <section className={`result-screen ${success ? "success" : "fail"}`}><img className="screen-bg" src={`${ASSET}/ui/screens/pp_ui_screen_result_${success ? "success" : "fail"}_final.webp`} alt="구조 작전 결과" /><div className="result-vignette" /><div className={`result-card ${success ? "pixel-success" : "pixel-alert"}`}><div className="result-copy"><span className="result-kicker">{success ? "MISSION COMPLETE" : "MISSION REPORT"}</span><img className="grade" src={`${ASSET}/ui/pp_ui_grade_${grade.toLowerCase()}.png`} alt={`${grade} 등급`} /><div><h1>{reason}</h1><p>{success ? "결정론 엔진이 모든 구조 기록을 집계했습니다." : "확산 순서와 로봇 조합을 바꿔 다시 도전해보세요."}</p></div></div><div className="result-stats"><ResultStat icon="rescued" label="구조 주민" value={`${game.rescuedResidents}명`} /><ResultStat icon="incident_count" label="해결 사고" value={`${getResolvedCount(game)}/${INCIDENT_IDS.length}`} /><ResultStat icon="village_hp" label="마을 보존" value={`${game.villagePreservation}%`} /><ResultStat icon="command_count" label="발견 콤보" value={`${game.foundCombos.length}/5`} /><ResultStat icon="timer" label="남은 시간" value={formatGameTime(game.remainingMs)} /><ResultStat icon="done" label="최대 콤보" value={`×${game.maxCombo}`} /></div><div className="result-score"><small>FINAL SCORE</small><strong>{Math.max(0, game.score).toLocaleString()}</strong></div><div className="result-actions"><PixelButton onClick={onRetry}>다시 출동</PixelButton><PixelButton variant="secondary" onClick={onTitle}>본부로</PixelButton></div></div></section>
  );
}

function HudStat({ icon, label, value, emphasized = false }: { icon: string; label: string; value: string; emphasized?: boolean }) { return <div className={`hud-stat ${emphasized ? "emphasized" : ""}`}><img src={`${ASSET}/ui/icons/pp_ui_icon_${icon}.png`} alt="" /><span>{label}</span><strong>{value}</strong></div>; }
function ResultStat({ icon, label, value }: { icon: string; label: string; value: string }) { return <div className="result-stat"><img src={`${ASSET}/ui/icons/pp_ui_icon_${icon}.png`} alt="" /><span>{label}</span><strong>{value}</strong></div>; }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal-card pixel-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" onClick={onClose} aria-label="닫기">×</button><h2 id="modal-title">{title}</h2>{children}</section></div>;
}
