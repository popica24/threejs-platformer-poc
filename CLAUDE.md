# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A teaching project: a small Three.js scene built step by step for a student learning 3D on the web. It is being turned into a platformer sandbox in phases: (1) hand-written collision and (2) a platform library with behaviors and a demo course, both done; (3) a build mode with save/load; (4) platformer feel (coyote time, jump buffer and so on) and collectibles. There is no build system, package manager, bundler, linter, or test suite, and none should be added. Three.js r0.160.0 loads from the jsDelivr CDN through the `<importmap>` in `index.html` (`three` and `three/addons/`), so running it needs an internet connection.

## Running

ES modules don't load over `file://`, so serve the folder:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Conventions (important for a teaching codebase)

- **Comments are in Romanian, written without diacritics** (`//Scena = lumea in care...`). Each concept is explained inline so the student can read every file from top to bottom. New code should follow the same style and explain *why*, not only *what*.
- **The `NOU:` prefix marks code added in the current iteration** (the page title says "v2"). Use it for new additions so the student can see what changed. When code moves between files, its `NOU:` comment moves with it. Don't remove or rename existing markers, and don't bump the title version, unless the user asks.
- **No hidden shared state between modules.** Each module exports one `create*()` factory that builds its objects, keeps its state in local variables, and returns only what other modules need (objects plus `update()`-style functions). Cross-module wiring happens only in `js/main.js`.
- **Magic numbers go in `js/config.js`** when they're used in more than one place or are tuning values (speeds, smoothing rates, sizes). Values used once stay inline next to their comment.
- **Frame-rate independence is mandatory for anything animated:**
  - Scale movement by `delta`.
  - Smooth with `THREE.MathUtils.damp(x, target, k, delta)` for numbers, or `dampFactor(k, delta)` from `js/utils.js` for `Vector3.lerp` and `Color.lerp`.
  - Decay with `x *= Math.exp(-k * delta)`.
  - Never use a fixed per-frame lerp factor such as `0.1`. The `*_SMOOTHING` constants were chosen so that 60 fps looks the same as the old per-frame factors did.
  - For constant acceleration (gravity), use the exact formula `y += v*dt - 0.5*g*dt*dt` and then `v -= g*dt`. Plain Euler made the jump height depend on frame rate.

## Architecture

`index.html` is a thin entry point: CSS, the importmap, and `<script type="module" src="./js/main.js">`. The importmap must stay *before* that script.

| File | Exports | Role |
|---|---|---|
| `js/config.js` | constants | Colors; `GROUND_RADIUS` (radius 12 of the hub island, also used for the grid); `WORLD_RADIUS` (120, the invisible wall); `SHADOW_EXTENT` (size of the shadow box around the player); `KILL_Y`; `KILL_DROP`; the player's collision shape (including the forgiving `FOOT_RADIUS`, `CURVED_FOOT_RADIUS`, `HEAD_RADIUS`, `AIR_STEP_HEIGHT`); camera tuning; speeds; `*_SMOOTHING` rates; `MAX_DELTA` |
| `js/utils.js` | `dampFactor` | `1 - exp(-k*delta)` factor for vector and color lerps |
| `js/core.js` | `createCore()` → `{scene, camera, renderer}` | Fog plus a `scene.background` of the same color (`FOG_COLOR`, which also matches the CSS background), gradient sky dome, static `scene.environment` built once with `PMREMGenerator` (reflections on every Standard material), camera, renderer with PCF soft shadows; owns its own resize handler (which also refreshes the pixel ratio) |
| `js/world.js` | `createWorld(scene)` → `{knot, ring, pulseKnot, update(delta, elapsed, mouse, hovered)}` | Decoration only, none of it solid: round `PolarGridHelper` on the hub, semi-transparent `Reflector` floor mirror on the hub, torus knot, ring, two moons, dust particles (the old starfield), 44 distant non-solid shapes; owns the click color/pulse state and the knot hover scaling |
| `js/collision.js` | `createCollider`, `findGround`, `findCeiling`, `resolveWalls`, `cancelVelocityInto` | Hand-written collision for `box`, `ramp`, `cylinder`, `sphere`, `torus` colliders (no physics library) |
| `js/platforms.js` | `createPlatform(type, params)` → platform; `createPlatformSet(scene)` → `{list, colliders, add(type, params), remove(platform), update(delta, elapsed, standingOn)}` | Shape factory and behaviors (see below). The set keeps `list` and the flat `colliders` array in sync, and `remove` disposes geometry and materials |
| `js/course.js` | `createCourse(platforms)` | The demo course added through `platforms.add`: a data array with the hub island, a start pad and a loop around the hub using every shape and behavior, plus `createSpiral()`, which generates a 236-platform route from the hub's south edge outward and upward (a polar "pen" advanced by piece helpers; 4 tiers of 9 zones) |
| `js/lights.js` | `createLights(scene)` → `{update(elapsed, playerPosition)}` | Ambient light, two point lights (one moves), and the `DirectionalLight`, which is the only shadow caster and follows the player so shadows stay sharp in the large world |
| `js/player.js` | `createPlayer(scene)` → `{group, update(delta, elapsed, input, colliders, cameraYaw), getStandingOn(), getVelocity()}` | Character built from primitives (spawns facing −z, back to the camera), camera-relative WASD movement, jump/gravity (one jump per Space press event via `input.consumePress`, so holding Space doesn't repeat and short taps between frames aren't lost), collision, being carried by moving platforms, bounce, ice, checkpoints and respawn below `max(KILL_Y, respawn.y - KILL_DROP)`, `WORLD_RADIUS` clamp (also removes outward velocity so the walk cycle stops against the edge), walk cycle |
| `js/input.js` | `createInput()` → `{keys, consumePress(code), mouse, isHovering(object, camera), onClick(cb), consumeLook(), consumeZoom()}` | Keyboard map (by physical `e.code`) plus a set of press events (ignoring auto-repeat), mouse in the -1..1 range (centered while pointer-locked), pointer lock on click with accumulated mouse movement, wheel zoom, raycaster |
| `js/camera.js` | `createFollowCamera(camera, target)` → `{update(delta, velocity, look, zoom, platforms), getYaw()}` | Over-the-shoulder orbit camera: the mouse sets `yaw`/`pitch` directly, the wheel sets the arm length between `CAMERA_MIN_DISTANCE` and `CAMERA_MAX_DISTANCE`, a smoothed pivot follows the player, and a raycast shortens the arm so it doesn't clip platforms |
| `js/main.js` | (entry) | Wires the modules together and contains `animate()` driven by `renderer.setAnimationLoop` |

Game systems added on top of the table above, each a `create*()` factory wired only in `js/main.js`: `save.js` (localStorage: coins, best time, shop, settings, custom platforms), `audio.js` (Web Audio sounds and music), `effects.js` (pooled particles), `zones.js` (wind, low gravity, grapple anchors; `sample(position)`), `pickups.js` (instanced coins, abilities, portal), `hazards.js` (spikes, lasers, hammers, balls, stompable enemies, rising lava in the last tier), `ghost.js` (best-run replay), `customize.js` (shop), `builder.js` (build mode through `platforms.add`/`remove`), `hud.js` (DOM HUD, minimap, menus). `core.js` also owns bloom (`render()`, `setBloom`) and `setDayTime`. `createCourse` returns the level data these modules consume. `main.js` holds the `menu`/`playing`/`paused` state, and the player reports events through the `emit` callback passed to `createPlayer`. Player keys beyond movement: Q dash, E grapple, V first/third person, B build, P or Esc pause. In first person the player's materials use `colorWrite: false`, so the body stays invisible but still casts a shadow.

Points that need more than one file to understand:

- **Frame order in `animate()`:**
  1. `delta` is read and capped at `MAX_DELTA`. `elapsed` is built up from those capped deltas, not taken from `clock.getElapsedTime()`, so time-based animations (moons, knot float) pause and resume along with delta-based ones after a tab switch. Pass this `elapsed` to modules and don't read the clock anywhere else.
  2. The hover check, `world.update`, and `lights.update` run next, then `platforms.update`, then `player.update`. Platforms must move *before* the player so the player is carried in the same frame.
  3. `followCamera.update(delta, player.getVelocity(), input.consumeLook(), input.consumeZoom(), platforms.list)` runs *after* the player has moved. `player.update` reads `followCamera.getYaw()` from the previous frame.
  4. `render` comes last.
- **There is one platform set.** `main.js` creates it with `createPlatformSet` and passes `platforms.colliders` to `player.update` every frame. Anything that adds solid shapes, such as the future build mode, must go through `platforms.add` and `platforms.remove`; `player.js` never stores the list.
- **Platforms (`platforms.js`):**
  - **Shapes:** `box`, `ramp`, `cylinder`, `sphere`, `cone` (stepped) and `torus` (walkway). Each shape is described as "pieces" (geometry, collider, vertical offset). The stepped cone has one cylinder piece per tier, so mesh and collider always match.
  - **The platform object:** `platform.object` is a `Group` that holds the pose, and each collider has a `collider.platform` back-reference.
  - **Behaviors are optional, combinable fields in params:** `move: {axis, distance, period}`, `spin: {speed}`, `bounce` (upward velocity), `crumble: {delay, respawn}`, `slippery`, `checkpoint`.
  - **Pose:** each frame the pose is recomputed from the *base* params plus `elapsed`, never accumulated, so it doesn't drift. `sync()` then writes `collider.moved` (the frame's change in x, y, z and yaw).
  - **Crumbling:** the platform shakes only visually, then sets `collider.enabled = false` while it falls and respawns.
- **Player-side behaviors (`player.js`):**
  - **Carrying:** at the start of `update`, if the collider the player stood on last frame moved, the player is moved the same way: rotated around the platform center by `moved.yaw`, then translated.
  - **Bounce, ice, checkpoints:** `bounce` replaces landing with an upward launch, and `slippery` swaps `VELOCITY_SMOOTHING` for `SLIPPERY_SMOOTHING` while on the ice. Standing on a `checkpoint` sets the respawn point; falling below `max(KILL_Y, respawn.y - KILL_DROP)` teleports there.
- **Collision fields written by `platforms.js`:** `collision.js` only reads `enabled` and the geometry, and `player.js` reads `moved`, `bounce`, `slippery` and `checkpoint`.
- **How collision works (`collision.js`):**
  - **Player shape:** the player is an upright cylinder. Walls push with `PLAYER_RADIUS` (0.32). Ground checks use `FOOT_RADIUS` (0.45) on flat shapes, so you fall off an edge once your center is about 0.45 past it, and `CURVED_FOOT_RADIUS` (0.3) for heights on ramps, spheres and tori so the player doesn't float. Ceilings use `HEAD_RADIUS` (0.2). While airborne, `AIR_STEP_HEIGHT` (0.6) replaces `STEP_HEIGHT` for walls and ground, so near-miss jumps land on the edge.
  - **Local frame:** each collider has a center `position` and a `yaw`, the only rotation allowed so "up" stays up. Queries first move the player point into the collider's local frame, so rotated boxes and ramps reuse the axis-aligned math. Moving or rotating platforms only need their `position` and `yaw` updated.
  - **Three queries:**
    - `findGround`: the highest top under the foot, among surfaces no higher than the feet at the start of the frame plus `STEP_HEIGHT`. This prevents tunneling through thin platforms when falling fast and stops the player from popping onto roofs overhead.
    - `findCeiling`: the lowest underside above the head from the previous frame.
    - `resolveWalls`: pushes the player sideways out of any collider part above `feet + STEP_HEIGHT`, in two passes so corners work, and removes the velocity component going into the wall.
  - **Steps and slopes:** the step rule is also how ramps and the cone's 0.28 tiers are climbed. Spheres and tori are standable only where the slope is at most `MAX_SLOPE_DEG`; past that, the wall push plus gravity make the player slide off.
  - **Sphere and torus share code:** they measure distance to the "ring" line (radius 0 for a sphere), and `pushOutOfRing` can push the player outward or into the torus's hole.
  - **No allocations:** the query functions reuse module-level scratch objects, and the player passes a reusable `ground` object to `findGround`.
- **Order inside `player.update`:** being carried by the platform, then the horizontal move (using ice smoothing if on ice), then walls, then the world-radius clamp, then the turn to face the movement direction, then the jump, then gravity and the vertical move, then the ceiling check (only while rising), then landing on the ground or snapping down to it (or bouncing, or saving a checkpoint), then the `KILL_Y` respawn. Snapping down keeps the player stuck to ramps and small steps going downhill, and it only happens if they were grounded on the previous frame.
- **The third-person camera and its controls go together:**
  - **Input is camera-relative.** `player.js` turns WASD into a world direction using the camera yaw: forward is `(sin yaw, cos yaw)` and right is `(−cos yaw, sin yaw)`. W walks away from the camera and A/D walk left/right on screen.
  - **After `CAMERA_RECENTER_DELAY` seconds without mouse movement, the camera swings toward the *walking velocity* direction** (not the facing), weighted by `max(0, cos(angle)) × speed/WALK_SPEED`. It follows fully when walking forward, doesn't turn when strafing with A/D (otherwise camera-relative input would make you circle tightly) or when walking toward it with S, steers gradually with W+A or W+D, and stays still when idle.
  - **Platform carrying isn't part of the velocity**, so riding a rotating disc doesn't swing the camera.
- **Hover runs before the updates on purpose.** `matrixWorld` only refreshes during `render`, so the raycast tests the camera and knot as they were drawn last frame, which is what the user is pointing at.
- **Limbs pivot at their joint.** `createLimb()` in `player.js` translates each box geometry down by half its height, so the mesh origin is at the hip or shoulder and `rotation.x` swings the limb like a real leg or arm.
- **Stuck-key protection is in `input.js`.** All keys are reset on `blur`, `contextmenu`, the tab being hidden, and the release of Cmd (macOS doesn't send `keyup` for other keys while Cmd is held). `keydown` events with `metaKey` set are ignored.
- **Disposal:** decoration lives as long as the page and is never disposed. Platforms removed at runtime with `platforms.remove` dispose their geometry and material.
