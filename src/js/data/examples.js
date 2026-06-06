import { Automaton, AUTOMATON_TYPES, EPSILON, TM_LEFT, TM_RIGHT, TM_STAY, TM_BLANK } from '../core/automaton.js';

function createExample(type, name, description, buildFn) {
    return {
        id: `${type}_${name.toLowerCase().replace(/\s+/g, '_')}`,
        type,
        name,
        description,
        build: buildFn
    };
}

function buildDFABinaryDivisibleBy3() {
    const automaton = createEmptyAutomaton(AUTOMATON_TYPES.DFA, 300, 200);
    
    const q0 = automaton.addState('q0', -150, 0);
    const q1 = automaton.addState('q1', 0, 0);
    const q2 = automaton.addState('q2', 150, 0);
    
    automaton.setStartState(q0.id);
    q0.isAccept = true;
    
    automaton.addTransition(q0.id, q0.id, '0');
    automaton.addTransition(q0.id, q1.id, '1');
    automaton.addTransition(q1.id, q2.id, '0');
    automaton.addTransition(q1.id, q0.id, '1');
    automaton.addTransition(q2.id, q1.id, '0');
    automaton.addTransition(q2.id, q2.id, '1');
    
    return automaton;
}

function buildDFAEndsWithAB() {
    const automaton = createEmptyAutomaton(AUTOMATON_TYPES.DFA, 300, 200);
    
    const q0 = automaton.addState('q0', -150, 0);
    const q1 = automaton.addState('q1', 0, 0);
    const q2 = automaton.addState('q2', 150, 0);
    
    automaton.setStartState(q0.id);
    q2.isAccept = true;
    
    automaton.addTransition(q0.id, q0.id, 'b');
    automaton.addTransition(q0.id, q1.id, 'a');
    automaton.addTransition(q1.id, q1.id, 'a');
    automaton.addTransition(q1.id, q2.id, 'b');
    automaton.addTransition(q2.id, q0.id, 'b');
    automaton.addTransition(q2.id, q1.id, 'a');
    
    return automaton;
}

function buildDFAEvenOnes() {
    const automaton = createEmptyAutomaton(AUTOMATON_TYPES.DFA, 300, 200);
    
    const q0 = automaton.addState('even', -100, 0);
    const q1 = automaton.addState('odd', 100, 0);
    
    automaton.setStartState(q0.id);
    q0.isAccept = true;
    
    automaton.addTransition(q0.id, q1.id, '1');
    automaton.addTransition(q0.id, q0.id, '0');
    automaton.addTransition(q1.id, q0.id, '1');
    automaton.addTransition(q1.id, q1.id, '0');
    
    return automaton;
}

function buildNFAThirdFromEnd() {
    const automaton = createEmptyAutomaton(AUTOMATON_TYPES.NFA, 400, 200);
    
    const q0 = automaton.addState('q0', -200, 0);
    const q1 = automaton.addState('q1', 0, 0);
    const q2 = automaton.addState('q2', 150, -80);
    const q3 = automaton.addState('q3', 150, 80);
    const q4 = automaton.addState('q4', 300, 0);
    
    automaton.setStartState(q0.id);
    q4.isAccept = true;
    
    automaton.addTransition(q0.id, q0.id, 'a');
    automaton.addTransition(q0.id, q0.id, 'b');
    automaton.addTransition(q0.id, q1.id, 'a');
    automaton.addTransition(q1.id, q2.id, 'a');
    automaton.addTransition(q1.id, q3.id, 'b');
    automaton.addTransition(q2.id, q4.id, 'a');
    automaton.addTransition(q2.id, q4.id, 'b');
    automaton.addTransition(q3.id, q4.id, 'a');
    automaton.addTransition(q3.id, q4.id, 'b');
    
    return automaton;
}

function buildNFAUnion() {
    const automaton = createEmptyAutomaton(AUTOMATON_TYPES.NFA, 450, 300);
    
    const q0 = automaton.addState('start', -200, 0);
    const q1 = automaton.addState('a1', -50, -100);
    const q2 = automaton.addState('a2', 100, -100);
    const q3 = automaton.addState('b1', -50, 100);
    const q4 = automaton.addState('b2', 100, 100);
    const q5 = automaton.addState('accept', 250, 0);
    
    automaton.setStartState(q0.id);
    q5.isAccept = true;
    
    automaton.addTransition(q0.id, q1.id, EPSILON);
    automaton.addTransition(q0.id, q3.id, EPSILON);
    automaton.addTransition(q1.id, q2.id, 'a');
    automaton.addTransition(q2.id, q5.id, EPSILON);
    automaton.addTransition(q3.id, q4.id, 'b');
    automaton.addTransition(q4.id, q5.id, EPSILON);
    
    return automaton;
}

function buildPDAPalindrome() {
    const automaton = createEmptyAutomaton(AUTOMATON_TYPES.PDA, 400, 300);
    
    const q0 = automaton.addState('start', -150, 0);
    const q1 = automaton.addState('push', 0, 0);
    const q2 = automaton.addState('pop', 150, -80);
    const q3 = automaton.addState('accept', 300, 0);
    const q4 = automaton.addState('odd', 150, 80);
    
    automaton.setStartState(q0.id);
    q3.isAccept = true;
    
    automaton.addTransition(q0.id, q1.id, EPSILON, { pop: null, push: '$' });
    automaton.addTransition(q1.id, q1.id, 'a', { pop: null, push: 'a' });
    automaton.addTransition(q1.id, q1.id, 'b', { pop: null, push: 'b' });
    automaton.addTransition(q1.id, q2.id, EPSILON, { pop: null, push: null });
    automaton.addTransition(q1.id, q4.id, 'a', { pop: null, push: null });
    automaton.addTransition(q1.id, q4.id, 'b', { pop: null, push: null });
    automaton.addTransition(q4.id, q2.id, EPSILON, { pop: null, push: null });
    automaton.addTransition(q2.id, q2.id, 'a', { pop: 'a', push: null });
    automaton.addTransition(q2.id, q2.id, 'b', { pop: 'b', push: null });
    automaton.addTransition(q2.id, q3.id, EPSILON, { pop: '$', push: null });
    
    return automaton;
}

function buildPDAEqualAB() {
    const automaton = createEmptyAutomaton(AUTOMATON_TYPES.PDA, 350, 250);
    
    const q0 = automaton.addState('q0', -150, 0);
    const q1 = automaton.addState('q1', 0, 0);
    const q2 = automaton.addState('q2', 150, 0);
    
    automaton.setStartState(q0.id);
    q0.isAccept = true;
    q2.isAccept = true;
    
    automaton.addTransition(q0.id, q1.id, EPSILON, { pop: null, push: 'Z' });
    automaton.addTransition(q1.id, q1.id, 'a', { pop: null, push: 'A' });
    automaton.addTransition(q1.id, q1.id, 'b', { pop: 'A', push: null });
    automaton.addTransition(q1.id, q2.id, EPSILON, { pop: 'Z', push: null });
    
    return automaton;
}

function buildTMIncrement() {
    const automaton = createEmptyAutomaton(AUTOMATON_TYPES.TM, 400, 250);
    
    const q0 = automaton.addState('start', -150, 0);
    const q1 = automaton.addState('find_end', 0, 0);
    const q2 = automaton.addState('increment', 150, 0);
    const q3 = automaton.addState('carry', 300, -80);
    const q4 = automaton.addState('new_msb', 300, 80);
    const q5 = automaton.addState('accept', 450, 0);
    
    automaton.setStartState(q0.id);
    q5.isAccept = true;
    
    automaton.addTransition(q0.id, q1.id, '0', { write: '0', direction: TM_RIGHT });
    automaton.addTransition(q0.id, q1.id, '1', { write: '1', direction: TM_RIGHT });
    automaton.addTransition(q1.id, q1.id, '0', { write: '0', direction: TM_RIGHT });
    automaton.addTransition(q1.id, q1.id, '1', { write: '1', direction: TM_RIGHT });
    automaton.addTransition(q1.id, q2.id, TM_BLANK, { write: TM_BLANK, direction: TM_LEFT });
    automaton.addTransition(q2.id, q5.id, '0', { write: '1', direction: TM_STAY });
    automaton.addTransition(q2.id, q3.id, '1', { write: '0', direction: TM_LEFT });
    automaton.addTransition(q3.id, q5.id, '0', { write: '1', direction: TM_STAY });
    automaton.addTransition(q3.id, q3.id, '1', { write: '0', direction: TM_LEFT });
    automaton.addTransition(q3.id, q4.id, TM_BLANK, { write: '1', direction: TM_STAY });
    automaton.addTransition(q4.id, q5.id, '1', { write: '1', direction: TM_STAY });
    
    return automaton;
}

function buildTMPalindrome() {
    const automaton = createEmptyAutomaton(AUTOMATON_TYPES.TM, 500, 350);
    
    const q0 = automaton.addState('start', -200, 0);
    const q1 = automaton.addState('mark_a', -50, -100);
    const q2 = automaton.addState('mark_b', -50, 100);
    const q3 = automaton.addState('find_end_a', 100, -150);
    const q4 = automaton.addState('find_end_b', 100, 150);
    const q5 = automaton.addState('check_a', 250, -100);
    const q6 = automaton.addState('check_b', 250, 100);
    const q7 = automaton.addState('go_back', 400, 0);
    const q8 = automaton.addState('accept', 550, 0);
    
    automaton.setStartState(q0.id);
    q8.isAccept = true;
    
    automaton.addTransition(q0.id, q1.id, 'a', { write: 'X', direction: TM_RIGHT });
    automaton.addTransition(q0.id, q2.id, 'b', { write: 'X', direction: TM_RIGHT });
    automaton.addTransition(q0.id, q8.id, TM_BLANK, { write: TM_BLANK, direction: TM_STAY });
    automaton.addTransition(q0.id, q8.id, 'X', { write: 'X', direction: TM_STAY });
    
    automaton.addTransition(q1.id, q1.id, 'a', { write: 'a', direction: TM_RIGHT });
    automaton.addTransition(q1.id, q1.id, 'b', { write: 'b', direction: TM_RIGHT });
    automaton.addTransition(q1.id, q1.id, 'X', { write: 'X', direction: TM_RIGHT });
    automaton.addTransition(q1.id, q3.id, TM_BLANK, { write: TM_BLANK, direction: TM_LEFT });
    
    automaton.addTransition(q2.id, q2.id, 'a', { write: 'a', direction: TM_RIGHT });
    automaton.addTransition(q2.id, q2.id, 'b', { write: 'b', direction: TM_RIGHT });
    automaton.addTransition(q2.id, q2.id, 'X', { write: 'X', direction: TM_RIGHT });
    automaton.addTransition(q2.id, q4.id, TM_BLANK, { write: TM_BLANK, direction: TM_LEFT });
    
    automaton.addTransition(q3.id, q5.id, 'a', { write: 'X', direction: TM_LEFT });
    automaton.addTransition(q3.id, q8.id, 'X', { write: 'X', direction: TM_STAY });
    
    automaton.addTransition(q4.id, q6.id, 'b', { write: 'X', direction: TM_LEFT });
    automaton.addTransition(q4.id, q8.id, 'X', { write: 'X', direction: TM_STAY });
    
    automaton.addTransition(q5.id, q7.id, 'X', { write: 'X', direction: TM_LEFT });
    automaton.addTransition(q5.id, q7.id, 'b', { write: 'b', direction: TM_LEFT });
    automaton.addTransition(q6.id, q7.id, 'X', { write: 'X', direction: TM_LEFT });
    automaton.addTransition(q6.id, q7.id, 'a', { write: 'a', direction: TM_LEFT });
    
    automaton.addTransition(q7.id, q7.id, 'a', { write: 'a', direction: TM_LEFT });
    automaton.addTransition(q7.id, q7.id, 'b', { write: 'b', direction: TM_LEFT });
    automaton.addTransition(q7.id, q7.id, 'X', { write: 'X', direction: TM_LEFT });
    automaton.addTransition(q7.id, q0.id, TM_BLANK, { write: TM_BLANK, direction: TM_RIGHT });
    
    return automaton;
}

function buildDFAContainsABBA() {
    const automaton = createEmptyAutomaton(AUTOMATON_TYPES.DFA, 500, 200);
    
    const q0 = automaton.addState('q0', -250, 0);
    const q1 = automaton.addState('q1', -100, 0);
    const q2 = automaton.addState('q2', 50, 0);
    const q3 = automaton.addState('q3', 200, 0);
    const q4 = automaton.addState('q4', 350, 0);
    
    automaton.setStartState(q0.id);
    q4.isAccept = true;
    
    automaton.addTransition(q0.id, q1.id, 'a');
    automaton.addTransition(q0.id, q0.id, 'b');
    automaton.addTransition(q1.id, q1.id, 'a');
    automaton.addTransition(q1.id, q2.id, 'b');
    automaton.addTransition(q2.id, q1.id, 'a');
    automaton.addTransition(q2.id, q3.id, 'b');
    automaton.addTransition(q3.id, q4.id, 'a');
    automaton.addTransition(q3.id, q0.id, 'b');
    automaton.addTransition(q4.id, q4.id, 'a');
    automaton.addTransition(q4.id, q4.id, 'b');
    
    return automaton;
}

function createEmptyAutomaton(type, centerX, centerY) {
    const automaton = new Automaton(type);
    automaton._centerX = centerX;
    automaton._centerY = centerY;
    return automaton;
}

export const EXAMPLES = [
    createExample(AUTOMATON_TYPES.DFA, '二进制被3整除', 
        '判断二进制数是否能被3整除。接受所有模3等于0的二进制串。',
        buildDFABinaryDivisibleBy3),
    
    createExample(AUTOMATON_TYPES.DFA, '以ab结尾',
        '接受所有以 "ab" 结尾的二进制串。测试: aab, ab, babab',
        buildDFAEndsWithAB),
    
    createExample(AUTOMATON_TYPES.DFA, '偶数个1',
        '接受包含偶数个1的二进制串。测试: 0011, 1010, 1111',
        buildDFAEvenOnes),
    
    createExample(AUTOMATON_TYPES.DFA, '包含abba',
        '接受包含子串 "abba" 的所有字符串。测试: abba, xabbay, aabba',
        buildDFAContainsABBA),
    
    createExample(AUTOMATON_TYPES.NFA, '倒数第三个是a',
        '使用NFA识别倒数第三个字符为a的串。测试: aaa, baa, xayaz',
        buildNFAThirdFromEnd),
    
    createExample(AUTOMATON_TYPES.NFA, 'a|b 并运算',
        '演示NFA的并运算，接受 "a" 或 "b"。展示ε转移的用法。',
        buildNFAUnion),
    
    createExample(AUTOMATON_TYPES.PDA, '回文识别',
        '识别偶长度和奇长度回文。测试: abba, abcba, aa, aba',
        buildPDAPalindrome),
    
    createExample(AUTOMATON_TYPES.PDA, 'a和b数量相等',
        '使用栈计数，接受a和b数量相等的串。测试: ab, aabb, abab',
        buildPDAEqualAB),
    
    createExample(AUTOMATON_TYPES.TM, '二进制加1',
        '对二进制数加1。输入: 101 → 输出: 110; 输入: 111 → 输出: 1000',
        buildTMIncrement),
    
    createExample(AUTOMATON_TYPES.TM, '回文检测',
        '图灵机版本的回文检测。从两端向中间标记匹配字符。',
        buildTMPalindrome)
];

export function getExampleById(id) {
    return EXAMPLES.find(e => e.id === id);
}

export function getExamplesByType(type) {
    return EXAMPLES.filter(e => e.type === type);
}
