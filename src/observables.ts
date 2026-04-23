//done
import {from, fromEvent, interval, map, filter, Observable, endWith, mergeMap} from "rxjs"
import {C} from "./utils"
import { timer, merge, concat , of} from "rxjs";
import type { Action, PipesMap, Constants } from "./types";


//In FRP, everything that changes over time is represented as a stream (Observable)
//This file builds the INPUT streams for the game:
// - tick$: time passing (like a game timer thing)
// - flap$: player pres the space key 
// - restart$: player presses the R key to restart the game
//
//Nothing here runs until you subscribe to one of the streams
//main.ts composes them into Action streams and reduces with 'scan' to produce 'state$'. 
//The view subscirbes to state$ to render the game


/**
 * Time stream
 * 
 * 'interval' emits a number every N milliseconds. 
 * Each tick is map into a domain Action with a fixed dt. 
 */

export const tick$: Observable<Action> = interval(C.TICK_RATE_MS).pipe(
    map((): Action => ({ type: "tick", dt: C.TICK_RATE_MS}))
);


export const flap$: Observable<Action> = fromEvent<KeyboardEvent>(document, "keydown").pipe(
    filter(e => e.code === C.KEYS.flap),
    map((): Action => ({type: "flap"}))
);

export const restart$: Observable<Action> = 
    fromEvent<KeyboardEvent>(document, "keydown").pipe(
        filter(e => e.code === C.KEYS.restart),
        map((): Action => ({type: "restart"}))
);


export const pipes$ = (
    rows: ReadonlyArray<PipesMap      >,
    C: Constants
): Observable<Action> => 
    from(rows).pipe(
        mergeMap((rows) => 
            timer(Math.max(0, Math.round(rows.time * 1000))).pipe(
                map((): Action => ({
                    type: "pipe_on_screen",
                    pipe: {
                        x: C.CANVAS_WIDTH,
                        gap_y: rows.gap_y * C.CANVAS_HEIGHT,
                        gap_height: rows.gap_height * C.CANVAS_HEIGHT,
                        width: C.PIPE_WIDTH,
                        passed: false,
                    },
                }))
            )
        ),
        endWith<Action>({type: "pipes_done"})
    );


