import { Automaton, AUTOMATON_TYPES, EPSILON, TM_LEFT, TM_RIGHT, TM_STAY, TM_BLANK } from '../core/automaton.js';
import { ForceDirectedLayout } from '../core/layout.js';
import { CanvasRenderer } from '../core/renderer.js';
import { RegexParser, RegexToNFA, NFAToDFA } from '../core/regex.js';
import { AutomatonSimulator } from '../core/simulator.js';
import { HistoryManager } from '../utils/history.js';
import { downloadFile, copyToClipboard, deepClone } from '../utils/helpers.js';
import { EXAMPLES, getExampleById } from '../data/examples.js';
import { InteractionManager, EDIT_MODE } from './interaction.js';

export class App {
    constructor() {
        this.canvas = document.getElementById('main-canvas');
        this.automaton = new Automaton(AUTOMATON_TYPES.DFA);
        this.renderer = new CanvasRenderer(this.canvas);
        this.layout = new ForceDirectedLayout();
        this.history = new HistoryManager();
        this.interaction = new InteractionManager(this);
        this.simulator = null;
        this.isSimulating = false;
        this.isPlaying = false;
        this.playInterval = null;
        this.playSpeed = 800;
        this.conversionSteps = [];
        this.currentStepIndex = -1;
        this.isModified = false;
        
        this.initializeCanvas();
        this.bindUIEvents();
        this.updateUI();
        this.pushHistory();
        this.render();
    }

    initializeCanvas() {
        const container = this.canvas.parentElement;
        this.renderer.resize(container.clientWidth, container.clientHeight);
    }

    bindUIEvents() {
        document.querySelectorAll('.model-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchModel(btn.dataset.model));
        });

        document.getElementById('btn-select').addEventListener('click', () => {
            this.interaction.setEditMode(EDIT_MODE.SELECT);
        });
        document.getElementById('btn-add-state').addEventListener('click', () => {
            this.interaction.setEditMode(EDIT_MODE.ADD_STATE);
        });
        document.getElementById('btn-add-transition').addEventListener('click', () => {
            this.interaction.setEditMode(EDIT_MODE.ADD_TRANSITION);
        });
        document.getElementById('btn-set-start').addEventListener('click', () => {
            this.interaction.setEditMode(EDIT_MODE.SET_START);
        });
        document.getElementById('btn-set-accept').addEventListener('click', () => {
            this.interaction.setEditMode(EDIT_MODE.SET_ACCEPT);
        });
        document.getElementById('btn-delete').addEventListener('click', () => {
            this.interaction.setEditMode(EDIT_MODE.DELETE);
        });

        document.getElementById('btn-undo').addEventListener('click', () => this.undo());
        document.getElementById('btn-redo').addEventListener('click', () => this.redo());
        document.getElementById('btn-layout').addEventListener('click', () => this.autoLayout());

        document.getElementById('btn-import').addEventListener('click', () => this.showImportModal());
        document.getElementById('btn-export').addEventListener('click', () => this.showExportModal());
        document.getElementById('btn-examples').addEventListener('click', () => this.showExamplesModal());

        document.getElementById('btn-regex-to-nfa').addEventListener('click', () => this.convertRegexToNFA());
        document.getElementById('btn-nfa-to-dfa').addEventListener('click', () => this.convertNFAToDFA());
        document.getElementById('btn-step-conversion').addEventListener('click', () => this.stepConversion());

        document.getElementById('btn-reset-sim').addEventListener('click', () => this.resetSimulation());
        document.getElementById('btn-step-sim').addEventListener('click', () => this.stepSimulation());
        document.getElementById('btn-play-sim').addEventListener('click', () => this.togglePlay());
        document.getElementById('btn-pause-sim').addEventListener('click', () => this.pauseSimulation());

        document.getElementById('sim-speed').addEventListener('input', (e) => {
            this.playSpeed = parseInt(e.target.value);
            document.getElementById('speed-value').textContent = `${this.playSpeed}ms`;
            if (this.isPlaying) {
                this.pauseSimulation();
                this.togglePlay();
            }
        });

        document.getElementById('btn-zoom-in').addEventListener('click', () => {
            this.renderer.zoom *= 1.2;
            this.updateZoomLevel();
            this.render();
        });
        document.getElementById('btn-zoom-out').addEventListener('click', () => {
            this.renderer.zoom /= 1.2;
            this.updateZoomLevel();
            this.render();
        });
        document.getElementById('btn-zoom-fit').addEventListener('click', () => {
            this.renderer.fitToView(this.automaton);
            this.updateZoomLevel();
            this.render();
        });

        document.querySelectorAll('.modal .close-btn, #btn-cancel-import').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
            });
        });

        document.getElementById('btn-do-import').addEventListener('click', () => this.doImport());
        document.getElementById('btn-copy-export').addEventListener('click', () => this.copyExport());
        document.getElementById('btn-download-export').addEventListener('click', () => this.downloadExport());

        this.updateEditButtons();
    }

    switchModel(type) {
        if (!confirm('切换模型将清除当前状态，确定继续吗？')) return;
        
        this.stopSimulation();
        this.automaton = new Automaton(type);
        this.history.clear();
        this.pushHistory();
        this.conversionSteps = [];
        this.currentStepIndex = -1;
        
        document.querySelectorAll('.model-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.model === type);
        });
        
        document.getElementById('pda-stack').style.display = type === AUTOMATON_TYPES.PDA ? 'block' : 'none';
        document.getElementById('tm-tape').style.display = type === AUTOMATON_TYPES.TM ? 'block' : 'none';
        
        document.getElementById('btn-regex-to-nfa').disabled = type !== AUTOMATON_TYPES.NFA && type !== AUTOMATON_TYPES.DFA;
        document.getElementById('btn-nfa-to-dfa').disabled = type !== AUTOMATON_TYPES.NFA;
        
        this.updateUI();
        this.render();
    }

    addAction(action) {
        action();
        this.pushHistory();
        this.isModified = true;
    }

    pushHistory() {
        this.history.push(this.automaton.toJSON());
        this.updateHistoryButtons();
    }

    undo() {
        if (this.history.canUndo()) {
            const json = this.history.undo(this.automaton.toJSON());
            this.automaton = Automaton.fromJSON(json);
            this.stopSimulation();
            this.updateUI();
            this.render();
        }
        this.updateHistoryButtons();
    }

    redo() {
        const json = this.history.redo();
        if (json) {
            this.automaton = Automaton.fromJSON(json);
            this.stopSimulation();
            this.updateUI();
            this.render();
        }
        this.updateHistoryButtons();
    }

    updateHistoryButtons() {
        document.getElementById('btn-undo').disabled = !this.history.canUndo();
        document.getElementById('btn-redo').disabled = !this.history.canRedo();
    }

    updateEditButtons() {
        const buttons = {
            'btn-select': EDIT_MODE.SELECT,
            'btn-add-state': EDIT_MODE.ADD_STATE,
            'btn-add-transition': EDIT_MODE.ADD_TRANSITION,
            'btn-set-start': EDIT_MODE.SET_START,
            'btn-set-accept': EDIT_MODE.SET_ACCEPT,
            'btn-delete': EDIT_MODE.DELETE
        };
        
        for (const [id, mode] of Object.entries(buttons)) {
            document.getElementById(id).classList.toggle('active', this.interaction.editMode === mode);
        }
    }

    autoLayout() {
        const centerX = -this.renderer.panX;
        const centerY = -this.renderer.panY;
        const width = this.canvas.width / this.renderer.zoom;
        const height = this.canvas.height / this.renderer.zoom;
        
        this.layout.layout(this.automaton, width, height, centerX, centerY);
        this.pushHistory();
        this.render();
    }

    render() {
        this.renderer.render(this.automaton);
    }

    updateUI() {
        const states = Array.from(this.automaton.states.values());
        const transitions = Array.from(this.automaton.transitions.values());
        
        document.getElementById('info-type').textContent = this.automaton.type.toUpperCase();
        document.getElementById('info-states').textContent = states.length;
        document.getElementById('info-transitions').textContent = transitions.length;
        
        this.updateTransitionsList();
        this.updatePropertyPanel();
        this.updateEditButtons();
        this.updateHistoryButtons();
        this.updateStatus('就绪');
        
        if (this.simulator) {
            this.updateSimulationDisplay();
        }
    }

    updateTransitionsList() {
        const container = document.getElementById('transitions-list');
        const transitions = Array.from(this.automaton.transitions.values());
        
        if (transitions.length === 0) {
            container.innerHTML = '<p style="color:#64748b;text-align:center;padding:20px;font-size:13px;">暂无转移</p>';
            return;
        }
        
        const type = this.automaton.type;
        container.innerHTML = transitions.map(t => {
            const from = this.automaton.states.get(t.from)?.name || '?';
            const to = this.automaton.states.get(t.to)?.name || '?';
            const label = this.formatTransitionLabel(t, type);
            const isSelected = t.id === this.renderer.selectedTransitionId;
            
            return `<div class="transition-item ${isSelected ? 'selected' : ''}" data-id="${t.id}">
                <div class="from-to">${from} → ${to}</div>
                <div class="label">${label}</div>
            </div>`;
        }).join('');
        
        container.querySelectorAll('.transition-item').forEach(item => {
            item.addEventListener('click', () => {
                this.renderer.selectedTransitionId = item.dataset.id;
                this.renderer.selectedStateId = null;
                this.updatePropertyPanel();
                this.updateTransitionsList();
                this.render();
            });
        });
    }

    formatTransitionLabel(transition, type) {
        const symbol = transition.symbol === EPSILON ? 'ε' : transition.symbol;
        
        if (type === AUTOMATON_TYPES.PDA) {
            const pop = transition.stackOp?.pop || 'ε';
            const push = transition.stackOp?.push || 'ε';
            return `${symbol}, ${pop} → ${push}`;
        }
        
        if (type === AUTOMATON_TYPES.TM) {
            const write = transition.tapeOp?.write || 'ε';
            const dir = transition.tapeOp?.direction || '';
            return `${symbol} → ${write}, ${dir}`;
        }
        
        return symbol;
    }

    updatePropertyPanel() {
        const panel = document.getElementById('property-panel');
        const stateId = this.renderer.selectedStateId;
        const transitionId = this.renderer.selectedTransitionId;
        
        if (stateId) {
            const state = this.automaton.states.get(stateId);
            panel.innerHTML = `
                <label>状态名称</label>
                <input type="text" id="prop-name" value="${state.name}">
                <div class="checkbox-group">
                    <input type="checkbox" id="prop-start" ${state.isStart ? 'checked' : ''}>
                    <label for="prop-start">初始状态</label>
                </div>
                <div class="checkbox-group">
                    <input type="checkbox" id="prop-accept" ${state.isAccept ? 'checked' : ''}>
                    <label for="prop-accept">接受状态</label>
                </div>
                <label>X 坐标</label>
                <input type="number" id="prop-x" value="${Math.round(state.x)}">
                <label>Y 坐标</label>
                <input type="number" id="prop-y" value="${Math.round(state.y)}">
            `;
            
            document.getElementById('prop-name').addEventListener('change', (e) => {
                this.addAction(() => { state.name = e.target.value; });
                this.updateUI();
            });
            document.getElementById('prop-start').addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.addAction(() => { this.automaton.setStartState(stateId); });
                }
                this.updateUI();
            });
            document.getElementById('prop-accept').addEventListener('change', (e) => {
                this.addAction(() => { state.isAccept = e.target.checked; });
                this.updateUI();
            });
            document.getElementById('prop-x').addEventListener('change', (e) => {
                this.addAction(() => { state.x = parseFloat(e.target.value); });
                this.render();
            });
            document.getElementById('prop-y').addEventListener('change', (e) => {
                this.addAction(() => { state.y = parseFloat(e.target.value); });
                this.render();
            });
        } else if (transitionId) {
            const transition = this.automaton.transitions.get(transitionId);
            const from = this.automaton.states.get(transition.from);
            const to = this.automaton.states.get(transition.to);
            const type = this.automaton.type;
            
            let extraFields = '';
            if (type === AUTOMATON_TYPES.PDA) {
                extraFields = `
                    <label>弹出栈符号</label>
                    <input type="text" id="prop-pop" value="${transition.stackOp?.pop || ''}" placeholder="ε">
                    <label>压入栈符号</label>
                    <input type="text" id="prop-push" value="${transition.stackOp?.push || ''}" placeholder="ε">
                `;
            } else if (type === AUTOMATON_TYPES.TM) {
                extraFields = `
                    <label>写入符号</label>
                    <input type="text" id="prop-write" value="${transition.tapeOp?.write || ''}" placeholder="不修改">
                    <label>移动方向</label>
                    <select id="prop-direction">
                        <option value="${TM_LEFT}" ${transition.tapeOp?.direction === TM_LEFT ? 'selected' : ''}>左移 (L)</option>
                        <option value="${TM_RIGHT}" ${transition.tapeOp?.direction === TM_RIGHT ? 'selected' : ''}>右移 (R)</option>
                        <option value="${TM_STAY}" ${transition.tapeOp?.direction === TM_STAY ? 'selected' : ''}>不动 (S)</option>
                    </select>
                `;
            }
            
            panel.innerHTML = `
                <label>转移符号</label>
                <input type="text" id="prop-symbol" value="${transition.symbol === EPSILON ? '' : transition.symbol}" placeholder="ε">
                <label>起始状态: ${from?.name || '?'}</label>
                <label>目标状态: ${to?.name || '?'}</label>
                ${extraFields}
            `;
            
            document.getElementById('prop-symbol').addEventListener('change', (e) => {
                this.addAction(() => { 
                    transition.symbol = e.target.value || EPSILON; 
                });
                this.updateUI();
            });
            
            if (type === AUTOMATON_TYPES.PDA) {
                document.getElementById('prop-pop').addEventListener('change', (e) => {
                    this.addAction(() => { 
                        transition.stackOp.pop = e.target.value || null; 
                    });
                    this.updateUI();
                });
                document.getElementById('prop-push').addEventListener('change', (e) => {
                    this.addAction(() => { 
                        transition.stackOp.push = e.target.value || null; 
                    });
                    this.updateUI();
                });
            }
            
            if (type === AUTOMATON_TYPES.TM) {
                document.getElementById('prop-write').addEventListener('change', (e) => {
                    this.addAction(() => { 
                        transition.tapeOp.write = e.target.value || null; 
                    });
                    this.updateUI();
                });
                document.getElementById('prop-direction').addEventListener('change', (e) => {
                    this.addAction(() => { 
                        transition.tapeOp.direction = e.target.value; 
                    });
                    this.updateUI();
                });
            }
        } else {
            panel.innerHTML = '<p class="hint">选择状态或转移以编辑属性</p>';
        }
    }

    updateMousePosition(pos) {
        document.getElementById('mouse-position').textContent = `x: ${Math.round(pos.x)}, y: ${Math.round(pos.y)}`;
    }

    updateZoomLevel() {
        document.getElementById('zoom-level').textContent = `${Math.round(this.renderer.zoom * 100)}%`;
    }

    updateStatus(text) {
        document.getElementById('status-text').textContent = text;
    }

    showImportModal() {
        document.getElementById('import-modal').classList.add('show');
        document.getElementById('import-textarea').value = '';
        document.getElementById('import-textarea').focus();
    }

    showExportModal() {
        const json = JSON.stringify(this.automaton.toJSON(), null, 2);
        document.getElementById('export-textarea').value = json;
        document.getElementById('export-modal').classList.add('show');
    }

    showExamplesModal() {
        const container = document.getElementById('examples-list');
        container.innerHTML = EXAMPLES.map(ex => `
            <div class="example-card" data-id="${ex.id}">
                <span class="example-type">${ex.type.toUpperCase()}</span>
                <h4>${ex.name}</h4>
                <p>${ex.description}</p>
            </div>
        `).join('');
        
        container.querySelectorAll('.example-card').forEach(card => {
            card.addEventListener('click', () => {
                this.loadExample(card.dataset.id);
                document.getElementById('examples-modal').classList.remove('show');
            });
        });
        
        document.getElementById('examples-modal').classList.add('show');
    }

    doImport() {
        try {
            const text = document.getElementById('import-textarea').value;
            const json = JSON.parse(text);
            this.automaton = Automaton.fromJSON(json);
            this.history.clear();
            this.pushHistory();
            this.stopSimulation();
            
            document.querySelectorAll('.model-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.model === json.type);
            });
            
            document.getElementById('pda-stack').style.display = json.type === AUTOMATON_TYPES.PDA ? 'block' : 'none';
            document.getElementById('tm-tape').style.display = json.type === AUTOMATON_TYPES.TM ? 'block' : 'none';
            
            this.autoLayout();
            this.updateUI();
            this.render();
            document.getElementById('import-modal').classList.remove('show');
            this.updateStatus('导入成功');
        } catch (e) {
            alert('导入失败: ' + e.message);
        }
    }

    async copyExport() {
        const text = document.getElementById('export-textarea').value;
        await copyToClipboard(text);
        this.updateStatus('已复制到剪贴板');
    }

    downloadExport() {
        const text = document.getElementById('export-textarea').value;
        const type = this.automaton.type;
        downloadFile(text, `automaton_${type}_${Date.now()}.json`);
        this.updateStatus('文件已下载');
    }

    loadExample(id) {
        const example = getExampleById(id);
        if (!example) return;
        
        if (!confirm(`加载示例: ${example.name}?\n\n${example.description}`)) return;
        
        this.stopSimulation();
        this.automaton = example.build();
        this.history.clear();
        this.pushHistory();
        
        document.querySelectorAll('.model-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.model === example.type);
        });
        
        document.getElementById('pda-stack').style.display = example.type === AUTOMATON_TYPES.PDA ? 'block' : 'none';
        document.getElementById('tm-tape').style.display = example.type === AUTOMATON_TYPES.TM ? 'block' : 'none';
        
        document.getElementById('btn-regex-to-nfa').disabled = example.type !== AUTOMATON_TYPES.NFA && example.type !== AUTOMATON_TYPES.DFA;
        document.getElementById('btn-nfa-to-dfa').disabled = example.type !== AUTOMATON_TYPES.NFA;
        
        this.autoLayout();
        this.updateUI();
        this.render();
        this.updateStatus(`已加载: ${example.name}`);
    }

    convertRegexToNFA() {
        const regex = document.getElementById('regex-input').value.trim();
        if (!regex) {
            alert('请输入正则表达式');
            return;
        }
        
        try {
            const parser = new RegexParser();
            const ast = parser.parse(regex);
            
            const converter = new RegexToNFA();
            const steps = [];
            const { automaton } = converter.convert(ast, null, steps);
            
            this.conversionSteps = steps;
            this.currentStepIndex = -1;
            
            this.stopSimulation();
            this.automaton = automaton;
            this.history.clear();
            this.pushHistory();
            
            document.querySelectorAll('.model-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.model === AUTOMATON_TYPES.NFA);
            });
            
            this.displayConversionSteps(steps);
            document.getElementById('btn-step-conversion').disabled = false;
            document.getElementById('btn-nfa-to-dfa').disabled = false;
            
            this.autoLayout();
            this.updateUI();
            this.render();
            this.updateStatus('正则 → NFA 转换完成');
        } catch (e) {
            alert('转换失败: ' + e.message);
        }
    }

    convertNFAToDFA() {
        if (this.automaton.type !== AUTOMATON_TYPES.NFA) {
            alert('当前自动机不是 NFA');
            return;
        }
        
        try {
            const converter = new NFAToDFA();
            const steps = [];
            const { dfa } = converter.convert(this.automaton, steps);
            
            this.conversionSteps = steps;
            this.currentStepIndex = -1;
            
            this.stopSimulation();
            this.automaton = dfa;
            this.history.clear();
            this.pushHistory();
            
            document.querySelectorAll('.model-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.model === AUTOMATON_TYPES.DFA);
            });
            
            this.displayConversionSteps(steps);
            document.getElementById('btn-step-conversion').disabled = false;
            
            this.autoLayout();
            this.updateUI();
            this.render();
            this.updateStatus('NFA → DFA 转换完成');
        } catch (e) {
            alert('转换失败: ' + e.message);
        }
    }

    displayConversionSteps(steps) {
        const container = document.getElementById('conversion-steps');
        container.innerHTML = steps.map((step, i) => `
            <div class="conversion-step" data-index="${i}">
                <strong>步骤 ${i + 1}:</strong> ${step.description}
            </div>
        `).join('');
    }

    stepConversion() {
        if (this.currentStepIndex < this.conversionSteps.length - 1) {
            this.currentStepIndex++;
            
            document.querySelectorAll('.conversion-step').forEach((el, i) => {
                el.classList.toggle('active', i <= this.currentStepIndex);
            });
            
            const step = this.conversionSteps[this.currentStepIndex];
            if (step.dfaState) {
                this.renderer.selectedStateId = step.dfaState;
                this.render();
            }
            
            this.updateStatus(`步骤 ${this.currentStepIndex + 1}/${this.conversionSteps.length}`);
        }
        
        if (this.currentStepIndex >= this.conversionSteps.length - 1) {
            document.getElementById('btn-step-conversion').disabled = true;
            this.updateStatus('转换完成');
        }
    }

    startSimulation() {
        const input = document.getElementById('input-string').value;
        this.simulator = new AutomatonSimulator(this.automaton);
        this.simulator.setInput(input);
        this.isSimulating = true;
        this.renderer.clearHighlights();
        this.updateSimulationDisplay();
    }

    resetSimulation() {
        this.stopSimulation();
        this.isPlaying = false;
        this.simulator = null;
        this.renderer.clearHighlights();
        document.getElementById('simulation-result').className = 'simulation-result';
        document.getElementById('simulation-result').textContent = '';
        document.getElementById('btn-pause-sim').disabled = true;
        document.getElementById('btn-play-sim').disabled = false;
        document.getElementById('stack-display').innerHTML = '';
        document.getElementById('tape-display').innerHTML = '';
        this.render();
        this.updateStatus('模拟已重置');
    }

    stopSimulation() {
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
        this.isPlaying = false;
        this.isSimulating = false;
    }

    stepSimulation() {
        if (!this.simulator) {
            this.startSimulation();
        }
        
        if (this.simulator.isFinished) {
            this.updateSimulationResult();
            return;
        }
        
        const result = this.simulator.step();
        
        this.renderer.setActiveStates(this.simulator.getActiveStates());
        this.renderer.setActiveTransitions(this.simulator.getActiveTransitions());
        
        this.updateSimulationDisplay();
        this.render();
        
        if (this.simulator.isFinished) {
            this.updateSimulationResult();
            this.pauseSimulation();
        }
    }

    togglePlay() {
        if (this.isPlaying) {
            this.pauseSimulation();
            return;
        }
        
        if (!this.simulator) {
            this.startSimulation();
        }
        
        if (this.simulator.isFinished) {
            this.updateSimulationResult();
            return;
        }
        
        this.isPlaying = true;
        document.getElementById('btn-play-sim').disabled = true;
        document.getElementById('btn-pause-sim').disabled = false;
        
        this.playInterval = setInterval(() => {
            if (!this.simulator.isFinished) {
                this.stepSimulation();
            } else {
                this.pauseSimulation();
            }
        }, this.playSpeed);
    }

    pauseSimulation() {
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
        this.isPlaying = false;
        document.getElementById('btn-play-sim').disabled = false;
        document.getElementById('btn-pause-sim').disabled = true;
    }

    updateSimulationDisplay() {
        if (!this.simulator) return;
        
        if (this.automaton.type === AUTOMATON_TYPES.PDA) {
            const stack = this.simulator.getStack();
            const display = document.getElementById('stack-display');
            if (stack.length === 0) {
                display.innerHTML = '<div style="color:#64748b;text-align:center;padding:20px;">栈为空</div>';
            } else {
                display.innerHTML = stack.map(s => `<div class="stack-item">${s}</div>`).join('');
            }
        }
        
        if (this.automaton.type === AUTOMATON_TYPES.TM) {
            const tape = this.simulator.getTape();
            const head = this.simulator.getHeadPosition();
            const display = document.getElementById('tape-display');
            display.innerHTML = tape.map((cell, i) => 
                `<div class="tape-cell ${i === head ? 'head' : ''}">${cell}</div>`
            ).join('');
        }
    }

    updateSimulationResult() {
        const resultEl = document.getElementById('simulation-result');
        if (this.simulator.isAccepted) {
            resultEl.className = 'simulation-result accept';
            resultEl.textContent = '✓ 接受';
            this.updateStatus('输入串被接受');
        } else if (this.simulator.isRejected) {
            resultEl.className = 'simulation-result reject';
            resultEl.textContent = '✗ 拒绝';
            this.updateStatus('输入串被拒绝');
        }
    }
}
