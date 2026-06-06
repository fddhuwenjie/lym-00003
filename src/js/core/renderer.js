import { AUTOMATON_TYPES, EPSILON } from './automaton.js';
import { angleBetween, pointOnCircle, isPointInCircle, isPointNearLine, distance } from '../utils/helpers.js';

export const STATE_RADIUS = 32;
export const STATE_RADIUS_LARGE = 36;

export class CanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.hoveredStateId = null;
        this.hoveredTransitionId = null;
        this.selectedStateId = null;
        this.selectedTransitionId = null;
        this.activeStateIds = new Set();
        this.activeTransitionIds = new Set();
        this.previewTransition = null;
        this.gridSize = 40;
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.canvas.width / 2) / this.zoom - this.panX,
            y: (screenY - this.canvas.height / 2) / this.zoom - this.panY
        };
    }

    worldToScreen(worldX, worldY) {
        return {
            x: (worldX + this.panX) * this.zoom + this.canvas.width / 2,
            y: (worldY + this.panY) * this.zoom + this.canvas.height / 2
        };
    }

    zoomAt(screenX, screenY, factor) {
        const worldBefore = this.screenToWorld(screenX, screenY);
        this.zoom = Math.max(0.2, Math.min(3, this.zoom * factor));
        const worldAfter = this.screenToWorld(screenX, screenY);
        this.panX += worldAfter.x - worldBefore.x;
        this.panY += worldAfter.y - worldBefore.y;
    }

    fitToView(automaton) {
        const states = Array.from(automaton.states.values());
        if (states.length === 0) {
            this.zoom = 1;
            this.panX = 0;
            this.panY = 0;
            return;
        }

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        for (const state of states) {
            minX = Math.min(minX, state.x - STATE_RADIUS_LARGE);
            maxX = Math.max(maxX, state.x + STATE_RADIUS_LARGE);
            minY = Math.min(minY, state.y - STATE_RADIUS_LARGE);
            maxY = Math.max(maxY, state.y + STATE_RADIUS_LARGE);
        }

        const padding = 100;
        const contentWidth = maxX - minX + padding * 2;
        const contentHeight = maxY - minY + padding * 2;
        
        const scaleX = this.canvas.width / contentWidth;
        const scaleY = this.canvas.height / contentHeight;
        
        this.zoom = Math.min(scaleX, scaleY, 2);
        this.panX = -(minX + maxX) / 2;
        this.panY = -(minY + maxY) / 2;
    }

    render(automaton) {
        const ctx = this.ctx;
        ctx.save();
        
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawGrid();
        
        ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(this.panX, this.panY);
        
        this.drawTransitions(automaton);
        
        if (this.previewTransition) {
            this.drawPreviewTransition();
        }
        
        this.drawStates(automaton);
        
        ctx.restore();
    }

    drawGrid() {
        const ctx = this.ctx;
        const scaledGridSize = this.gridSize * this.zoom;
        
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.1)';
        ctx.lineWidth = 1;
        
        const startX = (this.panX * this.zoom) % scaledGridSize;
        const startY = (this.panY * this.zoom) % scaledGridSize;
        
        ctx.beginPath();
        for (let x = startX; x < this.canvas.width; x += scaledGridSize) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvas.height);
        }
        for (let y = startY; y < this.canvas.height; y += scaledGridSize) {
            ctx.moveTo(0, y);
            ctx.lineTo(this.canvas.width, y);
        }
        ctx.stroke();
        
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const centerX = this.canvas.width / 2 + this.panX * this.zoom;
        const centerY = this.canvas.height / 2 + this.panY * this.zoom;
        ctx.moveTo(0, centerY);
        ctx.lineTo(this.canvas.width, centerY);
        ctx.moveTo(centerX, 0);
        ctx.lineTo(centerX, this.canvas.height);
        ctx.stroke();
    }

    drawStates(automaton) {
        const ctx = this.ctx;
        const states = Array.from(automaton.states.values());
        
        for (const state of states) {
            const isSelected = state.id === this.selectedStateId;
            const isHovered = state.id === this.hoveredStateId;
            const isActive = this.activeStateIds.has(state.id);
            const isStart = state.isStart;
            const isAccept = state.isAccept;
            
            const radius = isHovered || isSelected ? STATE_RADIUS_LARGE : STATE_RADIUS;
            
            if (isActive) {
                const gradient = ctx.createRadialGradient(
                    state.x, state.y, radius * 0.5,
                    state.x, state.y, radius * 2
                );
                gradient.addColorStop(0, 'rgba(34, 197, 94, 0.4)');
                gradient.addColorStop(1, 'rgba(34, 197, 94, 0)');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(state.x, state.y, radius * 2, 0, Math.PI * 2);
                ctx.fill();
            }
            
            if (isStart) {
                const arrowLength = 30;
                const angle = Math.PI;
                ctx.strokeStyle = isActive ? '#22c55e' : '#94a3b8';
                ctx.lineWidth = 2.5;
                ctx.lineCap = 'round';
                
                const startX = state.x - radius - arrowLength;
                const startY = state.y;
                const endX = state.x - radius - 4;
                const endY = state.y;
                
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
                
                const headLen = 10;
                const headAngle = Math.PI / 6;
                ctx.beginPath();
                ctx.moveTo(endX, endY);
                ctx.lineTo(endX - headLen * Math.cos(angle - headAngle), endY - headLen * Math.sin(angle - headAngle));
                ctx.moveTo(endX, endY);
                ctx.lineTo(endX - headLen * Math.cos(angle + headAngle), endY - headLen * Math.sin(angle + headAngle));
                ctx.stroke();
            }
            
            ctx.beginPath();
            ctx.arc(state.x, state.y, radius, 0, Math.PI * 2);
            
            let fillColor = 'rgba(30, 41, 59, 0.9)';
            let strokeColor = '#475569';
            let lineWidth = 2.5;
            
            if (isActive) {
                fillColor = 'rgba(34, 197, 94, 0.25)';
                strokeColor = '#22c55e';
            } else if (isSelected) {
                strokeColor = '#3b82f6';
                lineWidth = 3.5;
                fillColor = 'rgba(59, 130, 246, 0.15)';
            } else if (isHovered) {
                strokeColor = '#60a5fa';
                fillColor = 'rgba(59, 130, 246, 0.08)';
            }
            
            ctx.fillStyle = fillColor;
            ctx.fill();
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
            
            if (isAccept) {
                ctx.beginPath();
                ctx.arc(state.x, state.y, radius - 6, 0, Math.PI * 2);
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
            
            ctx.fillStyle = isActive ? '#4ade80' : '#e2e8f0';
            ctx.font = `bold ${14 / this.zoom}px 'Segoe UI', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(state.name, state.x, state.y);
        }
    }

    drawTransitions(automaton) {
        const ctx = this.ctx;
        const transitionGroups = this.groupTransitions(automaton);
        
        for (const group of transitionGroups) {
            this.drawTransitionGroup(group, automaton);
        }
    }

    groupTransitions(automaton) {
        const groups = new Map();
        
        for (const transition of automaton.transitions.values()) {
            const key = `${transition.from}-${transition.to}`;
            const reverseKey = `${transition.to}-${transition.from}`;
            
            let groupKey = key;
            if (groups.has(reverseKey) && transition.from !== transition.to) {
                groupKey = reverseKey;
            }
            
            if (!groups.has(groupKey)) {
                groups.set(groupKey, {
                    from: transition.from,
                    to: transition.to,
                    transitions: [],
                    isReversed: groupKey === reverseKey
                });
            }
            groups.get(groupKey).transitions.push(transition);
        }
        
        return Array.from(groups.values());
    }

    drawTransitionGroup(group, automaton) {
        const ctx = this.ctx;
        const fromState = automaton.states.get(group.from);
        const toState = automaton.states.get(group.to);
        
        if (!fromState || !toState) return;
        
        const isSelfLoop = group.from === group.to;
        const activeTransitions = group.transitions.filter(t => this.activeTransitionIds.has(t.id));
        const hasActive = activeTransitions.length > 0;
        const isSelected = group.transitions.some(t => t.id === this.selectedTransitionId);
        const isHovered = group.transitions.some(t => t.id === this.hoveredTransitionId);
        
        const labels = group.transitions.map(t => this.formatTransitionLabel(t, automaton.type));
        const labelText = labels.join(', ');
        
        if (isSelfLoop) {
            this.drawSelfLoop(fromState, labelText, hasActive, isSelected, isHovered, automaton.type);
        } else {
            this.drawCurveTransition(
                fromState, toState, labelText, group.isReversed,
                hasActive, isSelected, isHovered, automaton.type,
                group.transitions, activeTransitions
            );
        }
    }

    drawSelfLoop(state, label, isActive, isSelected, isHovered, type) {
        const ctx = this.ctx;
        const radius = STATE_RADIUS;
        const loopRadius = 28;
        const loopOffset = 20;
        
        const centerX = state.x;
        const centerY = state.y - radius - loopOffset;
        
        let strokeColor = isActive ? '#22c55e' : (isSelected ? '#3b82f6' : (isHovered ? '#60a5fa' : '#64748b'));
        let lineWidth = isActive ? 3 : (isSelected ? 3.5 : 2);
        
        if (isActive) {
            ctx.shadowColor = '#22c55e';
            ctx.shadowBlur = 10;
        }
        
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, loopRadius, 0.2, Math.PI * 2 - 0.2);
        ctx.stroke();
        
        ctx.shadowBlur = 0;
        
        const arrowAngle = -0.3;
        const arrowX = centerX + loopRadius * Math.cos(arrowAngle);
        const arrowY = centerY + loopRadius * Math.sin(arrowAngle);
        const headLen = 10;
        const headAngle = Math.PI / 6;
        
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
            arrowX - headLen * Math.cos(arrowAngle - headAngle),
            arrowY - headLen * Math.sin(arrowAngle - headAngle)
        );
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
            arrowX - headLen * Math.cos(arrowAngle + headAngle),
            arrowY - headLen * Math.sin(arrowAngle + headAngle)
        );
        ctx.stroke();
        
        const labelY = centerY - loopRadius - 12;
        this.drawLabel(label, centerX, labelY, isActive, isSelected, isHovered);
    }

    drawCurveTransition(from, to, label, isReversed, isActive, isSelected, isHovered, type, allTransitions, activeTransitions) {
        const ctx = this.ctx;
        const radius = STATE_RADIUS;
        
        const angle = angleBetween(from, to);
        const startPoint = pointOnCircle(from, radius, angle);
        const endPoint = pointOnCircle(to, radius, angle + Math.PI);
        
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        const midX = (startPoint.x + endPoint.x) / 2;
        const midY = (startPoint.y + endPoint.y) / 2;
        
        const perpX = -dy;
        const perpY = dx;
        const perpLen = Math.sqrt(perpX * perpX + perpY * perpY);
        
        let curveOffset = isReversed ? -40 : 40;
        const dist = Math.sqrt(dx * dx + dy * dy);
        curveOffset = curveOffset * Math.min(1, dist / 200);
        
        const ctrlX = midX + (perpX / perpLen) * curveOffset;
        const ctrlY = midY + (perpY / perpLen) * curveOffset;
        
        let strokeColor = isActive ? '#22c55e' : (isSelected ? '#3b82f6' : (isHovered ? '#60a5fa' : '#64748b'));
        let lineWidth = isActive ? 3 : (isSelected ? 3.5 : 2);
        
        if (isActive) {
            ctx.shadowColor = '#22c55e';
            ctx.shadowBlur = 10;
        }
        
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.quadraticCurveTo(ctrlX, ctrlY, endPoint.x, endPoint.y);
        ctx.stroke();
        
        ctx.shadowBlur = 0;
        
        const t = 0.85;
        const arrowX = (1-t)*(1-t)*startPoint.x + 2*(1-t)*t*ctrlX + t*t*endPoint.x;
        const arrowY = (1-t)*(1-t)*startPoint.y + 2*(1-t)*t*ctrlY + t*t*endPoint.y;
        
        const tx = 2*(1-t)*(ctrlX - startPoint.x) + 2*t*(endPoint.x - ctrlX);
        const ty = 2*(1-t)*(ctrlY - startPoint.y) + 2*t*(endPoint.y - ctrlY);
        const arrowAngle = Math.atan2(ty, tx);
        
        const headLen = 12;
        const headAngle = Math.PI / 6;
        
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
            arrowX - headLen * Math.cos(arrowAngle - headAngle),
            arrowY - headLen * Math.sin(arrowAngle - headAngle)
        );
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
            arrowX - headLen * Math.cos(arrowAngle + headAngle),
            arrowY - headLen * Math.sin(arrowAngle + headAngle)
        );
        ctx.stroke();
        
        const labelT = 0.5;
        const labelX = (1-labelT)*(1-labelT)*startPoint.x + 2*(1-labelT)*labelT*ctrlX + labelT*labelT*endPoint.x;
        const labelY = (1-labelT)*(1-labelT)*startPoint.y + 2*(1-labelT)*labelT*ctrlY + labelT*labelT*endPoint.y;
        
        const labelOffsetDist = 18;
        const normX = perpX / perpLen;
        const normY = perpY / perpLen;
        const finalLabelX = labelX + normX * curveOffset * 0.3 + normX * labelOffsetDist * Math.sign(curveOffset);
        const finalLabelY = labelY + normY * curveOffset * 0.3 + normY * labelOffsetDist * Math.sign(curveOffset);
        
        this.drawLabel(label, finalLabelX, finalLabelY, isActive, isSelected, isHovered);
    }

    drawLabel(text, x, y, isActive, isSelected, isHovered) {
        const ctx = this.ctx;
        const fontSize = 13 / this.zoom;
        const padding = 6 / this.zoom;
        
        ctx.font = `${fontSize}px 'Segoe UI', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const metrics = ctx.measureText(text);
        const textWidth = metrics.width + padding * 2;
        const textHeight = fontSize + padding;
        
        let bgColor = 'rgba(15, 23, 42, 0.9)';
        let textColor = isActive ? '#4ade80' : (isSelected ? '#60a5fa' : (isHovered ? '#93c5fd' : '#94a3b8'));
        let borderColor = isActive ? '#22c55e' : (isSelected ? '#3b82f6' : 'transparent');
        
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        const radius = 4 / this.zoom;
        ctx.roundRect(x - textWidth / 2, y - textHeight / 2, textWidth, textHeight, radius);
        ctx.fill();
        
        if (borderColor !== 'transparent') {
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 1.5 / this.zoom;
            ctx.stroke();
        }
        
        ctx.fillStyle = textColor;
        ctx.fillText(text, x, y);
    }

    formatTransitionLabel(transition, type) {
        const symbol = transition.symbol === EPSILON ? 'ε' : transition.symbol;
        
        if (type === AUTOMATON_TYPES.PDA) {
            const pop = transition.stackOp.pop || 'ε';
            const push = transition.stackOp.push || 'ε';
            return `${symbol}, ${pop} → ${push}`;
        }
        
        if (type === AUTOMATON_TYPES.TM) {
            const write = transition.tapeOp.write || 'ε';
            const dir = transition.tapeOp.direction || '';
            return `${symbol} → ${write}, ${dir}`;
        }
        
        return symbol;
    }

    drawPreviewTransition() {
        const ctx = this.ctx;
        const { from, toX, toY } = this.previewTransition;
        const fromState = { x: from.x, y: from.y };
        
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.lineCap = 'round';
        
        const angle = angleBetween(fromState, { x: toX, y: toY });
        const startPoint = pointOnCircle(fromState, STATE_RADIUS, angle);
        
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(toX, toY);
        ctx.stroke();
        
        ctx.setLineDash([]);
        
        const headLen = 12;
        const headAngle = Math.PI / 6;
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - headLen * Math.cos(angle - headAngle), toY - headLen * Math.sin(angle - headAngle));
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - headLen * Math.cos(angle + headAngle), toY - headLen * Math.sin(angle + headAngle));
        ctx.stroke();
    }

    getStateAtPoint(worldX, worldY, automaton) {
        for (const state of automaton.states.values()) {
            if (isPointInCircle({ x: worldX, y: worldY }, state, STATE_RADIUS_LARGE)) {
                return state;
            }
        }
        return null;
    }

    getTransitionAtPoint(worldX, worldY, automaton) {
        const threshold = 8 / this.zoom;
        
        for (const transition of automaton.transitions.values()) {
            const from = automaton.states.get(transition.from);
            const to = automaton.states.get(transition.to);
            
            if (!from || !to) continue;
            
            if (transition.from === transition.to) {
                const loopCenter = { x: from.x, y: from.y - STATE_RADIUS - 20 };
                const dist = distance({ x: worldX, y: worldY }, loopCenter);
                if (Math.abs(dist - 28) < threshold + 5) {
                    return transition;
                }
            } else {
                const angle = angleBetween(from, to);
                const startPoint = pointOnCircle(from, STATE_RADIUS, angle);
                const endPoint = pointOnCircle(to, STATE_RADIUS, angle + Math.PI);
                
                if (isPointNearLine({ x: worldX, y: worldY }, startPoint, endPoint, threshold + 10)) {
                    return transition;
                }
            }
        }
        return null;
    }

    clearHighlights() {
        this.activeStateIds.clear();
        this.activeTransitionIds.clear();
    }

    setActiveStates(ids) {
        this.activeStateIds = new Set(ids);
    }

    setActiveTransitions(ids) {
        this.activeTransitionIds = new Set(ids);
    }
}
