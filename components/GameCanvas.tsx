"use client";

import { useEffect, useRef } from "react";

export type OperationPhase = "idle" | "analyzing" | "preview" | "executing";

const ASSET = "/assets/pixel-panic";

export function GameCanvas({ phase }: { phase: OperationPhase }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ setOperationPhase: (phase: OperationPhase) => void } | null>(null);

  useEffect(() => {
    let game: import("phaser").Game | null = null;
    let disposed = false;

    void (async () => {
      const Phaser = await import("phaser");
      if (!containerRef.current || disposed) return;

      class RescueScene extends Phaser.Scene {
        private robots: Phaser.GameObjects.Image[] = [];
        private markers: Phaser.GameObjects.Image[] = [];
        private planLines?: Phaser.GameObjects.Graphics;

        constructor() { super("rescue"); }

        preload() {
          this.load.image("map", `${ASSET}/ui/pp_placeholder_map.png`);
          for (const robot of ["aqua", "fix", "buddy"]) this.load.image(robot, `${ASSET}/ui/pp_placeholder_robot_${robot}.png`);
          for (const incident of ["fire", "bridge", "cat", "generator"]) this.load.image(incident, `${ASSET}/ui/pp_placeholder_incident_${incident}.png`);
        }

        create() {
          this.add.image(0, 64, "map").setOrigin(0);
          const robotStarts = [[340, 530], [404, 530], [468, 530]];
          this.robots = ["aqua", "fix", "buddy"].map((key, index) => this.add.image(robotStarts[index][0], robotStarts[index][1], key).setDepth(5));
          const markerPoints = [[300, 206], [816, 360], [585, 164], [946, 188]];
          this.markers = ["fire", "bridge", "cat", "generator"].map((key, index) => {
            const image = this.add.image(markerPoints[index][0], markerPoints[index][1], key).setDepth(4);
            this.tweens.add({ targets: image, y: image.y - 6, duration: 720 + index * 80, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
            return image;
          });
          this.planLines = this.add.graphics().setDepth(3);
          sceneRef.current = this;
          this.setOperationPhase(phase);
        }

        setOperationPhase(next: OperationPhase) {
          if (!this.planLines || this.robots.length === 0) return;
          this.planLines.clear();
          const starts = [[340, 530], [404, 530], [468, 530]];
          if (next === "idle" || next === "analyzing") {
            this.robots.forEach((robot, index) => { this.tweens.killTweensOf(robot); robot.setPosition(starts[index][0], starts[index][1]); });
          }
          if (next === "analyzing") this.cameras.main.flash(160, 57, 191, 242, false);
          if (next === "preview" || next === "executing") {
            const assignments = [
              { from: starts[0], to: [300, 206], color: 0x39bff2 },
              { from: starts[1], to: [816, 360], color: 0xffd34e },
              { from: starts[2], to: [585, 164], color: 0xff6577 },
            ];
            for (const assignment of assignments) {
              this.planLines.lineStyle(4, assignment.color, 0.8);
              this.planLines.lineBetween(assignment.from[0], assignment.from[1], assignment.to[0], assignment.to[1]);
            }
          }
          if (next === "executing") {
            const targets = [[300, 238], [816, 392], [585, 196]];
            this.robots.forEach((robot, index) => this.tweens.add({ targets: robot, x: targets[index][0], y: targets[index][1], duration: 2600 + index * 320, ease: "Sine.easeInOut" }));
            this.time.delayedCall(3200, () => this.markers.forEach((marker, index) => this.tweens.add({ targets: marker, alpha: index === 3 ? 1 : 0.25, scale: index === 3 ? 1 : 0.75, duration: 450 })));
          }
        }
      }

      const scene = new RescueScene();
      game = new Phaser.Game({
        type: Phaser.AUTO,
        width: 1280,
        height: 720,
        parent: containerRef.current,
        transparent: true,
        pixelArt: true,
        roundPixels: true,
        antialias: false,
        banner: false,
        scene,
      });
    })();

    return () => {
      disposed = true;
      sceneRef.current = null;
      game?.destroy(true);
    };
  }, []);

  useEffect(() => sceneRef.current?.setOperationPhase(phase), [phase]);

  return <div className="phaser-canvas" ref={containerRef} aria-hidden="true" />;
}
