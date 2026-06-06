import { App } from './ui/controller.js';

window.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    
    console.log('✅ 四合一自动机可视化模拟器已启动');
    console.log('📖 快捷键:');
    console.log('   V - 选择模式');
    console.log('   S - 添加状态');
    console.log('   T - 添加转移');
    console.log('   Del - 删除选中');
    console.log('   Ctrl+Z - 撤销');
    console.log('   Ctrl+Y - 重做');
    console.log('   Esc - 取消选择');
    console.log('   Alt+拖拽 - 平移画布');
    console.log('   滚轮 - 缩放');
});
