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

    minimizeDFA() {
        if (this.type !== AUTOMATON_TYPES.DFA) {
            throw new Error('只能对 DFA 执行最小化');
        }

        const validation = this.validate();
        if (validation.length > 0) {
            throw new Error('DFA 不完整，无法最小化: ' + validation.join('; '));
        }

        const states = Array.from(this.states.values());
        const stateIds = states.map(s => s.id);
        const alphabet = Array.from(this.alphabet);
        
        const steps = [];
        const n = states.length;
        
        const isAccept = new Map();
        states.forEach(s => isAccept.set(s.id, s.isAccept));
        
        const table = new Map();
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const key = `${stateIds[i]},${stateIds[j]}`;
                table.set(key, false);
            }
        }
        
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const s1 = stateIds[i], s2 = stateIds[j];
                if (isAccept.get(s1) !== isAccept.get(s2)) {
                    table.set(`${s1},${s2}`, true);
                }
            }
        }
        
        steps.push({
            description: '初始标记：区分接受状态和非接受状态',
            markedPairs: Array.from(table.entries()).filter(([, v]) => v).map(([k]) => k),
            groups: this.getGroupsFromTable(table, stateIds)
        });
        
        let changed = true;
        let iteration = 0;
        while (changed) {
            changed = false;
            iteration++;
            
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    const s1 = stateIds[i], s2 = stateIds[j];
                    const key = `${s1},${s2}`;
                    
                    if (table.get(key)) continue;
                    
                    for (const symbol of alphabet) {
                        const t1 = this.getTransitionForSymbol(s1, symbol);
                        const t2 = this.getTransitionForSymbol(s2, symbol);
                        
                        if (!t1 || !t2) continue;
                        
                        let pairKey;
                        const idx1 = stateIds.indexOf(t1.to);
                        const idx2 = stateIds.indexOf(t2.to);
                        
                        if (idx1 < idx2) {
                            pairKey = `${t1.to},${t2.to}`;
                        } else if (idx1 > idx2) {
                            pairKey = `${t2.to},${t1.to}`;
                        } else {
                            continue;
                        }
                        
                        if (table.get(pairKey)) {
                            table.set(key, true);
                            changed = true;
                            break;
                        }
                    }
                }
            }
            
            steps.push({
                description: `迭代 ${iteration}：检查转移目标`,
                markedPairs: Array.from(table.entries()).filter(([, v]) => v).map(([k]) => k),
                groups: this.getGroupsFromTable(table, stateIds)
            });
        }
        
        const groups = this.getGroupsFromTable(table, stateIds);
        
        steps.push({
            description: '最终等价类分组',
            groups: groups.map(g => g.map(id => this.states.get(id)?.name || id))
        });
        
        const minimized = new Automaton(AUTOMATON_TYPES.DFA);
        const groupMap = new Map();
        const oldToNew = new Map();
        
        groups.forEach((group, idx) => {
            const groupName = group.map(id => this.states.get(id)?.name || id).join(',');
            const isGroupStart = group.some(id => this.states.get(id)?.isStart);
            const isGroupAccept = group.some(id => this.states.get(id)?.isAccept);
            
            const newState = minimized.addState(`{${groupName}}`);
            newState.isStart = isGroupStart;
            newState.isAccept = isGroupAccept;
            
            if (isGroupStart) {
                minimized.startStateId = newState.id;
            }
            
            group.forEach(id => oldToNew.set(id, newState.id));
            groupMap.set(newState.id, group);
        });
        
        for (const group of groups) {
            const rep = group[0];
            const newFromId = oldToNew.get(rep);
            
            for (const symbol of alphabet) {
                const trans = this.getTransitionForSymbol(rep, symbol);
                if (trans) {
                    const newToId = oldToNew.get(trans.to);
                    minimized.addTransition(newFromId, newToId, symbol);
                }
            }
        }
        
        return {
            automaton: minimized,
            steps: steps,
            groups: groups.map(g => g.map(id => this.states.get(id)?.name || id)),
            oldToNew: oldToNew
        };
    }

    getGroupsFromTable(table, stateIds) {
        const parent = new Map();
        stateIds.forEach(id => parent.set(id, id));
        
        const find = (x) => {
            if (parent.get(x) !== x) {
                parent.set(x, find(parent.get(x)));
            }
            return parent.get(x);
        };
        
        const union = (x, y) => {
            const px = find(x), py = find(y);
            if (px !== py) {
                parent.set(py, px);
            }
        };
        
        const n = stateIds.length;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const s1 = stateIds[i], s2 = stateIds[j];
                const key = `${s1},${s2}`;
                if (!table.get(key)) {
                    union(s1, s2);
                }
            }
        }
        
        const groups = new Map();
        stateIds.forEach(id => {
            const root = find(id);
            if (!groups.has(root)) {
                groups.set(root, []);
            }
            groups.get(root).push(id);
        });
        
        return Array.from(groups.values());
    }

    getTransitionForSymbol(stateId, symbol) {
        const transitions = this.getTransitionsFrom(stateId);
        return transitions.find(t => t.symbol === symbol);
    }
}
