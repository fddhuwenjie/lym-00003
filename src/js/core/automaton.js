import { generateId, deepClone } from '../utils/helpers.js';

export const AUTOMATON_TYPES = {
    DFA: 'dfa',
    NFA: 'nfa',
    PDA: 'pda',
    TM: 'tm'
};

export const EPSILON = 'ε';
export const TM_LEFT = 'L';
export const TM_RIGHT = 'R';
export const TM_STAY = 'S';
export const TM_BLANK = '␣';

export class Automaton {
    constructor(type = AUTOMATON_TYPES.DFA) {
        this.type = type;
        this.states = new Map();
        this.transitions = new Map();
        this.startStateId = null;
        this.alphabet = new Set();
        this.stackAlphabet = new Set();
        this.tapeAlphabet = new Set();
    }

    clone() {
        const cloned = new Automaton(this.type);
        cloned.states = new Map(this.states);
        cloned.transitions = new Map(this.transitions);
        cloned.startStateId = this.startStateId;
        cloned.alphabet = new Set(this.alphabet);
        cloned.stackAlphabet = new Set(this.stackAlphabet);
        cloned.tapeAlphabet = new Set(this.tapeAlphabet);
        return cloned;
    }

    addState(name, x = 0, y = 0) {
        const id = generateId('state');
        const state = {
            id,
            name: name || `q${this.states.size}`,
            x,
            y,
            isStart: false,
            isAccept: false,
            label: ''
        };
        this.states.set(id, state);
        return state;
    }

    removeState(stateId) {
        this.states.delete(stateId);
        const transitionsToDelete = [];
        for (const [id, t] of this.transitions) {
            if (t.from === stateId || t.to === stateId) {
                transitionsToDelete.push(id);
            }
        }
        transitionsToDelete.forEach(id => this.transitions.delete(id));
        if (this.startStateId === stateId) {
            this.startStateId = null;
        }
    }

    setStatePosition(stateId, x, y) {
        const state = this.states.get(stateId);
        if (state) {
            state.x = x;
            state.y = y;
        }
    }

    setStartState(stateId) {
        for (const state of this.states.values()) {
            state.isStart = false;
        }
        const state = this.states.get(stateId);
        if (state) {
            state.isStart = true;
            this.startStateId = stateId;
        }
    }

    toggleAcceptState(stateId) {
        const state = this.states.get(stateId);
        if (state) {
            state.isAccept = !state.isAccept;
        }
    }

    addTransition(from, to, symbol, stackOp = null, tapeOp = null) {
        const id = generateId('trans');
        const transition = {
            id,
            from,
            to,
            symbol: symbol || EPSILON,
            stackOp: stackOp || { pop: null, push: null },
            tapeOp: tapeOp || { write: null, direction: null }
        };
        
        if (symbol && symbol !== EPSILON) {
            this.alphabet.add(symbol);
        }
        
        this.transitions.set(id, transition);
        return transition;
    }

    removeTransition(transitionId) {
        this.transitions.delete(transitionId);
    }

    getTransitionsFrom(stateId) {
        return Array.from(this.transitions.values()).filter(t => t.from === stateId);
    }

    getTransitionsTo(stateId) {
        return Array.from(this.transitions.values()).filter(t => t.to === stateId);
    }

    getTransitionsBetween(fromId, toId) {
        return Array.from(this.transitions.values())
            .filter(t => t.from === fromId && t.to === toId);
    }

    getStartState() {
        return this.startStateId ? this.states.get(this.startStateId) : null;
    }

    getAcceptStates() {
        return Array.from(this.states.values()).filter(s => s.isAccept);
    }

    toJSON() {
        return {
            type: this.type,
            states: Array.from(this.states.values()),
            transitions: Array.from(this.transitions.values()),
            startStateId: this.startStateId,
            alphabet: Array.from(this.alphabet),
            stackAlphabet: Array.from(this.stackAlphabet),
            tapeAlphabet: Array.from(this.tapeAlphabet)
        };
    }

    static fromJSON(json) {
        const automaton = new Automaton(json.type);
        json.states.forEach(s => {
            automaton.states.set(s.id, { ...s });
        });
        json.transitions.forEach(t => {
            automaton.transitions.set(t.id, { ...t });
        });
        automaton.startStateId = json.startStateId;
        automaton.alphabet = new Set(json.alphabet || []);
        automaton.stackAlphabet = new Set(json.stackAlphabet || []);
        automaton.tapeAlphabet = new Set(json.tapeAlphabet || []);
        return automaton;
    }

    validate() {
        const errors = [];
        
        if (!this.startStateId) {
            errors.push('必须设置初始状态');
        }
        
        if (this.states.size === 0) {
            errors.push('至少需要一个状态');
        }

        if (this.type === AUTOMATON_TYPES.DFA) {
            const start = this.getStartState();
            if (start) {
                for (const state of this.states.values()) {
                    for (const symbol of this.alphabet) {
                        const outgoing = this.getTransitionsFrom(state.id)
                            .filter(t => t.symbol === symbol);
                        if (outgoing.length === 0) {
                            errors.push(`状态 ${state.name} 缺少符号 "${symbol}" 的转移`);
                        } else if (outgoing.length > 1) {
                            errors.push(`状态 ${state.name} 对符号 "${symbol}" 有多个转移`);
                        }
                    }
                }
            }
        }

        return errors;
    }
}
