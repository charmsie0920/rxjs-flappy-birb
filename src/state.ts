// state.ts (pure model/reducer module)
// -------------------
// 
// - This file defines the *entire game model* and the pure reducer that evolves
//   it over time. It does **not** touch the DOM, timers, or wall-clock.
// -All changes happen by folding typed Actions into an immutable State.
//  -Deterministic “randomness” is provided by an injected PRNG seed carried
//   inside State.rng. (RNG is from your provided utils.ts.)
//
// WHY (FRP/purity):
// - scan(reduce, initial) + immutable State => referentially transparent logic
//   (same inputs → same outputs). Easy to test and replay.
// - Constants (C) are injected (dependency injection) so this module has no
//   runtime imports of global configuration and is easy to unit test.


/**
 * AI assistance declaration:
 * I used OpenAI ChatGPT (GPT-5 Thinking) only for small maths utilities (clamp, circle–rect collision, vector helpers, deterministic LCG). I verified each snippet against course concepts and edge cases, made the final design/integration decisions, and fully understand how and why each piece is used in my code. All FRP architecture, reducer rules (physics, collisions, scoring, lives, phases), CSV-driven spawning, ghost system, and rendering are my own work. 
 */


import type { State, Action, Bird, Pipe, Hit, Constants } from "./types"
import {RNG} from "./utils"

/** clamp(x, lo, hi): clamp a scalar into [lo, hi] */
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Given constants and a time step(ms), update the bird's velocity and position
 * - gravity accelerates vy 
 * - position y integrates vy
 * - result is clamped so the bird stays inside the canvas
 * - pure: returns a new bird, never mutates
 * @param C 
 * @returns 
 */
const integrateBird = (C: Constants) => (deltaMs: number, b: Bird): Bird => {
  const dt = deltaMs /1000;
  const vy = b.vy + C.GRAVITY * dt;
  const y = clamp(b.y + vy * dt, C.BIRD_RADIUS, C.CANVAS_HEIGHT - C.BIRD_RADIUS);
  return {...b, y, vy};
};


/**
 * circleRectCollide:
 * - axis aligned circle-rectangle collision
 * - finds nearest point on rect to circle center, check distance <= r. 
 * @param cx 
 * @param cy 
 * @param r 
 * @param rx 
 * @param ry 
 * @param rw 
 * @param rh 
 * @returns 
 */
const circleRectCollide = (
  cx: number, cy: number, r: number, 
  rx: number, ry: number, rw: number, rh: number
): boolean => {
  const nearestX = clamp(cx, rx, rx + rw);
  const nearestY = clamp(cy, ry, ry + rh);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy <= r *r;
}

/**
 * for a given pipe (x, gap_y, gap_height), compute the two rectangles: 
 * - top rect from y=0 down to gap_y
 * - bottom rect from (gap_y + gap_height) down to canvas bottom 
 * @param C 
 * @returns 
 */
const pipeRects = (C: Constants)=> (p: Pipe) => {
  const top = {rx: p.x, ry: 0, rw: C.PIPE_WIDTH, rh: p.gap_y};
  const bottomY = p.gap_y + p.gap_height;
  const bot = { rx: p.x, ry: bottomY, rw: C.PIPE_WIDTH, rh: Math.max(0, C.CANVAS_HEIGHT - bottomY)};
  return [top, bot] as const;
};


/**
 * decide if the bird (treated as a circle) collides with: 
 * - top canvas edge 
 * - bottom canvas edge
 * - top pipe rect 
 * - bottom pipe rect 
 * if hit, return a description: where to snap Y to, and which direction to bounce
 * @param C 
 * @returns 
 */
const hitCategory = (C: Constants) => (birdY: number, pipes: ReadonlyArray<Pipe>): Hit | undefined => {
  //top collision
  if (birdY - C.BIRD_RADIUS <= 0){
    return { kind: "topCanvas", targetY: C.BIRD_RADIUS, bounce: "down"};
  }
  //bottom collision
  if (birdY + C.BIRD_RADIUS >= C.CANVAS_HEIGHT){
    return { kind: "bottomCanvas", targetY: C.CANVAS_HEIGHT - C.BIRD_RADIUS, bounce: "up"};
  }
  //pipe collisions
  const cx = C.BIRD_X,  cy = birdY, r = C.BIRD_RADIUS;
  for (const p of pipes){
    const [top, bot] = pipeRects(C)(p);
    if (circleRectCollide(cx, cy, r, top.rx, top.ry, top.rw, top.rh)){
      //hit ceiling, bounce down
      return { kind: "pipeTop", targetY: p.gap_y + C.BIRD_RADIUS, bounce: "down"};
    }
    if (circleRectCollide(cx, cy, r, bot.rx, bot.ry, bot.rw, bot.rh)){
      //hit floor, bounce up
      return { kind: "pipeBottom", targetY: p.gap_y + p.gap_height - C.BIRD_RADIUS, bounce: "up"};
    }
  }
  return undefined;
};

/**
 * makeInitial
 * - Build the initial immutable state from injected constants
 * - injecting C avoids import cycles and makes this file testable/pure
 * @param C 
 * @returns 
 */
export const initialState = (C: Constants): State => ({
  time: 0,
  phase: "running",
  bird: { y: C.CANVAS_HEIGHT / 2, vy: 0, lives: 3},
  pipes: [],
  pipeIdCounter: 0,
  score: 0,
  rng: 0,
  pipesDone: false,
});

/**
 * makeReducer(C): returns the pure reducer (State, Action) → State
 * Captures helpers and constants once; no DOM or timers here.
 * @param C 
 * @returns 
 */

export const reducer = (C: Constants) => {
  const integrate = integrateBird(C);
  const hitType = hitCategory(C);

  return (state: State, action: Action): State => {
    switch(action.type){
      case "tick": {
        if (state.phase !== "running") return state;

        const deltaMs = action.dt;
        const time = state.time + deltaMs;
        const dtSec = deltaMs / 1000;

        const nextSeed = RNG.hash(state.rng);

        const moved = state.pipes
            .map(p => ({...p, x: p.x - C.SPEED * dtSec}))
            .filter(p => p.x + C.PIPE_WIDTH > 0) as ReadonlyArray<Pipe>;

        //integrate bird position/velocity 
        const bird1 = integrate(deltaMs, state.bird);

        //s pipe is passed when its right edge goes past bird
        //score 1 point per newly passed pipe
        //even when bird collides
        const newlyPassed = moved.map(p => !p.passed && (p.x + C.PIPE_WIDTH) < C.BIRD_X);
        const score = state.score + newlyPassed.filter(Boolean).length;
        const pipes2 = moved.map((p, i) => newlyPassed[i] ? {...p, passed: true} : p) as ReadonlyArray<Pipe>;

        //collision detection using bird Y and updated pipe positions
        const hit = hitType(bird1.y, pipes2);
        if (hit){
          //bounce magniture is picked deterministically from RNG
          const unitRandom = (RNG.scale(nextSeed) + 1) * 0.5;
          const mag = C.BOUNCE_LB + unitRandom * (C.BOUNCE_UB - C.BOUNCE_LB);
          const vy = hit.bounce === "down" ? +mag :-mag;

          //avoid immediate re collision at the same Y in the next tick
          const EPS = 0.1;
          const snapY = hit.bounce === "down" ? hit.targetY + EPS : hit.targetY - EPS;

          const bird2: Bird = {
            ...bird1,
            y: clamp(snapY, C.BIRD_RADIUS, C.CANVAS_HEIGHT - C.BIRD_RADIUS),
            vy,
            lives: state.bird.lives - 1,
          };
          const phase = bird2.lives <= 0 ? "gameover" : "running";
          //return a whole new state
          return { ...state, time: time, rng: nextSeed, phase, bird: bird2, pipes: pipes2, score};
        }

        //every pipe has left the screen and no more to come → finished
        const finished = state.pipesDone && pipes2.length === 0;
        const phase = finished ? "finished" : "running";
        return { ...state, time, rng: nextSeed, bird: bird1, pipes: pipes2, score, phase};
      }

      case "pipes_done": 
      //mark that no more pipes will come
        return { ...state, pipesDone: true };

      case "flap": 
      //only flap during running, set an immediate upward velocity flap impulse
        return state.phase !== 'running'
          ? state : { ...state, bird: { ...state.bird, vy: C.FLAP_IMPULSE } };

      case "pipe_on_screen": {
        //add a new pipe at the right edge of the screen
        const id = state.pipeIdCounter;
        const p: Pipe = {id, ...action.pipe};
        return { ...state, pipes: state.pipes.concat(p), pipeIdCounter: id + 1 };
      }

      case "restart":
        //reset to initial state
        return {...initialState(C), rng: state.rng };

      default:
        return state;
    }
  };
};