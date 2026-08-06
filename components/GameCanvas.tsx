"use client";

import { useEffect, useRef } from "react";
import { canComplete, deriveWorldSnapshot, type IncidentId as LegacyIncidentId } from "@/lib/game-state";
import { NPC_DIALOGUE_IDS } from "@/lib/npc-dialogue";
import type { ActionId, IncidentId, RobotId } from "@/lib/rescue-engine";
import { STAGE_MAPS, STAGE_MAP_SCALE_Y, STAGE_MAP_TOP, STAGE_MAP_VIEWPORT_HEIGHT, type StageMapDefinition } from "@/lib/stage-maps";

export type OperationPhase = "idle" | "analyzing" | "preview" | "fire" | "bridge" | "cat" | "generator" | "complete";
export type ActiveRobotMission = { robotId: RobotId; incidentId: IncidentId; actionId: ActionId };

type StageSpawnData = { runtimeHudOffsetY: number };
type CollisionData = { width: number; height: number; blocked: number[] };

const ASSET = "/assets/pixel-panic";
const ROBOTS: RobotId[] = ["aqua", "fix", "buddy"];
const LEGACY_INCIDENTS: LegacyIncidentId[] = ["fire", "bridge", "cat", "generator"];

export function GameCanvas({ phase, completedIncidents, missions, stageMap, panX = 0, onError, onRobotArrive }: { phase: OperationPhase; completedIncidents: readonly LegacyIncidentId[]; missions: readonly ActiveRobotMission[]; stageMap: StageMapDefinition; panX?: number; onError?: (message: string) => void; onRobotArrive?: (mission: ActiveRobotMission) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef(phase);
  const completedRef = useRef<readonly LegacyIncidentId[]>(completedIncidents);
  const missionsRef = useRef<readonly ActiveRobotMission[]>(missions);
  const stageMapRef = useRef(stageMap);
  const panRef = useRef(panX);
  const errorRef = useRef(onError);
  const robotArriveRef = useRef(onRobotArrive);
  const sceneRef = useRef<{ setOperationState: (next: OperationPhase, completed: readonly LegacyIncidentId[], activeMissions: readonly ActiveRobotMission[]) => void; setStageMap: (next: StageMapDefinition) => void; setPanX: (next: number) => void } | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
    completedRef.current = completedIncidents;
    missionsRef.current = missions;
    sceneRef.current?.setOperationState(phase, completedIncidents, missions);
  }, [phase, completedIncidents, missions]);
  useEffect(() => {
    stageMapRef.current = stageMap;
    sceneRef.current?.setStageMap(stageMap);
  }, [stageMap]);
  useEffect(() => {
    panRef.current = panX;
    sceneRef.current?.setPanX(panX);
  }, [panX]);
  useEffect(() => { errorRef.current = onError; }, [onError]);
  useEffect(() => { robotArriveRef.current = onRobotArrive; }, [onRobotArrive]);

  useEffect(() => {
    let game: import("phaser").Game | null = null;
    let disposed = false;

    void (async () => {
      const Phaser = await import("phaser");
      if (!containerRef.current || disposed) return;

      class RescueScene extends Phaser.Scene {
        private robots = new Map<RobotId, Phaser.GameObjects.Sprite>();
        private shadows = new Map<RobotId, Phaser.GameObjects.Image>();
        private markers = new Map<LegacyIncidentId, Phaser.GameObjects.Image>();
        private starts = new Map<RobotId, [number, number]>();
        private markerTargets = new Map<LegacyIncidentId, [number, number]>();
        private missionSignatures = new Map<RobotId, string>();
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
        private collision?: CollisionData;
        private baseCollision?: CollisionData;
        private hudOffsetY = 64;
        private currentPhase: OperationPhase = "idle";
        private completedSignature = "__uninitialized__";
        private stageBackground?: Phaser.GameObjects.Image;
        private stageBackgroundLeft?: Phaser.GameObjects.Image;
        private stageBackgroundRight?: Phaser.GameObjects.Image;
        private worldLayer?: Phaser.GameObjects.Container;
        private activeMap: StageMapDefinition = stageMapRef.current;

        constructor() { super("rescue"); }

        preload() {
          this.load.on("loaderror", (file: { key?: string }) => errorRef.current?.(`에셋 ${file.key ?? "unknown"} 로딩에 실패했습니다.`));
          for (const map of STAGE_MAPS) this.load.image(`stage-${map.id}`, `${ASSET}/world/maps/${map.file}`);
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
          for (const incident of LEGACY_INCIDENTS) this.load.image(`marker-${incident}`, `${ASSET}/world/incidents/pp_world_incident_marker_${incident}.png`);
        }

        create() {
          const stage = this.cache.json.get("stage-data") as { width: number; height: number; runtimeScale: number };
          const collision = this.cache.json.get("collision") as CollisionData;
          const spawnData = this.cache.json.get("spawns") as StageSpawnData;
          if (stage.width !== 40 || stage.height !== 17 || stage.runtimeScale !== 2 || collision.blocked.length !== 680) {
            errorRef.current?.("스테이지 데이터 검증에 실패했습니다.");
            return;
          }
          this.baseCollision = collision;
          this.activeMap = stageMapRef.current;
          this.collision = this.activeMap.layout === "classic" ? collision : undefined;
          this.hudOffsetY = spawnData.runtimeHudOffsetY;

          this.stageBackgroundLeft = this.add.image(0, 64, `stage-${this.activeMap.id}`).setOrigin(1, 0).setFlipX(true);
          this.stageBackground = this.add.image(0, 64, `stage-${this.activeMap.id}`).setOrigin(0);
          this.stageBackgroundRight = this.add.image(1280, 64, `stage-${this.activeMap.id}`).setOrigin(0).setFlipX(true);
          this.createAnimations();

          for (const robot of ROBOTS) {
            const start: [number, number] = [...this.activeMap.robotStarts[robot]];
            this.starts.set(robot, start);
            const shadow = this.add.image(start[0], start[1] + 10, "shadow").setScale(2).setDepth(8).setAlpha(0.55);
            const sprite = this.add.sprite(start[0], start[1], `${robot}-idle`).setScale(2).setOrigin(0.5, 0.875).setDepth(10);
            sprite.play(`${robot}-idle-anim`);
            this.robots.set(robot, sprite);
            this.shadows.set(robot, shadow);
          }

          for (const incident of LEGACY_INCIDENTS) {
            const position: [number, number] = [...this.activeMap.legacyTargets[incident]];
            this.markerTargets.set(incident, position);
            const marker = this.add.image(position[0], position[1], `marker-${incident}`).setScale(2).setDepth(15).setVisible(false);
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

          this.residents = ["a", "b", "c", "d"].map((npc, index) => {
            const position = this.activeMap.npcPositions[NPC_DIALOGUE_IDS[index]];
            return this.add.sprite(position[0], position[1], `npc-${npc}-idle`).setScale(2).setOrigin(0.5, 0.875).setDepth(9).play(`npc-${npc}-idle-anim`);
          });
          const aspectLockedObjects = [
            ...this.shadows.values(), ...this.robots.values(), ...this.markers.values(),
            this.fire, this.smoke, this.water, this.steam, this.bridge, this.sparks,
            this.cat, this.hearts, this.generator, this.electricity, this.restore, this.confetti,
            ...this.residents,
          ].filter((object): object is Phaser.GameObjects.Image | Phaser.GameObjects.Sprite => Boolean(object));
          for (const object of aspectLockedObjects) object.setScale(object.scaleX, object.scaleY / STAGE_MAP_SCALE_Y);
          const worldObjects = [this.stageBackgroundLeft, this.stageBackground, this.stageBackgroundRight, this.planLines, ...aspectLockedObjects]
            .filter((object): object is Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | Phaser.GameObjects.Graphics => Boolean(object))
            .sort((first, second) => first.depth - second.depth);
          this.worldLayer = this.add.container(panRef.current, STAGE_MAP_TOP * (1 - STAGE_MAP_SCALE_Y), worldObjects).setScale(1, STAGE_MAP_SCALE_Y);
          this.positionWorldElements();
          sceneRef.current = this;
          this.setOperationState(phaseRef.current, completedRef.current, missionsRef.current);
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

        setStageMap(next: StageMapDefinition) {
          if (!this.stageBackground || !this.textures.exists(`stage-${next.id}`) || this.activeMap.id === next.id) return;
          const backgrounds = [this.stageBackgroundLeft, this.stageBackground, this.stageBackgroundRight].filter((background): background is Phaser.GameObjects.Image => Boolean(background));
          this.tweens.killTweensOf(backgrounds);
          this.activeMap = next;
          this.collision = next.layout === "classic" ? this.baseCollision : undefined;
          for (const background of backgrounds) background.setTexture(`stage-${next.id}`).setAlpha(0.42);
          this.tweens.add({ targets: backgrounds, alpha: 1, duration: 260, ease: "Quad.easeOut" });
          for (const robot of ROBOTS) this.starts.set(robot, [...next.robotStarts[robot]]);
          for (const incident of LEGACY_INCIDENTS) {
            const position: [number, number] = [...next.legacyTargets[incident]];
            this.markerTargets.set(incident, position);
            this.markers.get(incident)?.setPosition(position[0], position[1]);
          }
          this.residents.forEach((resident, index) => resident.setPosition(...next.npcPositions[NPC_DIALOGUE_IDS[index]]));
          this.positionWorldElements();
          const phase = this.currentPhase;
          this.currentPhase = "idle";
          this.completedSignature = "__uninitialized__";
          this.missionSignatures.clear();
          this.resetActorsToBase();
          this.setOperationState(phase, completedRef.current, missionsRef.current);
        }

        setPanX(next: number) {
          this.worldLayer?.setX(next);
        }

        private positionWorldElements() {
          const firePoint = this.activeMap.legacyTargets.fire;
          const bridgePoint = this.activeMap.legacyTargets.bridge;
          const catPoint = this.activeMap.legacyTargets.cat;
          const generatorPoint = this.activeMap.legacyTargets.generator;
          this.fire?.setPosition(firePoint[0] + 8, firePoint[1] + 30);
          this.smoke?.setPosition(firePoint[0] + 14, firePoint[1] - 28);
          this.water?.setPosition(firePoint[0] + 58, firePoint[1] + 22);
          this.steam?.setPosition(firePoint[0] + 8, firePoint[1] + 18);
          this.bridge?.setPosition(bridgePoint[0], bridgePoint[1] + 24);
          this.sparks?.setPosition(bridgePoint[0], bridgePoint[1]);
          this.cat?.setPosition(catPoint[0], catPoint[1] - 26);
          this.hearts?.setPosition(catPoint[0], catPoint[1] - 58);
          this.generator?.setPosition(generatorPoint[0], generatorPoint[1] + 20);
          this.electricity?.setPosition(generatorPoint[0] + 22, generatorPoint[1] - 8);
          this.restore?.setPosition(generatorPoint[0], generatorPoint[1]);
          const starts = ROBOTS.map((robot) => this.activeMap.robotStarts[robot]);
          this.confetti?.setPosition(starts.reduce((sum, point) => sum + point[0], 0) / starts.length, Math.max(150, starts[0][1] - 65));
        }

        private resetActorsToBase() {
          for (const robot of ROBOTS) this.resetRobotToBase(robot);
        }

        private resetRobotToBase(robot: RobotId) {
          const sprite = this.robots.get(robot);
          const shadow = this.shadows.get(robot);
          const start = this.starts.get(robot);
          if (!sprite || !start) return;
          this.tweens.killTweensOf(sprite);
          sprite.setPosition(start[0], start[1]).setAlpha(1).setVisible(true).play(`${robot}-idle-anim`, true);
          shadow?.setPosition(start[0], start[1] + 10).setVisible(true);
          this.writeRobotPosition(robot, start[0], start[1]);
          if (containerRef.current) containerRef.current.dataset[`robot${robot[0].toUpperCase()}${robot.slice(1)}Movement`] = "idle";
        }

        private writeRobotPosition(robot: RobotId, x: number, y: number) {
          if (containerRef.current) containerRef.current.dataset[`robot${robot[0].toUpperCase()}${robot.slice(1)}Position`] = `${Math.round(x)},${Math.round(y)}`;
        }

        private applyWorldSnapshot(completed: readonly LegacyIncidentId[]) {
          const snapshot = deriveWorldSnapshot(completed);
          if (containerRef.current) {
            containerRef.current.dataset.worldCompleted = LEGACY_INCIDENTS.filter((incident) => completed.includes(incident)).join(",");
            containerRef.current.dataset.worldResolvedCount = String(snapshot.resolvedCount);
          }
          this.planLines?.clear();
          LEGACY_INCIDENTS.forEach((incident) => {
            const resolved = completed.includes(incident);
            const marker = this.markers.get(incident);
            if (marker) {
              const markerScale = resolved ? 1.35 : 2;
              marker.setAlpha(resolved ? 0.18 : 1).setScale(markerScale, markerScale / STAGE_MAP_SCALE_Y);
            }
          });
          this.fire?.setVisible(!snapshot.fireResolved).setAlpha(1).play("fire-loop", true);
          this.smoke?.setVisible(!snapshot.fireResolved).setAlpha(1).play("smoke-loop", true);
          this.water?.setVisible(false); this.steam?.setVisible(false); this.sparks?.setVisible(false); this.hearts?.setVisible(false); this.restore?.setVisible(false); this.confetti?.setVisible(false);
          this.bridge?.setVisible(this.activeMap.legacyStructureOverlays).setTexture(snapshot.bridgeResolved ? "bridge-repaired" : "bridge-broken");
          this.cat?.setVisible(!snapshot.catResolved).play("cat-idle-anim", true);
          this.generator?.setVisible(this.activeMap.legacyStructureOverlays);
          if (snapshot.generatorResolved) this.generator?.setTexture("generator-on", 0).play("generator-on-anim", true);
          else this.generator?.stop().setTexture("generator-off");
          this.electricity?.setVisible(!snapshot.generatorResolved).play("electric-loop", true);
          this.residents.forEach((resident, index) => resident.play(`npc-${["a", "b", "c", "d"][index]}-idle-anim`, true));
        }

        private findWalkPath(fromX: number, fromY: number, toX: number, toY: number): Array<[number, number]> {
          const collision = this.collision;
          if (!collision) return [[toX, toY]];
          const toTile = (x: number, y: number): [number, number] => [
            Math.max(0, Math.min(collision.width - 1, Math.floor(x / 32))),
            Math.max(0, Math.min(collision.height - 1, Math.floor((y - this.hudOffsetY) / 32))),
          ];
          const start = toTile(fromX, fromY);
          const goal = toTile(toX, toY);
          const key = (x: number, y: number) => y * collision.width + x;
          const queue: Array<[number, number]> = [start];
          const previous = new Map<number, number>();
          const visited = new Set<number>([key(...start)]);
          const goalKey = key(...goal);

          for (let cursor = 0; cursor < queue.length && !visited.has(goalKey); cursor += 1) {
            const [x, y] = queue[cursor];
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
              const nx = x + dx; const ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= collision.width || ny >= collision.height) continue;
              const nextKey = key(nx, ny);
              if (visited.has(nextKey) || collision.blocked[nextKey] === 1 && nextKey !== goalKey) continue;
              visited.add(nextKey); previous.set(nextKey, key(x, y)); queue.push([nx, ny]);
            }
          }
          if (!visited.has(goalKey)) return [[toX, toY]];

          const tiles: Array<[number, number]> = [];
          let cursor = goalKey;
          while (cursor !== key(...start)) {
            tiles.push([cursor % collision.width, Math.floor(cursor / collision.width)]);
            const prior = previous.get(cursor);
            if (prior === undefined) return [[toX, toY]];
            cursor = prior;
          }
          tiles.reverse();
          const points: Array<[number, number]> = [];
          let priorDirection = "";
          for (let index = 0; index < tiles.length; index += 1) {
            const previousTile = index === 0 ? start : tiles[index - 1];
            const tile = tiles[index];
            const direction = `${tile[0] - previousTile[0]},${tile[1] - previousTile[1]}`;
            if (index > 0 && direction !== priorDirection) {
              const turn = tiles[index - 1];
              points.push([turn[0] * 32 + 16, turn[1] * 32 + 16 + this.hudOffsetY]);
            }
            priorDirection = direction;
          }
          points.push([toX, toY]);
          return points;
        }

        private densifyWalkRoute(fromX: number, fromY: number, waypoints: readonly [number, number][]): Array<[number, number]> {
          const dense: Array<[number, number]> = [];
          let startX = fromX;
          let startY = fromY;
          for (const [targetX, targetY] of waypoints) {
            const distance = Math.hypot(targetX - startX, targetY - startY);
            const steps = Math.max(1, Math.ceil(distance / 28));
            for (let step = 1; step <= steps; step += 1) {
              const progress = step / steps;
              dense.push([startX + (targetX - startX) * progress, startY + (targetY - startY) * progress]);
            }
            startX = targetX;
            startY = targetY;
          }
          return dense;
        }

        private moveRobot(robot: RobotId, incident: IncidentId, onArrive: () => void) {
          const sprite = this.robots.get(robot);
          const target = this.activeMap.incidentPositions[incident];
          if (!sprite) return;
          const shadow = this.shadows.get(robot);
          this.tweens.killTweensOf(sprite);
          sprite.play(`${robot}-walk-anim`, true);
          const customRoute = this.activeMap.routes?.[incident];
          const waypoints: Array<[number, number]> = customRoute
            ? customRoute.map(([x, y]) => [x, y])
            : this.findWalkPath(sprite.x, sprite.y, target[0], target[1]);
          const points = this.densifyWalkRoute(sprite.x, sprite.y, waypoints);
          if (containerRef.current) {
            containerRef.current.dataset[`robot${robot[0].toUpperCase()}${robot.slice(1)}Movement`] = "walking";
            containerRef.current.dataset[`robot${robot[0].toUpperCase()}${robot.slice(1)}RouteSteps`] = String(points.length);
          }
          const distances = points.map((point, index) => {
            const from = index === 0 ? [sprite.x, sprite.y] : points[index - 1];
            return Math.hypot(point[0] - from[0], point[1] - from[1]);
          });
          const totalDistance = Math.max(1, distances.reduce((sum, distance) => sum + distance, 0));
          const duration = Math.max(1000, Math.min(3800, totalDistance / 220 * 1000));
          const walk = (index: number) => {
            const point = points[index];
            if (!point) {
              sprite.play(`${robot}-action-anim`, true);
              if (containerRef.current) containerRef.current.dataset[`robot${robot[0].toUpperCase()}${robot.slice(1)}Movement`] = "working";
              onArrive();
              return;
            }
            if (Math.abs(point[0] - sprite.x) > 1) sprite.setFlipX(point[0] < sprite.x);
            this.tweens.add({
              targets: sprite,
              x: point[0], y: point[1],
              duration: Math.max(90, duration * distances[index] / totalDistance),
              ease: "Linear",
              onUpdate: () => {
                shadow?.setPosition(sprite.x, sprite.y + 10);
                this.writeRobotPosition(robot, sprite.x, sprite.y);
              },
              onComplete: () => walk(index + 1),
            });
          };
          walk(0);
        }

        private playMissionEffect(mission: ActiveRobotMission) {
          const [x, y] = this.activeMap.incidentPositions[mission.incidentId];
          if (["extinguish", "firebreak", "lower_water"].includes(mission.actionId)) {
            this.water?.setPosition(x + 46, y - 8).setVisible(true).play("water-loop", true);
            this.steam?.setPosition(x, y - 6).setVisible(true).play("steam-once", true);
            this.time.delayedCall(950, () => this.water?.setVisible(false));
          } else if (["evacuate", "carry_parts", "rescue_residents", "rescue_cat"].includes(mission.actionId)) {
            this.hearts?.setPosition(x, y - 42).setVisible(true).play("heart-once", true);
            this.time.delayedCall(950, () => this.hearts?.setVisible(false));
          } else {
            this.sparks?.setPosition(x, y - 10).setVisible(true).play("spark-loop", true);
            this.restore?.setPosition(x, y - 8).setVisible(true).play("restore-once", true);
            this.time.delayedCall(950, () => this.sparks?.setVisible(false));
          }
        }

        private syncRobotMissions(activeMissions: readonly ActiveRobotMission[]) {
          const byRobot = new Map(activeMissions.map((mission) => [mission.robotId, mission]));
          for (const robot of ROBOTS) {
            const mission = byRobot.get(robot);
            const signature = mission ? `${mission.incidentId}:${mission.actionId}` : "";
            const prior = this.missionSignatures.get(robot) ?? "";
            if (signature === prior) continue;
            this.missionSignatures.set(robot, signature);
            if (!mission) {
              this.resetRobotToBase(robot);
              if (containerRef.current) {
                delete containerRef.current.dataset[`robot${robot[0].toUpperCase()}${robot.slice(1)}Mission`];
                delete containerRef.current.dataset[`robot${robot[0].toUpperCase()}${robot.slice(1)}Target`];
              }
              continue;
            }
            const [targetX, targetY] = this.activeMap.incidentPositions[mission.incidentId];
            if (containerRef.current) {
              containerRef.current.dataset[`robot${robot[0].toUpperCase()}${robot.slice(1)}Mission`] = mission.incidentId;
              containerRef.current.dataset[`robot${robot[0].toUpperCase()}${robot.slice(1)}Target`] = `${targetX},${targetY}`;
            }
            this.moveRobot(robot, mission.incidentId, () => {
              this.playMissionEffect(mission);
              robotArriveRef.current?.(mission);
            });
          }
        }

        setOperationState(next: OperationPhase, completed: readonly LegacyIncidentId[], activeMissions: readonly ActiveRobotMission[]) {
          if (!this.planLines || this.robots.size === 0) return;
          const signature = [...completed].sort().join(",");
          if (next === "complete" && !canComplete(completed)) return;
          const phaseChanged = next !== this.currentPhase;
          const worldChanged = signature !== this.completedSignature;
          this.currentPhase = next;
          this.completedSignature = signature;
          if (worldChanged) this.applyWorldSnapshot(completed);
          this.syncRobotMissions(activeMissions);

          if (next === "analyzing") this.cameras.main.flash(180, 57, 191, 242, false);
          if (next === "preview") {
            const assignments: Array<[RobotId, LegacyIncidentId, number]> = [["aqua", "fire", 0x39bff2], ["fix", "bridge", 0xffd34e], ["buddy", "cat", 0xff6577]];
            for (const [robot, incident, color] of assignments) {
              const sprite = this.robots.get(robot); const to = this.markerTargets.get(incident); if (!sprite || !to) continue;
              this.planLines.lineStyle(5, color, 0.78); this.planLines.lineBetween(sprite.x, sprite.y, to[0], to[1]);
            }
          }
          if (next === "complete" && phaseChanged) {
            const positions: [number, number][] = this.activeMap.layout === "classic"
              ? [[555, 430], [640, 420], [725, 430]]
              : ROBOTS.map((robot) => [...this.activeMap.robotStarts[robot]]);
            ROBOTS.forEach((robot, index) => {
              const sprite = this.robots.get(robot);
              if (!sprite) return;
              sprite.setPosition(...positions[index]).play(`${robot}-celebrate-anim`, true);
              this.shadows.get(robot)?.setPosition(positions[index][0], positions[index][1] + 10);
            });
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

  return <div className="phaser-canvas" ref={containerRef} data-map-pan-x={panX} data-map-viewport-height={STAGE_MAP_VIEWPORT_HEIGHT} data-stage-map={stageMap.id} data-world-completed="" data-world-resolved-count="0" aria-label="화면 하단까지 확장된 도트 마을 구조 작전 지도" role="img" />;
}
