"use client";

import { useEffect, useState } from "react";

const WIDTH = 1280;
const HEIGHT = 720;

export function StageViewport({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const resize = () => setScale(Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT));
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <div className="stage-viewport" style={{ width: WIDTH * scale, height: HEIGHT * scale }}>
      <div className="stage" style={{ transform: `scale(${scale})` }}>{children}</div>
    </div>
  );
}
