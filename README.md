# Three.js Platformer Sandbox — Vibecoded Proof of Concept

![Vibecoded](https://img.shields.io/badge/built%20with-vibecoding%20(AI--assisted)-ff7a3c)
![Status](https://img.shields.io/badge/status-proof%20of%20concept-blue)
![Three.js](https://img.shields.io/badge/three.js-r160-black)

**▶ Live demo:** https://popica24.github.io/threejs-platformer-poc/

A 3D browser platformer built with plain JavaScript and Three.js — no build step, no physics engine, no framework.

## ⚠️ Read this first: this project is vibecoded

This is a **proof of concept**, not production software. It was built through **vibecoding**: I described features, behaviour and constraints in natural language, and an AI coding assistant ([Claude Code](https://claude.com/claude-code)) wrote most of the code. My role was directing the work: defining the architecture rules, setting conventions, play-testing, spotting bugs and steering iterations.

The evidence is in the repo itself:

- [`CLAUDE.md`](./CLAUDE.md) is the instruction file I wrote and kept updating to guide the AI: architecture rules, conventions and invariants (frame-rate independence, no hidden shared state, collision rules and so on).
- Code comments are in Romanian. The project started as a step-by-step teaching scene and the AI was told to explain every concept inline.
- The `NOU:` ("new") markers show what each iteration added.

What it demonstrates:

- Using an AI agent to build a non-trivial interactive app (~20 modules) quickly
- Writing clear specs and constraints that keep AI-generated code consistent
- Testing, debugging and iterating on AI output until it plays well

What it is **not**: hand-written, thoroughly tested or optimised production code. There are no automated tests, and there may be bugs and rough edges.

## Features

- **Hand-written collision** (no physics library): boxes, ramps, cylinders, spheres, tori and stepped cones, with steps, slopes and forgiving ledge landings
- **Platform behaviours** you can combine: moving, spinning, bouncy, crumbling, icy, checkpoints
- **Demo course**: a hub island plus a generated 236-platform spiral route
- **Third-person orbit camera** with pointer lock, zoom and wall-avoiding raycasts, plus a first-person mode
- **Game systems**: coins, abilities (dash, grapple), hazards and enemies, rising lava, wind and low-gravity zones, best-run ghost replay, shop and customisation, build mode, save/load (localStorage), Web Audio sound and music, bloom, a HUD and a minimap
- **Frame-rate independent** movement, smoothing and gravity

## Controls

| Key | Action |
|---|---|
| WASD | Move (relative to the camera) |
| Mouse | Look (click to lock the pointer) |
| Wheel | Zoom |
| Space | Jump |
| Q | Dash |
| E | Grapple |
| V | Switch between first and third person |
| B | Build mode |
| P / Esc | Pause |

## Run locally

ES modules don't load over `file://`, so serve the folder:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Three.js loads from the jsDelivr CDN, so you need an internet connection.

## Tech

Vanilla JavaScript (ES modules) · Three.js r0.160.0 via importmap · Web Audio API · localStorage
