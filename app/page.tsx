"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameCanvas, type ActiveRobotMission, type OperationPhase } from "@/components/GameCanvas";
import { PixelButton } from "@/components/PixelButton";
import { StageViewport } from "@/components/StageViewport";
import { PixelPanicAudio, type PixelPanicSfx } from "@/lib/audio-engine";
import {
  buildBombHintRequest,
  fallbackBombHint,
  normalizeBombHint,
  pickBombWire,
  type BombHintResponse,
  type BombWire,
} from "@/lib/bomb-defusal";
import {
  CAT_FALL_MS,
  CAT_ROBOT_STEP,
  CAT_WARNING_MS,
  clampCatRobotX,
  getCatRoamDuration,
  getFallingCatY,
  getRoamingCatX,
  isCatCaught,
} from "@/lib/cat-rescue-minigame";
import { DIALOGUE_EVENTS, buildDialogueRequest, dialogueForAction, type DialogueEventDefinition } from "@/lib/dialogue-events";
import { deriveWorldSnapshot, type IncidentId as LegacyIncidentId } from "@/lib/game-state";
import { clampMapPanX, mapPanFromPointerDelta, revealMapAnchor } from "@/lib/map-pan";
import { NPC_DIALOGUES, NPC_DIALOGUE_IDS, buildNpcDialogueRequest, fallbackNpcDialogue, isNpcDialogueExcluded, type NpcDialogueId } from "@/lib/npc-dialogue";
import { buildResultNewsRequest, buildStageNewsRequest, fallbackResultNews, normalizeResultNews, type ResultNewsRequest, type ResultNewsResponse } from "@/lib/result-news";
import {
  MAX_EXCLUDED_QUIZ_QUESTIONS,
  MAX_SAFETY_QUIZ_SEQUENCE,
  buildSafetyQuizRequest,
  fallbackSafetyQuiz,
  isSafetyQuizQuestionExcluded,
  normalizeSafetyQuiz,
  type SafetyQuizDifficulty,
  type SafetyQuizOptionId,
  type SafetyQuizResponse,
} from "@/lib/safety-quiz";
import { getIncidentPopupPosition, getStageMap, stageMapScreenY, type StageMapDefinition, type StageMapId, type StagePoint } from "@/lib/stage-maps";
import {
  ACTIONS,
  INCIDENTS,
  INCIDENT_IDS,
  ROBOT_IDS,
  TOTAL_STAGE_INCIDENTS,
  WAVE_LABELS,
  abandonGame,
  advanceGame,
  advanceToNextWave,
  applyDialogueChoice,
  canAdvanceToNextWave,
  createInitialGame,
  formatGameTime,
  getAvailableActions,
  getGrade,
  getIncidentProgress,
  getResolvedCount,
  getWaveIncidentIds,
  getVisibleIncidents,
  failCatRescueMinigame,
  failBombDefusalMinigame,
  selectIncident,
  selectRobot,
  resolveActionWithSafetyQuiz,
  resolveCatRescueMinigame,
  resolveBombDefusalMinigame,
  startAction,
  type ActionId,
  type ActionDefinition,
  type IncidentId,
  type IncidentDefinition,
  type IncidentRuntime,
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
type NpcSpeech = { npcId: NpcDialogueId; text: string; source: "openai" | "fallback"; loading: boolean };
type SafetyQuizView = {
  quiz: SafetyQuizResponse;
  difficulty: SafetyQuizDifficulty;
  quizSequence: number;
  pendingAction: { incidentId: IncidentId; actionId: ActionId };
  loading: boolean;
  selectedOptionId: SafetyQuizOptionId | null;
  status: "answering" | "wrong" | "correct";
};
type CatRescueView = {
  pendingAction: { incidentId: "cat_trapped"; actionId: "rescue_cat" };
  seed: number;
};
type CatRescuePhase = "roaming" | "warning" | "falling" | "success" | "failure";
type BombDefusalView = {
  pendingAction: { incidentId: "suspicious_bomb"; actionId: "defuse_bomb" };
  correctWire: BombWire;
  hint: BombHintResponse;
  attempt: number;
  loading: boolean;
  selectedWire: BombWire | null;
  status: "armed" | "success" | "failure";
};
type StageTransitionView = { completedWave: 1 | 2; snapshot: RescueGameState };
type MapDragState = { pointerId: number; startClientX: number; startOffset: number; renderedWidth: number };

declare global {
  interface Window {
    __PIXEL_PANIC_DEBUG__?: {
      phase: OperationPhase;
      completedIncidents: LegacyIncidentId[];
      missions: ActiveRobotMission[];
      worldSnapshot: ReturnType<typeof deriveWorldSnapshot>;
      game: RescueGameState;
      stageMap: StageMapId;
      npcSpeech: NpcSpeech | null;
      quizHistory: () => { sequence: number; questions: string[] };
      audio: () => ReturnType<PixelPanicAudio["getDebugState"]>;
    };
  }
}

const ASSET = "/assets/pixel-panic";
const QUIZ_HISTORY_STORAGE_KEY = "pixel-panic:safety-quiz-history:v2";
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
  `${ASSET}/ui/minigames/pp_ui_bomb_defusal_case.png`,
  `${ASSET}/ui/portraits/pp_ui_portrait_hq_ai.png`,
  ...ROBOT_IDS.flatMap((robot) => ["ready", "busy"].map((state) => `${ASSET}/ui/portraits/pp_ui_portrait_${robot}_${state}.png`)),
];

const debugEnabled = process.env.NEXT_PUBLIC_ENABLE_TEST_DEBUG === "1";

function legacyWorldState(game: RescueGameState): { phase: OperationPhase; completed: LegacyIncidentId[]; missions: ActiveRobotMission[] } {
  const completed: LegacyIncidentId[] = [];
  if (["resolved", "contained"].includes(game.incidents.bakery_fire.status) && ["resolved", "contained"].includes(game.incidents.house_fire.status)) completed.push("fire");
  if (["resolved", "contained"].includes(game.incidents.bridge_damage.status)) completed.push("bridge");
  if (["resolved", "contained"].includes(game.incidents.cat_trapped.status)) completed.push("cat");
  if (["resolved", "contained"].includes(game.incidents.power_flood.status)) completed.push("generator");
  const missions = ROBOT_IDS.flatMap((robotId): ActiveRobotMission[] => {
    const pending = game.robots[robotId].pendingAction;
    return pending ? [{ robotId, incidentId: pending.incidentId, actionId: pending.actionId }] : [];
  });
  const pending = missions[0];
  if (!pending) return { phase: game.status === "success" ? "complete" : "idle", completed, missions };
  if (pending.actionId === "build_bridge") return { phase: "bridge", completed, missions };
  if (pending.actionId === "rescue_cat" || pending.actionId === "rescue_residents" || pending.actionId === "evacuate" || pending.actionId === "carry_parts") return { phase: "cat", completed, missions };
  if (pending.actionId === "extinguish" || pending.actionId === "firebreak" || pending.actionId === "lower_water") return { phase: "fire", completed, missions };
  return { phase: "generator", completed, missions };
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
  const [safetyQuiz, setSafetyQuiz] = useState<SafetyQuizView | null>(null);
  const [catRescue, setCatRescue] = useState<CatRescueView | null>(null);
  const [bombDefusal, setBombDefusal] = useState<BombDefusalView | null>(null);
  const [stageTransition, setStageTransition] = useState<StageTransitionView | null>(null);
  const [arrivedMissionQueue, setArrivedMissionQueue] = useState<ActiveRobotMission[]>([]);
  const [npcSpeech, setNpcSpeech] = useState<NpcSpeech | null>(null);
  const [actionPopupOpen, setActionPopupOpen] = useState(false);
  const [mapRunIndex, setMapRunIndex] = useState(0);
  const [mapPanX, setMapPanX] = useState(0);
  const [mapDragging, setMapDragging] = useState(false);
  const dialogueAbortRef = useRef<AbortController | null>(null);
  const quizAbortRef = useRef<AbortController | null>(null);
  const bombHintAbortRef = useRef<AbortController | null>(null);
  const askedQuizQuestionsRef = useRef<string[]>([]);
  const quizSequenceRef = useRef(0);
  const quizDispatchTimerRef = useRef<number | null>(null);
  const catRescueAttemptRef = useRef(0);
  const bombDefusalAttemptRef = useRef(0);
  const bombOutcomeTimerRef = useRef<number | null>(null);
  const npcDialogueAbortRef = useRef<AbortController | null>(null);
  const npcDialogueHistoryRef = useRef<string[]>([]);
  const npcSpeechTimerRef = useRef<number | null>(null);
  const mapDragRef = useRef<MapDragState | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const resultTimerRef = useRef<number | null>(null);
  const audioRef = useRef<PixelPanicAudio | null>(null);
  const previousWaveRef = useRef(game.wave);
  const previousResolvedRef = useRef(getResolvedCount(game));
  const previousComboRef = useRef(game.foundCombos.length);
  const previousStatusRef = useRef(game.status);
  const stageMap = useMemo(() => getStageMap(mapRunIndex, game.wave), [game.wave, mapRunIndex]);

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
    try {
      const stored = JSON.parse(window.localStorage.getItem(QUIZ_HISTORY_STORAGE_KEY) ?? "null") as { sequence?: unknown; questions?: unknown } | null;
      if (!stored) return;
      if (Number.isInteger(stored.sequence)) quizSequenceRef.current = Math.min(MAX_SAFETY_QUIZ_SEQUENCE - 1, Math.max(0, stored.sequence as number));
      if (Array.isArray(stored.questions)) {
        askedQuizQuestionsRef.current = stored.questions
          .filter((question): question is string => typeof question === "string" && question.length >= 10 && question.length <= 120)
          .slice(-MAX_EXCLUDED_QUIZ_QUESTIONS);
      }
    } catch {
      window.localStorage.removeItem(QUIZ_HISTORY_STORAGE_KEY);
    }
  }, []);

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
      if (initial.status === "success") {
        initial.completedStageIncidents = ([1, 2, 3] as const).flatMap((wave) => getWaveIncidentIds(wave).map((id) => `${wave}:${id}`));
      }
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
    if (screen !== "play" || paused || safetyQuiz || catRescue || bombDefusal || stageTransition || game.status !== "playing") {
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
  }, [bombDefusal, catRescue, dialogue, game.status, paused, safetyQuiz, screen, stageTransition]);

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
    if (screen !== "play" || !game.selectedIncidentId) return;
    const anchorX = getIncidentPopupPosition(stageMap, game.selectedIncidentId)[0];
    setMapPanX((current) => revealMapAnchor(current, anchorX));
  }, [game.selectedIncidentId, screen, stageMap]);

  useEffect(() => {
    if (screen !== "title" || !soundOn) return;
    const audio = getAudio();
    void audio.startTitleMusic();
    let unlocked = false;
    const unlockTitleMusic = () => {
      if (unlocked) return;
      unlocked = true;
      void audio.startTitleMusic();
      window.removeEventListener("pointerdown", unlockTitleMusic, true);
      window.removeEventListener("keydown", unlockTitleMusic, true);
    };
    window.addEventListener("pointerdown", unlockTitleMusic, { capture: true, once: true });
    window.addEventListener("keydown", unlockTitleMusic, { capture: true, once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockTitleMusic, true);
      window.removeEventListener("keydown", unlockTitleMusic, true);
    };
  }, [getAudio, screen, soundOn]);

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
      missions: visual.missions,
      worldSnapshot: deriveWorldSnapshot(visual.completed),
      game,
      stageMap: stageMap.id,
      npcSpeech,
      quizHistory: () => ({ sequence: quizSequenceRef.current, questions: [...askedQuizQuestionsRef.current] }),
      audio: () => audioRef.current?.getDebugState() ?? { enabled: soundOn, requestedTrack: null, activeTrack: null, musicPlaying: false, contextState: "uninitialized" },
    };
    return () => { delete window.__PIXEL_PANIC_DEBUG__; };
  }, [game, npcSpeech, soundOn, stageMap.id, visual]);

  useEffect(() => () => {
    dialogueAbortRef.current?.abort();
    quizAbortRef.current?.abort();
    bombHintAbortRef.current?.abort();
    npcDialogueAbortRef.current?.abort();
    npcDialogueAbortRef.current = null;
    if (npcSpeechTimerRef.current !== null) window.clearTimeout(npcSpeechTimerRef.current);
    if (quizDispatchTimerRef.current !== null) window.clearTimeout(quizDispatchTimerRef.current);
    if (bombOutcomeTimerRef.current !== null) window.clearTimeout(bombOutcomeTimerRef.current);
    if (resultTimerRef.current !== null) window.clearTimeout(resultTimerRef.current);
    audioRef.current?.dispose();
  }, []);

  const startGame = useCallback(() => {
    dialogueAbortRef.current?.abort();
    quizAbortRef.current?.abort();
    bombHintAbortRef.current?.abort();
    npcDialogueAbortRef.current?.abort();
    npcDialogueAbortRef.current = null;
    if (npcSpeechTimerRef.current !== null) window.clearTimeout(npcSpeechTimerRef.current);
    if (quizDispatchTimerRef.current !== null) window.clearTimeout(quizDispatchTimerRef.current);
    if (bombOutcomeTimerRef.current !== null) window.clearTimeout(bombOutcomeTimerRef.current);
    setDialogue(null);
    setSafetyQuiz(null);
    setCatRescue(null);
    setBombDefusal(null);
    setStageTransition(null);
    setArrivedMissionQueue([]);
    setNpcSpeech(null);
    setActionPopupOpen(false);
    setPaused(false);
    setGameError(null);
    setToast(null);
    setMapPanX(0);
    setMapDragging(false);
    catRescueAttemptRef.current = 0;
    bombDefusalAttemptRef.current = 0;
    npcDialogueHistoryRef.current = [];
    mapDragRef.current = null;
    const initial = createInitialGame();
    previousWaveRef.current = initial.wave;
    previousResolvedRef.current = 0;
    previousComboRef.current = 0;
    previousStatusRef.current = "playing";
    setGame(initial);
    if (game.status !== "playing") setMapRunIndex((current) => current + 1);
    setScreen("play");
    if (soundOn) {
      const audio = getAudio();
      audio.play("dispatch");
      void audio.startMusic();
    }
  }, [game.status, getAudio, soundOn]);

  const openDialogue = useCallback((definition: DialogueEventDefinition, incidentId: IncidentId, actionId: ActionId) => {
    playSound("dialogue");
    npcDialogueAbortRef.current?.abort();
    npcDialogueAbortRef.current = null;
    if (npcSpeechTimerRef.current !== null) window.clearTimeout(npcSpeechTimerRef.current);
    setNpcSpeech(null);
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

  const talkToNpc = useCallback((npcId: NpcDialogueId) => {
    if (paused || dialogue || safetyQuiz || catRescue || bombDefusal || showHelp) return;
    const npc = NPC_DIALOGUES[npcId];
    const excludedDialogues = [...npcDialogueHistoryRef.current];
    const dialogueSequence = excludedDialogues.length + 1;
    const localFallback = fallbackNpcDialogue(npcId, excludedDialogues, dialogueSequence);
    setActionPopupOpen(false);
    playSound("dialogue");
    npcDialogueAbortRef.current?.abort();
    if (npcSpeechTimerRef.current !== null) window.clearTimeout(npcSpeechTimerRef.current);
    const controller = new AbortController();
    npcDialogueAbortRef.current = controller;
    setNpcSpeech({ npcId, text: "", source: "fallback", loading: true });

    const showSpeech = (text: string, source: "openai" | "fallback") => {
      if (npcDialogueAbortRef.current !== controller) return;
      const latestExcludedDialogues = npcDialogueHistoryRef.current;
      const repeated = isNpcDialogueExcluded(text, latestExcludedDialogues);
      const uniqueText = repeated ? fallbackNpcDialogue(npcId, latestExcludedDialogues, dialogueSequence) : text;
      if (isNpcDialogueExcluded(uniqueText, latestExcludedDialogues)) return;
      npcDialogueHistoryRef.current = [...latestExcludedDialogues, uniqueText];
      setNpcSpeech({ npcId, text: uniqueText, source: repeated ? "fallback" : source, loading: false });
      npcSpeechTimerRef.current = window.setTimeout(() => {
        setNpcSpeech((current) => current?.npcId === npcId ? null : current);
      }, 7_000);
    };
    const timeout = window.setTimeout(() => controller.abort(), 5_200);
    void fetch("/api/dialogue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildNpcDialogueRequest(npc, game, { dialogueSequence, excludedDialogues })),
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) return showSpeech(localFallback, "fallback");
      const data = await response.json() as { dialogue?: unknown; source?: unknown };
      if (typeof data.dialogue !== "string" || !data.dialogue.trim() || data.dialogue.length > 160 || isNpcDialogueExcluded(data.dialogue, excludedDialogues) || data.source !== "openai" && data.source !== "fallback") {
        return showSpeech(localFallback, "fallback");
      }
      showSpeech(data.dialogue, data.source);
    }).catch(() => showSpeech(localFallback, "fallback")).finally(() => window.clearTimeout(timeout));
  }, [bombDefusal, catRescue, dialogue, game, paused, playSound, safetyQuiz, showHelp]);

  const closeNpcSpeech = useCallback(() => {
    npcDialogueAbortRef.current?.abort();
    npcDialogueAbortRef.current = null;
    if (npcSpeechTimerRef.current !== null) window.clearTimeout(npcSpeechTimerRef.current);
    setNpcSpeech(null);
  }, []);

  const openSafetyQuiz = useCallback((incidentId: IncidentId, actionId: ActionId, currentGame: RescueGameState) => {
    const action = ACTIONS[actionId];
    const pending = currentGame.robots[action.robotId].pendingAction;
    if (!pending || pending.incidentId !== incidentId || pending.actionId !== actionId) return;
    const excludedQuestions = [...askedQuizQuestionsRef.current];
    const quizSequence = Math.min(MAX_SAFETY_QUIZ_SEQUENCE, quizSequenceRef.current + 1);
    quizSequenceRef.current = quizSequence;
    const randomValues = new Uint32Array(1);
    window.crypto.getRandomValues(randomValues);
    const variationSeed = randomValues[0] & 0x7fffffff;
    const quizRequest = buildSafetyQuizRequest(currentGame, incidentId, actionId, { quizSequence, variationSeed, excludedQuestions });
    const localFallback = fallbackSafetyQuiz(incidentId, { actionId, excludedQuestions, quizSequence, questionFocus: quizRequest.questionFocus, variationSeed });
    quizAbortRef.current?.abort();
    if (quizDispatchTimerRef.current !== null) window.clearTimeout(quizDispatchTimerRef.current);
    const controller = new AbortController();
    quizAbortRef.current = controller;
    setActionPopupOpen(false);
    closeNpcSpeech();
    setSafetyQuiz({ quiz: localFallback, difficulty: quizRequest.difficulty, quizSequence, pendingAction: { incidentId, actionId }, loading: true, selectedOptionId: null, status: "answering" });
    const timeout = window.setTimeout(() => controller.abort(), 5_200);
    void fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quizRequest),
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) return localFallback;
      const data = await response.json() as { source?: unknown };
      const normalized = normalizeSafetyQuiz(data);
      if (!normalized || isSafetyQuizQuestionExcluded(normalized.question, excludedQuestions) || data.source !== "openai" && data.source !== "fallback") return localFallback;
      return { ...normalized, source: data.source } as SafetyQuizResponse;
    }).catch(() => localFallback).then((quiz) => {
      if (quizAbortRef.current !== controller) return;
      const latestExcludedQuestions = askedQuizQuestionsRef.current;
      const uniqueQuiz = isSafetyQuizQuestionExcluded(quiz.question, latestExcludedQuestions)
        ? fallbackSafetyQuiz(incidentId, { actionId, excludedQuestions: latestExcludedQuestions, quizSequence, questionFocus: quizRequest.questionFocus, variationSeed })
        : quiz;
      if (isSafetyQuizQuestionExcluded(uniqueQuiz.question, latestExcludedQuestions)) return;
      askedQuizQuestionsRef.current = [...latestExcludedQuestions, uniqueQuiz.question].slice(-MAX_EXCLUDED_QUIZ_QUESTIONS);
      try {
        window.localStorage.setItem(QUIZ_HISTORY_STORAGE_KEY, JSON.stringify({ sequence: quizSequenceRef.current, questions: askedQuizQuestionsRef.current }));
      } catch {}
      setSafetyQuiz((current) => current?.pendingAction.incidentId === incidentId && current.pendingAction.actionId === actionId
        ? { ...current, quiz: uniqueQuiz, loading: false }
        : current);
    }).finally(() => window.clearTimeout(timeout));
  }, [closeNpcSpeech, playSound]);

  const handleRobotArrive = useCallback((mission: ActiveRobotMission) => {
    setArrivedMissionQueue((current) => current.some((queued) => queued.robotId === mission.robotId && queued.incidentId === mission.incidentId && queued.actionId === mission.actionId)
      ? current
      : [...current, mission]);
  }, []);

  const openCatRescue = useCallback((currentGame: RescueGameState) => {
    const pending = currentGame.robots.buddy.pendingAction;
    if (!pending || pending.incidentId !== "cat_trapped" || pending.actionId !== "rescue_cat") return;
    catRescueAttemptRef.current += 1;
    setActionPopupOpen(false);
    closeNpcSpeech();
    setCatRescue({
      pendingAction: { incidentId: "cat_trapped", actionId: "rescue_cat" },
      seed: currentGame.seed + catRescueAttemptRef.current * 7_919 + Math.floor(Math.random() * 10_000),
    });
  }, [closeNpcSpeech]);

  const openBombDefusal = useCallback((currentGame: RescueGameState) => {
    const pending = currentGame.robots.fix.pendingAction;
    if (!pending || pending.incidentId !== "suspicious_bomb" || pending.actionId !== "defuse_bomb") return;
    bombDefusalAttemptRef.current += 1;
    const attempt = bombDefusalAttemptRef.current;
    const correctWire = pickBombWire(currentGame.seed, attempt);
    const localFallback = fallbackBombHint(correctWire, attempt);
    bombHintAbortRef.current?.abort();
    const controller = new AbortController();
    bombHintAbortRef.current = controller;
    setActionPopupOpen(false);
    closeNpcSpeech();
    playSound("wave");
    setBombDefusal({
      pendingAction: { incidentId: "suspicious_bomb", actionId: "defuse_bomb" },
      correctWire,
      hint: localFallback,
      attempt,
      loading: true,
      selectedWire: null,
      status: "armed",
    });
    const timeout = window.setTimeout(() => controller.abort(), 5_200);
    void fetch("/api/bomb-hint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBombHintRequest(correctWire, attempt, currentGame.incidents.suspicious_bomb.severity)),
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) return localFallback;
      const data = await response.json() as { source?: unknown };
      const normalized = normalizeBombHint(data);
      if (!normalized || data.source !== "openai" && data.source !== "fallback") return localFallback;
      return { ...normalized, source: data.source } as BombHintResponse;
    }).catch(() => localFallback).then((hint) => {
      if (bombHintAbortRef.current !== controller) return;
      setBombDefusal((current) => current?.attempt === attempt ? { ...current, hint, loading: false } : current);
    }).finally(() => window.clearTimeout(timeout));
  }, [closeNpcSpeech, playSound]);

  useEffect(() => {
    if (screen !== "play" || paused || showHelp || safetyQuiz || catRescue || bombDefusal || dialogue || arrivedMissionQueue.length === 0) return;
    const mission = arrivedMissionQueue[0];
    setArrivedMissionQueue((current) => current.slice(1));
    if (mission.incidentId === "cat_trapped" && mission.actionId === "rescue_cat") openCatRescue(game);
    else if (mission.incidentId === "suspicious_bomb" && mission.actionId === "defuse_bomb") openBombDefusal(game);
    else openSafetyQuiz(mission.incidentId, mission.actionId, game);
  }, [arrivedMissionQueue, bombDefusal, catRescue, dialogue, game, openBombDefusal, openCatRescue, openSafetyQuiz, paused, safetyQuiz, screen, showHelp]);

  const requestAction = useCallback((actionId: ActionId) => {
    const incidentId = game.selectedIncidentId;
    if (!incidentId) return setToast("먼저 지도에서 사고를 선택하세요.");
    const action = ACTIONS[actionId];
    const event = dialogueForAction(game, incidentId, actionId, action.robotId);
    if (event) {
      setActionPopupOpen(false);
      return openDialogue(event, incidentId, actionId);
    }
    const result = startAction(game, incidentId, actionId);
    if (!result.ok) {
      playSound("failure");
      return setToast(result.error ?? "출동할 수 없습니다.");
    }
    playSound("dispatch");
    setActionPopupOpen(false);
    setGame(result.state);
  }, [game, openDialogue, playSound]);

  const chooseDialogue = useCallback((choiceId: string) => {
    if (!dialogue) return;
    dialogueAbortRef.current?.abort();
    const decided = applyDialogueChoice(game, dialogue.definition.id, choiceId);
    setDialogue(null);
    const result = startAction(decided, dialogue.pendingAction.incidentId, dialogue.pendingAction.actionId);
    if (!result.ok) {
      playSound("failure");
      setToast(result.error ?? "출동할 수 없습니다.");
      setGame(decided);
      return;
    }
    playSound("dispatch");
    setGame(result.state);
  }, [dialogue, game, playSound]);

  const answerSafetyQuiz = useCallback((optionId: SafetyQuizOptionId) => {
    if (!safetyQuiz || safetyQuiz.loading || safetyQuiz.status === "correct") return;
    if (optionId !== safetyQuiz.quiz.correctOptionId) {
      playSound("failure");
      setSafetyQuiz((current) => current ? { ...current, selectedOptionId: optionId, status: "wrong" } : current);
      return;
    }
    playSound("success");
    setSafetyQuiz((current) => current ? { ...current, selectedOptionId: optionId, status: "correct" } : current);
    const pending = safetyQuiz.pendingAction;
    quizDispatchTimerRef.current = window.setTimeout(() => {
      setGame((current) => {
        const robotId = ACTIONS[pending.actionId].robotId;
        const result = resolveActionWithSafetyQuiz(current, robotId, pending.incidentId, pending.actionId);
        if (!result.ok) setToast(result.error ?? "현장을 해결할 수 없습니다.");
        return result.state;
      });
      setSafetyQuiz(null);
      playSound("resolve");
    }, 750);
  }, [playSound, safetyQuiz]);

  const finishCatRescue = useCallback((caught: boolean) => {
    setGame((current) => {
      const result = caught ? resolveCatRescueMinigame(current) : failCatRescueMinigame(current);
      if (!result.ok) setToast(result.error ?? "고양이 구조 결과를 반영할 수 없습니다.");
      return result.state;
    });
    setCatRescue(null);
    playSound(caught ? "resolve" : "failure");
    setToast(caught ? "쿠션 캐치 성공! 고양이를 안전하게 구조했습니다." : "쿠션을 놓쳤습니다. 고양이 구조에 다시 도전하세요.");
  }, [playSound]);

  const cutBombWire = useCallback((wire: BombWire) => {
    if (!bombDefusal || bombDefusal.loading || bombDefusal.status !== "armed") return;
    const success = wire === bombDefusal.correctWire;
    bombHintAbortRef.current?.abort();
    setBombDefusal((current) => current ? { ...current, selectedWire: wire, status: success ? "success" : "failure" } : current);
    playSound(success ? "success" : "failure");
    if (bombOutcomeTimerRef.current !== null) window.clearTimeout(bombOutcomeTimerRef.current);
    bombOutcomeTimerRef.current = window.setTimeout(() => {
      setGame((current) => {
        const result = success ? resolveBombDefusalMinigame(current) : failBombDefusalMinigame(current);
        if (!result.ok) setToast(result.error ?? "폭탄 해체 결과를 반영할 수 없습니다.");
        return result.state;
      });
      setBombDefusal(null);
      if (success) playSound("resolve");
      setToast(success ? "본부 AI 힌트 판독 성공! 폭탄을 안전하게 해체했습니다." : "잘못된 회로였습니다. 안전 장치가 작동했으니 다시 도전하세요.");
      bombOutcomeTimerRef.current = null;
    }, 1_050);
  }, [bombDefusal, playSound]);

  useEffect(() => {
    if (screen !== "play" || stageTransition || paused || showHelp || dialogue || safetyQuiz || catRescue || bombDefusal) return;
    if (!canAdvanceToNextWave(game)) return;
    const completedWave = game.wave as 1 | 2;
    npcDialogueAbortRef.current?.abort();
    npcDialogueAbortRef.current = null;
    if (npcSpeechTimerRef.current !== null) window.clearTimeout(npcSpeechTimerRef.current);
    setNpcSpeech(null);
    setActionPopupOpen(false);
    setStageTransition({ completedWave, snapshot: game });
  }, [bombDefusal, catRescue, dialogue, game, paused, safetyQuiz, screen, showHelp, stageTransition]);

  const continueToNextStage = useCallback(() => {
    if (!stageTransition) return;
    setGame((current) => advanceToNextWave(current));
    setStageTransition(null);
    setActionPopupOpen(false);
    setMapPanX(0);
    playSound("button");
  }, [playSound, stageTransition]);

  const toggleSound = useCallback(() => {
    const next = !soundOn;
    setSoundOn(next);
    const audio = getAudio();
    audio.setEnabled(next);
    if (next) {
      audio.play("button");
      if (screen === "title") void audio.startTitleMusic();
      else if (screen === "play" && !paused && game.status === "playing") void audio.startMusic();
    }
  }, [game.status, getAudio, paused, screen, soundOn]);

  const chooseIncident = useCallback((id: IncidentId) => {
    playSound("select");
    setActionPopupOpen(false);
    setGame((current) => selectIncident(current, id));
  }, [playSound]);

  const chooseRobot = useCallback((id: RobotId) => {
    playSound("button");
    closeNpcSpeech();
    setGame((current) => selectRobot(current, id));
    setActionPopupOpen(true);
  }, [closeNpcSpeech, playSound]);

  const pauseGame = useCallback(() => {
    playSound("button");
    getAudio().stopMusic(true);
    setActionPopupOpen(false);
    setPaused(true);
  }, [getAudio, playSound]);

  const resumeGame = useCallback(() => {
    setPaused(false);
    playSound("button");
    if (soundOn) void getAudio().startMusic();
  }, [getAudio, playSound, soundOn]);

  const openHelp = useCallback(() => {
    playSound("button");
    setActionPopupOpen(false);
    setShowHelp(true);
  }, [playSound]);

  const closeHelp = useCallback(() => {
    playSound("button");
    setShowHelp(false);
  }, [playSound]);

  const confirmHelp = useCallback(() => {
    playSound("button");
    dialogueAbortRef.current?.abort();
    quizAbortRef.current?.abort();
    npcDialogueAbortRef.current?.abort();
    npcDialogueAbortRef.current = null;
    if (npcSpeechTimerRef.current !== null) window.clearTimeout(npcSpeechTimerRef.current);
    setDialogue(null);
    setSafetyQuiz(null);
    setCatRescue(null);
    setArrivedMissionQueue([]);
    setNpcSpeech(null);
    setActionPopupOpen(false);
    setPaused(false);
    setShowHelp(false);
    setScreen("title");
    if (screen !== "title") getAudio().stopMusic();
  }, [getAudio, playSound, screen]);

  const beginMapDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || paused || dialogue || safetyQuiz || catRescue || bombDefusal || showHelp) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    mapDragRef.current = { pointerId: event.pointerId, startClientX: event.clientX, startOffset: mapPanX, renderedWidth: bounds.width };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    setMapDragging(true);
  }, [bombDefusal, catRescue, dialogue, mapPanX, paused, safetyQuiz, showHelp]);

  const moveMapDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = mapDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setMapPanX(mapPanFromPointerDelta(drag.startOffset, event.clientX - drag.startClientX, drag.renderedWidth));
    event.preventDefault();
  }, []);

  const endMapDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (mapDragRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    mapDragRef.current = null;
    setMapDragging(false);
  }, []);

  const moveMapWithKeyboard = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const delta = event.key === "ArrowLeft" ? 64 : event.key === "ArrowRight" ? -64 : 0;
    if (!delta) return;
    event.preventDefault();
    setMapPanX((current) => clampMapPanX(current + delta));
  }, []);

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
            stageMap={stageMap}
            mapPanX={mapPanX}
            npcSpeech={npcSpeech}
            actionPopupOpen={actionPopupOpen}
            paused={paused}
            soundOn={soundOn}
            gameError={gameError}
            toast={toast}
            onIncident={chooseIncident}
            onRobot={chooseRobot}
            onAction={requestAction}
            onNpc={talkToNpc}
            onCloseNpc={closeNpcSpeech}
            onCloseActions={() => setActionPopupOpen(false)}
            onPause={pauseGame}
            onSound={toggleSound}
            onHelp={openHelp}
            onGameError={setGameError}
            onRobotArrive={handleRobotArrive}
          />
        )}
        {screen === "result" && <ResultScreen game={game} onRetry={startGame} onTitle={() => setScreen("title")} />}

        {game.briefingMs > 0 && screen === "play" && <WaveBriefing wave={game.wave} />}
        {stageTransition && screen === "play" && <StageNewsTransition view={stageTransition} onContinue={continueToNextStage} />}
        {game.comboBanner && screen === "play" && <div className="combo-banner"><small>PERFECT COMBO</small><strong>{game.comboBanner}</strong><span>+150</span></div>}
        {dialogue && screen === "play" && <DialogueModal view={dialogue} incidentPosition={stageMap.incidentPositions[dialogue.pendingAction.incidentId]} mapPanX={mapPanX} onChoose={chooseDialogue} />}
        {safetyQuiz && screen === "play" && <SafetyQuizModal view={safetyQuiz} onAnswer={answerSafetyQuiz} />}
        {catRescue && screen === "play" && <CatRescueMinigameModal view={catRescue} onOutcome={finishCatRescue} onWarning={() => playSound("wave")} />}
        {bombDefusal && screen === "play" && <BombDefusalMinigameModal view={bombDefusal} onCut={cutBombWire} />}
        {screen === "play" && (
          <>
            <div
              className={`map-drag-surface ${mapDragging ? "is-dragging" : ""}`}
              role="region"
              aria-label="지도 이동 영역. 마우스로 드래그하거나 좌우 방향키로 이동하세요."
              tabIndex={0}
              data-map-pan-x={mapPanX}
              onPointerDown={beginMapDrag}
              onPointerMove={moveMapDrag}
              onPointerUp={endMapDrag}
              onPointerCancel={endMapDrag}
              onLostPointerCapture={() => { mapDragRef.current = null; setMapDragging(false); }}
              onKeyDown={moveMapWithKeyboard}
            />
            <div className="map-pan-hint" aria-hidden="true"><span>↔</span> 지도를 드래그해 탐색</div>
          </>
        )}
        {paused && screen === "play" && (
          <Modal title="작전 일시정지" onClose={resumeGame}>
            <p>모든 사고와 로봇 타이머가 멈췄습니다.</p>
            <div className="modal-actions"><PixelButton onClick={resumeGame}>계속하기</PixelButton><PixelButton variant="danger" onClick={() => { playSound("failure"); getAudio().stopMusic(); setGame((current) => abandonGame(current)); setPaused(false); }}>작전 포기</PixelButton></div>
          </Modal>
        )}
        {showHelp && (
          <Modal title="클릭 구조 매뉴얼" onClose={closeHelp} dismissible={false}>
            <ol className="how-to-list"><li><b>1</b><span>지도 빈 공간을 좌우로 드래그해 가려진 지역을 살펴봅니다.</span></li><li><b>2</b><span>주민 머리 위 말풍선 아이콘을 클릭하면 AI 대화를 들을 수 있습니다.</span></li><li><b>3</b><span>지도나 왼쪽 목록에서 사고와 구조 로봇의 행동을 선택합니다.</span></li><li><b>4</b><span>현장 도착 후 AI 안전 퀴즈를 풀고, 매 스테이지의 고양이 구조와 폭탄 해체 미니게임에 도전합니다.</span></li></ol>
            <PixelButton onClick={confirmHelp}>확인</PixelButton>
          </Modal>
        )}
      </StageViewport>
    </main>
  );
}

function GameScreen({ game, visual, stageMap, mapPanX, npcSpeech, actionPopupOpen, paused, soundOn, gameError, toast, onIncident, onRobot, onAction, onNpc, onCloseNpc, onCloseActions, onPause, onSound, onHelp, onGameError, onRobotArrive }: {
  game: RescueGameState;
  visual: { phase: OperationPhase; completed: LegacyIncidentId[]; missions: ActiveRobotMission[] };
  stageMap: StageMapDefinition;
  mapPanX: number;
  npcSpeech: NpcSpeech | null;
  actionPopupOpen: boolean;
  paused: boolean;
  soundOn: boolean;
  gameError: string | null;
  toast: string | null;
  onIncident: (id: IncidentId) => void;
  onRobot: (id: RobotId) => void;
  onAction: (id: ActionId) => void;
  onNpc: (id: NpcDialogueId) => void;
  onCloseNpc: () => void;
  onCloseActions: () => void;
  onPause: () => void;
  onSound: () => void;
  onHelp: () => void;
  onGameError: (message: string) => void;
  onRobotArrive: (mission: ActiveRobotMission) => void;
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
    <section className="game-screen" aria-label="PIXEL PANIC 클릭 구조 작전" data-wave={game.wave} data-stage-map={stageMap.id} data-status={game.status} data-resolved={resolvedCount}>
      <GameCanvas phase={visual.phase} completedIncidents={visual.completed} missions={visual.missions} stageMap={stageMap} panX={mapPanX} onError={onGameError} onRobotArrive={onRobotArrive} />
      <header className="top-hud pixel-panel">
        <div className="hud-brand"><img src={`${ASSET}/brand/pp_brand_logo_mark.png`} alt="" /><span><strong>PIXEL PANIC</strong><small>CLICK RESCUE OPS</small></span></div>
        <HudStat icon="timer" label="남은 시간" value={formatGameTime(game.remainingMs)} emphasized />
        <HudStat icon="village_hp" label="마을 보존" value={`${game.villagePreservation}%`} />
        <HudStat icon="incident_count" label="해결 임무" value={`${resolvedCount}/${TOTAL_STAGE_INCIDENTS}`} />
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
              <button className={`incident-row ${active ? "active" : ""} ${resolved ? "is-resolved" : ""}`} key={incident.id} data-incident-row={incident.id} onClick={() => onIncident(incident.id)}>
                <img src={`${ASSET}/ui/icons/pp_ui_icon_incident_${incident.icon}.png`} alt="" />
                <span><strong>{incident.label}</strong><small>{resolved ? "해결 완료" : runtime.status === "warning" ? "확산 경고" : `확산 ${Math.ceil(runtime.remainingSpreadMs / 1_000)}초`}</small><i><b style={{ width: `${Math.min(100, runtime.severity / incident.maxSeverity * 100)}%` }} /></i></span>
                <em>{resolved ? "✓" : runtime.severity}</em>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="map-hotspots" style={{ transform: `translate3d(${mapPanX}px, 0, 0)` }} aria-label="사고 지도" data-map-pan-x={mapPanX}>
        {visible.filter((incident) => !["resolved", "contained"].includes(game.incidents[incident.id].status)).map((incident) => {
          const runtime = game.incidents[incident.id];
          const popupPosition = getIncidentPopupPosition(stageMap, incident.id);
          return (
            <button
              key={incident.id}
              className={`incident-pin ${runtime.status} ${game.selectedIncidentId === incident.id ? "selected" : ""}`}
              style={{ left: popupPosition[0], top: stageMapScreenY(popupPosition[1]) }}
              data-incident-id={incident.id}
              onClick={() => onIncident(incident.id)}
              aria-label={`${incident.label}, 위험도 ${runtime.severity}`}
            >
              <img src={`${ASSET}/ui/icons/pp_ui_icon_incident_${incident.icon}.png`} alt="" /><span>{incident.shortLabel}</span><i>{Math.ceil(runtime.remainingSpreadMs / 1_000)}</i>
            </button>
          );
        })}
      </div>

      <div className="npc-hotspots" style={{ transform: `translate3d(${mapPanX}px, 0, 0)` }} aria-label="대화 가능한 주민" data-map-pan-x={mapPanX}>
        {NPC_DIALOGUE_IDS.map((npcId) => {
          const npc = NPC_DIALOGUES[npcId];
          return (
            <button
              key={npcId}
              className={`npc-hotspot ${npcSpeech?.npcId === npcId ? "is-speaking" : ""}`}
              style={{ left: stageMap.npcPositions[npcId][0], top: stageMapScreenY(stageMap.npcPositions[npcId][1]) - 62 }}
              data-npc-id={npcId}
              onClick={() => onNpc(npcId)}
              aria-label={`${npc.name}에게 말 걸기, ${npc.role}`}
              title={`${npc.name} · ${npc.role}`}
            >
              <span aria-hidden="true">···</span>
            </button>
          );
        })}
      </div>
      {npcSpeech && !npcSpeech.loading && <NpcSpeechBubble speech={npcSpeech} npcPosition={stageMap.npcPositions[npcSpeech.npcId]} mapPanX={mapPanX} onClose={onCloseNpc} />}

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

      {actionPopupOpen && selected && selectedRuntime && selectedRobot && (
        <ActionPopup
          incident={selected}
          runtime={selectedRuntime}
          progress={selectedProgress}
          robotId={selectedRobot}
          actions={actions}
          robotBusy={game.robots[selectedRobot].status !== "idle"}
          onAction={onAction}
          onClose={onCloseActions}
        />
      )}

      <footer className="operation-dock pixel-command">
        <section className="mission-log"><strong>작전 로그</strong>{game.logs.slice(-3).map((log) => <span className={log.tone} key={log.id}>› {log.message}</span>)}</section>
      </footer>

      {toast && <div className="toast" role="status">{toast}</div>}
      {gameError && <div className="graphics-warning" role="status">그래픽 일부를 불러오지 못했지만 게임은 계속됩니다.</div>}
      {paused && <div className="pause-dim" />}
    </section>
  );
}

function ActionPopup({ incident, runtime, progress, robotId, actions, robotBusy, onAction, onClose }: {
  incident: IncidentDefinition;
  runtime: IncidentRuntime;
  progress: number;
  robotId: RobotId;
  actions: ActionDefinition[];
  robotBusy: boolean;
  onAction: (id: ActionId) => void;
  onClose: () => void;
}) {
  const meta = ROBOT_META[robotId];
  const top = { aqua: 92, fix: 148, buddy: 204 }[robotId];
  return (
    <>
      <button className="action-popup-scrim" onClick={onClose} aria-label="행동 선택 팝업 닫기" />
      <section className={`action-popup pixel-command ${meta.color}`} style={{ top }} role="dialog" aria-modal="false" aria-labelledby="action-popup-title" data-action-popup={robotId}>
        <button className="action-popup-close" onClick={onClose} aria-label="행동 선택 닫기">×</button>
        <header>
          <img src={`${ASSET}/ui/portraits/pp_ui_portrait_${robotId}_${robotBusy ? "busy" : "ready"}.png`} alt="" />
          <span><small>ROBOT COMMAND</small><strong id="action-popup-title">{meta.name} 행동 선택</strong><em>{meta.role}</em></span>
        </header>
        <div className="action-popup-incident">
          <span className={`severity severity-${runtime.severity}`}>위험 {runtime.severity}</span>
          <strong>{incident.label}</strong>
          <small>해결 진행 {progress}% · {runtime.status === "warning" ? "확산 전 선행 조치 가능" : `다음 확산까지 ${Math.ceil(runtime.remainingSpreadMs / 1_000)}초`}</small>
        </div>
        <div className="action-popup-buttons">
          {actions.map((action) => (
            <button key={action.id} disabled={robotBusy} onClick={() => onAction(action.id)}>
              <span><b>{action.label}</b><em>{Math.ceil(action.durationMs / 1_000)}초</em></span>
              <small>{action.description}</small>
            </button>
          ))}
          {actions.length === 0 && <p>이 현장에서 {meta.name}이 수행할 수 있는 행동이 없습니다.</p>}
        </div>
      </section>
    </>
  );
}

function NpcSpeechBubble({ speech, npcPosition, mapPanX, onClose }: { speech: NpcSpeech; npcPosition: StagePoint; mapPanX: number; onClose: () => void }) {
  const npc = NPC_DIALOGUES[speech.npcId];
  const anchorX = npcPosition[0] + mapPanX;
  const anchorY = stageMapScreenY(npcPosition[1]);
  const width = 306;
  const left = Math.max(270, Math.min(984 - width - 12, anchorX - width / 2));
  const top = Math.max(82, anchorY - 174);
  const pointerX = Math.max(34, Math.min(width - 34, anchorX - left));
  const style = { left, top, "--npc-pointer-x": `${pointerX}px` } as React.CSSProperties;
  return (
    <aside className="npc-speech" style={style} role="status" aria-live="polite" data-npc-speech={speech.npcId} data-dialogue-source={speech.source}>
      <button className="npc-speech-close" onClick={onClose} aria-label="주민 말풍선 닫기">×</button>
      <span className="npc-avatar" style={{ backgroundImage: `url(${ASSET}/characters/npcs/pp_char_npc_${npc.spriteId}_idle.png)` }} aria-hidden="true" />
      <span className="npc-speech-copy">
        <span><b>{npc.name}</b><small>{npc.role}</small><em className={speech.source}>{speech.source === "openai" ? "GPT LIVE" : "LOCAL SAFE"}</em></span>
        <p>{speech.text}</p>
      </span>
    </aside>
  );
}

function SafetyQuizModal({ view, onAnswer }: { view: SafetyQuizView; onAnswer: (optionId: SafetyQuizOptionId) => void }) {
  const incident = INCIDENTS[view.pendingAction.incidentId];
  const action = ACTIONS[view.pendingAction.actionId];
  const robot = ROBOT_META[action.robotId];
  return (
    <div className="modal-backdrop safety-quiz-backdrop" role="presentation">
      <section
        className={`safety-quiz-card pixel-panel ${view.status}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="safety-quiz-title"
        data-safety-quiz={view.pendingAction.incidentId}
        data-quiz-source={view.loading ? "loading" : view.quiz.source}
        data-quiz-status={view.status}
        data-quiz-difficulty={view.difficulty}
        data-qa-correct-option={debugEnabled ? view.quiz.correctOptionId : undefined}
      >
        <header>
          <img src={`${ASSET}/ui/portraits/pp_ui_portrait_${action.robotId}_busy.png`} alt="" />
          <span><small>AI SAFETY CHECK · {robot.name} 현장 도착</small><h2 id="safety-quiz-title">{incident.label} 안전 퀴즈</h2><em>{view.quizSequence}번 문제 · {view.difficulty === "hard" ? "고급" : view.difficulty === "medium" ? "중급" : "초급"} · {action.label} 전 최종 확인</em></span>
          <b className={view.loading ? "loading" : view.quiz.source}>{view.loading ? "GPT CONNECT" : view.quiz.source === "openai" ? "GPT LIVE" : "LOCAL SAFE"}</b>
        </header>
        {view.loading ? (
          <div className="safety-quiz-loading" role="status" aria-live="polite"><i /><strong>현장 상황에 맞는 문제를 만들고 있습니다</strong><span>잠시만 기다려주세요. 이 동안 작전 시간은 멈춥니다.</span></div>
        ) : (
          <>
            <p className="safety-quiz-question">{view.quiz.question}</p>
            <div className="safety-quiz-options" aria-label="안전 퀴즈 보기">
              {view.quiz.options.map((option) => {
                const selectedWrong = view.status === "wrong" && view.selectedOptionId === option.id;
                const selectedCorrect = view.status === "correct" && view.selectedOptionId === option.id;
                return <button key={option.id} className={`${selectedWrong ? "is-wrong" : ""} ${selectedCorrect ? "is-correct" : ""}`} disabled={view.status === "correct"} data-quiz-option={option.id} onClick={() => onAnswer(option.id)}><b>{option.id.toUpperCase()}</b><span>{option.label}</span></button>;
              })}
            </div>
            {view.status === "wrong" && <div className="safety-quiz-feedback wrong" role="alert"><strong>다시 생각해보세요!</strong><span>{view.quiz.explanation}</span></div>}
            {view.status === "correct" && <div className="safety-quiz-feedback correct" role="status"><strong>정답입니다! 현장 해결 중</strong><span>{view.quiz.explanation}</span></div>}
            {view.status === "answering" && <small className="safety-quiz-tip">정답을 선택하면 로봇이 장애 상황을 해결합니다.</small>}
          </>
        )}
      </section>
    </div>
  );
}

function CatRescueMinigameModal({ view, onOutcome, onWarning }: { view: CatRescueView; onOutcome: (caught: boolean) => void; onWarning: () => void }) {
  const [phase, setPhase] = useState<CatRescuePhase>("roaming");
  const [catX, setCatX] = useState(() => getRoamingCatX(view.seed, 0));
  const [catY, setCatY] = useState(31);
  const [robotX, setRobotX] = useState(50);
  const phaseRef = useRef<CatRescuePhase>("roaming");
  const robotXRef = useRef(50);
  const holdTimerRef = useRef<number | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);

  const updateRobotX = useCallback((next: number | ((current: number) => number)) => {
    setRobotX((current) => {
      const value = clampCatRobotX(typeof next === "function" ? next(current) : next);
      robotXRef.current = value;
      return value;
    });
  }, []);

  const moveRobot = useCallback((direction: -1 | 1) => {
    if (phaseRef.current === "success" || phaseRef.current === "failure") return;
    updateRobotX((current) => current + direction * CAT_ROBOT_STEP);
  }, [updateRobotX]);

  const stopHolding = useCallback(() => {
    if (holdTimerRef.current !== null) window.clearInterval(holdTimerRef.current);
    holdTimerRef.current = null;
  }, []);

  const startHolding = useCallback((direction: -1 | 1) => {
    stopHolding();
    moveRobot(direction);
    holdTimerRef.current = window.setInterval(() => moveRobot(direction), 85);
  }, [moveRobot, stopHolding]);

  useEffect(() => {
    cardRef.current?.focus();
    phaseRef.current = "roaming";
    robotXRef.current = 50;
    setRobotX(50);
    setPhase("roaming");
    setCatY(31);
    const startedAt = performance.now();
    const roamDuration = getCatRoamDuration(view.seed);
    const fallX = getRoamingCatX(view.seed, roamDuration);
    let animationFrame = 0;
    let outcomeTimer: number | null = null;
    let warningPlayed = false;

    const setPhaseNow = (next: CatRescuePhase) => {
      if (phaseRef.current === next) return;
      phaseRef.current = next;
      setPhase(next);
    };

    const animate = (now: number) => {
      const elapsed = now - startedAt;
      if (elapsed < roamDuration) {
        setCatX(getRoamingCatX(view.seed, elapsed));
      } else if (elapsed < roamDuration + CAT_WARNING_MS) {
        setCatX(fallX);
        setPhaseNow("warning");
        if (!warningPlayed) {
          warningPlayed = true;
          onWarning();
        }
      } else {
        setPhaseNow("falling");
        setCatX(fallX);
        const progress = Math.min(1, (elapsed - roamDuration - CAT_WARNING_MS) / CAT_FALL_MS);
        setCatY(getFallingCatY(progress));
        if (progress >= 1) {
          const caught = isCatCaught(fallX, robotXRef.current);
          setPhaseNow(caught ? "success" : "failure");
          setCatY(caught ? 67 : 83);
          outcomeTimer = window.setTimeout(() => onOutcome(caught), 1_250);
          return;
        }
      }
      animationFrame = window.requestAnimationFrame(animate);
    };
    animationFrame = window.requestAnimationFrame(animate);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      if (outcomeTimer !== null) window.clearTimeout(outcomeTimer);
      stopHolding();
    };
  }, [onOutcome, onWarning, stopHolding, view.seed]);

  const moveToPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (phaseRef.current === "success" || phaseRef.current === "failure") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    updateRobotX((event.clientX - bounds.left) / bounds.width * 100);
  };

  const statusText = phase === "roaming"
    ? "고양이 아래로 BUDDY를 이동하세요"
    : phase === "warning"
      ? "위험! 1초 뒤 고양이가 떨어집니다"
      : phase === "falling"
        ? "지금 쿠션으로 받아내세요!"
        : phase === "success"
          ? "구조 성공! 고양이를 안전하게 받았습니다"
          : "구조 실패! 쿠션 위치를 놓쳤습니다";

  return (
    <div className="modal-backdrop cat-rescue-backdrop" role="presentation">
      <section
        ref={cardRef}
        className={`cat-rescue-card pixel-alert phase-${phase}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cat-rescue-title"
        tabIndex={0}
        data-cat-rescue="cat_trapped"
        data-cat-phase={phase}
        data-cat-x={catX.toFixed(2)}
        data-robot-x={robotX.toFixed(2)}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            moveRobot(event.key === "ArrowLeft" ? -1 : 1);
          }
        }}
      >
        <header>
          <img src={`${ASSET}/ui/icons/pp_ui_icon_incident_cat.png`} alt="" />
          <span><small>RESCUE MINI GAME · BUDDY 현장 도착</small><h2 id="cat-rescue-title">옥상 고양이 쿠션 캐치</h2></span>
          <b className={phase}>{phase === "roaming" ? "READY" : phase === "warning" ? "1 SEC" : phase === "falling" ? "CATCH!" : phase.toUpperCase()}</b>
        </header>
        <div
          className="cat-rescue-field"
          style={{ "--cat-x": catX, "--cat-y": catY, "--robot-x": robotX } as React.CSSProperties}
          onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); moveToPointer(event); }}
          onPointerMove={(event) => event.currentTarget.hasPointerCapture(event.pointerId) && moveToPointer(event)}
          onPointerUp={(event) => event.currentTarget.hasPointerCapture(event.pointerId) && event.currentTarget.releasePointerCapture(event.pointerId)}
        >
          <span className={`cat-rescue-drop-guide ${phase === "warning" || phase === "falling" ? "visible" : ""}`} aria-hidden="true" />
          {phase === "warning" && <span className="cat-rescue-warning" aria-hidden="true">!</span>}
          <span className={`cat-rescue-cat ${phase}`} aria-hidden="true" />
          <span className={`cat-rescue-robot ${phase}`} aria-hidden="true"><i /></span>
          {(phase === "success" || phase === "failure") && <div className={`cat-rescue-result ${phase}`} role="status"><strong>{phase === "success" ? "PERFECT CATCH!" : "MISS!"}</strong><span>{phase === "success" ? "푹신한 쿠션으로 안전하게 구조했어요" : "고양이는 낮은 차양에 착지했어요 · 재도전 필요"}</span></div>}
        </div>
        <div className="cat-rescue-command">
          <button
            aria-label="BUDDY 왼쪽 이동"
            onPointerDown={() => startHolding(-1)}
            onPointerUp={stopHolding}
            onPointerCancel={stopHolding}
            onPointerLeave={stopHolding}
          >◀</button>
          <p className={phase} aria-live="assertive"><strong>{statusText}</strong><span>아래 구조 구역을 클릭·드래그하거나 좌우 버튼을 누르세요</span></p>
          <button
            aria-label="BUDDY 오른쪽 이동"
            onPointerDown={() => startHolding(1)}
            onPointerUp={stopHolding}
            onPointerCancel={stopHolding}
            onPointerLeave={stopHolding}
          >▶</button>
        </div>
      </section>
    </div>
  );
}

function BombDefusalMinigameModal({ view, onCut }: { view: BombDefusalView; onCut: (wire: BombWire) => void }) {
  const statusLabel = view.loading ? "AI LINK" : view.status === "armed" ? "SIGNAL READY" : view.status === "success" ? "SAFE" : "RETRY";
  return (
    <div className="modal-backdrop bomb-defusal-backdrop" role="presentation">
      <section
        className={`bomb-defusal-card pixel-alert ${view.status}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bomb-defusal-title"
        data-bomb-defusal="suspicious_bomb"
        data-bomb-status={view.status}
        data-bomb-hint-source={view.loading ? "loading" : view.hint.source}
        data-qa-correct-wire={debugEnabled ? view.correctWire : undefined}
      >
        <header>
          <img src={`${ASSET}/ui/icons/pp_ui_icon_incident_bomb.png`} alt="" />
          <span><small>DEFUSAL MINI GAME · FIX 현장 도착</small><h2 id="bomb-defusal-title">본부 AI 무전 · 폭탄 해체</h2></span>
          <b className={`${view.loading ? "loading" : ""} ${view.status}`}>{statusLabel}</b>
        </header>
        <div className="bomb-radio-row" aria-live="polite">
          <img src={`${ASSET}/ui/portraits/pp_ui_portrait_hq_ai.png`} alt="본부 AI 루나" />
          <div className={`bomb-radio-bubble ${view.loading ? "loading" : ""}`}>
            <span><strong>본부 AI · 루나</strong><em className={view.loading ? "loading" : view.hint.source}>{view.loading ? "주파수 분석 중" : view.hint.source === "openai" ? "GPT LIVE" : "LOCAL SAFE"}</em></span>
            <p>{view.loading ? "현장 회로 신호를 읽고 있어요… 잠시만 기다려주세요." : view.hint.hint}</p>
          </div>
        </div>
        <div className={`bomb-defusal-field ${view.status}`}>
          <span className="bomb-signal-pulse" aria-hidden="true" />
          {(["red", "blue"] as const).map((wire) => (
            <button
              key={wire}
              type="button"
              className={`bomb-wire ${wire} ${view.selectedWire === wire ? "selected is-cut" : ""}`}
              disabled={view.loading || view.status !== "armed"}
              data-bomb-wire={wire}
              aria-label={`${wire === "red" ? "빨간" : "파란"} 전선 자르기`}
              onClick={() => onCut(wire)}
            >
              <i aria-hidden="true" />
              <span><b>✂</b>{wire === "red" ? "빨간선" : "파란선"}</span>
            </button>
          ))}
          {view.status !== "armed" && (
            <div className={`bomb-defusal-result ${view.status}`} role="status">
              <strong>{view.status === "success" ? "CIRCUIT SAFE!" : "WRONG WIRE!"}</strong>
              <span>{view.status === "success" ? "본부 AI와 주파수가 일치했습니다" : "안전 장치 작동 · 폭발 없이 재시도합니다"}</span>
            </div>
          )}
        </div>
        <footer><strong>무전 힌트를 해독하고 전선을 마우스로 클릭하세요</strong><span>시도 {view.attempt} · 정답은 매번 달라집니다</span></footer>
      </section>
    </div>
  );
}

function DialogueModal({ view, incidentPosition, mapPanX, onChoose }: { view: DialogueView; incidentPosition: StagePoint; mapPanX: number; onChoose: (choiceId: string) => void }) {
  const robot = view.definition.speaker === "주민" ? "buddy" : view.definition.speaker.toLowerCase();
  const [baseIncidentX, baseIncidentY] = incidentPosition;
  const incidentY = stageMapScreenY(baseIncidentY);
  const incidentX = baseIncidentX + mapPanX;
  const leftSpace = incidentX - 256;
  const rightSpace = 984 - incidentX;
  let pointerSide: "left" | "right" | "top" | "bottom";
  let left: number;
  let top: number;
  if (rightSpace >= 580) {
    pointerSide = "left";
    left = incidentX + 60;
    top = Math.max(80, Math.min(454, incidentY - 110));
  } else if (leftSpace >= 580) {
    pointerSide = "right";
    left = incidentX - 580;
    top = Math.max(80, Math.min(454, incidentY - 110));
  } else {
    const placeBelow = incidentY + 305 <= 710;
    pointerSide = placeBelow ? "top" : "bottom";
    left = Math.max(278, Math.min(440, incidentX - 260));
    top = placeBelow ? incidentY + 55 : Math.max(80, incidentY - 305);
  }
  const pointerY = Math.max(42, Math.min(190, incidentY - top - 10));
  const pointerX = Math.max(42, Math.min(478, incidentX - left));
  const position = { left, top, "--dialogue-pointer-y": `${pointerY}px`, "--dialogue-pointer-x": `${pointerX}px` } as React.CSSProperties;
  return (
    <div className="modal-backdrop dialogue-backdrop" role="presentation">
      <section className={`dialogue-card pixel-panel pointer-${pointerSide}`} style={position} role="dialog" aria-modal="true" aria-labelledby="dialogue-title" data-incident={view.pendingAction.incidentId}>
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
    <section className="title-screen"><img className="screen-bg" src={`${ASSET}/ui/screens/pp_ui_screen_title_final.webp`} alt="AQUA, FIX, BUDDY가 출동을 준비하는 구조 마을" /><div className="title-vignette" /><button className="sound-button icon-control" onClick={onSound} aria-label={soundOn ? "소리 끄기" : "소리 켜기"}><img src={`${ASSET}/ui/icons/pp_ui_icon_sound_${soundOn ? "on" : "off"}.png`} alt="" /></button><div className="title-content"><span className="title-kicker"><i /> NHN AI 해커톤 <i /></span><div className="title-lockup"><span>NHN AI HACKATHON</span><h1>PIXEL <em>PANIC</em></h1><b>AI 구조대</b></div><p>번지는 사고를 분석하고 세 로봇을 올바른 순서로 배치하세요.<br /><strong>당신의 클릭으로 마을을 구조합니다.</strong></p><div className="title-actions"><PixelButton className="hero-button" onClick={onStart}>구조 작전 시작</PixelButton><PixelButton variant="secondary" onClick={onHelp}>플레이 방법</PixelButton></div></div><div className="role-pills" aria-label="구조 로봇 역할"><span className="aqua"><b>AQUA</b> FIRE & WATER</span><span className="fix"><b>FIX</b> REPAIR & POWER</span><span className="buddy"><b>BUDDY</b> RESCUE & CARE</span></div></section>
  );
}

function StageNewsTransition({ view, onContinue }: { view: StageTransitionView; onContinue: () => void }) {
  const request = useMemo(() => buildStageNewsRequest(view.snapshot, view.completedWave), [view.completedWave, view.snapshot]);
  const [news, setNews] = useState<ResultNewsResponse>(() => fallbackResultNews(request));
  const [loading, setLoading] = useState(true);
  const interviewee = NPC_DIALOGUES[request.intervieweeId];

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const localFallback = fallbackResultNews(request);
    setNews(localFallback);
    setLoading(true);
    const timeout = window.setTimeout(() => controller.abort(), 5_200);
    void fetch("/api/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) return localFallback;
      const data = await response.json() as { source?: unknown };
      const normalized = normalizeResultNews(data);
      return normalized && (data.source === "openai" || data.source === "fallback")
        ? { ...normalized, source: data.source } as ResultNewsResponse
        : localFallback;
    }).catch(() => localFallback).then((result) => {
      if (active) setNews(result);
    }).finally(() => {
      window.clearTimeout(timeout);
      if (active) setLoading(false);
    });
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [request]);

  return (
    <div className="modal-backdrop result-news-backdrop" role="presentation">
      <article className="result-news-card stage-news-card pixel-command" role="dialog" aria-modal="true" aria-labelledby="stage-news-headline" data-stage-news={view.completedWave} data-news-source={loading ? "loading" : news.source}>
        <header><span><b>PIXEL VILLAGE NEWS</b><small>WAVE {view.completedWave} 구조 완료 특별판</small></span><em className={loading ? "fallback" : news.source}>{loading ? "GPT 작성 중" : news.source === "openai" ? "GPT LIVE" : "LOCAL EDITION"}</em></header>
        <section className="result-news-article"><small>다음 지역 출동 속보</small><h2 id="stage-news-headline">{news.headline}</h2><p>{news.article}</p></section>
        <section className="result-news-interview">
          <span className="result-news-portrait" style={{ backgroundImage: `url(${ASSET}/characters/npcs/pp_char_npc_${interviewee.spriteId}_idle.png)` }} aria-hidden="true" />
          <div><small>현장 주민 인터뷰</small><strong>{interviewee.name} · {interviewee.role}</strong><blockquote>“{news.interviewQuote}”</blockquote></div>
        </section>
        <footer><div><span>마을 보존 {request.villagePreservation}%</span><span>누적 해결 임무 {getResolvedCount(view.snapshot)}건</span></div><PixelButton onClick={onContinue}>WAVE {view.completedWave + 1} · {WAVE_LABELS[view.completedWave]} 출동</PixelButton></footer>
      </article>
    </div>
  );
}

function ResultScreen({ game, onRetry, onTitle }: { game: RescueGameState; onRetry: () => void; onTitle: () => void }) {
  const success = game.status === "success";
  const grade = getGrade(game);
  const reason = game.finishReason === "timeout" ? "구조 시간이 종료됐어요" : game.finishReason === "village_lost" ? "마을 안전도가 0이 됐어요" : game.finishReason === "abandoned" ? "작전을 종료했습니다" : "구조 작전 완료!";
  const newsRequest = useMemo(() => buildResultNewsRequest(game), [game]);
  const [news, setNews] = useState<ResultNewsResponse>(() => fallbackResultNews(newsRequest));
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsOpen, setNewsOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const localFallback = fallbackResultNews(newsRequest);
    setNews(localFallback);
    setNewsLoading(true);
    setNewsOpen(false);
    const timeout = window.setTimeout(() => controller.abort(), 5_200);
    void fetch("/api/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newsRequest),
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) return localFallback;
      const data = await response.json() as { source?: unknown };
      const normalized = normalizeResultNews(data);
      return normalized && (data.source === "openai" || data.source === "fallback")
        ? { ...normalized, source: data.source } as ResultNewsResponse
        : localFallback;
    }).catch(() => localFallback).then((result) => {
      if (active) setNews(result);
    }).finally(() => {
      window.clearTimeout(timeout);
      if (active) setNewsLoading(false);
    });
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [newsRequest]);

  return (
    <section className={`result-screen ${success ? "success" : "fail"}`}>
      <img className="screen-bg" src={`${ASSET}/ui/screens/pp_ui_screen_result_${success ? "success" : "fail"}_final.webp`} alt="구조 작전 결과" />
      <div className="result-vignette" />
      <div className={`result-card ${success ? "pixel-success" : "pixel-alert"}`}>
        <div className="result-copy"><span className="result-kicker">{success ? "MISSION COMPLETE" : "MISSION REPORT"}</span><img className="grade" src={`${ASSET}/ui/pp_ui_grade_${grade.toLowerCase()}.png`} alt={`${grade} 등급`} /><div><h1>{reason}</h1><p>{success ? "결정론 엔진이 모든 구조 기록을 집계했습니다." : "확산 순서와 로봇 조합을 바꿔 다시 도전해보세요."}</p></div></div>
        <div className="result-stats"><ResultStat icon="rescued" label="구조 주민" value={`${game.rescuedResidents}명`} /><ResultStat icon="incident_count" label="해결 임무" value={`${getResolvedCount(game)}/${TOTAL_STAGE_INCIDENTS}`} /><ResultStat icon="village_hp" label="마을 보존" value={`${game.villagePreservation}%`} /><ResultStat icon="command_count" label="발견 콤보" value={`${game.foundCombos.length}/5`} /><ResultStat icon="timer" label="남은 시간" value={formatGameTime(game.remainingMs)} /><ResultStat icon="done" label="최대 콤보" value={`×${game.maxCombo}`} /></div>
        <div className="result-score"><small>FINAL SCORE</small><strong>{Math.max(0, game.score).toLocaleString()}</strong></div>
        <div className="result-actions"><PixelButton variant="secondary" disabled={newsLoading} onClick={() => setNewsOpen(true)}>{newsLoading ? "AI 뉴스 작성 중" : "AI 마을 뉴스"}</PixelButton><PixelButton onClick={onRetry}>다시 출동</PixelButton><PixelButton variant="secondary" onClick={onTitle}>본부로</PixelButton></div>
      </div>
      {newsOpen && <ResultNewsModal news={news} request={newsRequest} onClose={() => setNewsOpen(false)} />}
    </section>
  );
}

function ResultNewsModal({ news, request, onClose }: { news: ResultNewsResponse; request: ResultNewsRequest; onClose: () => void }) {
  const interviewee = NPC_DIALOGUES[request.intervieweeId];
  return (
    <div className="modal-backdrop result-news-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <article className="result-news-card pixel-command" role="dialog" aria-modal="true" aria-labelledby="result-news-headline" data-news-source={news.source}>
        <button className="modal-close" onClick={onClose} aria-label="AI 마을 뉴스 닫기">×</button>
        <header><span><b>PIXEL VILLAGE NEWS</b><small>구조 작전 특별판</small></span><em className={news.source}>{news.source === "openai" ? "GPT LIVE" : "LOCAL EDITION"}</em></header>
        <section className="result-news-article"><small>긴급 구조 속보</small><h2 id="result-news-headline">{news.headline}</h2><p>{news.article}</p></section>
        <section className="result-news-interview">
          <span className="result-news-portrait" style={{ backgroundImage: `url(${ASSET}/characters/npcs/pp_char_npc_${interviewee.spriteId}_idle.png)` }} aria-hidden="true" />
          <div><small>현장 주민 인터뷰</small><strong>{interviewee.name} · {interviewee.role}</strong><blockquote>“{news.interviewQuote}”</blockquote></div>
        </section>
        <footer><span>마을 보존 {request.villagePreservation}%</span><span>구조 주민 {request.rescuedResidents}명</span><span>해결 사고 {request.resolvedIncidents.length}건</span></footer>
      </article>
    </div>
  );
}

function HudStat({ icon, label, value, emphasized = false }: { icon: string; label: string; value: string; emphasized?: boolean }) { return <div className={`hud-stat ${emphasized ? "emphasized" : ""}`}><img src={`${ASSET}/ui/icons/pp_ui_icon_${icon}.png`} alt="" /><span>{label}</span><strong>{value}</strong></div>; }
function ResultStat({ icon, label, value }: { icon: string; label: string; value: string }) { return <div className="result-stat"><img src={`${ASSET}/ui/icons/pp_ui_icon_${icon}.png`} alt="" /><span>{label}</span><strong>{value}</strong></div>; }

function Modal({ title, onClose, dismissible = true, children }: { title: string; onClose: () => void; dismissible?: boolean; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => dismissible && event.target === event.currentTarget && onClose()}><section className="modal-card pixel-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">{dismissible && <button className="modal-close" onClick={onClose} aria-label="닫기">×</button>}<h2 id="modal-title">{title}</h2>{children}</section></div>;
}
