import './style.css';
import './app.css';
import { EventsOn } from '../wailsjs/runtime/runtime';

const metrics = [
        { label: '活跃技能', value: '32', trend: '+6%' },
        { label: '今日任务', value: '14', trend: '+2' },
        { label: '自动化执行', value: '68%', trend: '+4%' },
        { label: '风险拦截', value: '3', trend: '需确认' },
];


    try {
        // 可以添加一个简单的 loading 提示
        const originalText = document.title;
        document.title = "正在更新...";
        const result = await window.go.main.App.SelfUpdate();
        alert(result);
    } catch (e) {
        alert('更新失败: ' + e);
    } finally {
        document.title = "Domour Copilot";
    }
});
