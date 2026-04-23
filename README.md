# RxJS Flappy Birb

A declarative, purely functional implementation of the classic Flappy Bird game built using **Functional Reactive Programming (FRP)** principles. This project explores the power of **RxJS Observable streams** to manage complex game states, user interactions, and physics without the use of imperative loops or mutable global variables.

## Core Technical Concepts

* **Functional Reactive Programming (FRP)**: Handles animation and user interaction entirely through asynchronous data streams.
* **State Management**: Utilizes the `scan` and `merge` operators to process game state transitions in a purely functional manner, inspired by the Redux pattern.
* **Collision Physics**: Implements high-stakes collision logic where the bird interacts with a dynamic environment, including "bounce" mechanics with randomized velocities.
* **Session Replay (Ghost Bird)**: Features a non-interactive "ghost" bird that replays the exact path of previous runs in real-time by leveraging stream history.
* **Stream-Based Obstacles**: Dynamically generates and manages obstacles (pipes) based on external CSV data, synchronized with the game's timeline.



## Tech Stack

* **Language**: TypeScript (Strict Mode)
* **Reactive Library**: RxJS
* **Rendering**: SVG Canvas
* **Testing**: Vitest for comprehensive unit testing of pure functions
* **Build Tool**: Vite

## Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v16+)

### Installation
```bash
# Install dependencies
npm install
Development
Bash
# Launch the interactive game in the browser
npm run dev

# Run unit tests
npm test
Environment Tools
Generate Obstacle Maps: Create new pipe configurations via npm run generate-pipes.

Code Formatting: This project enforces a clean functional style via Prettier. Run npx prettier . --write to maintain consistency.

Architecture
To maintain a clean separation of concerns while adhering to FRP constraints, the code is structured as follows:

src/main.ts: Application entry point and core stream orchestration.

src/state.ts: Pure functions for state transformations and physics calculations.

src/observable.ts: Factory functions for creating specialized interaction streams.

src/view.ts: Side-effect-free rendering logic for the SVG canvas.

src/types.ts: Immutable type definitions and game interfaces.