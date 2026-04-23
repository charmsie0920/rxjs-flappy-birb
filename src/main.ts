import "./style.css";
import {
  catchError, fromEvent, merge, Observable, scan, startWith, switchMap, take, takeUntil,
  takeWhile, share, shareReplay, timestamp, map, toArray, defer, from, mergeMap, timer,
  of, Subject, withLatestFrom, filter, BehaviorSubject, concatMap, finalize, tap
} from "rxjs";
import { fromFetch } from "rxjs/fetch";

import type { State, Action } from "./types";
import { initialState,  reducer } from "./state";
import { parsePipesCSV } from "./utils";
import { pipes$ } from "./observables";
import { tick$, flap$, restart$ } from "./observables";
import { render, renderGhost } from "./view";
import {C} from "./utils";


const initial = initialState(C);
const reduce  = reducer(C);


/**
 * buildGhost$
 * -----
 * 
 * Builds a ghost state for a ghost run by replaying flap inputs from previous game
 *
 * How: 
 * 1) Parse csv → rows, then create a spawn$ stream that emits pipe_on_screen actions at the scheduled times in the CSV (timeline as data).
 * 2) Turn each previous flap offset into a delayed {type:'flap'} action using timer
 * 3) Merge tick$, ghostFlaps$, spawn$ → Actions$, then fold with scan(reduce, initial) to produce a deterministic ghost State$.
 * 
 * @param csvText the map.csv contents as text
 * @param flapMs immutable array of flap times in milliseconds captured during a previous run
 * @returns An observable of the ghost state.
 */
const ghost$ = (csvText: string, flapMs: ReadonlyArray<number>): Observable<State> => {
  if (flapMs.length === 0) return of<State>({ ...initial, phase: "finished" });
  const rows = parsePipesCSV(csvText);
  const spawn$ = pipes$(rows, C);
  const ghostFlaps$: Observable<Action> = from(flapMs).pipe(
    mergeMap(ms => timer(ms).pipe(map(() => ({ type: "flap" } as Action))))
  );

  const actions$: Observable<Action> = merge(tick$, ghostFlaps$, spawn$);
  return actions$.pipe(
    startWith<Action>({ type: "tick", dt: 0 } as Action),
    scan(reduce, initial)
  );
};

/**
 * state$
 * -----
 * Builds the player state$ for one run using the same pattern as the ghost above.
 * - tick$  (time)  +
 * - flap$  (player input)  +
 * - spawn$ (CSV-driven pipe schedule)
 * are merged into one Actions$; scan(reduce, initial) evolves the model.
 *
 * This function is pure: it describes the stream transformation. Nothing happens
 * until someone subscribes (the view does)
 * 
 * @param csvText the map.csv contents as text
 * @returns An observable of the player state.
*/
export const state$ = (csvText: string) => {
  const rows = parsePipesCSV(csvText);
  const spawn$ = pipes$(rows, C);
  const actions$: Observable<Action> = merge(tick$, flap$, spawn$);
  return actions$.pipe(
    startWith<Action>({ type: "tick", dt: 0 } as Action),
    scan(reduce, initial)
  );
};


// The following simply runs your main function on window load.  Make sure to leave it in place.
// You should not need to change this, beware if you are.
if (typeof window !== "undefined") {
    const { protocol, hostname, port } = new URL(import.meta.url);
    const baseUrl = `${protocol}//${hostname}${port ? `:${port}` : ""}`;
    const csvUrl = `${baseUrl}/assets/map.csv`;

    // Get the file from URL
    const csv$ = fromFetch(csvUrl).pipe(
        switchMap(response => {
            if (response.ok) {
                return response.text();
            } else {
                throw new Error(`Fetch error: ${response.status}`);
            }
        }),
        catchError(err => {
            console.error("Error fetching the CSV file:", err);
            throw err;
        }),
    );

    //holds the most recent game flaps times 
    const lastRunFlapsSubject = new BehaviorSubject<ReadonlyArray<number>>([]);

    //readonly observable of the most recent game flaps times for immutability
    const lastRunFlaps$ = lastRunFlapsSubject.asObservable();
    
    //game can start either on first mouse click or restart button click
    const click$ = fromEvent(document.body, "mousedown").pipe(take(1));
    const restartSignal$ = restart$.pipe(share());
    const start$ = merge(click$, restartSignal$);

    type FlapRun = ReadonlyArray<number>;

    //in memory history of runs 
    const ghostRunsSubject = new BehaviorSubject<ReadonlyArray<FlapRun>>([]);
    const ghostRuns$ = ghostRunsSubject.asObservable();

    //after csv is loaded, wait for game start signal to start a run
    csv$
      .pipe(
        switchMap(csvText =>
          //each time start$ emits, start a new game run
          start$.pipe(
            withLatestFrom(ghostRuns$),
            //concatmap wait for the inner observable to complete before processing the next start signal                   
            concatMap(([_, prevGame]) => {
              //1. live player state stream for this run
              const player$ = state$(csvText).pipe(
                takeWhile(s => s.phase !== 'gameover' && s.phase !== 'finished', true),
                takeUntil(restartSignal$),
                shareReplay({ bufferSize: 1, refCount: true })
              );

              const playerEnd$ = player$.pipe(
                filter(s => s.phase === 'gameover' || s.phase === 'finished'),
                take(1)
              );

              //2. 
              const runClock$ = tick$.pipe(
                filter(a => a.type === "tick"),
                map(a => a.dt),
                scan((t, dt) => t + dt, 0),
                startWith(0),
                takeUntil(restartSignal$),
                shareReplay({ bufferSize: 1, refCount: true })
              );

              //Capture start time of this run's clock
              const startTime$ = runClock$.pipe(take(1));

              //3.Record each flap as "elapsed ms since run start"  
              const recordFlaps$ = startTime$.pipe(
                switchMap(t0 =>
                  flap$.pipe(
                    withLatestFrom(runClock$),
                    map(([_, t]) => Math.max(0, Math.round(t - t0))),
                    takeUntil(merge(restartSignal$, playerEnd$))
                  )
                )
              );

              //4. build all ghosts for this run from all prev runs
              //each ghost is its own state stream. we subscribe with a distinct render 
              const ghostSubs = prevGame.map((flaps, i) => {
                const g$ = flaps.length === 0
                  ? of<State>({ ...initial, phase: 'finished' })
                  : ghost$(csvText, flaps);
                return g$.pipe(takeUntil(restartSignal$))
                        .subscribe(renderGhost(String(i), Math.max(0.12, 0.35 - i * 0.06))); //each ghost has a unique id
              });

              const subPlayer = player$.subscribe(render());

              //5. value to return from concatmap is a observabel that completes only after save the flaps into memory (save -> next run)
              return recordFlaps$.pipe(
                toArray(),
                tap(list => {
                  const updated = [list, ...ghostRunsSubject.value];
                  ghostRunsSubject.next(updated);
                }),
                finalize(() => {
                  ghostSubs.forEach(s => s.unsubscribe());
                  subPlayer.unsubscribe();
                }),
                map(() => void 0)  
              );
            })
          )
        )
      )
      .subscribe();
}
