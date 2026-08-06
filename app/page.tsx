"use client";

import { useEffect, useMemo, useState } from "react";
import { GameCanvas, OperationPhase } from "@/components/GameCanvas";
import { PixelButton } from "@/components/PixelButton";
import { RobotCard } from "@/components/RobotCard";
import { StageViewport } from "@/components/StageViewport";

type Screen = "loading" | "title" | "play" | "result";
type ResultKind = "success" | "fail";

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
];

export default function Home() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [resultKind, setResultKind] = useState<ResultKind>("success");
  const [phase, setPhase] = useState<OperationPhase>("idle");
  const [command, setCommand] = useState(quickCommands[0].command);
  const [seconds, setSeconds] = useState(90);
  const [showHelp, setShowHelp] = useState(false);
  const [showPause, setShowPause] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("screen");
    if (requested === "play") {
      setScreen("play");
      const requestedPhase = params.get("phase") as OperationPhase | null;
      if (["idle", "analyzing", "preview", "executing"].includes(requestedPhase ?? "")) {
        setPhase(requestedPhase ?? "idle");
      }
      return;
    }
    if (requested === "result") {
      setResultKind(params.get("result") === "fail" ? "fail" : "success");
      setScreen("result");
      return;
    }
    const timer = window.setTimeout(() => setScreen("title"), 650);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (screen !== "play" || phase === "executing" || showPause) return;
    const timer = window.setInterval(() => {
      setSeconds((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          setResultKind("fail");
          setScreen("result");
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [screen, phase, showPause]);

  const timerText = useMemo(() => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`, [seconds]);

  const startGame = () => {
    setSeconds(90);
    setPhase("idle");
    setScreen("play");
  };

  const analyze = () => {
    if (!command.trim() || phase !== "idle") return;
    setPhase("analyzing");
    window.setTimeout(() => setPhase("preview"), 1350);
  };

  const execute = () => {
    setPhase("executing");
    window.setTimeout(() => {
      setResultKind("success");
      setScreen("result");
    }, 4400);
  };

  return (
    <main className="app-shell">
      <div className="rotate-overlay" role="status">
        <img src={`${ASSET}/brand/pp_brand_logo_mark.png`} alt="" />
        <strong>기기를 가로로 돌려주세요</strong>
        <span>PIXEL PANIC은 가로 화면에 최적화되어 있어요.</span>
      </div>

      <StageViewport>
        {screen === "loading" && <LoadingScreen />}
        {screen === "title" && (
          <TitleScreen
            soundOn={soundOn}
            onSound={() => setSoundOn((value) => !value)}
            onStart={startGame}
            onHelp={() => setShowHelp(true)}
          />
        )}
        {screen === "play" && (
          <section className="game-screen" aria-label="PIXEL PANIC 게임 화면">
            <GameCanvas phase={phase} />

            <header className="top-hud pixel-panel">
              <div className="hud-brand">
                <img src={`${ASSET}/brand/pp_brand_logo_mark.png`} alt="" />
                <strong>PIXEL PANIC</strong>
              </div>
              <HudStat icon="timer" label="남은 시간" value={timerText} emphasized />
              <HudStat icon="village_hp" label="마을 보존율" value="86%" />
              <HudStat icon="incident_count" label="해결한 사건" value={phase === "executing" ? "3/4" : "0/4"} />
              <button className="icon-control" aria-label="일시정지" onClick={() => setShowPause(true)}>
                <img src={`${ASSET}/ui/icons/pp_ui_icon_pause.png`} alt="" />
              </button>
            </header>

            <aside className="robot-panel pixel-panel" aria-label="구조 로봇 상태">
              <div className="panel-heading"><span>구조 로봇</span><small>3대 준비 완료</small></div>
              <RobotCard robot="aqua" name="AQUA" role="소방·냉각" phase={phase} />
              <RobotCard robot="fix" name="FIX" role="수리·건설" phase={phase} />
              <RobotCard robot="buddy" name="BUDDY" role="구조·운반" phase={phase} />
            </aside>

            <aside className="incident-panel pixel-alert" aria-label="활성 사건">
              <div className="panel-heading"><span>활성 사건</span><small>위험도 순</small></div>
              <div className="incident-list">
                {incidents.map((incident) => (
                  <div className="incident-row" key={incident.id}>
                    <img src={`${ASSET}/ui/icons/pp_ui_icon_incident_${incident.id}.png`} alt="" />
                    <div><strong>{incident.name}</strong><span className={`risk ${incident.color}`}>{incident.risk}</span></div>
                    <span className={phase === "executing" ? "incident-check resolved" : "incident-check"}>
                      {phase === "executing" ? "✓" : "!"}
                    </span>
                  </div>
                ))}
              </div>
              {phase === "preview" && (
                <div className="plan-preview" aria-label="작전 미리보기">
                  <b>작전 미리보기</b>
                  <span className="aqua-text">AQUA → 빵집</span>
                  <span className="fix-text">FIX → 다리</span>
                  <span className="buddy-text">BUDDY → 고양이</span>
                </div>
              )}
            </aside>

            <section className={`command-dock pixel-command ${phase === "analyzing" ? "is-analyzing" : ""}`}>
              <div className="quick-command-list" aria-label="추천 명령">
                {quickCommands.map((item) => (
                  <button key={item.label} onClick={() => { setCommand(item.command); setPhase("idle"); }}>
                    <img src={`${ASSET}/ui/icons/pp_ui_icon_${item.icon}.png`} alt="" />
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="command-main">
                <label htmlFor="rescue-command">
                  <img src={`${ASSET}/ui/icons/pp_ui_icon_ai.png`} alt="" />
                  자연어 작전 명령
                </label>
                <input
                  id="rescue-command"
                  value={command}
                  onChange={(event) => { setCommand(event.target.value); setPhase("idle"); }}
                  onKeyDown={(event) => event.key === "Enter" && analyze()}
                  aria-describedby="command-status"
                />
                <span id="command-status" className="command-status" aria-live="polite">
                  {phase === "analyzing" && "AI가 명령을 분석하고 있어요…"}
                  {phase === "preview" && "작전 준비 완료! 배정 내용을 확인하세요."}
                  {phase === "executing" && "구조 로봇이 작전을 실행 중이에요!"}
                  {phase === "idle" && "Enter 키로 빠르게 분석할 수 있어요."}
                </span>
              </div>
              <PixelButton onClick={phase === "preview" ? execute : analyze} disabled={phase === "analyzing" || phase === "executing"}>
                {phase === "preview" ? "작전 실행" : phase === "analyzing" ? "분석 중…" : phase === "executing" ? "실행 중…" : "명령 분석"}
              </PixelButton>
              {phase === "analyzing" && <div className="ai-scanline" aria-hidden="true" />}
            </section>

            {showPause && (
              <Modal title="작전 일시정지" onClose={() => setShowPause(false)}>
                <p>타이머가 멈췄습니다. 준비되면 작전을 계속하세요.</p>
                <div className="modal-actions">
                  <PixelButton onClick={() => setShowPause(false)}>계속하기</PixelButton>
                  <PixelButton variant="danger" onClick={() => { setShowPause(false); setResultKind("fail"); setScreen("result"); }}>작전 포기</PixelButton>
                </div>
              </Modal>
            )}
          </section>
        )}
        {screen === "result" && <ResultScreen kind={resultKind} onRetry={startGame} onTitle={() => setScreen("title")} />}

        {showHelp && (
          <Modal title="플레이 방법" onClose={() => setShowHelp(false)}>
            <ol className="how-to-list">
              <li><b>1</b><span>추천 문장을 고르거나 자연어로 명령하세요.</span></li>
              <li><b>2</b><span>AI가 나눈 로봇별 작전을 확인하세요.</span></li>
              <li><b>3</b><span>90초 안에 네 사건을 모두 해결하세요!</span></li>
            </ol>
            <PixelButton onClick={() => { setShowHelp(false); startGame(); }}>바로 시작</PixelButton>
          </Modal>
        )}
      </StageViewport>
    </main>
  );
}

function LoadingScreen() {
  return (
    <section className="loading-screen">
      <img className="screen-bg" src={`${ASSET}/ui/screens/pp_ui_screen_loading_bg.png`} alt="" />
      <div className="loading-card pixel-panel">
        <img className="loading-mark" src={`${ASSET}/brand/pp_brand_logo_mark.png`} alt="" />
        <strong>구조 본부 연결 중</strong>
        <div className="loading-spinner" aria-label="로딩 중" />
      </div>
    </section>
  );
}

function TitleScreen({ soundOn, onSound, onStart, onHelp }: { soundOn: boolean; onSound: () => void; onStart: () => void; onHelp: () => void }) {
  return (
    <section className="title-screen">
      <img className="screen-bg" src={`${ASSET}/ui/screens/pp_ui_screen_title_bg.png`} alt="맑은 도트 마을과 구조 본부" />
      <button className="sound-button icon-control" onClick={onSound} aria-label={soundOn ? "소리 끄기" : "소리 켜기"}>
        <img src={`${ASSET}/ui/icons/pp_ui_icon_sound_${soundOn ? "on" : "off"}.png`} alt="" />
      </button>
      <div className="title-content">
        <img className="main-logo" src={`${ASSET}/brand/pp_brand_logo_horizontal.png`} alt="PIXEL PANIC — AI 구조대" />
        <p>말 한마디로 출동! 90초 안에 도트 마을을 구해주세요.</p>
        <div className="title-actions">
          <PixelButton onClick={onStart}>게임 시작</PixelButton>
          <PixelButton variant="secondary" onClick={onHelp}>플레이 방법</PixelButton>
        </div>
        <div className="role-pills" aria-label="구조 로봇 역할">
          <span className="aqua">AQUA · 소방</span><span className="fix">FIX · 수리</span><span className="buddy">BUDDY · 구조</span>
        </div>
      </div>
    </section>
  );
}

function ResultScreen({ kind, onRetry, onTitle }: { kind: ResultKind; onRetry: () => void; onTitle: () => void }) {
  const success = kind === "success";
  return (
    <section className={`result-screen ${kind}`}>
      <img className="screen-bg" src={`${ASSET}/ui/screens/pp_ui_screen_result_${kind}_bg.png`} alt="" />
      <div className={`result-card ${success ? "pixel-success" : "pixel-alert"}`}>
        <div className="result-kicker">{success ? "MISSION COMPLETE" : "MISSION FAILED"}</div>
        <img className="grade" src={`${ASSET}/ui/pp_ui_grade_${success ? "s" : "f"}.png`} alt={`${success ? "S" : "F"} 등급`} />
        <h1>{success ? "마을을 완벽하게 구했어요!" : "다시 출동할 준비를 해볼까요?"}</h1>
        <p>{success ? "세 로봇의 멋진 협동으로 모든 사건을 해결했습니다." : "사건별 역할을 나누면 다음 작전은 분명 성공할 수 있어요."}</p>
        <div className="result-stats">
          <ResultStat icon="rescued" label="구조" value={success ? "5명" : "2명"} />
          <ResultStat icon="incident_count" label="사건 해결" value={success ? "4/4" : "2/4"} />
          <ResultStat icon="village_hp" label="마을 보존" value={success ? "92%" : "46%"} />
          <ResultStat icon="command_count" label="사용 명령" value={success ? "2회" : "4회"} />
        </div>
        <div className="result-actions">
          <PixelButton onClick={onRetry}>다시 하기</PixelButton>
          <PixelButton variant="secondary" onClick={onTitle}>타이틀로</PixelButton>
        </div>
      </div>
    </section>
  );
}

function HudStat({ icon, label, value, emphasized = false }: { icon: string; label: string; value: string; emphasized?: boolean }) {
  return <div className={`hud-stat ${emphasized ? "emphasized" : ""}`}><img src={`${ASSET}/ui/icons/pp_ui_icon_${icon}.png`} alt="" /><span>{label}</span><strong>{value}</strong></div>;
}

function ResultStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return <div className="result-stat"><img src={`${ASSET}/ui/icons/pp_ui_icon_${icon}.png`} alt="" /><span>{label}</span><strong>{value}</strong></div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-card pixel-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button className="modal-close" onClick={onClose} aria-label="닫기">×</button>
        <h2 id="modal-title">{title}</h2>
        {children}
      </section>
    </div>
  );
}
