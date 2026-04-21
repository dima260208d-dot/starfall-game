export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  attack: boolean;
  super: boolean;
  mouseX: number;
  mouseY: number;
  mouseWorldX: number;
  mouseWorldY: number;
}

export class InputHandler {
  state: InputState = {
    up: false,
    down: false,
    left: false,
    right: false,
    attack: false,
    super: false,
    mouseX: 0,
    mouseY: 0,
    mouseWorldX: 0,
    mouseWorldY: 0,
  };

  private canvas: HTMLCanvasElement;
  private onAttack?: () => void;
  private onSuper?: () => void;

  constructor(canvas: HTMLCanvasElement, onAttack?: () => void, onSuper?: () => void) {
    this.canvas = canvas;
    this.onAttack = onAttack;
    this.onSuper = onSuper;
    this.bindEvents();
  }

  private bindEvents(): void {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.canvas.addEventListener("mousemove", this.onMouseMove);
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    this.canvas.addEventListener("mouseup", this.onMouseUp);
    this.canvas.addEventListener("contextmenu", this.onContextMenu);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    switch (e.code) {
      case "KeyW": case "ArrowUp": this.state.up = true; break;
      case "KeyS": case "ArrowDown": this.state.down = true; break;
      case "KeyA": case "ArrowLeft": this.state.left = true; break;
      case "KeyD": case "ArrowRight": this.state.right = true; break;
      case "Space":
        if (!this.state.attack) { this.state.attack = true; this.onAttack?.(); }
        e.preventDefault();
        break;
      case "KeyE":
      case "KeyQ":
        if (!this.state.super) { this.state.super = true; this.onSuper?.(); }
        break;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    switch (e.code) {
      case "KeyW": case "ArrowUp": this.state.up = false; break;
      case "KeyS": case "ArrowDown": this.state.down = false; break;
      case "KeyA": case "ArrowLeft": this.state.left = false; break;
      case "KeyD": case "ArrowRight": this.state.right = false; break;
      case "Space": this.state.attack = false; break;
      case "KeyE": case "KeyQ": this.state.super = false; break;
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.state.mouseX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    this.state.mouseY = (e.clientY - rect.top) * (this.canvas.height / rect.height);
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) {
      this.state.attack = true;
      this.onAttack?.();
    } else if (e.button === 2) {
      this.state.super = true;
      this.onSuper?.();
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.state.attack = false;
    if (e.button === 2) this.state.super = false;
  };

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  updateWorldMouse(camX: number, camY: number): void {
    this.state.mouseWorldX = this.state.mouseX + camX;
    this.state.mouseWorldY = this.state.mouseY + camY;
  }

  destroy(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    this.canvas.removeEventListener("mouseup", this.onMouseUp);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
  }
}
