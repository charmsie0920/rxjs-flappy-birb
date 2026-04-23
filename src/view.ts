//done
/**
 * view.ts
 * ----------
 * ROLE
 * • This is the View (V) in an MVU/FRP architecture. It subscribes to immutable State values
 *   (produced by scan(reduce, initial)) and updates the SVG DOM accordingly.
 * • It is the ONLY place that performs side-effects (DOM creation/mutation). The Model/Reducer
 *   remain pure and testable.
 *
 * HOW IT'S USED
 * • Live game:     state$.subscribe(render())
 *     - `render()` returns (State) => void; each new State emission re-renders the frame.
 * • Ghost replays: ghostState$.subscribe(renderGhost("0", 0.35))
 *     - Multiple ghosts: use distinct idSuffixes ("0","1","2",...) and different opacities.
 *
 * DESIGN NOTES
 * • Elements are created once (idempotently), then only their attributes are updated per frame.
 * • Z-order: a <g id="ghosts"> layer is inserted BEHIND the live bird so ghosts never cover it.
 * • Pipes are drawn as pairs of <rect> (top + bottom). We ensure the correct count and reuse them.
 * • Performance: query DOM once where possible; batch insertions via DocumentFragment.
 */

import type { State } from "./types";
import { C } from "./utils";

/**
 * Creates an SVG element with the given properties.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element for valid
 * element names and properties.
 *
 * @param namespace Namespace of the SVG element
 * @param name SVGElement name
 * @param props Properties to set on the SVG element
 * @returns SVG element
 */
const createSvgElement = (
    namespace: string | null,
    name: string,
    props: Record<string, string> = {},
): SVGElement => {
    const elem = document.createElementNS(namespace, name) as SVGElement;
    Object.entries(props).forEach(([k, v]) => elem.setAttribute(k, v));
    return elem;
};

/**
 * getOrCreate
 * -----------
 * Lookup-or-create helper that guarantees a single element with a given selector exists
 * under a specific parent. If it exists, reuse it; otherwise, create and append it.
 *
 * @param root     Parent SVG node to search/append within
 * @param selector CSS selector to find the element (e.g., "#bird")
 * @param create   Factory for creating the element if missing
 * @returns        The existing or newly created element
 */
const getOrCreate = <T extends SVGElement>(
  root: SVGSVGElement | SVGGElement,
  selector: string,
  create: () => T
): T => {
  //find an existing child that matches the selector
  const existing = root.querySelector<T>(selector);

  //if found, reuse it
  if (existing) return existing;

  //otherwise create a fresh node
  const fresh = create();

  //append only once so subsequent frames can reuse it
  root.appendChild(fresh);

  //return the ensured node
  return fresh;
};

/**
 * setVisibility
 * -------------
 * Toggle an element's visibility attribute (keeps its layout/position; just hides/shows).
 *
 * @param node     The SVG element to show/hide
 * @param visible  true → visible, false → hidden
 */
const setVisibility = (node: SVGElement | null, visible: boolean): void => {
  //if the node isn’t present, nothing to do
  if (!node) return;

  // flip the visibility attribute (not display)
  node.setAttribute("visibility", visible ? "visible" : "hidden");
};

/**
 * render
 * ------
 * Builds a frame renderer: a function (State) => void that updates the SVG per emission.
 * Usage: state$.subscribe(render()).
 *
 * Queries static DOM nodes once.
 * Creates the bird and pipes container omce.
 * On each State:
 *   - Updates bird Y position
 *   - Shows/hides the Game Over overlay
 *   - Ensures enough rects for all pipes and positions them
 *   - Update lives, score
 */
export function render(): (s: State) => void {
  const svg = document.querySelector("#svgCanvas") as SVGSVGElement;
  const gameOver = document.querySelector("#gameOver") as SVGElement | null;
  const livesText = document.querySelector("#livesText") as HTMLElement | null;
  const scoreText = document.querySelector("#scoreText") as HTMLElement | null;
  const finished = document.querySelector("#finished") as SVGElement | null;
  svg.setAttribute(
      "viewBox",
      `0 0 ${C.CANVAS_WIDTH} ${C.CANVAS_HEIGHT}`,
  );
  //ensure a single <image id="bird"> exists; reuse on subsequent renders
  const birdImg = getOrCreate<SVGImageElement>(svg, "#bird", () =>
    createSvgElement(svg.namespaceURI, "image", {
      id: "bird",
      href: "assets/birb.png",
      x: String(C.CANVAS_WIDTH * 0.3 - C.BIRB_WIDTH / 2),
      y: String(C.CANVAS_HEIGHT / 2 - C.BIRB_HEIGHT / 2),
      width: String(C.BIRB_WIDTH),
      height: String(C.BIRB_HEIGHT),
    }) as SVGImageElement
  );

  const pipesGroup = getOrCreate<SVGGElement>(svg, "#pipes", () =>
    createSvgElement(svg.namespaceURI, "g", { id: "pipes" }) as SVGGElement
  );

  //keeps overlay above everything by moving it to the end of the SVG tree once
  if (gameOver?.parentNode) gameOver.parentNode.appendChild(gameOver);
  if (finished?.parentNode) finished.parentNode.appendChild(finished);
  //return per frame renderer
  return (s: State) => {
    //update bird’s vertical position (center the sprite on State.bird.y)
    birdImg.setAttribute("y", String(s.bird.y - C.BIRB_HEIGHT / 2));

    //show or hide the overlay accordingly
    const ended = s.phase === "gameover" || s.phase === "finished";
    setVisibility(gameOver, s.phase === "gameover");
    setVisibility(finished, s.phase === "finished");

    while (pipesGroup.firstChild) pipesGroup.removeChild(pipesGroup.firstChild);

    for (const p of s.pipes) {
      const bottomY = p.gap_y + p.gap_height;

      // Top pipe
      const pipeTop = createSvgElement(svg.namespaceURI, "rect", {
        x: String(p.x),
        y: "0",
        width: String(p.width),
        height: String(p.gap_y),
        fill: "green",
      }) as SVGRectElement;

      const pipeBottom = createSvgElement(svg.namespaceURI, "rect", {
        x: String(p.x),
        y: String(bottomY),
        width: String(p.width),
        height: String(Math.max(0, C.CANVAS_HEIGHT - bottomY)),
        fill: "green",
      }) as SVGRectElement;

      pipesGroup.appendChild(pipeTop);
      pipesGroup.appendChild(pipeBottom);
    }

    if (livesText) livesText.textContent = String(s.bird.lives);
    if (scoreText) scoreText.textContent = String(s.score);
  };
}


/**
 * renderGhost
 * -----------
 * Builds a ghost renderer for a single prior run. It draws a gray, semi-transparent bird image
 * in a dedicated "ghosts" layer that sits behind the live bird. Multiple ghosts are supported
 * by providing unique id values ("0", "1", …) and varying opacity.
 *
 * @param id Unique suffix for the element id (e.g., "ghost-0", "ghost-1")
 * @param opacity  Ghost image opacity (0..1), e.g., 0.35 for the newest, lower for older ghosts
 * @returns        (State) => void renderer for the ghost’s state stream
 *
 * Usage:
 *   ghostState$.subscribe(renderGhost("0", 0.35))
 */
export function renderGhost(id = "0", opacity = 0.35): (s: State) => void {
  const svg = document.querySelector("#svgCanvas") as SVGSVGElement;
  const ghostId = `ghost-${id}`;

  // Reuse or create the ghost image
  let ghost = svg.querySelector<SVGImageElement>(`#${ghostId}`);
  if (!ghost) {
    ghost = createSvgElement(svg.namespaceURI, "image", {
      id: ghostId,
      href: "assets/birb.png",
      x: String(C.CANVAS_WIDTH * 0.3 - C.BIRB_WIDTH / 2),
      y: String(C.CANVAS_HEIGHT / 2 - C.BIRB_HEIGHT / 2),
      width: String(C.BIRB_WIDTH),
      height: String(C.BIRB_HEIGHT),
      opacity: String(opacity),
      style: "filter: grayscale(100%)",
      "pointer-events": "none",
    }) as SVGImageElement;

    // Insert ghost just BEFORE the live bird so it paints behind it.
    const bird = svg.querySelector("#bird");
    if (bird?.parentNode) {
      bird.parentNode.insertBefore(ghost, bird);
    } else {
      // If bird isn't there yet, just append; first render() will move bird later.
      svg.appendChild(ghost);
    }
  }

  // Per-frame ghost renderer
  return (s: State) => {
    ghost!.setAttribute("y", String(s.bird.y - C.BIRB_HEIGHT / 2));
    const ended = s.phase === "gameover" || s.phase === "finished";
    ghost!.setAttribute("visibility", ended ? "hidden" : "visible");
  };
}
