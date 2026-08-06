"use client";

import { useEffect, useRef } from "react";

export type OperationPhase = "idle" | "analyzing" | "preview" | "executing";

type StageIncident = {
  properties: {
    incident_id: "fire" | "bridge" | "cat" | "generator";
    interaction_tile: [number, number];
    marker_pixel: [number, number];
  };
};

type StageSpawnData = {
  runtimeHudOffsetY: number;
  actors: Array<{ id: "aqua" | "fix" | "buddy"; pixel: [number, number] }>;
  incidents: StageIncident[];
};

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
        private robotStarts: [number, number][] = [];
        private operationTargets: [number, number][] = [];
        private markerTargets: [number, number][] = [];
        private planLines?: Phaser.GameObjects.Graphics;

        constructor() { super("rescue"); }

        preload() {
          this.load.image("pp_stage_01_preview", `${ASSET}/world/maps/pp_stage_01_preview.png`);
          this.load.json("pp_stage_01", `${ASSET}/world/maps/pp_stage_01.json`);
          this.load.json("pp_stage_01_collision", `${ASSET}/world/maps/pp_stage_01_collision.json`);
          this.load.json("pp_stage_01_spawn_points", `${ASSET}/world/maps/pp_stage_01_spawn_points.json`);
          for (const robot of ["aqua", "fix", "buddy"]) this.load.image(robot, `${ASSET}/ui/pp_placeholder_robot_${robot}.png`);
          for (const incident of ["fire", "bridge", "cat", "generator"]) {
            this.load.image(`pp_world_incident_marker_${incident}`, `${ASSET}/world/incidents/pp_world_incident_marker_${incident}.png`);
          }
        }

        create() {
          const stage = this.cache.json.get("pp_stage_01") as { width: number; height: number; runtimeScale: number };
          const collision = this.cache.json.get("pp_stage_01_collision") as { blocked: number[] };
          const spawnData = this.cache.json.get("pp_stage_01_spawn_points") as StageSpawnData;
          if (stage.width !== 40 || stage.height !== 17 || stage.runtimeScale !== 2 || collision.blocked.length !== 680) {
            throw new Error("Invalid PIXEL PANIC Phase 2 stage data");
          }

          this.add.image(0, 64, "pp_stage_01_preview").setOrigin(0);
          const actorsById = new Map(spawnData.actors.map((actor) => [actor.id, actor]));
          const incidentsById = new Map(spawnData.incidents.map((incident) => [incident.properties.incident_id, incident]));
          const robotKeys = ["aqua", "fix", "buddy"] as const;
          const incidentKeys = ["fire", "bridge", "cat", "generator"] as const;
          this.robotStarts = robotKeys.map((key) => {
            const actor = actorsById.get(key);
            if (!actor) throw new Error(`Missing Phase 2 spawn data for ${key}`);
            return [actor.pixel[0], actor.pixel[1] + spawnData.runtimeHudOffsetY];
          });
          this.operationTargets = ["fire", "bridge", "cat"].map((key) => {
            const incident = incidentsById.get(key as StageIncident["properties"]["incident_id"]);
            if (!incident) throw new Error(`Missing Phase 2 incident data for ${key}`);
            const [tileX, tileY] = incident.properties.interaction_tile;
            return [tileX * 32 + 16, tileY * 32 + 16 + spawnData.runtimeHudOffsetY];
          });
          this.robots = robotKeys.map((key, index) => this.add.image(this.robotStarts[index][0], this.robotStarts[index][1], key).setDepth(5));
          this.markerTargets = incidentKeys.map((key) => {
            const incident = incidentsById.get(key);
            if (!incident) throw new Error(`Missing Phase 2 incident data for ${key}`);
            const [markerX, markerY] = incident.properties.marker_pixel;
            return [markerX, markerY + spawnData.runtimeHudOffsetY];
          });
          this.markers = incidentKeys.map((key, index) => {
            const [markerX, markerY] = this.markerTargets[index];
            const image = this.add.image(markerX, markerY, `pp_world_incident_marker_${key}`).setScale(2).setDepth(4);
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
          if (next === "idle" || next === "analyzing") {
            this.robots.forEach((robot, index) => { this.tweens.killTweensOf(robot); robot.setPosition(this.robotStarts[index][0], this.robotStarts[index][1]); });
          }
          if (next === "analyzing") this.cameras.main.flash(160, 57, 191, 242, false);
          if (next === "preview" || next === "executing") {
            const assignments = [
              { from: this.robotStarts[0], to: this.markerTargets[0], color: 0x39bff2 },
              { from: this.robotStarts[1], to: this.markerTargets[1], color: 0xffd34e },
              { from: this.robotStarts[2], to: this.markerTargets[2], color: 0xff6577 },
            ];
            for (const assignment of assignments) {
              this.planLines.lineStyle(4, assignment.color, 0.8);
              this.planLines.lineBetween(assignment.from[0], assignment.from[1], assignment.to[0], assignment.to[1]);
            }
          }
          if (next === "executing") {
            this.robots.forEach((robot, index) => this.tweens.add({ targets: robot, x: this.operationTargets[index][0], y: this.operationTargets[index][1], duration: 2600 + index * 320, ease: "Sine.easeInOut" }));
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
