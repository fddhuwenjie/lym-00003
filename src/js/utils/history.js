import { deepClone } from './helpers.js';

export class HistoryManager {
    constructor(maxHistory = 50) {
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistory = maxHistory;
    }

    push(state) {
        const clonedState = deepClone(state);
        this.undoStack.push(clonedState);
        this.redoStack = [];
        
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }
    }

    canUndo() {
        return this.undoStack.length > 1;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }

    undo(currentState) {
        if (!this.canUndo()) return currentState;
        
        const current = this.undoStack.pop();
        this.redoStack.push(current);
        return deepClone(this.undoStack[this.undoStack.length - 1]);
    }

    redo() {
        if (!this.canRedo()) return null;
        
        const state = this.redoStack.pop();
        this.undoStack.push(state);
        return deepClone(state);
    }

    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }
}
