import './style.css';
import './app.css';

const metrics = [
        { label: '活跃技能', value: '32', trend: '+6%' },
        { label: '今日任务', value: '14', trend: '+2' },
        { label: '自动化执行', value: '68%', trend: '+4%' },
        { label: '风险拦截', value: '3', trend: '需确认' },
];

const quickActions = [
        '生成周报',
        '同步 IoT 状态',
        '复盘执行日志',
        '打开场景配置',
];

const activityFeed = [
        { time: '09:12', text: '完成“专注办公”场景启动' },
        { time: '09:18', text: '检测到 2 个设备离线，已通知' },
        { time: '09:34', text: '生成销售看板草稿，待确认' },
        { time: '09:40', text: '自动化清理 4 个重复任务' },
];

const starterMessages = [
        { role: 'assistant', content: '早上好！我可以帮你准备今日计划。' },
        { role: 'assistant', content: '是否要打开“专注办公”场景并同步设备状态？' },
];

document.querySelector('#app').innerHTML = `
    <div class="tars-shell">
        <header class="tars-header">
            <div>
                <div class="tars-title">TARS Copilot</div>
                <div class="tars-subtitle">协同优先 · 自动化放权</div>
            </div>
            <div class="tars-status">
                <span class="status-pill online">Cosmos-Star 在线</span>
                <span class="status-pill">本地模式</span>
                <span class="status-pill">低风险</span>
                <label class="status-pill" style="cursor:pointer;user-select:none;">
                  <input type="checkbox" id="proxyToggle" style="vertical-align:middle;margin-right:4px;">网络加速
                </label>
                                <span class="status-pill idle" id="vlinkStatus">加速状态：未开启</span>
            </div>
        </header>

        <main class="tars-main">
            <section class="dashboard">
                <div class="section-header">
                    <h2>Dashboard</h2>
                    <button class="ghost-btn">查看全局</button>
                </div>
                <div class="metric-grid" id="metricGrid"></div>

                <div class="dashboard-row">
                    <div class="panel">
                        <div class="panel-title">快捷操作</div>
                        <div class="chip-grid" id="quickActions"></div>
                    </div>
                    <div class="panel">
                        <div class="panel-title">实时动态</div>
                        <ul class="activity" id="activityFeed"></ul>
                    </div>
                </div>

                <div class="panel insight">
                    <div class="panel-title">协同建议</div>
                    <p>今日存在 3 个高风险步骤待确认。建议优先审阅“商业报表”生成链路。</p>
                    <div class="insight-actions">
                        <button class="primary-btn">进入审阅</button>
                        <button class="ghost-btn">稍后提醒</button>
                    </div>
                </div>
            </section>

            <aside class="chat">
                <div class="chat-header">
                    <div>
                        <div class="panel-title">Copilot 对话</div>
                        <div class="muted">人机协同 · 可控执行</div>
                    </div>
                    <button class="ghost-btn small">新建会话</button>
                </div>
                <div class="chat-body" id="chatBody"></div>
                <div class="chat-input">
                    <div class="attachment-row">
                        <input id="fileInput" type="file" multiple hidden />
                        <button id="attachButton" class="ghost-btn small" title="添加附件">+ 附件</button>
                        <div id="attachmentList" class="attachment-list"></div>
                    </div>
                    <div class="chat-compose">
                        <textarea id="chatInput" rows="1" placeholder="输入任务或问题…"></textarea>
                        <button id="chatSend" class="primary-btn">发送</button>
                    </div>
                </div>
            </aside>
        </main>
    </div>
`;

const metricGrid = document.getElementById('metricGrid');
metricGrid.innerHTML = metrics
        .map(
                (item) => `
            <div class="metric-card">
                <div class="metric-label">${item.label}</div>
                <div class="metric-value">${item.value}</div>
                <div class="metric-trend">${item.trend}</div>
            </div>
        `
        )
        .join('');

const quickActionsContainer = document.getElementById('quickActions');
quickActionsContainer.innerHTML = quickActions
        .map((action) => `<button class="chip">${action}</button>`)
        .join('');

const activityFeedContainer = document.getElementById('activityFeed');
activityFeedContainer.innerHTML = activityFeed
        .map(
                (item) => `
            <li>
                <span class="time">${item.time}</span>
                <span class="text">${item.text}</span>
            </li>
        `
        )
        .join('');

const chatBody = document.getElementById('chatBody');
const chatInput = document.getElementById('chatInput');
const chatSend = document.getElementById('chatSend');
const fileInput = document.getElementById('fileInput');
const attachButton = document.getElementById('attachButton');
const attachmentList = document.getElementById('attachmentList');
let pendingAttachments = [];

const proxyToggle = document.getElementById('proxyToggle');
const vlinkStatus = document.getElementById('vlinkStatus');
let vlinkStatusTimer = null;

const setVlinkStatus = (state) => {
    if (!vlinkStatus) return;
    vlinkStatus.classList.remove('ok', 'error', 'idle');
    if (state === 'ok') {
        vlinkStatus.classList.add('ok');
        vlinkStatus.textContent = '加速状态：运行中';
    } else if (state === 'error') {
        vlinkStatus.classList.add('error');
        vlinkStatus.textContent = '加速状态：异常';
    } else {
        vlinkStatus.classList.add('idle');
        vlinkStatus.textContent = '加速状态：未开启';
    }
};

const checkVlinkStatus = async () => {
    try {
        const alive = await window.go.main.App.IsVlinkPortAlive();
        setVlinkStatus(alive ? 'ok' : 'error');
    } catch (error) {
        console.error('vlink 状态检测失败:', error);
        setVlinkStatus('error');
    }
};

const startVlinkPolling = () => {
    if (vlinkStatusTimer) return;
    vlinkStatusTimer = window.setInterval(checkVlinkStatus, 2000);
    checkVlinkStatus();
};

const stopVlinkPolling = () => {
    if (vlinkStatusTimer) {
        window.clearInterval(vlinkStatusTimer);
        vlinkStatusTimer = null;
    }
    setVlinkStatus('idle');
};
if (proxyToggle) {
    proxyToggle.addEventListener('change', async () => {
        proxyToggle.disabled = true;
        try {
            if (proxyToggle.checked) {
                const installed = await window.go.main.App.IsVlinkInstalled();
                if (!installed) {
                    const confirmInstall = window.confirm('未检测到 vlink，是否自动下载安装？');
                    if (!confirmInstall) {
                        proxyToggle.checked = false;
                        stopVlinkPolling();
                        return;
                    }
                    const sudoPassword = window.prompt('请输入 sudo 密码用于安装 vlink（不会保存）：', '');
                    if (!sudoPassword) {
                        proxyToggle.checked = false;
                        stopVlinkPolling();
                        return;
                    }
                    const installResult = await window.go.main.App.InstallVlink('', sudoPassword);
                    console.log(installResult);
                }
                const result = await window.go.main.App.StartVlink();
                console.log(result);
                startVlinkPolling();
            } else {
                const result = await window.go.main.App.StopVlink();
                console.log(result);
                stopVlinkPolling();
            }
        } catch (error) {
            console.error('vlink 操作失败:', error);
            proxyToggle.checked = !proxyToggle.checked;
            if (proxyToggle.checked) {
                startVlinkPolling();
            } else {
                stopVlinkPolling();
            }
        } finally {
            proxyToggle.disabled = false;
        }
    });
}

const renderMessage = (role, content) => {
        const message = document.createElement('div');
        message.className = `chat-message ${role}`;
        message.innerHTML = `<div class="bubble">${content}</div>`;
        chatBody.appendChild(message);
        chatBody.scrollTop = chatBody.scrollHeight;
    return message;
};

const isLikelyTextFile = (file) => {
    if (file.type && file.type.startsWith('text/')) return true;
    const name = file.name.toLowerCase();
    return (
        name.endsWith('.txt') ||
        name.endsWith('.md') ||
        name.endsWith('.json') ||
        name.endsWith('.csv') ||
        name.endsWith('.yaml') ||
        name.endsWith('.yml') ||
        name.endsWith('.log')
    );
};

const readFileAsText = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result || '');
        reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
        reader.readAsText(file);
    });

const readFileAsBase64 = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || '');
            const base64 = result.includes(',') ? result.split(',')[1] : result;
            resolve(base64);
        };
        reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
        reader.readAsDataURL(file);
    });

const prepareAttachments = async (files) => {
    const prepared = await Promise.all(
        files.map(async (file) => {
            const isText = isLikelyTextFile(file);
            const content = isText
                ? await readFileAsText(file)
                : await readFileAsBase64(file);
            return {
                name: file.name,
                content: String(content || ''),
                isBinary: !isText,
            };
        })
    );
    return prepared.filter((item) => item.content.trim() !== '');
};

starterMessages.forEach((message) => renderMessage(message.role, message.content));

const handleSend = async () => {
    const value = chatInput.value.trim();
    if (!value && pendingAttachments.length === 0) return;
    renderMessage('user', value || '（仅附件）');
    if (pendingAttachments.length > 0) {
        const attachmentNames = pendingAttachments.map((file) => file.name).join(', ');
        renderMessage('assistant', `已记录附件：${attachmentNames}`);
    }
    chatInput.value = '';
    chatInput.style.height = 'auto';
    const filesToSend = pendingAttachments;
    pendingAttachments = [];
    attachmentList.innerHTML = '';

    const assistantMessage = renderMessage('assistant', '处理中…');
    const assistantBubble = assistantMessage.querySelector('.bubble');
    try {
        const attachments = await prepareAttachments(filesToSend);
        const prompt = value || '请根据附件内容进行分析。';
        const response = attachments.length
            ? await window.go.main.App.ChatWithGeminiWithAttachments(prompt, attachments)
            : await window.go.main.App.ChatWithGemini(prompt);
        assistantBubble.textContent = response || '（无返回）';
    } catch (error) {
        console.error('Gemini CLI 调用失败:', error);
        assistantBubble.textContent = '调用 Gemini CLI 失败，请检查命令或环境配置。';
    }
};

chatSend.addEventListener('click', handleSend);
attachButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
        const files = Array.from(fileInput.files || []);
        // TODO: 目前仅做本地展示与选择，不做上传。
        pendingAttachments = [...pendingAttachments, ...files];
        attachmentList.innerHTML = pendingAttachments
                .map(
                        (file, index) => `
                    <button class="attachment-chip" data-index="${index}" title="点击移除">
                        ${file.name}
                    </button>
                `
                )
                .join('');
        fileInput.value = '';
});

attachmentList.addEventListener('click', (event) => {
        const target = event.target.closest('.attachment-chip');
        if (!target) return;
        const index = Number(target.dataset.index);
        pendingAttachments = pendingAttachments.filter((_, i) => i !== index);
        attachmentList.innerHTML = pendingAttachments
                .map(
                        (file, i) => `
                    <button class="attachment-chip" data-index="${i}" title="点击移除">
                        ${file.name}
                    </button>
                `
                )
                .join('');
});
chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = `${chatInput.scrollHeight}px`;
});

chatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSend();
    }
});
