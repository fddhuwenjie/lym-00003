import { AUTOMATON_TYPES, EPSILON, TM_LEFT, TM_RIGHT, TM_STAY } from '../core/automaton.js';
import { STATE_RADIUS } from '../core/renderer.js';

export const EDIT_MODE = {
    SELECT: 'select',
    ADD_STATE: 'add_state',
    ADD_TRANSITION: 'add_transition',
    SET_START: 'set_start',
    SET_ACCEPT: 'set_accept',
    DELETE: 'delete'
};

export class InteractionManager {
    constructor(app) {
        this.app = app;
        this.canvas = app.canvas;
        this.renderer = app.renderer;
        this.editMode = EDIT_MODE.SELECT;
        
        this.isDragging = false;
        this.isPanning = false;
        this.dragStateId = null;
        this.dragOffset = { x: 0, y: 0 };
        this.lastMousePos = { x: 0, y: 0 };
        this.transitionStartState = null;
        this.animationFrameId = null;
        
        this.bindEvents();
    }

    bindEvents() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e, 'left'));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e, 'left'));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e, 'left'));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseLeave(e, 'left'));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e, 'left'), { passive: false });
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        const rightCanvas = document.getElementById('main-canvas-right');
        if (rightCanvas) {
            rightCanvas.addEventListener('mousedown', (e) => this.onMouseDown(e, 'right'));
            rightCanvas.addEventListener('mousemove', (e) => this.onMouseMove(e, 'right'));
            rightCanvas.addEventListener('mouseup', (e) => this.onMouseUp(e, 'right'));
            rightCanvas.addEventListener('mouseleave', (e) => this.onMouseLeave(e, 'right'));
            rightCanvas.addEventListener('wheel', (e) => this.onWheel(e, 'right'), { passive: false });
            rightCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
        }
        
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        
        window.addEventListener('resize', () => this.onResize());
    }

    getCanvasMousePos(e, canvas) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    getContext(side) {
        if (side === 'right' && this.app.isCompareMode) {
            return {
                canvas: this.app.rightCanvas,
                renderer: this.app.rightRenderer,
                automaton: this.app.rightAutomaton
            };
        }
        return {
            canvas: this.canvas,
            renderer: this.renderer,
            automaton: this.app.automaton
        };
    }

    onMouseDown(e, side = 'left') {
        const ctx = this.getContext(side);
        if (!ctx.renderer || !ctx.automaton) return;
        
        const screenPos = this.getCanvasMousePos(e, ctx.canvas);
        const worldPos = ctx.renderer.screenToWorld(screenPos.x, screenPos.y);
        this.lastMousePos = screenPos;
        
        const state = ctx.renderer.getStateAtPoint(worldPos.x, worldPos.y, ctx.automaton);
        const transition = ctx.renderer.getTransitionAtPoint(worldPos.x, worldPos.y, ctx.automaton);
        
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            this.isPanning = true;
            ctx.canvas.style.cursor = 'grabbing';
            return;
        }
        
        switch (this.editMode) {
            case EDIT_MODE.SELECT:
                if (state) {
                    ctx.renderer.selectedStateId = state.id;
                    ctx.renderer.selectedTransitionId = null;
                    this.isDragging = true;
                    this.dragStateId = state.id;
                    this.dragOffset = {
                        x: worldPos.x - state.x,
                        y: worldPos.y - state.y
                    };
                    this.app.updatePropertyPanel();
                } else if (transition) {
                    ctx.renderer.selectedTransitionId = transition.id;
                    ctx.renderer.selectedStateId = null;
                    this.app.updatePropertyPanel();
                } else {
                    ctx.renderer.selectedStateId = null;
                    ctx.renderer.selectedTransitionId = null;
                    this.isPanning = true;
                    ctx.canvas.style.cursor = 'grabbing';
                    this.app.updatePropertyPanel();
                }
                break;
                
            case EDIT_MODE.ADD_STATE:
                if (side === 'left') {
                    this.app.addAction(() => {
                        const newState = this.app.automaton.addState(null, worldPos.x, worldPos.y);
                        this.renderer.selectedStateId = newState.id;
                        this.renderer.selectedTransitionId = null;
                        this.app.updateUI();
                    });
                }
                break;
                
            case EDIT_MODE.ADD_TRANSITION:
                if (state && side === 'left') {
                    this.transitionStartState = state;
                    ctx.renderer.previewTransition = {
                        from: state,
                        toX: worldPos.x,
                        toY: worldPos.y
                    };
                }
                break;
                
            case EDIT_MODE.SET_START:
                if (state && side === 'left') {
                    this.app.addAction(() => {
                        this.app.automaton.setStartState(state.id);
                        this.app.updateUI();
                    });
                }
                break;
                
            case EDIT_MODE.SET_ACCEPT:
                if (state && side === 'left') {
                    this.app.addAction(() => {
                        this.app.automaton.toggleAcceptState(state.id);
                        this.app.updateUI();
                    });
                }
                break;
                
            case EDIT_MODE.DELETE:
                if (state && side === 'left') {
                    this.app.addAction(() => {
                        this.app.automaton.removeState(state.id);
                        this.renderer.selectedStateId = null;
                        this.app.updateUI();
                    });
                } else if (transition && side === 'left') {
                    this.app.addAction(() => {
                        this.app.automaton.removeTransition(transition.id);
                        this.renderer.selectedTransitionId = null;
                        this.app.updateUI();
                    });
                }
                break;
        }
        
        this.requestRender(side);
    }

    onMouseMove(e, side = 'left') {
        const ctx = this.getContext(side);
        if (!ctx.renderer || !ctx.automaton) return;
        
        const screenPos = this.getCanvasMousePos(e, ctx.canvas);
        const worldPos = ctx.renderer.screenToWorld(screenPos.x, screenPos.y);
        
        if (side === 'left') {
            this.app.updateMousePosition(worldPos);
        }
        
        if (this.isPanning) {
            const dx = (screenPos.x - this.lastMousePos.x) / ctx.renderer.zoom;
            const dy = (screenPos.y - this.lastMousePos.y) / ctx.renderer.zoom;
            ctx.renderer.panX += dx;
            ctx.renderer.panY += dy;
            this.lastMousePos = screenPos;
            this.requestRender(side);
            return;
        }
        
        if (this.isDragging && this.dragStateId && side === 'left') {
            const state = this.app.automaton.states.get(this.dragStateId);
            if (state) {
                state.x = worldPos.x - this.dragOffset.x;
                state.y = worldPos.y - this.dragOffset.y;
                this.app.isModified = true;
            }
            this.requestRender(side);
            return;
        }
        
        if (this.transitionStartState && side === 'left') {
            ctx.renderer.previewTransition.toX = worldPos.x;
            ctx.renderer.previewTransition.toY = worldPos.y;
            this.requestRender(side);
            return;
        }
        
        const state = ctx.renderer.getStateAtPoint(worldPos.x, worldPos.y, ctx.automaton);
        const transition = ctx.renderer.getTransitionAtPoint(worldPos.x, worldPos.y, ctx.automaton);
        
        ctx.renderer.hoveredStateId = state ? state.id : null;
        ctx.renderer.hoveredTransitionId = transition ? transition.id : null;
        
        this.updateCursor(state, transition, ctx.canvas);
        
        this.requestRender(side);
    }

    onMouseUp(e, side = 'left') {
        const ctx = this.getContext(side);
        if (!ctx.renderer || !ctx.automaton) return;
        
        const screenPos = this.getCanvasMousePos(e, ctx.canvas);
        const worldPos = ctx.renderer.screenToWorld(screenPos.x, screenPos.y);
        
        if (this.isPanning) {
            this.isPanning = false;
            ctx.canvas.style.cursor = 'default';
        }
        
        if (this.isDragging && side === 'left') {
            this.isDragging = false;
            this.dragStateId = null;
            this.app.pushHistory();
        }
        
        if (this.transitionStartState && side === 'left') {
            const targetState = ctx.renderer.getStateAtPoint(worldPos.x, worldPos.y, ctx.automaton);
            if (targetState) {
                this.showTransitionDialog(this.transitionStartState, targetState);
            }
            this.transitionStartState = null;
            ctx.renderer.previewTransition = null;
        }
        
        this.requestRender(side);
    }

    onMouseLeave(e, side = 'left') {
        const ctx = this.getContext(side);
        if (!ctx.renderer) return;
        
        this.isPanning = false;
        this.isDragging = false;
        this.dragStateId = null;
        this.transitionStartState = null;
        ctx.renderer.previewTransition = null;
        ctx.renderer.hoveredStateId = null;
        ctx.renderer.hoveredTransitionId = null;
        ctx.canvas.style.cursor = 'default';
        this.requestRender(side);
    }

    onWheel(e, side = 'left') {
        e.preventDefault();
        const ctx = this.getContext(side);
        if (!ctx.renderer) return;
        
        const screenPos = this.getCanvasMousePos(e, ctx.canvas);
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        ctx.renderer.zoomAt(screenPos.x, screenPos.y, factor);
        
        if (side === 'left') {
            this.app.updateZoomLevel();
        } else {
            this.app.updateZoomLevelRight();
        }
        
        this.requestRender(side);
    }

    onKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            this.app.undo();
            return;
        }
        
        if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            this.app.redo();
            return;
        }
        
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            if (this.renderer.selectedStateId) {
                this.app.addAction(() => {
                    this.app.automaton.removeState(this.renderer.selectedStateId);
                    this.renderer.selectedStateId = null;
                    this.app.updateUI();
                });
            } else if (this.renderer.selectedTransitionId) {
                this.app.addAction(() => {
                    this.app.automaton.removeTransition(this.renderer.selectedTransitionId);
                    this.renderer.selectedTransitionId = null;
                    this.app.updateUI();
                });
            }
            return;
        }
        
        if (e.key === 'v' || e.key === 'V') {
            this.setEditMode(EDIT_MODE.SELECT);
        } else if (e.key === 's' || e.key === 'S') {
            this.setEditMode(EDIT_MODE.ADD_STATE);
        } else if (e.key === 't' || e.key === 'T') {
            this.setEditMode(EDIT_MODE.ADD_TRANSITION);
        } else if (e.key === 'Escape') {
            this.renderer.selectedStateId = null;
            this.renderer.selectedTransitionId = null;
            this.app.updatePropertyPanel();
            this.requestRender();
        }
    }

    onResize() {
        const container = this.canvas.parentElement;
        this.renderer.resize(container.clientWidth, container.clientHeight);
        this.requestRender();
    }

    updateCursor(state, transition, canvas) {
        const targetCanvas = canvas || this.canvas;
        switch (this.editMode) {
            case EDIT_MODE.SELECT:
                if (state) {
                    targetCanvas.style.cursor = 'grab';
                } else if (transition) {
                    targetCanvas.style.cursor = 'pointer';
                } else {
                    targetCanvas.style.cursor = 'default';
                }
                break;
            case EDIT_MODE.ADD_STATE:
                targetCanvas.style.cursor = 'crosshair';
                break;
            case EDIT_MODE.ADD_TRANSITION:
                targetCanvas.style.cursor = state ? 'crosshair' : 'default';
                break;
            case EDIT_MODE.SET_START:
            case EDIT_MODE.SET_ACCEPT:
                targetCanvas.style.cursor = state ? 'pointer' : 'default';
                break;
            case EDIT_MODE.DELETE:
                targetCanvas.style.cursor = (state || transition) ? 'not-allowed' : 'default';
                break;
        }
    }

    setEditMode(mode) {
        this.editMode = mode;
        this.app.updateEditButtons();
    }

    showTransitionDialog(fromState, toState) {
        const type = this.app.automaton.type;
        const symbol = prompt('请输入转移符号 (留空为 ε):', '');
        
        if (symbol === null) return;
        
        const finalSymbol = symbol === '' ? EPSILON : symbol;
        let stackOp = null;
        let tapeOp = null;
        
        if (type === AUTOMATON_TYPES.PDA) {
            const pop = prompt('栈弹出符号 (留空为 ε):', '') || null;
            const push = prompt('栈压入符号 (留空为 ε):', '') || null;
            stackOp = { pop, push };
        }
        
        if (type === AUTOMATON_TYPES.TM) {
            const write = prompt('写入符号 (留空为不写):', '') || null;
            const dirRaw = prompt('移动方向 (L/R/S):', 'R')?.toUpperCase();
            const direction = dirRaw === 'L' ? TM_LEFT : (dirRaw === 'S' ? TM_STAY : TM_RIGHT);
            tapeOp = { write, direction };
        }
        
        this.app.addAction(() => {
            this.app.automaton.addTransition(fromState.id, toState.id, finalSymbol, stackOp, tapeOp);
            this.app.updateUI();
        });
    }

    requestRender(side = 'left') {
        if (this.animationFrameId) return;
        
        this.animationFrameId = requestAnimationFrame(() => {
            this.animationFrameId = null;
            this.app.render();
            if (this.app.isCompareMode) {
                this.app.renderRight();
            }
        });
    }
}
