// src/hooks/useGameLogic.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import type {
    GameState, PlayerState, EnemyState, ProjectileState, CameraState, TouchState,
    WorldObjectData, StationData, Point, TouchControlState, TouchShootState
} from '../types';
import { InfiniteWorldManager } from '../logic/infinite-world-manager';
import { distance, distanceSq, loadPlayerPosition, savePlayerPosition } from '../logic/utils';
import * as C from '../config'; // Import config constants

const INITIAL_TOUCH_CONTROL_STATE: TouchControlState = {
    active: false, id: null, startX: 0, startY: 0, currentX: 0, currentY: 0
};
const INITIAL_TOUCH_SHOOT_STATE: TouchShootState = {
    active: false, id: null, x: 0, y: 0
};

let enemyIdCounter = 0;
let projectileIdCounter = 0;

export function useGameLogic() {
    const worldManager = useRef<InfiniteWorldManager | null>(null);
    const saveIntervalId = useRef<NodeJS.Timeout | null>(null);

    const [gameState, setGameState] = useState<GameState>(() => {
        // Load initial position synchronously during initialization
        const initialPlayerPos = loadPlayerPosition(C.LOCAL_STORAGE_COORDS_KEY);
        return {
            player: {
                id: 'player',
                x: initialPlayerPos.x,
                y: initialPlayerPos.y,
                vx: 0,
                vy: 0,
                size: C.PLAYER_SIZE,
                radius: C.PLAYER_SIZE / 2,
                angle: -Math.PI / 2,
            },
            enemies: [],
            projectiles: [],
            visibleBackgroundObjects: [],
            camera: { x: 0, y: 0 }, // Will be updated based on player pos
            touchState: {
                move: { ...INITIAL_TOUCH_CONTROL_STATE },
                shoot: { ...INITIAL_TOUCH_SHOOT_STATE },
            },
            lastEnemySpawnTime: 0,
            lastShotTime: 0,
            isRunning: true,
        };
    });

    // Initialize World Manager and load initial objects/enemies
    useEffect(() => {
        if (!worldManager.current) {
            worldManager.current = new InfiniteWorldManager(C.WORLD_CONFIG);

            // Set initial camera based on loaded player position
            const initialCameraX = gameState.player.x - C.GAME_WIDTH / 2;
            const initialCameraY = gameState.player.y - C.GAME_VIEW_HEIGHT / 2;

            // Get initial background objects
            const initialBgObjects = worldManager.current.getObjectsInView(
                initialCameraX,
                initialCameraY,
                C.GAME_WIDTH,
                C.GAME_VIEW_HEIGHT
            );

            // Spawn initial enemies near player
            const initialEnemies: EnemyState[] = [];
            for (let i = 0; i < 3; i++) {
                initialEnemies.push(spawnEnemyNearPlayer(gameState.player));
            }

            setGameState(prev => ({
                ...prev,
                camera: { x: initialCameraX, y: initialCameraY },
                visibleBackgroundObjects: initialBgObjects,
                enemies: initialEnemies,
                lastEnemySpawnTime: Date.now(), // Set spawn time after initial spawn
            }));
        }
    }, [gameState.player]); // Re-run only if player ref changes (shouldn't)


    // Setup Save Interval
    useEffect(() => {
        if (saveIntervalId.current) clearInterval(saveIntervalId.current);
        saveIntervalId.current = setInterval(() => {
            // Access player state via a functional update to ensure freshness
            setGameState(currentGameState => {
                savePlayerPosition(C.LOCAL_STORAGE_COORDS_KEY, {
                    x: currentGameState.player.x,
                    y: currentGameState.player.y
                });
                return currentGameState; // No state change needed here
            });
        }, C.SAVE_COORDS_INTERVAL);

        return () => {
            if (saveIntervalId.current) clearInterval(saveIntervalId.current);
        };
    }, []); // Run only once on mount

    // --- Spawning Logic ---
    const spawnEnemyNearPlayer = (player: PlayerState): EnemyState => {
        const spawnDist = C.GAME_WIDTH * 0.8;
        const angle = Math.random() * Math.PI * 2;
        const spawnX = player.x + Math.cos(angle) * spawnDist;
        const spawnY = player.y + Math.sin(angle) * spawnDist;
        return {
            id: `enemy_${enemyIdCounter++}`,
            x: spawnX,
            y: spawnY,
            size: C.ENEMY_SIZE,
            radius: C.ENEMY_SIZE / 2,
            angle: Math.random() * Math.PI * 2, // Initial angle
        };
    };

    const shootProjectile = useCallback((player: PlayerState): ProjectileState => {
        return {
            id: `proj_${projectileIdCounter++}`,
            x: player.x,
            y: player.y,
            vx: Math.cos(player.angle) * C.PROJECTILE_SPEED,
            vy: Math.sin(player.angle) * C.PROJECTILE_SPEED,
            radius: C.PROJECTILE_SIZE / 2,
            life: C.PROJECTILE_LIFESPAN_FRAMES,
        };
    }, []);


    // --- Game Update Function (called by useTick) ---
    const updateGame = useCallback((delta: number) => { // delta is usually fraction of frame, ~1 for 60fps
        setGameState(prev => {
            if (!prev.isRunning || !worldManager.current) return prev;

            const now = Date.now();
            let {
                player, enemies, projectiles, camera, touchState,
                lastEnemySpawnTime, lastShotTime, visibleBackgroundObjects
            } = { ...prev }; // Shallow copy to modify

            let newProjectiles: ProjectileState[] = [];

            // --- Input Handling & Player Update ---
            let playerDx = 0;
            let playerDy = 0;
            if (touchState.move.active) {
                const dx = touchState.move.currentX - touchState.move.startX;
                const dy = touchState.move.currentY - touchState.move.startY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const maxDist = C.TOUCH_JOYSTICK_OUTER_RADIUS; // Use joystick radius
                if (dist > 0) {
                    const moveScale = Math.min(dist, maxDist) / maxDist;
                    const moveAngle = Math.atan2(dy, dx);
                    playerDx = Math.cos(moveAngle) * moveScale * C.PLAYER_SPEED * delta;
                    playerDy = Math.sin(moveAngle) * moveScale * C.PLAYER_SPEED * delta;
                    player.angle = moveAngle; // Update player angle based on move direction
                }
            }
            player.x += playerDx;
            player.y += playerDy;
            player.vx = playerDx / delta; // Store velocity for potential other uses
            player.vy = playerDy / delta;

            // Shooting
            if (touchState.shoot.active && now - lastShotTime > C.SHOOT_COOLDOWN) {
                newProjectiles.push(shootProjectile(player));
                lastShotTime = now;
            }

            // --- Camera Update ---
            camera.x = player.x - C.GAME_WIDTH / 2;
            camera.y = player.y - C.GAME_VIEW_HEIGHT / 2;

            // --- Background Objects Update ---
            visibleBackgroundObjects = worldManager.current.getObjectsInView(
                camera.x, camera.y, C.GAME_WIDTH, C.GAME_VIEW_HEIGHT
            );
            const currentTimeSeconds = now / 1000.0;
            visibleBackgroundObjects = visibleBackgroundObjects.map(obj => {
                if (obj.type === 'station') {
                    const station = obj as StationData;
                    let angle = (station.initialAngle + currentTimeSeconds * station.rotationSpeed) % (Math.PI * 2);
                     if (angle < 0) {
                        angle += Math.PI * 2;
                     }
                    return { ...station, angle: angle };
                }
                return obj;
            });


            // --- Projectile Update & Culling ---
            projectiles = projectiles
                .map(p => ({
                    ...p,
                    x: p.x + p.vx * delta,
                    y: p.y + p.vy * delta,
                    life: p.life - delta,
                }))
                .filter(p => {
                    const despawnRadius = C.ENEMY_DESPAWN_RADIUS * C.PROJECTILE_DESPAWN_RADIUS_MULTIPLIER;
                    const distSqToPlayer = distanceSq(p, player);
                    return p.life > 0 && distSqToPlayer < (despawnRadius * despawnRadius);
                });
            projectiles.push(...newProjectiles); // Add newly shot projectiles

            // --- Enemy Update & Culling ---
             enemies = enemies.map(enemy => {
                const dx = player.x - enemy.x;
                const dy = player.y - enemy.y;
                const distToPlayer = Math.sqrt(dx*dx + dy*dy);
                 let newX = enemy.x;
                 let newY = enemy.y;
                 let newAngle = enemy.angle;

                 // Only move if not too close
                 if (distToPlayer > enemy.radius + player.radius + 5) {
                    newAngle = Math.atan2(dy, dx);
                    newX += Math.cos(newAngle) * C.ENEMY_SPEED * delta;
                    newY += Math.sin(newAngle) * C.ENEMY_SPEED * delta;
                 }
                return { ...enemy, x: newX, y: newY, angle: newAngle };
            });

            // Despawn far enemies
            const enemyIdsToCull = worldManager.current.getEnemiesToDespawn(
                enemies, player.x, player.y, C.ENEMY_DESPAWN_RADIUS
            );
            if (enemyIdsToCull.length > 0) {
                const cullSet = new Set(enemyIdsToCull);
                enemies = enemies.filter(enemy => !cullSet.has(enemy.id));
            }

            // Spawn new enemies
            if (now - lastEnemySpawnTime > C.ENEMY_SPAWN_INTERVAL && enemies.length < C.MAX_ENEMIES) {
                enemies.push(spawnEnemyNearPlayer(player));
                lastEnemySpawnTime = now;
            }


            // --- Collision Detection ---
            const hitEnemyIds = new Set<string>();
            const hitProjectileIds = new Set<string>();
            const hitStationIds = new Set<string>(); // Stations don't get destroyed, but projectiles do

            // Projectile vs Enemy/Station
            projectiles.forEach(proj => {
                 if (hitProjectileIds.has(proj.id)) return; // Already hit something

                 // Vs Enemies
                enemies.forEach(enemy => {
                    if (hitEnemyIds.has(enemy.id)) return; // Already hit
                    if (distance(proj, enemy) < proj.radius + enemy.radius) {
                        hitEnemyIds.add(enemy.id);
                        hitProjectileIds.add(proj.id);
                    }
                });

                if (hitProjectileIds.has(proj.id)) return; // Stop checking if it hit an enemy

                // Vs Stations
                visibleBackgroundObjects.forEach(bgObj => {
                     if (bgObj.type === 'station') {
                        const station = bgObj as StationData;
                         if (distance(proj, station) < proj.radius + station.radius) {
                             hitProjectileIds.add(proj.id);
                             // hitStationIds.add(station.id); // Stations are indestructible for now
                         }
                     }
                });
            });

            // Player vs Enemy
            enemies.forEach(enemy => {
                if (hitEnemyIds.has(enemy.id)) return; // Already hit by projectile
                if (distance(player, enemy) < player.radius + enemy.radius) {
                    hitEnemyIds.add(enemy.id);
                    console.log("Collision with enemy!");
                    // Potentially add player damage logic here
                }
            });

            // Player vs Station (Collision Response - Push player out)
            visibleBackgroundObjects.forEach(bgObj => {
                if (bgObj.type === 'station') {
                    const station = bgObj as StationData;
                    const distPlayerStation = distance(player, station);
                    if (distPlayerStation < player.radius + station.radius) {
                        const angle = Math.atan2(player.y - station.y, player.x - station.x);
                        const overlap = player.radius + station.radius - distPlayerStation;
                        const pushAmount = overlap + 1; // Push slightly further than overlap
                        player.x += Math.cos(angle) * pushAmount;
                        player.y += Math.sin(angle) * pushAmount;
                        player.vx = 0; // Stop player movement on collision
                        player.vy = 0;
                        console.log("Collision with station!");
                        // No need to break, check all stations just in case of overlap
                    }
                }
            });


             // --- Filter out hit objects ---
            const finalEnemies = enemies.filter(e => !hitEnemyIds.has(e.id));
            const finalProjectiles = projectiles.filter(p => !hitProjectileIds.has(p.id));

            // --- Return updated state ---
            return {
                ...prev,
                player,
                enemies: finalEnemies,
                projectiles: finalProjectiles,
                visibleBackgroundObjects,
                camera,
                lastEnemySpawnTime,
                lastShotTime,
                // touchState is updated separately by handlers
            };
        });
    }, [shootProjectile]); // Include shootProjectile in dependency array


    // --- Input Handlers ---
    const handlePointerDown = useCallback((event: PIXI.FederatedPointerEvent) => {
        const touchX = event.global.x;
        const touchY = event.global.y;
        const touchId = event.pointerId;

        setGameState(prev => {
            const newState = { ...prev };
            let touchState = { ...newState.touchState }; // Copy touch state

            // Movement touch (left side, below HUD)
            if (touchX < C.GAME_WIDTH / 2 && touchY < C.GAME_VIEW_HEIGHT && !touchState.move.active) {
                touchState.move = {
                    active: true,
                    id: touchId,
                    startX: touchX,
                    startY: touchY,
                    currentX: touchX,
                    currentY: touchY,
                };
            }
            // Shooting touch (right side, below HUD)
            else if (touchX >= C.GAME_WIDTH / 2 && touchY < C.GAME_VIEW_HEIGHT && !touchState.shoot.active) {
                touchState.shoot = {
                    active: true,
                    id: touchId,
                    x: touchX,
                    y: touchY,
                };
            }
             newState.touchState = touchState;
            return newState;
        });
    }, []);

    const handlePointerMove = useCallback((event: PIXI.FederatedPointerEvent) => {
        const touchX = event.global.x;
        const touchY = event.global.y;
        const touchId = event.pointerId;

        setGameState(prev => {
             const newState = { ...prev };
             let touchState = { ...newState.touchState }; // Copy touch state

            if (touchState.move.active && touchId === touchState.move.id) {
                 // Allow moving finger anywhere, joystick position calculation is visual only
                touchState.move = { ...touchState.move, currentX: touchX, currentY: touchY };
            } else if (touchState.shoot.active && touchId === touchState.shoot.id) {
                // Update shoot indicator position only if still in game view
                 if (touchY < C.GAME_VIEW_HEIGHT) {
                     touchState.shoot = { ...touchState.shoot, x: touchX, y: touchY };
                 }
            }
             newState.touchState = touchState;
             return newState;
        });
    }, []);

    const handlePointerUpOrLeave = useCallback((event: PIXI.FederatedPointerEvent) => {
        const touchId = event.pointerId;

        setGameState(prev => {
             const newState = { ...prev };
             let touchState = { ...newState.touchState }; // Copy touch state
             let player = { ...newState.player }; // Copy player state

            if (touchState.move.active && touchId === touchState.move.id) {
                touchState.move = { ...INITIAL_TOUCH_CONTROL_STATE };
                player.vx = 0; // Stop player velocity
                player.vy = 0;
            }
            if (touchState.shoot.active && touchId === touchState.shoot.id) {
                touchState.shoot = { ...INITIAL_TOUCH_SHOOT_STATE };
            }

             newState.touchState = touchState;
             newState.player = player;
             return newState;
        });
    }, []);

    return {
        gameState,
        updateGame,
        handlePointerDown,
        handlePointerMove,
        handlePointerUpOrLeave,
    };
}