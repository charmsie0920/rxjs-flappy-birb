/**
 * Portions of this utility module (RNG, Vec, and FP helpers) are adapted from the
 * FIT2102 “Asteroids” teaching materials by T. Dwyer & FIT2102 staff (Week 4 workshop)
 * Used here under educational fair use for the Flappy FRP assignment.
 * Original repo/notes: https://tgdwyer.github.io/asteroids/
 */


import { PipesMap } from "./types";
import { Constants } from "./types";

export { Vec, flatMap, not, elem, except, attr, isNotNullOrUndefined, RNG }

/**
 * A random number generator which provides two pure functions
 * `hash` and `scaleToRange`.  Call `hash` repeatedly to generate the
 * sequence of hashes.
 */
abstract class RNG {
    // LCG using GCC's constants
    private static m = 0x80000000; // 2**31
    private static a = 1103515245;
    private static c = 12345;

    /**
     * Call `hash` repeatedly to generate the sequence of hashes.
     * @param seed 
     * @returns a hash of the seed
     */
    public static hash = (seed: number) => (RNG.a * seed + RNG.c) % RNG.m;

    /**
 h    * Takes hash value and scales it to the range [-1, 1]
     */
    public static scale = (hash: number) => (2 * hash) / (RNG.m - 1) - 1;
}

/**
 * A simple immutable vector class
 */
class Vec {
    constructor(public readonly x: number = 0, public readonly y: number = 0) { }
    add = (b: Vec) => new Vec(this.x + b.x, this.y + b.y)
    sub = (b: Vec) => this.add(b.scale(-1))
    len = () => Math.sqrt(this.x * this.x + this.y * this.y)
    scale = (s: number) => new Vec(this.x * s, this.y * s)
    ortho = () => new Vec(this.y, -this.x)
    rotate = (deg: number) =>
        (rad => (
            (cos, sin, { x, y }) => new Vec(x * cos - y * sin, x * sin + y * cos)
        )(Math.cos(rad), Math.sin(rad), this)
        )(Math.PI * deg / 180)

    static unitVecInDirection = (deg: number) => new Vec(0, -1).rotate(deg)
    static Zero = new Vec();
}

/**
 * apply f to every element of a and return the result in a flat array
 * @param a an array
 * @param f a function that produces an array
 */
function flatMap<T, U>(
    a: ReadonlyArray<T>,
    f: (a: T) => ReadonlyArray<U>
): ReadonlyArray<U> {
    return Array.prototype.concat(...a.map(f));
}

const
    /**
     * Composable not: invert boolean result of given function
     * @param f a function returning boolean
     * @param x the value that will be tested with f
     */
    not = <T>(f: (x: T) => boolean) => (x: T) => !f(x),
    /**
     * is e an element of a using the eq function to test equality?
     * @param eq equality test function for two Ts
     * @param a an array that will be searched
     * @param e an element to search a for
     */
    elem =
        <T>(eq: (_: T) => (_: T) => boolean) =>
            (a: ReadonlyArray<T>) =>
                (e: T) => a.findIndex(eq(e)) >= 0,
    /**
     * array a except anything in b
     * @param eq equality test function for two Ts
     * @param a array to be filtered
     * @param b array of elements to be filtered out of a
     */
    except =
        <T>(eq: (_: T) => (_: T) => boolean) =>
            (a: ReadonlyArray<T>) =>
                (b: ReadonlyArray<T>) => a.filter(not(elem(eq)(b))),
    /**
     * set a number of attributes on an Element at once
     * @param e the Element
     * @param o a property bag
     */
    attr = (e: Element, o: { [p: string]: unknown }) => { for (const k in o) e.setAttribute(k, String(o[k])) }
/**
 * Type guard for use in filters
 * @param input something that might be null or undefined
 */
function isNotNullOrUndefined<T extends object>(input: null | undefined | T): input is T {
    return input != null;
}

/**
 * Parses a CSV string into an array of PipesMap objects.
 * @param csv The CSV string to parse
 * @returns An array of PipesMap objects
 */
export function parsePipesCSV(csv: string): ReadonlyArray<PipesMap> {
  const lines = csv.trim().split(/\r?\n/);
  const [header, ...rows] = lines;
  
  const cols = header.split(',').map(s => s.trim());
  const idx = (name: string) => cols.findIndex(c => c.toLowerCase() === name);

  const iGapY = idx('gap_y');
  const iGapH = idx('gap_height');
  const iTime = idx('time');

  //Parse each non-empty row into numbers
  return rows.filter(Boolean).map(line => {
    const cells = line.split(',').map(s => s.trim());
    const gap_y = Number(cells[iGapY]);
    const gap_height = Number(cells[iGapH]);
    const time = Number(cells[iTime]);
    return {gap_y, gap_height, time };
  });
}

const CANVAS_WIDTH  = 600;
const CANVAS_HEIGHT = 400;


/**
 * constants
 */
export const C: Constants = {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PIPE_WIDTH: 50,
  TICK_RATE_MS: 16,
  SPEED: 120,
  BOUNCE_LB: 300,
  BOUNCE_UB: 600,
  BIRB_WIDTH: 42,
  BIRB_HEIGHT: 30,
  BIRD_X: CANVAS_WIDTH * 0.3,   
  BIRD_RADIUS: 14,
  GRAVITY: 1200,
  FLAP_IMPULSE: -350,
  KEYS: { flap: "Space", restart: "KeyR" },
} as const;