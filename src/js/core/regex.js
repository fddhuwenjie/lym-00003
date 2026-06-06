import { Automaton, AUTOMATON_TYPES, EPSILON } from './automaton.js';
import { generateId } from '../utils/helpers.js';

export class RegexParser {
    constructor() {
        this.pos = 0;
        this.input = '';
    }

    parse(regex) {
        this.input = regex.replace(/\s+/g, '');
        this.pos = 0;
        return this.parseExpression();
    }

    peek() {
        return this.input[this.pos];
    }

    consume() {
        return this.input[this.pos++];
    }

    match(char) {
        if (this.peek() === char) {
            this.consume();
            return true;
        }
        return false;
    }

    parseExpression() {
        let term = this.parseTerm();
        while (this.peek() === '|') {
            this.consume();
            const right = this.parseTerm();
            term = { type: 'alternation', left: term, right: right };
        }
        return term;
    }

    parseTerm() {
        let factors = [];
        while (this.peek() && this.peek() !== ')' && this.peek() !== '|') {
            factors.push(this.parseFactor());
        }
        if (factors.length === 0) {
            return { type: 'epsilon' };
        }
        if (factors.length === 1) {
            return factors[0];
        }
        return factors.reduce((left, right) => ({ type: 'concatenation', left, right }));
    }

    parseFactor() {
        let base = this.parseBase();
        while (this.peek() === '*' || this.peek() === '+' || this.peek() === '?') {
            const op = this.consume();
            base = { type: 'star', operand: base, op };
        }
        return base;
    }

    parseBase() {
        const c = this.peek();
        
        if (c === '(') {
            this.consume();
            const expr = this.parseExpression();
            if (!this.match(')')) {
                throw new Error('缺少右括号');
            }
            return expr;
        }
        
        if (c === 'ε' || c === 'e') {
            this.consume();
            return { type: 'epsilon' };
        }
        
        if (c && c !== '|' && c !== '*' && c !== '+' && c !== '?' && c !== ')') {
            this.consume();
            return { type: 'symbol', value: c };
        }
        
        throw new Error(`意外的字符: ${c} at position ${this.pos}`);
    }
}

export class RegexToNFA {
    constructor() {
        this.stateCounter = 0;
    }

    convert(ast, automaton = null, steps = []) {
        this.stateCounter = 0;
        
        if (!automaton) {
            automaton = new Automaton(AUTOMATON_TYPES.NFA);
        }

        const result = this.buildNFA(ast, automaton, steps);
        
        automaton.setStartState(result.start);
        automaton.states.get(result.accept).isAccept = true;
        
        return { automaton, steps };
    }

    newState(automaton, prefix = 'q') {
        const state = automaton.addState(`${prefix}${this.stateCounter++}`);
        return state.id;
    }

    buildNFA(node, automaton, steps) {
        switch (node.type) {
            case 'epsilon':
                return this.buildEpsilon(automaton, steps);
            case 'symbol':
                return this.buildSymbol(node.value, automaton, steps);
            case 'concatenation':
                return this.buildConcatenation(node.left, node.right, automaton, steps);
            case 'alternation':
                return this.buildAlternation(node.left, node.right, automaton, steps);
            case 'star':
                return this.buildStar(node.operand, node.op, automaton, steps);
            default:
                throw new Error(`未知节点类型: ${node.type}`);
        }
    }

    buildEpsilon(automaton, steps) {
        const start = this.newState(automaton, 's');
        const accept = this.newState(automaton, 'a');
        automaton.addTransition(start, accept, EPSILON);
        
        steps.push({
            type: 'epsilon',
            description: '创建 ε 转移',
            start, accept
        });
        
        return { start, accept };
    }

    buildSymbol(symbol, automaton, steps) {
        const start = this.newState(automaton, 's');
        const accept = this.newState(automaton, 'a');
        automaton.addTransition(start, accept, symbol);
        
        steps.push({
            type: 'symbol',
            description: `创建符号 "${symbol}" 的转移`,
            start, accept, symbol
        });
        
        return { start, accept };
    }

    buildConcatenation(left, right, automaton, steps) {
        const leftNFA = this.buildNFA(left, automaton, steps);
        const rightNFA = this.buildNFA(right, automaton, steps);
        
        automaton.addTransition(leftNFA.accept, rightNFA.start, EPSILON);
        
        steps.push({
            type: 'concatenation',
            description: '连接两个 NFA',
            left: leftNFA,
            right: rightNFA
        });
        
        return { start: leftNFA.start, accept: rightNFA.accept };
    }

    buildAlternation(left, right, automaton, steps) {
        const start = this.newState(automaton, 's');
        const accept = this.newState(automaton, 'a');
        
        const leftNFA = this.buildNFA(left, automaton, steps);
        const rightNFA = this.buildNFA(right, automaton, steps);
        
        automaton.addTransition(start, leftNFA.start, EPSILON);
        automaton.addTransition(start, rightNFA.start, EPSILON);
        automaton.addTransition(leftNFA.accept, accept, EPSILON);
        automaton.addTransition(rightNFA.accept, accept, EPSILON);
        
        steps.push({
            type: 'alternation',
            description: '创建或分支 (|)',
            start, accept,
            left: leftNFA,
            right: rightNFA
        });
        
        return { start, accept };
    }

    buildStar(operand, op, automaton, steps) {
        const start = this.newState(automaton, 's');
        const accept = this.newState(automaton, 'a');
        
        const innerNFA = this.buildNFA(operand, automaton, steps);
        
        automaton.addTransition(start, innerNFA.start, EPSILON);
        automaton.addTransition(start, accept, EPSILON);
        automaton.addTransition(innerNFA.accept, innerNFA.start, EPSILON);
        automaton.addTransition(innerNFA.accept, accept, EPSILON);
        
        if (op === '+') {
            const transitionsToRemove = [];
            for (const t of automaton.transitions.values()) {
                if (t.from === start && t.to === accept) {
                    transitionsToRemove.push(t.id);
                }
            }
            transitionsToRemove.forEach(id => automaton.transitions.delete(id));
        }
        
        if (op === '?') {
            const transitionsToRemove = [];
            for (const t of automaton.transitions.values()) {
                if (t.from === innerNFA.accept && t.to === innerNFA.start) {
                    transitionsToRemove.push(t.id);
                }
            }
            transitionsToRemove.forEach(id => automaton.transitions.delete(id));
        }
        
        steps.push({
            type: 'star',
            description: `创建闭包 (${op})`,
            start, accept,
            inner: innerNFA,
            op
        });
        
        return { start, accept };
    }
}

export class NFAToDFA {
    constructor() {
        this.stateCounter = 0;
    }

    epsilonClosure(states, automaton) {
        const closure = new Set(states);
        const stack = [...states];
        
        while (stack.length > 0) {
            const stateId = stack.pop();
            const transitions = automaton.getTransitionsFrom(stateId);
            
            for (const t of transitions) {
                if (t.symbol === EPSILON && !closure.has(t.to)) {
                    closure.add(t.to);
                    stack.push(t.to);
                }
            }
        }
        
        return Array.from(closure);
    }

    move(states, symbol, automaton) {
        const result = new Set();
        
        for (const stateId of states) {
            const transitions = automaton.getTransitionsFrom(stateId);
            for (const t of transitions) {
                if (t.symbol === symbol) {
                    result.add(t.to);
                }
            }
        }
        
        return Array.from(result);
    }

    stateSetKey(states) {
        return [...states].sort().join(',');
    }

    convert(nfa, steps = []) {
        const dfa = new Automaton(AUTOMATON_TYPES.DFA);
        const stateMap = new Map();
        
        const startStates = this.epsilonClosure([nfa.startStateId], nfa);
        const startKey = this.stateSetKey(startStates);
        
        const dfaStart = dfa.addState(`D${this.stateCounter++}`);
        dfaStart.nfaStates = startStates;
        stateMap.set(startKey, dfaStart.id);
        dfa.setStartState(dfaStart.id);
        
        if (startStates.some(s => nfa.states.get(s)?.isAccept)) {
            dfaStart.isAccept = true;
        }
        
        steps.push({
            type: 'start-closure',
            description: `计算初始状态的 ε-闭包: {${startStates.map(s => nfa.states.get(s)?.name).join(', ')}}`,
            dfaState: dfaStart.id,
            nfaStates: startStates
        });
        
        const unprocessed = [dfaStart.id];
        const alphabet = Array.from(nfa.alphabet).filter(s => s !== EPSILON);
        
        while (unprocessed.length > 0) {
            const dfaStateId = unprocessed.shift();
            const dfaState = dfa.states.get(dfaStateId);
            const nfaStates = dfaState.nfaStates;
            
            for (const symbol of alphabet) {
                const moveStates = this.move(nfaStates, symbol, nfa);
                const closureStates = this.epsilonClosure(moveStates, nfa);
                
                if (closureStates.length === 0) continue;
                
                const key = this.stateSetKey(closureStates);
                let targetDfaId;
                
                if (!stateMap.has(key)) {
                    const newState = dfa.addState(`D${this.stateCounter++}`);
                    newState.nfaStates = closureStates;
                    stateMap.set(key, newState.id);
                    unprocessed.push(newState.id);
                    
                    if (closureStates.some(s => nfa.states.get(s)?.isAccept)) {
                        newState.isAccept = true;
                    }
                    
                    steps.push({
                        type: 'new-state',
                        description: `对符号 "${symbol}", 创建新状态 {${closureStates.map(s => nfa.states.get(s)?.name).join(', ')}}`,
                        dfaState: newState.id,
                        nfaStates: closureStates
                    });
                }
                
                targetDfaId = stateMap.get(key);
                dfa.addTransition(dfaStateId, targetDfaId, symbol);
                
                steps.push({
                    type: 'transition',
                    description: `δ(${dfaState.name}, "${symbol}") = ${dfa.states.get(targetDfaId).name}`,
                    from: dfaStateId,
                    to: targetDfaId,
                    symbol
                });
            }
        }
        
        dfa.alphabet = new Set(alphabet);
        
        return { dfa, steps };
    }
}
