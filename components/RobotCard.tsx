import type { OperationPhase } from "./GameCanvas";

const ASSET = "/assets/pixel-panic";

export function RobotCard({ robot, name, role, phase }: { robot: "aqua" | "fix" | "buddy"; name: string; role: string; phase: OperationPhase }) {
  const portraitState = phase === "executing" ? "busy" : "ready";
  const status = phase === "executing" ? "작업 중" : phase === "preview" ? "배정 완료" : "대기 중";
  const icon = phase === "executing" ? "working" : phase === "preview" ? "ready" : "ready";
  return (
    <div className={`robot-card ${robot}`}>
      <img className="robot-portrait" src={`${ASSET}/ui/portraits/pp_ui_portrait_${robot}_${portraitState}.png`} alt={`${name} 초상화`} />
      <div className="robot-copy"><strong>{name}</strong><span>{role}</span></div>
      <div className="robot-status"><img src={`${ASSET}/ui/icons/pp_ui_icon_${icon}.png`} alt="" />{status}</div>
    </div>
  );
}
