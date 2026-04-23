# RxJS Flappy Birb

[cite_start]A declarative, purely functional implementation of the classic Flappy Bird game built using **Functional Reactive Programming (FRP)** principles[cite: 503]. [cite_start]This project explores the power of **RxJS Observable streams** to manage complex game states, user interactions, and physics without the use of imperative loops or mutable global variables[cite: 504, 505, 531].

## Core Technical Concepts

* [cite_start]**Functional Reactive Programming (FRP)**: Handles animation and user interaction entirely through asynchronous data streams[cite: 503, 504].
* [cite_start]**State Management**: Utilizes the `scan` and `merge` operators to process game state transitions in a purely functional manner, inspired by the Redux pattern[cite: 662].
* [cite_start]**Collision Physics**: Implements high-stakes collision logic where the bird interacts with a dynamic environment, including "bounce" mechanics with randomized velocities[cite: 553, 554, 556].
* [cite_start]**Session Replay (Ghost Bird)**: Features a non-interactive "ghost" bird that replays the exact path of previous runs in real-time by leveraging stream history[cite: 566, 572, 573].
* [cite_start]**Stream-Based Obstacles**: Dynamically generates and manages obstacles (pipes) based on external CSV data, synchronized with the game's timeline[cite: 558, 603, 663].



## Tech Stack

* [cite_start]**Language**: TypeScript (Strict Mode) [cite: 504]
* [cite_start]**Reactive Library**: RxJS [cite: 504]
* [cite_start]**Rendering**: SVG Canvas [cite: 531]
* [cite_start]**Testing**: Vitest for comprehensive unit testing of pure functions [cite: 680, 708]
* **Build Tool**: Vite

## Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v16+)

### Installation
```bash
# Install dependencies
npm install
