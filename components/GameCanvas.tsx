"use client";

import { useEffect, useRef } from "react";

export type OperationPhase = "idle" | "analyzing" | "preview" | "fire" | "bridge" | "cat" | "generator" | "complete";

type IncidentId = "fire" | "bridge" | "cat" | "generator";
type RobotId = "aqua" | "fix" | "buddy";
type StageIncident = { properties: { incident_id: IncidentId; interaction_tile: [number, number]; marker_pixel: [number, number] } };
type StageSpawnData = { runtimeHudOffsetY: number; actors: Array<{ id: RobotId; pixel: [number, number] }>; incidents: StageIncident[] };

const ASSET = "/assets/pixel-panic";
const ROBOTS: RobotId[] = ["aqua", "fix", "buddy"];
const INCIDENTS: IncidentId[] = ["fire", "bridge", "cat", "generator"];

export function GameCanvas({ phase, onError }: { phase: OperationPhase; onError?: (message: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef(phase);
  const errorRef = useRef(onError);
  const sceneRef = useRef<{ setOperationPhase: (next: OperationPhase) => void } | null>(null);

  useEffect(() => { phaseRef.current = phase; sceneRef.current?.setOperationPhase(phase); }, [phase]);
  useEffect(() => { errorRef.current = onError; }, [onError]);

  useEffect(() => {
    let game: import("phaser").Game | null = null;
    let disposed = false;

    void (async () => {
      const Phaser = await import("phaser");
      if (!containerRef.current || disposed) return;

      class RescueScene extends Phaser.Scene {
        private robots = new Map<RobotId, Phaser.GameObjects.Sprite>();
        private markers = new Map<IncidentId, Phaser.GameObjects.Image>();
        private starts = new Map<RobotId, [number, number]>();
        private targets = new Map<IncidentId, [number, number]>();
        private markerTargets = new Map<IncidentId, [number, number]>();
        private residents: Phaser.GameObjects.Sprite[] = [];
        private cat?: Phaser.GameObjects.Sprite;
        private fire?: Phaser.GameObjects.Sprite;
        private smoke?: Phaser.GameObjects.Sprite;
        private water?: Phaser.GameObjects.Sprite;
        private steam?: Phaser.GameObjects.Sprite;
        private sparks?: Phaser.GameObjects.Sprite;
        private hearts?: Phaser.GameObjects.Sprite;
        private electricity?: Phaser.GameObjects.Sprite;
        private restore?: Phaser.GameObjects.Sprite;
        private confetti?: Phaser.GameObjects.Sprite;
        private bridge?: Phaser.GameObjects.Image;
        private generator?: Phaser.GameObjects.Sprite;
        private planLines?: Phaser.GameObjects.Graphics;
        private currentPhase: OperationPhase = "idle";

        constructor() { super("rescue"); }

        preload() {
          this.load.on("loaderror", (file: { key?: string }) => errorRef.current?.(`에셋 ${file.key ?? "unknown"} 로딩에 실패했습니다.`));
          this.load.image("stage", `${ASSET}/world/maps/pp_stage_01_preview.webp`);
          this.load.json("stage-data", `${ASSET}/world/maps/pp_stage_01.json`);
          this.load.json("collision", `${ASSET}/world/maps/pp_stage_01_collision.json`);
          this.load.json("spawns", `${ASSET}/world/maps/pp_stage_01_spawn_points.json`);
          this.load.image("shadow", `${ASSET}/characters/common/pp_char_shadow_small.png`);
          this.load.image("bridge-broken", `${ASSET}/world/incidents/pp_world_bridge_broken.png`);
          this.load.image("bridge-repaired", `${ASSET}/world/incidents/pp_world_bridge_repaired.png`);
          this.load.image("generator-off", `${ASSET}/world/incidents/pp_world_generator_off.png`);
          this.load.spritesheet("generator-on", `${ASSET}/world/incidents/pp_world_generator_on.png`, { frameWidth: 48, frameHeight: 48 });

          for (const robot of ROBOTS) {
            const action = robot === "aqua" ? "extinguish" : robot === "fix" ? "repair" : "rescue";
            this.load.spritesheet(`${robot}-idle`, `${ASSET}/characters/robots/pp_char_robot_${robot}_idle.png`, { frameWidth: 32, frameHeight: 32 });
            this.load.spritesheet(`${robot}-walk`, `${ASSET}/characters/robots/pp_char_robot_${robot}_walk.png`, { frameWidth: 32, frameHeight: 32 });
            this.load.spritesheet(`${robot}-action`, `${ASSET}/characters/robots/pp_char_robot_${robot}_${action}.png`, { frameWidth: 32, frameHeight: 32 });
            this.load.spritesheet(`${robot}-celebrate`, `${ASSET}/characters/robots/pp_char_robot_${robot}_celebrate.png`, { frameWidth: 32, frameHeight: 32 });
          }
          for (const npc of ["a", "b", "c", "d"]) {
            this.load.spritesheet(`npc-${npc}-idle`, `${ASSET}/characters/npcs/pp_char_npc_${npc}_idle.png`, { frameWidth: 32, frameHeight: 32 });
            this.load.spritesheet(`npc-${npc}-cheer`, `${ASSET}/characters/npcs/pp_char_npc_${npc}_cheer.png`, { frameWidth: 32, frameHeight: 32 });
          }
          this.load.spritesheet("cat-idle", `${ASSET}/characters/cat/pp_char_cat_idle.png`, { frameWidth: 24, frameHeight: 24 });
          this.load.spritesheet("cat-hop", `${ASSET}/characters/cat/pp_char_cat_hop.png`, { frameWidth: 24, frameHeight: 24 });
          const effects: Array<[string, string, number, number]> = [
            ["fire", "fire_medium_loop", 32, 48], ["smoke", "smoke_small_loop", 32, 48], ["water", "water_jet_loop", 64, 24],
            ["steam", "steam_burst", 48, 48], ["sparks", "repair_spark", 32, 32], ["hearts", "rescue_heart", 24, 24],
            ["electricity", "electric_arc", 48, 48], ["restore", "power_restore_burst", 64, 64], ["confetti", "confetti", 96, 96],
          ];
          for (const [key, file, width, height] of effects) this.load.spritesheet(key, `${ASSET}/fx/pp_fx_${file}.png`, { frameWidth: width, frameHeight: height });
          for (const incident of INCIDENTS) this.load.image(`marker-${incident}`, `${ASSET}/world/incidents/pp_world_incident_marker_${incident}.png`);
        }

        create() {
          const stage = this.cache.json.get("stage-data") as { width: number; height: number; runtimeScale: number };
          const collision = this.cache.json.get("collision") as { blocked: number[] };
          const spawnData = this.cache.json.get("spawns") as StageSpawnData;
          if (stage.width !== 40 || stage.height !== 17 || stage.runtimeScale !== 2 || collision.blocked.length !== 680) {
            errorRef.current?.("스테이지 데이터 검증에 실패했습니다.");
            return;
          }

          this.add.image(0, 64, "stage").setOrigin(0);
          this.createAnimations();
          const actorMap = new Map(spawnData.actors.map((actor) => [actor.id, actor]));
          const incidentMap = new Map(spawnData.incidents.map((incident) => [incident.properties.incident_id, incident]));

          for (const robot of ROBOTS) {
            const actor = actorMap.get(robot);
            if (!actor) continue;
            const start: [number, number] = [actor.pixel[0], actor.pixel[1] + spawnData.runtimeHudOffsetY];
            this.starts.set(robot, start);
            this.add.image(start[0], start[1] + 10, "shadow").setScale(2).setDepth(8).setAlpha(0.55);
            const sprite = this.add.sprite(start[0], start[1], `${robot}-idle`).setScale(2).setOrigin(0.5, 0.875).setDepth(10);
            sprite.play(`${robot}-idle-anim`);
            this.robots.set(robot, sprite);
          }

          for (const incident of INCIDENTS) {
            const item = incidentMap.get(incident);
            if (!item) continue;
            const [tileX, tileY] = item.properties.interaction_tile;
            this.targets.set(incident, [tileX * 32 + 16, tileY * 32 + 16 + spawnData.runtimeHudOffsetY]);
            const position: [number, number] = [item.properties.marker_pixel[0], item.properties.marker_pixel[1] + spawnData.runtimeHudOffsetY];
            this.markerTargets.set(incident, position);
            const marker = this.add.image(position[0], position[1], `marker-${incident}`).setScale(2).setDepth(15);
            this.tweens.add({ targets: marker, y: position[1] - 7, duration: 680 + INCIDENTS.indexOf(incident) * 90, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
            this.markers.set(incident, marker);
          }

          this.planLines = this.add.graphics().setDepth(7);
          const firePoint = this.markerTargets.get("fire") ?? [300, 208];
          const bridgePoint = this.markerTargets.get("bridge") ?? [848, 336];
          const catPoint = this.markerTargets.get("cat") ?? [496, 176];
          const generatorPoint = this.markerTargets.get("generator") ?? [992, 208];
          this.fire = this.add.sprite(firePoint[0] + 8, firePoint[1] + 30, "fire").setScale(2).setDepth(12).play("fire-loop");
          this.smoke = this.add.sprite(firePoint[0] + 14, firePoint[1] - 28, "smoke").setScale(2).setDepth(11).play("smoke-loop");
          this.water = this.add.sprite(firePoint[0] + 58, firePoint[1] + 22, "water").setScale(2).setFlipX(true).setDepth(14).setVisible(false);
          this.steam = this.add.sprite(firePoint[0] + 8, firePoint[1] + 18, "steam").setScale(2).setDepth(14).setVisible(false);
          this.bridge = this.add.image(bridgePoint[0], bridgePoint[1] + 24, "bridge-broken").setDepth(9);
          this.sparks = this.add.sprite(bridgePoint[0], bridgePoint[1], "sparks").setScale(2).setDepth(14).setVisible(false);
          this.cat = this.add.sprite(catPoint[0], catPoint[1] - 26, "cat-idle").setScale(2).setDepth(13).play("cat-idle-anim");
          this.hearts = this.add.sprite(catPoint[0], catPoint[1] - 58, "hearts").setScale(2).setDepth(16).setVisible(false);
          this.generator = this.add.sprite(generatorPoint[0], generatorPoint[1] + 20, "generator-off").setScale(2).setDepth(10);
          this.electricity = this.add.sprite(generatorPoint[0] + 22, generatorPoint[1] - 8, "electricity").setScale(2).setDepth(14).play("electric-loop");
          this.restore = this.add.sprite(generatorPoint[0], generatorPoint[1], "restore").setScale(2).setDepth(16).setVisible(false);
          this.confetti = this.add.sprite(640, 360, "confetti").setScale(4).setDepth(18).setVisible(false);

          const npcPositions: [number, number][] = [[400, 360], [546, 250], [720, 450], [930, 430]];
          this.residents = ["a", "b", "c", "d"].map((npc, index) => this.add.sprite(npcPositions[index][0], npcPositions[index][1], `npc-${npc}-idle`).setScale(2).setOrigin(0.5, 0.875).setDepth(9).play(`npc-${npc}-idle-anim`));
          sceneRef.current = this;
          this.setOperationPhase(phaseRef.current);
        }

        private createAnimations() {
          const add = (key: string, texture: string, end: number, frameRate: number, repeat = -1) => {
            if (!this.anims.exists(key)) this.anims.create({ key, frames: this.anims.generateFrameNumbers(texture, { start: 0, end }), frameRate, repeat });
          };
          for (const robot of ROBOTS) {
            add(`${robot}-idle-anim`, `${robot}-idle`, 3, 4);
            add(`${robot}-walk-anim`, `${robot}-walk`, 5, 8);
            add(`${robot}-action-anim`, `${robot}-action`, 7, 10);
            add(`${robot}-celebrate-anim`, `${robot}-celebrate`, 5, 8);
          }
          for (const npc of ["a", "b", "c", "d"]) { add(`npc-${npc}-idle-anim`, `npc-${npc}-idle`, 3, 4); add(`npc-${npc}-cheer-anim`, `npc-${npc}-cheer`, 5, 8); }
          add("cat-idle-anim", "cat-idle", 3, 4); add("cat-hop-anim", "cat-hop", 5, 10, 0);
          add("fire-loop", "fire", 7, 12); add("smoke-loop", "smoke", 5, 6); add("water-loop", "water", 5, 12);
          add("steam-once", "steam", 7, 10, 0); add("spark-loop", "sparks", 5, 12); add("heart-once", "hearts", 5, 10, 0);
          add("electric-loop", "electricity", 5, 10); add("restore-once", "restore", 7, 12, 0); add("confetti-once", "confetti", 9, 12, 1);
          add("generator-on-anim", "generator-on", 3, 5);
        }

        private resetSnapshot(resolved: number) {
          this.planLines?.clear();
          for (const robot of ROBOTS) {
            const sprite = this.robots.get(robot);
            const start = this.starts.get(robot);
            if (!sprite || !start) continue;
            this.tweens.killTweensOf(sprite);
            sprite.setPosition(start[0], start[1]).setAlpha(1).setVisible(true).play(`${robot}-idle-anim`, true);
          }
          INCIDENTS.forEach((incident, index) => {
            const marker = this.markers.get(incident);
            if (marker) marker.setAlpha(index < resolved ? 0.18 : 1).setScale(index < resolved ? 1.35 : 2);
          });
          this.fire?.setVisible(resolved < 1).setAlpha(1).play("fire-loop", true);
          this.smoke?.setVisible(resolved < 1).setAlpha(1).play("smoke-loop", true);
          this.water?.setVisible(false); this.steam?.setVisible(false); this.sparks?.setVisible(false); this.hearts?.setVisible(false); this.restore?.setVisible(false); this.confetti?.setVisible(false);
          this.bridge?.setTexture(resolved >= 2 ? "bridge-repaired" : "bridge-broken");
          this.cat?.setVisible(resolved < 3).play("cat-idle-anim", true);
          if (resolved >= 4) this.generator?.setTexture("generator-on", 0).play("generator-on-anim", true);
          else this.generator?.stop().setTexture("generator-off");
          this.electricity?.setVisible(resolved < 4).play("electric-loop", true);
          this.residents.forEach((resident, index) => resident.play(`npc-${["a", "b", "c", "d"][index]}-idle-anim`, true));
        }

        private moveRobot(robot: RobotId, incident: IncidentId, duration: number, onArrive: () => void) {
          const sprite = this.robots.get(robot); const target = this.targets.get(incident);
          if (!sprite || !target) return;
          sprite.play(`${robot}-walk-anim`, true);
          this.tweens.add({ targets: sprite, x: target[0], y: target[1], duration, ease: "Sine.easeInOut", onComplete: () => { sprite.play(`${robot}-action-anim`, true); onArrive(); } });
        }

        setOperationPhase(next: OperationPhase) {
          if (!this.planLines || this.robots.size === 0 || next === this.currentPhase && next !== "idle") return;
          this.currentPhase = next;
          const resolved = next === "bridge" ? 1 : next === "cat" ? 2 : next === "generator" ? 3 : next === "complete" ? 4 : 0;
          this.resetSnapshot(resolved);

          if (next === "analyzing") this.cameras.main.flash(180, 57, 191, 242, false);
          if (next === "preview") {
            const assignments: Array<[RobotId, IncidentId, number]> = [["aqua", "fire", 0x39bff2], ["fix", "bridge", 0xffd34e], ["buddy", "cat", 0xff6577]];
            for (const [robot, incident, color] of assignments) {
              const from = this.starts.get(robot); const to = this.markerTargets.get(incident); if (!from || !to) continue;
              this.planLines.lineStyle(5, color, 0.78); this.planLines.lineBetween(from[0], from[1], to[0], to[1]);
            }
          }
          if (next === "fire") this.moveRobot("aqua", "fire", 900, () => { this.water?.setVisible(true).play("water-loop"); this.tweens.add({ targets: [this.fire, this.smoke], alpha: 0.35, duration: 1200 }); this.steam?.setVisible(true).play("steam-once"); });
          if (next === "bridge") this.moveRobot("fix", "bridge", 1050, () => { this.sparks?.setVisible(true).play("spark-loop"); this.time.delayedCall(900, () => this.bridge?.setTexture("bridge-repaired")); });
          if (next === "cat") this.moveRobot("buddy", "cat", 950, () => { this.cat?.play("cat-hop-anim", true); this.hearts?.setVisible(true).play("heart-once"); this.time.delayedCall(850, () => this.cat?.setVisible(false)); });
          if (next === "generator") this.moveRobot("fix", "generator", 1100, () => { this.restore?.setVisible(true).play("restore-once"); this.electricity?.setVisible(false); this.generator?.setTexture("generator-on", 0).play("generator-on-anim", true); });
          if (next === "complete") {
            const positions: [number, number][] = [[555, 430], [640, 420], [725, 430]];
            ROBOTS.forEach((robot, index) => { const sprite = this.robots.get(robot); if (sprite) sprite.setPosition(...positions[index]).play(`${robot}-celebrate-anim`, true); });
            this.residents.forEach((resident, index) => resident.play(`npc-${["a", "b", "c", "d"][index]}-cheer-anim`, true));
            this.confetti?.setVisible(true).play("confetti-once");
            this.cameras.main.flash(320, 255, 211, 78, false);
          }
        }
      }

      const scene = new RescueScene();
      game = new Phaser.Game({ type: Phaser.AUTO, width: 1280, height: 720, parent: containerRef.current, transparent: true, pixelArt: true, roundPixels: true, antialias: false, banner: false, scene });
    })().catch((error: Error) => errorRef.current?.(error.message));

    return () => { disposed = true; sceneRef.current = null; game?.destroy(true); };
  }, []);

  return <div className="phaser-canvas" ref={containerRef} aria-label="도트 마을 구조 작전 애니메이션" role="img" />;
}
