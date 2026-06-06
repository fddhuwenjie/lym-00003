import { distance, normalize, clamp } from '../utils/helpers.js';

export class ForceDirectedLayout {
    constructor(options = {}) {
        this.options = {
            repulsionStrength: 8000,
            attractionStrength: 0.015,
            gravityStrength: 0.01,
            damping: 0.85,
            maxVelocity: 50,
            iterations: 300,
            minDistance: 80,
            ...options
        };
    }

    layout(automaton, canvasWidth, canvasHeight, centerX, centerY) {
        const states = Array.from(automaton.states.values());
        const n = states.length;
        
        if (n === 0) return;
        
        if (n <= 8) {
            this.circularLayout(states, centerX, centerY, Math.min(canvasWidth, canvasHeight) * 0.3);
        }
        
        const velocities = states.map(() => ({ x: 0, y: 0 }));
        const forces = states.map(() => ({ x: 0, y: 0 }));
        
        for (let iter = 0; iter < this.options.iterations; iter++) {
            this.calculateForces(states, velocities, forces, automaton);
            this.updatePositions(states, velocities, forces, canvasWidth, canvasHeight, centerX, centerY);
            
            let totalEnergy = 0;
            for (const v of velocities) {
                totalEnergy += Math.sqrt(v.x * v.x + v.y * v.y);
            }
            if (totalEnergy < 0.1 && iter > 50) break;
        }
        
        this.keepWithinBounds(states, canvasWidth, canvasHeight, centerX, centerY);
    }

    calculateForces(states, velocities, forces, automaton) {
        const n = states.length;
        const { repulsionStrength, attractionStrength, gravityStrength, minDistance } = this.options;
        
        for (let i = 0; i < n; i++) {
            forces[i].x = 0;
            forces[i].y = 0;
        }
        
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const dx = states[j].x - states[i].x;
                const dy = states[j].y - states[i].y;
                let dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < minDistance) {
                    dist = minDistance;
                }
                
                if (dist > 0) {
                    const repulsion = repulsionStrength / (dist * dist);
                    const fx = (dx / dist) * repulsion;
                    const fy = (dy / dist) * repulsion;
                    
                    forces[i].x -= fx;
                    forces[i].y -= fy;
                    forces[j].x += fx;
                    forces[j].y += fy;
                }
            }
        }
        
        for (const transition of automaton.transitions.values()) {
            const fromIdx = states.findIndex(s => s.id === transition.from);
            const toIdx = states.findIndex(s => s.id === transition.to);
            
            if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
                const dx = states[toIdx].x - states[fromIdx].x;
                const dy = states[toIdx].y - states[fromIdx].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist > 0) {
                    const attraction = attractionStrength * (dist - 150);
                    const fx = (dx / dist) * attraction;
                    const fy = (dy / dist) * attraction;
                    
                    forces[fromIdx].x += fx;
                    forces[fromIdx].y += fy;
                    forces[toIdx].x -= fx;
                    forces[toIdx].y -= fy;
                }
            }
        }
        
        const startState = automaton.getStartState();
        if (startState) {
            const startIdx = states.findIndex(s => s.id === startState.id);
            if (startIdx !== -1) {
                const dx = 0 - states[startIdx].x;
                const dy = 0 - states[startIdx].y;
                forces[startIdx].x += dx * gravityStrength * 0.5;
                forces[startIdx].y += dy * gravityStrength * 0.5;
            }
        }
    }

    updatePositions(states, velocities, forces, canvasWidth, canvasHeight, centerX, centerY) {
        const { damping, maxVelocity } = this.options;
        const margin = 60;
        
        for (let i = 0; i < states.length; i++) {
            velocities[i].x += forces[i].x;
            velocities[i].y += forces[i].y;
            
            velocities[i].x *= damping;
            velocities[i].y *= damping;
            
            const speed = Math.sqrt(velocities[i].x ** 2 + velocities[i].y ** 2);
            if (speed > maxVelocity) {
                velocities[i].x = (velocities[i].x / speed) * maxVelocity;
                velocities[i].y = (velocities[i].y / speed) * maxVelocity;
            }
            
            states[i].x += velocities[i].x;
            states[i].y += velocities[i].y;
        }
    }

    circularLayout(states, centerX, centerY, radius) {
        const n = states.length;
        const startState = states.find(s => s.isStart);
        const startIdx = startState ? states.indexOf(startState) : 0;
        
        states.forEach((state, i) => {
            const angle = (2 * Math.PI * (i - startIdx)) / n - Math.PI / 2;
            state.x = centerX + radius * Math.cos(angle);
            state.y = centerY + radius * Math.sin(angle);
        });
    }

    keepWithinBounds(states, canvasWidth, canvasHeight, centerX, centerY) {
        const margin = 80;
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        for (const state of states) {
            minX = Math.min(minX, state.x);
            maxX = Math.max(maxX, state.x);
            minY = Math.min(minY, state.y);
            maxY = Math.max(maxY, state.y);
        }
        
        const offsetX = centerX - (minX + maxX) / 2;
        const offsetY = centerY - (minY + maxY) / 2;
        
        for (const state of states) {
            state.x += offsetX;
            state.y += offsetY;
        }
    }

    layoutStep(automaton, velocities, canvasWidth, canvasHeight, centerX, centerY) {
        const states = Array.from(automaton.states.values());
        const n = states.length;
        
        if (n === 0) return velocities;
        
        if (!velocities || velocities.length !== n) {
            velocities = states.map(() => ({ x: 0, y: 0 }));
        }
        
        const forces = states.map(() => ({ x: 0, y: 0 }));
        this.calculateForces(states, velocities, forces, automaton);
        this.updatePositions(states, velocities, forces, canvasWidth, canvasHeight, centerX, centerY);
        
        return velocities;
    }
}

export class GridLayout {
    layout(automaton, canvasWidth, canvasHeight, centerX, centerY) {
        const states = Array.from(automaton.states.values());
        const n = states.length;
        
        if (n === 0) return;
        
        const cols = Math.ceil(Math.sqrt(n));
        const rows = Math.ceil(n / cols);
        const spacing = Math.min(canvasWidth, canvasHeight) / (Math.max(cols, rows) + 1);
        
        states.forEach((state, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            state.x = centerX - ((cols - 1) * spacing) / 2 + col * spacing;
            state.y = centerY - ((rows - 1) * spacing) / 2 + row * spacing;
        });
    }
}

export class HierarchicalLayout {
    layout(automaton, canvasWidth, canvasHeight, centerX, centerY) {
        const states = Array.from(automaton.states.values());
        const levels = new Map();
        const visited = new Set();
        const queue = [];
        
        const startState = automaton.getStartState();
        if (startState) {
            queue.push({ id: startState.id, level: 0 });
            visited.add(startState.id);
        } else if (states.length > 0) {
            queue.push({ id: states[0].id, level: 0 });
            visited.add(states[0].id);
        }
        
        while (queue.length > 0) {
            const { id, level } = queue.shift();
            
            if (!levels.has(level)) {
                levels.set(level, []);
            }
            levels.get(level).push(id);
            
            const transitions = automaton.getTransitionsFrom(id);
            for (const t of transitions) {
                if (!visited.has(t.to)) {
                    visited.add(t.to);
                    queue.push({ id: t.to, level: level + 1 });
                }
            }
        }
        
        for (const state of states) {
            if (!visited.has(state.id)) {
                let maxLevel = -1;
                for (const l of levels.keys()) {
                    maxLevel = Math.max(maxLevel, l);
                }
                const newLevel = maxLevel + 1;
                if (!levels.has(newLevel)) {
                    levels.set(newLevel, []);
                }
                levels.get(newLevel).push(state.id);
            }
        }
        
        const levelSpacing = 150;
        const nodeSpacing = 120;
        const sortedLevels = Array.from(levels.keys()).sort((a, b) => a - b);
        const totalHeight = (sortedLevels.length - 1) * levelSpacing;
        
        sortedLevels.forEach((level, levelIdx) => {
            const stateIds = levels.get(level);
            const totalWidth = (stateIds.length - 1) * nodeSpacing;
            const y = centerY - totalHeight / 2 + levelIdx * levelSpacing;
            
            stateIds.forEach((id, nodeIdx) => {
                const state = automaton.states.get(id);
                if (state) {
                    state.x = centerX - totalWidth / 2 + nodeIdx * nodeSpacing;
                    state.y = y;
                }
            });
        });
    }
}
