"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const break_infinity_js_1 = __importDefault(require("break_infinity.js"));
const x = new break_infinity_js_1.default(10);
//Main game loop
let gameRunning = true;
while (gameRunning) {
    //wait 50ms
    wait(50);
    gameLoop();
}
function gameLoop() {
    updateGame();
    renderGame();
    requestAnimationFrame(gameLoop);
}
//TODO: Implement game update
function updateGame() { }
//TODO: Implement game render
function renderGame() { }
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function PauseOrResumeGame() {
    gameRunning = !gameRunning;
    if (gameRunning) {
        console.log("Game resumed");
    }
    else {
        console.log("Game paused");
    }
}
//# sourceMappingURL=game.js.map