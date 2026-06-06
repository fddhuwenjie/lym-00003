import { AUTOMATON_TYPES, EPSILON, TM_LEFT, TM_RIGHT, TM_STAY, TM_BLANK } from './automaton.js';

export class AutomatonSimulator {
    constructor(automaton) {
        this.automaton = automaton;
        this.reset();
    }

    reset() {
        this.currentStates = new Set();
        this.inputPosition = 0;
        this.stack = [];
        this.tape = [];
        this.headPosition = 0;
        this.inputString = '';
        this.isAccepted = false;
        this.isRejected = false;
        this.isFinished = false;
        this.history = [];
        this.transitionHistory = [];
        
        const start = this.automaton.getStartState();
        if (start) {
            this.currentStates.add(start.id);
            
            if (this.automaton.type === AUTOMATON_TYPES.NFA) {
                this.currentStates = new Set(this.epsilonClosure(start.id));
            }
            
            if (this.automaton.type === AUTOMATON_TYPES.TM) {
                this.tape = [TM_BLANK];
                this.headPosition = 0;
            }
        }
    }

    setInput(input) {
        this.inputString = input;
        this.reset();
        
        if (this.automaton.type === AUTOMATON_TYPES.TM) {
            this.tape = input.length > 0 ? input.split('') : [TM_BLANK];
            this.headPosition = 0;
        }
    }

    epsilonClosure(stateId) {
        const closure = new Set([stateId]);
        const stack = [stateId];
        
        while (stack.length > 0) {
            const s = stack.pop();
            const transitions = this.automaton.getTransitionsFrom(s);
            for (const t of transitions) {
                if (t.symbol === EPSILON && !closure.has(t.to)) {
                    closure.add(t.to);
                    stack.push(t.to);
                }
            }
        }
        
        return Array.from(closure);
    }

    epsilonClosureSet(stateIds) {
        const closure = new Set();
        for (const s of stateIds) {
            for (const c of this.epsilonClosure(s)) {
                closure.add(c);
            }
        }
        return Array.from(closure);
    }

    canStep() {
        if (this.isFinished) return false;
        if (this.currentStates.size === 0) return false;
        
        if (this.automaton.type === AUTOMATON_TYPES.DFA || 
            this.automaton.type === AUTOMATON_TYPES.NFA) {
            return this.inputPosition < this.inputString.length;
        }
        
        return true;
    }

    step() {
        if (!this.canStep()) {
            this.checkAcceptance();
            return { transitions: [], newStates: [] };
        }
        
        this.history.push({
            states: new Set(this.currentStates),
            position: this.inputPosition,
            stack: [...this.stack],
            tape: [...this.tape],
            head: this.headPosition
        });
        
        let stepResult;
        
        switch (this.automaton.type) {
            case AUTOMATON_TYPES.DFA:
                stepResult = this.stepDFA();
                break;
            case AUTOMATON_TYPES.NFA:
                stepResult = this.stepNFA();
                break;
            case AUTOMATON_TYPES.PDA:
                stepResult = this.stepPDA();
                break;
            case AUTOMATON_TYPES.TM:
                stepResult = this.stepTM();
                break;
            default:
                stepResult = { transitions: [], newStates: [] };
        }
        
        this.transitionHistory.push(stepResult.transitions);
        
        if (!this.canStep()) {
            this.checkAcceptance();
        }
        
        return stepResult;
    }

    stepDFA() {
        const symbol = this.inputString[this.inputPosition];
        const currentStateId = Array.from(this.currentStates)[0];
        const transitions = this.automaton.getTransitionsFrom(currentStateId);
        const validTransitions = transitions.filter(t => t.symbol === symbol);
        
        if (validTransitions.length === 0) {
            this.currentStates.clear();
            this.isRejected = true;
            this.isFinished = true;
            return { transitions: [], newStates: [] };
        }
        
        const transition = validTransitions[0];
        this.currentStates = new Set([transition.to]);
        this.inputPosition++;
        
        return {
            transitions: [transition.id],
            newStates: [transition.to]
        };
    }

    stepNFA() {
        const symbol = this.inputString[this.inputPosition];
        const newStates = new Set();
        const usedTransitions = [];
        
        for (const stateId of this.currentStates) {
            const transitions = this.automaton.getTransitionsFrom(stateId);
            const validTransitions = transitions.filter(t => t.symbol === symbol);
            
            for (const t of validTransitions) {
                const closure = this.epsilonClosure(t.to);
                for (const s of closure) {
                    newStates.add(s);
                }
                usedTransitions.push(t.id);
            }
        }
        
        this.currentStates = newStates;
        this.inputPosition++;
        
        if (newStates.size === 0) {
            this.isRejected = true;
            this.isFinished = true;
        }
        
        return {
            transitions: usedTransitions,
            newStates: Array.from(newStates)
        };
    }

    stepPDA() {
        const symbol = this.inputPosition < this.inputString.length 
            ? this.inputString[this.inputPosition] 
            : EPSILON;
        
        const newConfigs = [];
        const usedTransitions = [];
        
        for (const stateId of this.currentStates) {
            const transitions = this.automaton.getTransitionsFrom(stateId);
            
            for (const t of transitions) {
                const symbolMatch = t.symbol === EPSILON || t.symbol === symbol;
                const stackTop = this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
                const stackMatch = t.stackOp.pop === null || t.stackOp.pop === stackTop;
                
                if (symbolMatch && stackMatch) {
                    const newStack = [...this.stack];
                    if (t.stackOp.pop !== null) {
                        newStack.pop();
                    }
                    if (t.stackOp.push !== null) {
                        newStack.push(t.stackOp.push);
                    }
                    
                    newConfigs.push({
                        state: t.to,
                        stack: newStack,
                        consume: t.symbol !== EPSILON
                    });
                    usedTransitions.push(t.id);
                }
            }
        }
        
        if (newConfigs.length > 0) {
            const config = newConfigs[0];
            this.currentStates = new Set([config.state]);
            this.stack = config.stack;
            if (config.consume) {
                this.inputPosition++;
            }
        } else {
            this.isRejected = true;
            this.isFinished = true;
        }
        
        return {
            transitions: usedTransitions,
            newStates: Array.from(this.currentStates)
        };
    }

    stepTM() {
        const currentStateId = Array.from(this.currentStates)[0];
        const currentSymbol = this.tape[this.headPosition] || TM_BLANK;
        const transitions = this.automaton.getTransitionsFrom(currentStateId);
        const validTransitions = transitions.filter(t => t.symbol === currentSymbol);
        
        if (validTransitions.length === 0) {
            this.isRejected = true;
            this.isFinished = true;
            return { transitions: [], newStates: [] };
        }
        
        const transition = validTransitions[0];
        
        if (transition.tapeOp.write !== null) {
            this.tape[this.headPosition] = transition.tapeOp.write;
        }
        
        switch (transition.tapeOp.direction) {
            case TM_LEFT:
                this.headPosition--;
                if (this.headPosition < 0) {
                    this.tape.unshift(TM_BLANK);
                    this.headPosition = 0;
                }
                break;
            case TM_RIGHT:
                this.headPosition++;
                if (this.headPosition >= this.tape.length) {
                    this.tape.push(TM_BLANK);
                }
                break;
            case TM_STAY:
                break;
        }
        
        this.currentStates = new Set([transition.to]);
        
        return {
            transitions: [transition.id],
            newStates: [transition.to]
        };
    }

    checkAcceptance() {
        if (this.isFinished) return;
        
        const type = this.automaton.type;
        const acceptStates = this.automaton.getAcceptStates();
        
        if (type === AUTOMATON_TYPES.DFA || type === AUTOMATON_TYPES.NFA) {
            if (this.inputPosition >= this.inputString.length) {
                for (const stateId of this.currentStates) {
                    if (this.automaton.states.get(stateId)?.isAccept) {
                        this.isAccepted = true;
                        this.isFinished = true;
                        return;
                    }
                }
                this.isRejected = true;
                this.isFinished = true;
            }
        } else if (type === AUTOMATON_TYPES.PDA) {
            for (const stateId of this.currentStates) {
                if (this.automaton.states.get(stateId)?.isAccept) {
                    this.isAccepted = true;
                    this.isFinished = true;
                    return;
                }
            }
            if (this.stack.length === 0) {
                this.isAccepted = true;
                this.isFinished = true;
                return;
            }
            this.isRejected = true;
            this.isFinished = true;
        } else if (type === AUTOMATON_TYPES.TM) {
            for (const stateId of this.currentStates) {
                if (this.automaton.states.get(stateId)?.isAccept) {
                    this.isAccepted = true;
                    this.isFinished = true;
                    return;
                }
            }
            this.isRejected = true;
            this.isFinished = true;
        }
    }

    stepBack() {
        if (this.history.length === 0) return false;
        
        const prev = this.history.pop();
        this.transitionHistory.pop();
        
        this.currentStates = prev.states;
        this.inputPosition = prev.position;
        this.stack = prev.stack;
        this.tape = prev.tape;
        this.headPosition = prev.head;
        this.isAccepted = false;
        this.isRejected = false;
        this.isFinished = false;
        
        return true;
    }

    getActiveStates() {
        return Array.from(this.currentStates);
    }

    getActiveTransitions() {
        if (this.transitionHistory.length === 0) return [];
        return this.transitionHistory[this.transitionHistory.length - 1];
    }

    getStack() {
        return [...this.stack];
    }

    getTape() {
        return [...this.tape];
    }

    getHeadPosition() {
        return this.headPosition;
    }

    runToEnd(maxSteps = 1000) {
        let steps = 0;
        while (this.canStep() && steps < maxSteps) {
            this.step();
            steps++;
        }
        if (!this.isFinished) {
            this.checkAcceptance();
        }
        return { accepted: this.isAccepted, steps };
    }
}
