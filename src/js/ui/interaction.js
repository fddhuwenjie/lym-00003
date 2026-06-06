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
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseLeave(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        
        window.addEventListener('resize', () => this.onResize());
    }

    getCanvasMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    onMouseDown(e) {
        const screenPos = this.getCanvasMousePos(e);
        const worldPos = this.renderer.screenToWorld(screenPos.x, screenPos.y);
        this.lastMousePos = screenPos;
        
        const state = this.renderer.getStateAtPoint(worldPos.x, worldPos.y, this.app.automaton);
        const transition = this.renderer.getTransitionAtPoint(worldPos.x, worldPos.y, this.app.automaton);
        
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            this.isPanning = true;
            this.canvas.style.cursor = 'grabbing';
            return;
        }
        
        switch (this.editMode) {
            case EDIT_MODE.SELECT:
                if (state) {
                    this.renderer.selectedStateId = state.id;
                    this.renderer.selectedTransitionId = null;
                    this.isDragging = true;
                    this.dragStateId = state.id;
                    this.dragOffset = {
                        x: worldPos.x - state.x,
                        y: worldPos.y - state.y
                    };
                    this.app.updatePropertyPanel();
                } else if (transition) {
                    this.renderer.selectedTransitionId = transition.id;
                    this.renderer.selectedStateId = null;
                    this.app.updatePropertyPanel();
                } else {
                    this.renderer.selectedStateId = null;
                    this.renderer.selectedTransitionId = null;
                    this.isPanning = true;
                    this.canvas.style.cursor = 'grabbing';
                    this.app.updatePropertyPanel();
                }
                break;
                
            case EDIT_MODE.ADD_STATE:
                this.app.addAction(() => {
                    const newState = this.app.automaton.addState(null, worldPos.x, worldPos.y);
                    this.renderer.selectedStateId = newState.id;
                    this.renderer.selectedTransitionId = null;
                    this.app.updateUI();
                });
                break;
                
            case EDIT_MODE.ADD_TRANSITION:
                if (state) {
                    this.transitionStartState = state;
                    this.renderer.previewTransition = {
                        from: state,
                        toX: worldPos.x,
                        toY: worldPos.y
                    };
                }
                break;
                
            case EDIT_MODE.SET_START:
                if (state) {
                    this.app.addAction(() => {
                        this.app.automaton.setStartState(state.id);
                        this.app.updateUI();
                    });
                }
                break;
                
            case EDIT_MODE.SET_ACCEPT:
                if (state) {
                    this.app.addAction(() => {
                        this.app.automaton.toggleAcceptState(state.id);
                        this.app.updateUI();
                    });
                }
                break;
                
            case EDIT_MODE.DELETE:
                if (state) {
                    this.app.addAction(() => {
                        this.app.automaton.removeState(state.id);
                        this.renderer.selectedStateId = null;
                        this.app.updateUI();
                    });
                } else if (transition) {
                    this.app.addAction(() => {
                        this.app.automaton.removeTransition(transition.id);
                        this.renderer.selectedTransitionId = null;
                        this.app.updateUI();
                    });
                }
                break;
        }
        
        this.requestRender();
    }

    onMouseMove(e) {
        const screenPos = this.getCanvasMousePos(e);
        const worldPos = this.renderer.screenToWorld(screenPos.x, screenPos.y);
        
        this.app.updateMousePosition(worldPos);
        
        if (this.isPanning) {
            const dx = (screenPos.x - this.lastMousePos.x) / this.renderer.zoom;
            const dy = (screenPos.y - this.lastMousePos.y) / this.renderer.zoom;
            this.renderer.panX += dx;
            this.renderer.panY += dy;
            this.lastMousePos = screenPos;
            this.requestRender();
            return;
        }
        
        if (this.isDragging && this.dragStateId) {
            const state = this.app.automaton.states.get(this.dragStateId);
            if (state) {
                state.x = worldPos.x - this.dragOffset.x;
                state.y = worldPos.y - this.dragOffset.y;
                this.app.isModified = true;
            }
            this.requestRender();
            return;
        }
        
        if (this.transitionStartState) {
            this.renderer.previewTransition.toX = worldPos.x;
            this.renderer.previewTransition.toY = worldPos.y;
            this.requestRender();
            return;
        }
        
        const state = this.renderer.getStateAtPoint(worldPos.x, worldPos.y, this.app.automaton);
        const transition = this.renderer.getTransitionAtPoint(worldPos.x, worldPos.y, this.app.automaton);
        
        this.renderer.hoveredStateId = state ? state.id : null;
        this.renderer.hoveredTransitionId = transition ? transition.id : null;
        
        this.updateCursor(state, transition);
        
        this.requestRender();
    }

    onMouseUp(e) {
        const screenPos = this.getCanvasMousePos(e);
        const worldPos = this.renderer.screenToWorld(screenPos.x, screenPos.y);
        
        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = 'default';
        }
        
        if (this.isDragging) {
            this.isDragging = false;
            this.dragStateId = null;
            this.app.pushHistory();
        }
        
        if (this.transitionStartState) {
            const targetState = this.renderer.getStateAtPoint(worldPos.x, worldPos.y, this.app.automaton);
            if (targetState) {
                this.showTransitionDialog(this.transitionStartState, targetState);
            }
            this.transitionStartState = null;
            this.renderer.previewTransition = null;
        }
        
        this.requestRender();
    }

    onMouseLeave(e) {
        this.isPanning = false;
        this.isDragging = false;
        this.dragStateId = null;
        this.transitionStartState = null;
        this.renderer.previewTransition = null;
        this.renderer.hoveredStateId = null;
        this.renderer.hoveredTransitionId = null;
        this.canvas.style.cursor = 'default';
        this.requestRender();
    }

    onWheel(e) {
        e.preventDefault();
        const screenPos = this.getCanvasMousePos(e);
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        this.renderer.zoomAt(screenPos.x, screenPos.y, factor);
        this.app.updateZoomLevel();
        this.requestRender();
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

    updateCursor(state, transition) {
        switch (this.editMode) {
            case EDIT_MODE.SELECT:
                if (state) {
                    this.canvas.style.cursor = 'grab';
                } else if (transition) {
                    this.canvas.style.cursor = 'pointer';
                } else {
                    this.canvas.style.cursor = 'default';
                }
                break;
            case EDIT_MODE.ADD_STATE:
                this.canvas.style.cursor = 'crosshair';
                break;
            case EDIT_MODE.ADD_TRANSITION:
                this.canvas.style.cursor = state ? 'crosshair' : 'default';
                break;
            case EDIT_MODE.SET_START:
            case EDIT_MODE.SET_ACCEPT:
                this.canvas.style.cursor = state ? 'pointer' : 'default';
                break;
            case EDIT_MODE.DELETE:
                this.canvas.style.cursor = (state || transition) ? 'not-allowed' : 'default';
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

    requestRender() {
        if (this.animationFrameId) return;
        
        this.animationFrameId = requestAnimationFrame(() => {
            this.animationFrameId = null;
            this.app.render();
        });
    }
}
