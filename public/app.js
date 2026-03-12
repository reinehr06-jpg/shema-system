console.warn('--- SHEMA APP LOADED v1.0.0 ---');
const API_URL = window.location.origin.includes('localhost') ? 'http://localhost:3002/api' : '/api';
let currentUser = null;

// ==========================================
// Toast Notification System
// ==========================================
function showToast(message, type = 'success', duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) { console.warn('Toast container not found'); return; }

    const icons = {
        success: 'fa-check',
        error: 'fa-times',
        warning: 'fa-exclamation',
        info: 'fa-info'
    };
    const titles = {
        success: 'Sucesso',
        error: 'Erro',
        warning: 'Atenção',
        info: 'Informação'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon"><i class="fas ${icons[type] || icons.info}"></i></div>
        <div class="toast-body">
            <div class="toast-title">${titles[type] || titles.info}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.classList.add('removing'); setTimeout(() => this.parentElement.remove(), 300);">&times;</button>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }
    }, duration);
}

// Override native alert() to use toast system
const _nativeAlert = window.alert;
window.alert = function (msg) {
    if (!msg) return;
    const msgStr = String(msg).toLowerCase();
    let type = 'info';
    if (msgStr.includes('sucesso') || msgStr.includes('salvo') || msgStr.includes('criada') || msgStr.includes('cadastrado') || msgStr.includes('atualizado') || msgStr.includes('redefinida')) {
        type = 'success';
    } else if (msgStr.includes('erro') || msgStr.includes('falha') || msgStr.includes('inválido') || msgStr.includes('incorreto')) {
        type = 'error';
    } else if (msgStr.includes('atenção') || msgStr.includes('fraca') || msgStr.includes('selecione') || msgStr.includes('informe') || msgStr.includes('adicione')) {
        type = 'warning';
    }
    showToast(msg, type);
};


// Handle URL-based tab switching on load
window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab) showTab(tab);

    const gcal = params.get('gcal');
    if (gcal === 'success') {
        setTimeout(() => showToast('Autenticado com Google Calendar!', 'success'), 500);
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname + '?tab=connections');
    }
});

// Global input formatting for Phone and CPF/CNPJ
document.addEventListener('input', function (e) {
    if (e.target.tagName !== 'INPUT') return;

    const id = (e.target.id || '').toLowerCase();
    const placeholder = (e.target.placeholder || '').toLowerCase();
    const isPhone = id.includes('phone') || placeholder.includes('telefone') || placeholder.includes('celular');
    const isCpfCnpj = id.includes('cpf') || id.includes('cnpj') || placeholder.includes('cpf');

    if (isPhone) {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 11) val = val.slice(0, 11);
        if (val.length > 10) {
            e.target.value = val.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
        } else if (val.length > 6) {
            e.target.value = val.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
        } else if (val.length > 2) {
            e.target.value = val.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
        } else if (val.length > 0) {
            e.target.value = val.replace(/^(\d*)/, '($1');
        }
    } else if (isCpfCnpj) {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length <= 11) {
            // CPF format
            if (val.length > 9) {
                e.target.value = val.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2}).*/, '$1.$2.$3-$4');
            } else if (val.length > 6) {
                e.target.value = val.replace(/^(\d{3})(\d{3})(\d{0,3}).*/, '$1.$2.$3');
            } else if (val.length > 3) {
                e.target.value = val.replace(/^(\d{3})(\d{0,3}).*/, '$1.$2');
            } else {
                e.target.value = val;
            }
        } else {
            // CNPJ format
            if (val.length > 14) val = val.slice(0, 14);
            if (val.length > 12) {
                e.target.value = val.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2}).*/, '$1.$2.$3/$4-$5');
            } else if (val.length > 8) {
                e.target.value = val.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4}).*/, '$1.$2.$3/$4');
            } else if (val.length > 5) {
                e.target.value = val.replace(/^(\d{2})(\d{3})(\d{0,3}).*/, '$1.$2.$3');
            } else if (val.length > 2) {
                e.target.value = val.replace(/^(\d{2})(\d{0,3}).*/, '$1.$2');
            } else {
                e.target.value = val;
            }
        }
    }
});

window.toggleUserDropdown = (e) => {
    if (e) e.stopPropagation();
    const menu = document.getElementById('userDropdownMenu');
    menu.classList.toggle('active');
};

document.addEventListener('click', () => {
    const menu = document.getElementById('userDropdownMenu');
    if (menu) menu.classList.remove('active');
});
let chartInstance = null;
let allMembers = []; // Cache for members
let allTeams = []; // Cache for teams
let isDuplicatePhone = false; // Flag for phone validation
let phoneCheckTimer = null; // Debounce timer
let calendarYear = new Date().getFullYear();
let calendarMonth = new Date().getMonth() + 1; // 1-indexed
let selectedRecurrence = 'none';
let userWatchProgress = {}; // Cache for watch progress { training_id: { watched_seconds, total_seconds, completed } }
let ytPlayer = null;
let currentVideoData = null;
let watchInterval = null;
let accumulatedWatchTime = 0;
let currentFolderId = null;
let availabilityYear = new Date().getFullYear();
let availabilityMonth = new Date().getMonth() + 1;
let userAvailabilities = []; // Cache for current month availabilities
// ========================================
// Auth Logic
// ========================================

function showRegister() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('forgotForm').style.display = 'none';
    document.getElementById('resetForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
}

function showLogin() {
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('forgotForm').style.display = 'none';
    document.getElementById('resetForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
}

function showForgot() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('resetForm').style.display = 'none';
    document.getElementById('recoveryTokenStep').style.display = 'none';
    document.getElementById('recoveryCpfStep').style.display = 'none';
    document.getElementById('forgotForm').style.display = 'block';
}

function showReset() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('forgotForm').style.display = 'none';
    document.getElementById('recoveryTokenStep').style.display = 'none';
    document.getElementById('recoveryCpfStep').style.display = 'none';
    document.getElementById('resetForm').style.display = 'block';
}

let activeRecoveryTokenId = null;

async function handleForgot(e) {
    if (e) e.preventDefault();
    const phone = document.getElementById('forgotPhone').value;
    try {
        const res = await fetch(`${API_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });
        const data = await res.json();
        if (data.success) {
            activeRecoveryTokenId = data.token_id;
            document.getElementById('forgotForm').style.display = 'none';
            document.getElementById('recoveryTokenStep').style.display = 'block';
        } else {
            alert(data.error || 'Erro ao solicitar recuperação');
        }
    } catch (err) { alert('Erro na conexão'); }
}

async function handleRecoveryToken() {
    const token = document.getElementById('recoveryToken').value;
    if (!token || token.length < 6) return alert('Informe o código de 6 dígitos.');

    try {
        const res = await fetch(`${API_URL}/auth/verify-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token_id: activeRecoveryTokenId, token })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('maskedCpfLabel').textContent = data.masked_cpf;
            document.getElementById('recoveryTokenStep').style.display = 'none';
            document.getElementById('recoveryCpfStep').style.display = 'block';
        } else {
            alert(data.error || 'Código inválido');
        }
    } catch (err) { alert('Erro na conexão'); }
}

async function handleRecoveryCpf() {
    const cpf = document.getElementById('recoveryFullCpf').value;
    if (!cpf) return alert('Informe o CPF.');

    try {
        const res = await fetch(`${API_URL}/auth/verify-cpf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token_id: activeRecoveryTokenId, cpf })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('recoveryCpfStep').style.display = 'none';
            showReset();
        } else {
            alert(data.error || 'CPF incorreto');
        }
    } catch (err) { alert('Erro na conexão'); }
}

async function handleReset(e) {
    if (e) e.preventDefault();
    const newPassword = document.getElementById('resetNewPassword').value;

    try {
        const res = await fetch(`${API_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token_id: activeRecoveryTokenId, password: newPassword })
        });
        const data = await res.json();
        if (data.success) {
            alert('Senha redefinida com sucesso!');
            showLogin();
        } else {
            alert(data.error || 'Erro ao redefinir senha');
        }
    } catch (err) { alert('Erro na conexão'); }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ email: email.toLowerCase(), password })
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: 'Erro no servidor' }));
            return alert(errorData.error || `Erro ${res.status}`);
        }

        const data = await res.json();

        if (data.success) {
            currentUser = data.user;
            localStorage.setItem('shema_user', JSON.stringify(currentUser));
            initApp();

            if (currentUser.role === 'member_portal') {
                showTab('member_portal');
            } else {
                showTab('dashboard');
            }
        } else {
            alert(data.error);
        }
    } catch (err) {
        console.error(err);
        alert('Erro na conexão. Verifique se o servidor está rodando.');
    }
}

async function handleRegister(e) {
    if (e) e.preventDefault();
    const payload = {
        name: document.getElementById('regName').value,
        email: document.getElementById('regEmail').value.toLowerCase(),
        cpf_cnpj: document.getElementById('regCpfCnpj').value,
        phone: document.getElementById('regPhone').value,
        password: document.getElementById('regPassword').value,
    };

    const passError = validatePassword(payload.password);
    if (passError) {
        alert(passError);
        return;
    }

    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            alert('Cadastro realizado! Faça login.');
            showLogin();
        } else {
            // Requirement: handle duplicate account message
            if (data.error && data.error.includes('conta')) {
                alert('Você já possui conta.');
            } else {
                alert(data.error || 'Erro ao cadastrar');
            }
        }
    } catch (err) {
        console.error(err);
        alert('Erro no cadastro');
    }
}

document.getElementById('folderFormDisplay').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('fNameDisp').value;
    try {
        const res = await fetch(`${API_URL}/folders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ name })
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({ error: 'Erro ao criar pasta' }));
            throw new Error(errData.error || 'Erro ao criar pasta');
        }
        alert('Pasta criada com sucesso!');
        hideTrainingForms();
        loadTrainings();
        loadDashboard();
    } catch (err) {
        alert(err.message);
    }
});

// function removed to avoid duplicate

async function logout() {
    try {
        await fetch(`${API_URL}/auth/logout`, { method: 'POST' });
    } catch (e) { console.error('Logout error:', e); }

    currentUser = null;
    localStorage.removeItem('shema_user');
    location.reload();
}

// ========================================
// App Logic
// ========================================

function initApp() {
    const authScreen = document.getElementById('auth-screen');
    const appScreen = document.getElementById('app-screen');
    if (authScreen) authScreen.classList.remove('active');
    if (appScreen) appScreen.style.display = 'flex';

    // Role-based restrictions
    const waTeamSelector = document.getElementById('wa-team-selector');

    if (currentUser.role === 'sub_admin') {
        ['members', 'teamCalendar', 'trainings'].forEach(tab => {
            const el = document.querySelector(`li[onclick="showTab('${tab}')"]`);
            if (el) el.style.display = 'none';
        });
        if (waTeamSelector) waTeamSelector.style.display = 'block';
        loadSubAdminTeam();
        showTab('dashboard');
    } else if (currentUser.role === 'admin') {
        document.querySelectorAll('.nav-links > li').forEach(li => li.style.display = 'flex');
        if (waTeamSelector) waTeamSelector.style.display = 'block';
        showTab('dashboard');
    } else {
        // Volunteer
        ['dashboard', 'members', 'logs'].forEach(tab => {
            const el = document.querySelector(`li[onclick="showTab('${tab}')"]`);
            if (el) el.style.display = 'none';
        });
        showTab('userDashboard');
    }
}

function showTab(tabId) {
    // Reset Views Logic (Always show main view of the tab)
    if (tabId === 'members') {
        document.getElementById('memberFormView').style.display = 'none';
        document.getElementById('teamFormView').style.display = 'none';
        document.getElementById('sectorFormView').style.display = 'none';
        document.getElementById('cadastrosMainView').style.display = 'block';
    }
    if (tabId === 'teamCalendar') {
        document.getElementById('eventFormView').style.display = 'none';
        document.getElementById('calendarView').style.display = 'block';
    }
    if (tabId === 'trainings') {
        document.getElementById('folderFormView').style.display = 'none';
        document.getElementById('trainingFormView').style.display = 'none';
        document.getElementById('videoPlayerView').style.display = 'none';
        document.getElementById('trainingHeader').style.display = 'flex'; // Ensure header is shown
        document.getElementById('trainingBreadcrumb').style.display = 'block';
        document.getElementById('trainingsGridView').style.display = 'block';
        loadTrainings(); // Reload to refresh folders
    }

    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');

    // Clear all active states
    document.querySelectorAll('.nav-links > li').forEach(l => l.classList.remove('active'));

    // Map tab IDs to nav positions (only 4 items in nav now)
    const directTabs = {
        dashboard: 0,
        members: 1,
        teamCalendar: 2,
        trainings: 3
    };
    const navItems = document.querySelectorAll('.nav-links > li');
    if (directTabs[tabId] !== undefined && navItems[directTabs[tabId]]) {
        navItems[directTabs[tabId]].classList.add('active');
    }

    if (tabId === 'dashboard') loadDashboard();
    if (tabId === 'members') loadCadastros();
    if (tabId === 'trainings') loadTrainings();
    if (tabId === 'logs') loadLogs();
    if (tabId === 'calendar') { loadTeamCalendar(); }
    if (tabId === 'teamCalendar') { loadTeamCalendar(); }
    if (tabId === 'connections') { loadConnectionsContent(); }
    if (tabId === 'whatsapp') { loadConnectionsContent(); loadWhatsAppStatus(); }
    if (tabId === 'profile') {
        if (typeof window.loadAccountPage === 'function') window.loadAccountPage();
        else if (typeof loadAccountPage === 'function') loadAccountPage();
    }
    if (tabId === 'userDashboard') { loadAvailabilityCalendar(); }
    if (tabId === 'member_portal') { loadMemberPortal(); }
}

async function loadMemberPortal() {
    const availList = document.getElementById('member-availability-list');
    const assignList = document.getElementById('member-assignments-list');

    if (availList) availList.innerHTML = '<div class="loading">Carregando...</div>';
    if (assignList) assignList.innerHTML = '<div class="loading">Carregando...</div>';

    try {
        const [availRes, assignRes] = await Promise.all([
            fetch(`${API_URL}/member-portal/availability`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }),
            fetch(`${API_URL}/member-portal/assignments`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
        ]);

        const availData = await availRes.json();
        const assignData = await assignRes.json();

        renderMemberAvailability(availData);
        renderMemberAssignments(assignData);
    } catch (e) {
        console.error('Portal error:', e);
    }
}

function renderMemberAvailability(events) {
    const list = document.getElementById('member-availability-list');
    if (!list) return;
    list.innerHTML = events.length ? '' : '<p>Sem pendências de disponibilidade.</p>';

    events.forEach(ev => {
        const myResponse = ev.availability_responses?.[0]?.response || 'none';
        const card = document.createElement('div');
        card.className = 'portal-item-card';
        card.innerHTML = `
            <div class="info">
                <strong>${ev.event_name}</strong>
                <span>${ev.event_date} às ${ev.event_time}</span>
            </div>
            <div class="actions">
                <button class="btn-sm ${myResponse === 'yes' ? 'btn-success' : ''}" onclick="submitAvailability(${ev.id}, 'yes')">Posso</button>
                <button class="btn-sm ${myResponse === 'maybe' ? 'btn-warning' : ''}" onclick="submitAvailability(${ev.id}, 'maybe')">Talvez</button>
                <button class="btn-sm ${myResponse === 'no' ? 'btn-danger' : ''}" onclick="submitAvailability(${ev.id}, 'no')">Não posso</button>
            </div>
        `;
        list.appendChild(card);
    });
}

async function submitAvailability(eventId, response) {
    try {
        const res = await fetch(`${API_URL}/member-portal/availability`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ event_id: eventId, response: response })
        });
        if (res.ok) {
            loadMemberPortal();
        }
    } catch (e) { alert('Erro ao salvar resposta'); }
}

function renderMemberAssignments(assignments) {
    const list = document.getElementById('member-assignments-list');
    if (!list) return;
    list.innerHTML = assignments.length ? '' : '<p>Sem escalas pendentes.</p>';

    assignments.forEach(as => {
        const card = document.createElement('div');
        card.className = 'portal-item-card';
        card.innerHTML = `
            <div class="info">
                <strong>${as.event.event_name}</strong>
                <span>${as.role_name || 'Participante'} - ${as.event.event_date}</span>
            </div>
            <div class="status-badge ${as.status}">${as.status}</div>
            ${as.status === 'pending' ? `
                <div class="actions">
                    <button class="btn-sm btn-success" onclick="updateAssignment(${as.id}, 'confirm')">Confirmar</button>
                    <button class="btn-sm btn-danger" onclick="updateAssignment(${as.id}, 'decline')">Recusar</button>
                </div>
            ` : ''}
        `;
        list.appendChild(card);
    });
}

async function updateAssignment(id, action) {
    let reason = '';
    if (action === 'decline') {
        reason = prompt('Por que você não pode participar?');
        if (!reason) return;
    }

    const url = `${API_URL}/member-portal/assignments/${id}/${action}`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: action === 'decline' ? JSON.stringify({ reason }) : null
        });
        if (res.ok) {
            loadMemberPortal();
        }
    } catch (e) { alert('Erro ao atualizar escala'); }
}


window.toggleAccessFields = () => {
    const isChecked = document.getElementById('mCreateAccessDisp').checked;
    document.getElementById('accessFields').style.display = isChecked ? 'block' : 'none';
};

window.navigateBack = () => {
    const currentTab = document.querySelector('.tab-content.active').id;

    if (currentTab === 'members') {
        if (document.getElementById('memberFormView').style.display === 'block') {
            hideMemberForm();
            return;
        }
        if (document.getElementById('teamFormView').style.display === 'block') {
            hideTeamForm();
            return;
        }
    }
    if (currentTab === 'teamCalendar') {
        if (document.getElementById('eventFormView').style.display === 'block') {
            hideEventForm();
            return;
        }
    }
    if (currentTab === 'trainings') {
        if (document.getElementById('videoPlayerView').style.display === 'block') {
            closeVideoPlayer();
            return;
        }
        if (document.getElementById('folderFormView').style.display === 'block' ||
            document.getElementById('trainingFormView').style.display === 'block') {
            hideTrainingForms();
            return;
        }
        if (currentFolderId) {
            loadTrainings();
            return;
        }
    }

    if (currentTab === 'profile') {
        const overview = document.getElementById('account-overview');
        if (overview && overview.style.display === 'none') {
            backToAccountGrid();
            return;
        }
    }

    // Default: Go to Dashboard
    if (currentTab !== 'dashboard') {
        showTab('dashboard');
    }
};

window.showBirthdayModal = async () => {
    const modal = document.getElementById('birthdayModal');
    const list = document.getElementById('birthdayList');
    list.innerHTML = '<p>Carregando...</p>';
    modal.style.display = 'block';

    try {
        const res = await fetch(`${API_URL}/birthdays/today`);
        const birthdays = await res.json();

        if (birthdays.length === 0) {
            list.innerHTML = '<p class="empty-state">Nenhum aniversariante hoje.</p>';
            return;
        }

        list.innerHTML = birthdays.map(b => `
            <div class="birthday-item">
                <div class="b-info">
                    <strong>${b.name}</strong>
                    <span>Completa ${b.age} anos</span>
                </div>
                <a href="https://wa.me/55${b.phone.replace(/\D/g, '')}" target="_blank" class="btn-whatsapp-modal">
                    <i class="fab fa-whatsapp"></i> Parabenizar
                </a>
            </div>
        `).join('');
    } catch (e) {
        console.error(e);
        list.innerHTML = '<p class="error">Erro ao carregar dados.</p>';
    }
};

window.closeBirthdayModal = () => {
    document.getElementById('birthdayModal').style.display = 'none';
};

// Close modal on outside click
window.onclick = function (event) {
    const modal = document.getElementById('birthdayModal');
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

window.togglePasswordVisibility = (id) => {
    const input = document.getElementById(id);
    const icon = input.nextElementSibling;
    if (input.type === "password") {
        input.type = "text";
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
    } else {
        input.type = "password";
        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
    }
};

// Stats / Dashboard
let serviceChartInstance = null;
let ageChartInstance = null;



function renderServiceChart(teamCounts) {
    if (!teamCounts || teamCounts.length === 0) return;
    const canvas = document.getElementById('serviceChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const labels = teamCounts.map(t => t.name);
    const dataPoints = teamCounts.map(t => t.count);

    // Color palette matching mockup
    const colors = [
        '#1EBE5D', // Green
        '#4299E1', // Blue
        '#F6AD55', // Orange
        '#B794F4', // Purple
        '#F687B3', // Pink
        '#F6E05E', // Yellow
        '#63B3ED'  // Sky
    ];

    if (serviceChartInstance) serviceChartInstance.destroy();
    serviceChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Membros',
                data: dataPoints,
                backgroundColor: colors.slice(0, dataPoints.length),
                borderRadius: 4,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function renderAgeChart(ageDist) {
    const canvas = document.getElementById('ageChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const labels = Object.keys(ageDist);
    const dataPoints = Object.values(ageDist);

    if (ageChartInstance) ageChartInstance.destroy();

    // Exact colors from reference: Red, Blue, Green, Gold
    ageChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dataPoints,
                backgroundColor: [
                    '#1EBE5D', // Green
                    '#4299E1', // Blue
                    '#F6E05E', // Gold/Yellow
                    '#F56565'  // Red
                ],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 15
                    }
                },
                tooltip: { enabled: false },
                datalabels: {
                    color: '#fff',
                    font: {
                        weight: 'bold',
                        size: 14
                    },
                    formatter: (value, ctx) => {
                        const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = Math.round((value / total) * 100) + '%';
                        return percentage;
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}



function getAttendanceColor(memberId, date) {
    const avail = allAvailabilities.find(a => a.member_id === memberId && a.event_date === date);
    if (!avail) return 'var(--text-main)';
    if (avail.whatsapp_confirmation === 'confirmed') return '#25D366'; // Green
    if (avail.whatsapp_confirmation === 'declined') return '#FF3B30'; // Red
    return 'var(--text-main)';
}

let allAvailabilities = [];
async function loadCalendarAvailabilities(year, month) {
    try {
        const res = await fetch(`${API_URL}/availabilities?year=${year}&month=${month}`);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const data = await res.json();
        allAvailabilities = Array.isArray(data) ? data : [];
    } catch (e) {
        console.error('Error loading availabilities:', e);
        allAvailabilities = [];
    }
}

async function loadDashboard() {
    // Only render charts when dashboard is actually visible
    const dashSection = document.getElementById('dashboard');
    if (dashSection && !dashSection.classList.contains('active')) return;

    await loadCalendarAvailabilities(calendarYear, calendarMonth);
    // Register plugin if available
    if (window.ChartDataLabels) Chart.register(window.ChartDataLabels);

    try {
        // Fetch all data in parallel with error handling
        const [statsRes, membersRes, teamsRes, trainingsRes] = await Promise.all([
            fetch(`${API_URL}/stats`).catch(e => { console.error('Stats fetch error:', e); return { ok: false }; }),
            fetch(`${API_URL}/members`).catch(e => { console.error('Members fetch error:', e); return { ok: false }; }),
            fetch(`${API_URL}/teams`).catch(e => { console.error('Teams fetch error:', e); return { ok: false }; }),
            fetch(`${API_URL}/trainings`).catch(e => { console.error('Trainings fetch error:', e); return { ok: false }; })
        ]);

        const statsData = statsRes.ok ? await statsRes.json() : {};
        const membersData = membersRes.ok ? await membersRes.json() : [];
        const teamsData = teamsRes.ok ? await teamsRes.json() : [];
        const trainingsData = trainingsRes.ok ? await trainingsRes.json() : [];

        // Update Teams Select for WhatsApp (if needed)
        const waSelect = document.getElementById('wa-team-select');
        if (waSelect) {
            waSelect.innerHTML = '<option value="">Selecione sua equipe...</option>' +
                teamsData.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        }

        // Update Stats Cards
        const statMembers = document.getElementById('statMembers');
        const statTeams = document.getElementById('statTeams');
        const statTrainings = document.getElementById('statTrainings');
        const statParticipation = document.getElementById('statParticipation');
        const accCode = document.getElementById('accountCodeDisplay');

        if (statMembers) statMembers.textContent = membersData.length;
        if (statTeams) statTeams.textContent = teamsData.length;
        if (statTrainings) statTrainings.textContent = trainingsData.length;
        if (statParticipation) statParticipation.textContent = (statsData.participation || '0') + '%';
        if (accCode) accCode.textContent = statsData.accountCode || 'AH7-23X';

        // Render charts if data exists
        if (statsData.teamCounts) renderServiceChart(statsData.teamCounts);
        if (statsData.ageDistribution) renderAgeChart(statsData.ageDistribution);

    } catch (e) {
        console.error('Critical Dashboard Error:', e);
    }
}

function generateQRCode() {
    const code = document.getElementById('accountCodeDisplay').textContent;
    const container = document.getElementById('qrcode');
    if (!container) return;
    container.innerHTML = ''; // Clear previous
    new QRCode(container, {
        text: `https://shema.system/register?code=${code}`,
        width: 128,
        height: 128
    });
    document.getElementById('qrOverlay').style.display = 'block';
}

// Members (Cadastros)
async function loadMembers() {
    try {
        const res = await fetch(`${API_URL}/members`);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const data = await res.json();
        allMembers = Array.isArray(data) ? data : [];

        const list = document.getElementById('memberList') || document.getElementById('memberTableBody');
        if (!list) return; // Silent return if we are not on a view that shows the list

        if (allMembers.length === 0) {
            list.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhum cadastro encontrado.</td></tr>';
            return;
        }

        // Check if it's the table or the card list
        if (list.tagName === 'TBY' || list.id === 'memberTableBody') {
            list.innerHTML = allMembers.map(m => `
                <tr>
                    <td>${m.name}</td>
                    <td>${m.sector_name || '-'}</td>
                    <td>${m.role_name || '-'}</td>
                    <td style="text-align:right">
                        <button class="btn-icon" onclick="editMember(${m.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon btn-delete" onclick="deleteMember(${m.id})"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `).join('');
        } else {
            list.innerHTML = allMembers.map(m => `
                <div class="team-card">
                    <button class="btn-delete" onclick="deleteMember(${m.id})"><i class="fas fa-trash"></i></button>
                    <div>
                        <strong>${m.name}</strong>
                        <div style="font-size:0.8rem; color:var(--text-muted);">${m.phone || 'Sem telefone'} • ${m.age || '?'} anos</div>
                    </div>
                </div>
            `).join('');
        }
    } catch (e) { console.error('Error loading members:', e); }
}

async function deleteMember(id) {
    const confirmed = await showConfirmModal('Excluir Membro', 'Tem certeza que deseja excluir este membro? Esta ação não pode ser desfeita.');
    if (!confirmed) return;
    try {
        const res = await fetch(`${API_URL}/members/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
            loadCadastros();
            loadDashboard();
        } else {
            alert('Erro: ' + (result.error || 'Falha ao excluir'));
        }
    } catch (e) { alert('Erro ao excluir membro'); }
}

// Teams (Equipes)
async function loadTeams() {
    try {
        const res = await fetch(`${API_URL}/teams`);
        const teams = await res.json();

        const list = document.getElementById('teamList');
        if (teams.length === 0) {
            list.innerHTML = '<p style="color:#666; text-align:center;">Nenhuma equipe registrada.</p>';
            return;
        }

        list.innerHTML = teams.map(t => `
            <div class="team-card" style="display:block;">
                <button class="btn-delete" onclick="deleteTeam(${t.id})"><i class="fas fa-trash"></i></button>
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <strong style="color:var(--primary); font-size:1.1rem;">${t.name}</strong>
                    <small style="color:var(--text-muted);">Líder Geral: ${t.general_leader_name || 'N/A'}</small>
                </div>
                <div style="font-size:0.9rem; color:var(--text-muted);">
                    <strong>Sub-líderes:</strong> ${[t.sub1_name, t.sub2_name, t.sub3_name].filter(Boolean).join(', ')}
                </div>
                <div style="margin-top:8px; font-size:0.85rem; color:var(--text-muted);">
                    <strong>Membros:</strong> ${t.members.length ? t.members.join(', ') : 'Nenhum'}
                </div>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}

async function deleteTeam(id) {
    const confirmed = await showConfirmModal('Excluir Equipe', 'Tem certeza que deseja excluir esta equipe? Todos os membros serão desvinculados.');
    if (!confirmed) return;
    try {
        const res = await fetch(`${API_URL}/teams/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
            loadCadastros();
        } else {
            alert('Erro: ' + (result.error || 'Falha ao excluir'));
        }
    } catch (e) { alert('Erro ao excluir equipe'); }
}

// Trainings

async function loadTrainings() {
    currentFolderId = null;
    document.getElementById('trainingBreadcrumb').innerHTML = '<span onclick="loadTrainings()" style="cursor:pointer; color:var(--primary); font-weight:bold;">Pastas</span>';

    // Load watch progress
    if (currentUser) {
        try {
            const wpRes = await fetch(`${API_URL}/watch-progress/${currentUser.id}`);
            const wpData = await wpRes.json();
            userWatchProgress = {};
            wpData.forEach(wp => { userWatchProgress[wp.training_id] = wp; });
        } catch (e) { console.error('Watch progress load error:', e); }
    }

    try {
        const [resF, resT] = await Promise.all([
            fetch(`${API_URL}/folders`),
            fetch(`${API_URL}/trainings`)
        ]);
        const folders = await resF.json();
        const allTrainings = await resT.json();

        // Items in root (no folder)
        const rootItems = allTrainings.filter(t => !t.folder_id);

        const grid = document.getElementById('trainingFolders');
        grid.innerHTML = '';

        // Render Folders
        folders.forEach(f => {
            const itemCount = allTrainings.filter(t => t.folder_id === f.id).length;
            grid.innerHTML += `
                <div class="folder-card">
                    <button class="btn-delete" onclick="event.stopPropagation(); deleteFolder(${f.id})" title="Excluir pasta">
                        <i class="fas fa-trash"></i>
                    </button>
                    <div onclick="openFolder(${f.id}, '${f.name.replace(/'/g, "\\'")}')" style="cursor:pointer;">
                        <div class="folder-icon"><i class="fas fa-folder"></i></div>
                        <h3>${f.name}</h3>
                        <p style="color:#aaa; font-size:0.9rem;">${itemCount} itens</p>
                    </div>
                </div>
            `;
        });

        // Render Root Items
        rootItems.forEach(t => {
            grid.innerHTML += createVideoCard(t);
        });

    } catch (e) { console.error(e); }
}

async function openFolder(folderId, folderName) {
    currentFolderId = folderId;
    document.getElementById('trainingBreadcrumb').innerHTML = `
        <span onclick="loadTrainings()" style="cursor:pointer; color:#aaa;">Pastas</span> 
        <span style="color:#666;">/</span> 
        <span style="color:var(--primary); font-weight:bold;">${folderName}</span>
    `;

    try {
        const res = await fetch(`${API_URL}/trainings`);
        const allTrainings = await res.json();
        const items = allTrainings.filter(t => t.folder_id === folderId);

        const grid = document.getElementById('trainingFolders');
        if (items.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#666;">Pasta vazia.</p>';
        } else {
            grid.innerHTML = items.map(t => createVideoCard(t)).join('');
        }
    } catch (e) { console.error(e); }
}

function createVideoCard(video) {
    const isYouTube = video.type === 'youtube';
    const icon = isYouTube ? 'fab fa-youtube' : 'fas fa-link';
    const color = isYouTube ? '#ff0000' : 'var(--primary)';

    // Watch progress badge
    const wp = userWatchProgress[video.id];
    let progressBadge = '';
    if (wp && wp.total_seconds > 0) {
        const pct = Math.min(100, Math.round((wp.watched_seconds / wp.total_seconds) * 100));
        const badgeColor = wp.completed ? 'var(--primary)' : 'var(--secondary)';
        const badgeIcon = wp.completed ? 'fa-check-circle' : 'fa-clock';
        progressBadge = `
            <div class="watch-badge" style="background:${badgeColor}">
                <i class="fas ${badgeIcon}"></i> ${pct}%
            </div>
        `;
    }

    const watchBtn = `<button onclick="event.stopPropagation(); window.openVideoPlayer(${video.id}, '${video.title.replace(/'/g, "\\'")}', '${video.url.replace(/'/g, "\\'")}', '${(video.description || '').replace(/'/g, "\\'")}', '${video.type}')" class="btn-primary" style="display:inline-block; margin-top:10px; padding:6px 15px; font-size:0.8rem; border:none; cursor:pointer;">
        <i class="fas fa-play"></i> Assistir ${isYouTube ? '(YouTube)' : '(Arquivo)'}
      </button>`;

    return `
        <div class="folder-card video-card">
            ${progressBadge}
            <button class="btn-delete" onclick="event.stopPropagation(); deleteTraining(${video.id})" title="Excluir vídeo">
                <i class="fas fa-trash"></i>
            </button>
            <div class="folder-icon" style="color: ${color}"><i class="${icon}"></i></div>
            <h3>${video.title}</h3>
            <p style="color:#aaa; font-size:0.85rem; margin-top:5px; height: 32px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                ${video.description || 'Sem descrição'}
            </p>
            ${watchBtn}
        </div>
    `;
}

// Video card helper removed and integrated or kept as is

window.toggleTrainingType = () => {
    const type = document.getElementById('tTypeDisp').value;
    document.getElementById('urlGroupDisp').style.display = type === 'youtube' ? 'block' : 'none';
    document.getElementById('fileGroupDisp').style.display = type === 'file' ? 'block' : 'none';
};

window.showTrainingForm = () => {
    document.getElementById('trainingsGridView').style.display = 'none';
    document.getElementById('folderFormView').style.display = 'none';
    document.getElementById('trainingFormView').style.display = 'block';
    document.getElementById('trainingFormDisplay').reset();
    toggleTrainingType();
};

window.hideTrainingForms = () => {
    document.getElementById('folderFormView').style.display = 'none';
    document.getElementById('trainingFormView').style.display = 'none';
    document.getElementById('trainingsGridView').style.display = 'block';
};

window.createFolder = async (e) => {
    if (e) e.preventDefault();
    const name = document.getElementById('fNameDisp').value;
    if (!name) return;

    try {
        const res = await fetch(`${API_URL}/folders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (res.ok) {
            hideTrainingForms();
            loadTrainings();
        } else {
            const data = await res.json();
            alert(data.error || 'Erro ao criar pasta');
        }
    } catch (e) { alert('Erro ao criar pasta'); }
};

document.getElementById('trainingFormDisplay').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('title', document.getElementById('tTitleDisp').value);
    formData.append('type', document.getElementById('tTypeDisp').value);
    formData.append('folder_id', currentFolderId || '');
    formData.append('description', document.getElementById('tDescDisp').value);

    if (formData.get('type') === 'youtube') {
        formData.append('url', document.getElementById('tUrlDisp').value);
    } else {
        const fileInput = document.getElementById('tFileInputDisp');
        if (fileInput.files[0]) {
            formData.append('file', fileInput.files[0]);
        } else {
            return alert('Selecione um arquivo.');
        }
    }

    try {
        const res = await fetch(`${API_URL}/trainings`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            hideTrainingForms();
            loadTrainings();
        } else {
            alert(data.error || 'Erro ao salvar treinamento');
        }
    } catch (e) { alert('Erro ao salvar treinamento'); }
};

// Update existing function to be global if needed
window.openFolder = openFolder;
window.deleteMember = deleteMember;
window.deleteTeam = deleteTeam;

// Navigation View Handlers (Cadastros tab)
let memberPage = 1;
let teamPage = 1;
const PAGE_SIZE = 5;
let cadTeams = [];

// Photo Upload Logic
window.triggerPhotoUpload = (e) => {
    if (e) e.stopPropagation();
    document.getElementById('memberPhotoInput').click();
};

window.handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = document.getElementById('photoImg');
            img.src = e.target.result;
            img.style.display = 'block';
            document.querySelector('.photo-circle i').style.display = 'none';
            // Update state classes
            const actions = document.getElementById('photoActionsHover');
            actions.classList.remove('is-empty');
            actions.classList.add('is-full');
        }
        reader.readAsDataURL(file);
    }
};

window.viewPhoto = (e) => {
    if (e) e.stopPropagation();
    const img = document.getElementById('photoImg');
    if (img.src) {
        // Simple view for now, could be a modal
        const win = window.open("");
        win.document.write('<img src="' + img.src + '" style="max-width:100vh; max-height:100vh; margin:auto; display:block;">');
    }
};

// Team Photo Upload Logic
window.triggerTeamPhotoUpload = (e) => {
    if (e) e.stopPropagation();
    document.getElementById('teamPhotoInput').click();
};

window.handleTeamPhotoSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (ev) {
            const img = document.getElementById('teamPhotoImg');
            img.src = ev.target.result;
            img.style.display = 'block';
            const icon = document.querySelector('#teamPhotoPreview > i');
            if (icon) icon.style.display = 'none';
        }
        reader.readAsDataURL(file);
    }
};

window.showMemberForm = () => {
    document.getElementById('cadastrosMainView').style.display = 'none';
    document.getElementById('memberFormView').style.display = 'block';
    document.getElementById('teamFormView').style.display = 'none';

    // Reset form
    document.getElementById('memberFormDisplay').reset();
    document.getElementById('mIdDisp').value = '';

    // Reset photo state
    document.getElementById('photoImg').src = '';
    document.getElementById('photoImg').style.display = 'none';
    const photoIcon = document.querySelector('.photo-circle i');
    if (photoIcon) photoIcon.style.display = 'block';

    // Set initial hover state (Empty)
    const actions = document.getElementById('photoActionsHover');
    if (actions) {
        actions.classList.remove('is-full', 'has-photo');
        actions.classList.add('is-empty');
    }

    // Populate Sectors Select
    loadSectors().then(() => {
        const sectorSelect = document.getElementById('mSectorDisp');
        sectorSelect.innerHTML = '<option value="">Selecionar Setor</option>';
        allSectors.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.name;
            opt.textContent = s.name;
            sectorSelect.appendChild(opt);
        });
    });

    if (window.toggleCpfFieldDisp) window.toggleCpfFieldDisp();
};

window.closeMemberRegistration = () => {
    showTab('members');
};

// Sector Form Logic
window.showSectorForm = async () => {
    document.getElementById('cadastrosMainView').style.display = 'none';
    document.getElementById('memberFormView').style.display = 'none';
    document.getElementById('teamFormView').style.display = 'none';
    document.getElementById('sectorFormView').style.display = 'block';

    document.getElementById('sectorFormDisplay').reset();
    await loadSectors();
    renderSectorTable();
};

window.hideSectorForm = () => {
    document.getElementById('sectorFormView').style.display = 'none';
    document.getElementById('cadastrosMainView').style.display = 'block';
};

document.getElementById('sectorFormDisplay').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('sectorNameInput').value;
    try {
        const res = await fetch(`${API_URL}/sectors`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (!res.ok) throw new Error('Erro ao salvar setor');
        showToast('Setor salvo com sucesso!', 'success');
        document.getElementById('sectorNameInput').value = '';
        await loadSectors();
        renderSectorTable();
        loadCadastros();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

function renderSectorTable() {
    const tbody = document.getElementById('sectorTableBody');
    if (!tbody) return;

    if (allSectors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" class="empty-state">Nenhum setor cadastrado</td></tr>';
        return;
    }

    tbody.innerHTML = allSectors.map(s => `
        <tr id="sector-row-${s.id}">
            <td>${s.name}</td>
            <td style="text-align:right;">
                <button class="btn-icon-danger" id="btn-del-sector-${s.id}" onclick="deleteSector(${s.id})" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

let deleteConfirmTimeout = null;
let lastDeleteId = null;

window.deleteSector = async (id) => {
    const btn = document.getElementById(`btn-del-sector-${id}`);
    const row = document.getElementById(`sector-row-${id}`);

    if (lastDeleteId !== id) {
        // First click: arm for deletion
        if (lastDeleteId && document.getElementById(`btn-del-sector-${lastDeleteId}`)) {
            // Reset previous arming
            const prevBtn = document.getElementById(`btn-del-sector-${lastDeleteId}`);
            const prevRow = document.getElementById(`sector-row-${lastDeleteId}`);
            if (prevBtn) prevBtn.style.background = '';
            if (prevRow) prevRow.style.backgroundColor = '';
        }

        lastDeleteId = id;
        if (btn) btn.style.background = 'var(--danger)';
        if (row) row.style.backgroundColor = 'rgba(220, 53, 69, 0.05)';
        showToast('Clique novamente para confirmar a exclusão', 'info');

        if (deleteConfirmTimeout) clearTimeout(deleteConfirmTimeout);
        deleteConfirmTimeout = setTimeout(() => {
            if (lastDeleteId === id) {
                if (btn) btn.style.background = '';
                if (row) row.style.backgroundColor = '';
                lastDeleteId = null;
            }
        }, 3000);
        return;
    }

    // Second click: execute deletion
    try {
        const res = await fetch(`${API_URL}/sectors/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Erro ao excluir setor');
        showToast('Setor excluído com sucesso!', 'success');
        lastDeleteId = null;
        await loadSectors();
        renderSectorTable();
        loadCadastros();
    } catch (e) { showToast(e.message, 'error'); }
};

let allSectors = [];
// Helper to add Leader Row
window.addLeaderRow = (memberId = '', role = 'assistant', priority = 0) => {
    const container = document.getElementById('leadersContainer');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'role-row'; // Reuse same styling as the scale rows

    // Member Select
    const memberSelect = document.createElement('select');
    memberSelect.className = 'role-member-select';
    memberSelect.innerHTML = `<option value="">Selecionar Membro...</option>` +
        allMembers.map(m => `<option value="${m.id}" ${m.id == memberId ? 'selected' : ''}>${m.name}</option>`).join('');

    // Role Select
    const roleSelect = document.createElement('select');
    roleSelect.className = 'leader-role-select';
    roleSelect.innerHTML = `
        <option value="general" ${role === 'general' ? 'selected' : ''}>Líder Geral</option>
        <option value="assistant" ${role === 'assistant' ? 'selected' : ''}>Auxiliar</option>
        <option value="coordinator" ${role === 'coordinator' ? 'selected' : ''}>Coordenador</option>
    `;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.innerHTML = '&times;';
    removeBtn.className = 'btn-remove-row';
    removeBtn.onclick = () => row.remove();

    row.appendChild(memberSelect);
    row.appendChild(roleSelect);
    row.appendChild(removeBtn);
    container.appendChild(row);
};

// ... existing code ...
async function loadSectors() {
    try {
        const res = await fetch(`${API_URL}/sectors`);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const data = await res.json();
        allSectors = Array.isArray(data) ? data : [];
    } catch (e) {
        console.error('Error loading sectors:', e);
        allSectors = [];
    }
}

// Alias for backward compatibility
window.hideMemberForm = window.closeMemberRegistration;

window.showTeamForm = async () => {
    document.getElementById('cadastrosMainView').style.display = 'none';
    document.getElementById('memberFormView').style.display = 'none';
    document.getElementById('sectorFormView').style.display = 'none';
    document.getElementById('teamFormView').style.display = 'block';

    document.getElementById('teamFormDisplay').reset();
    document.getElementById('tmIdDisp').value = '';

    try {
        await Promise.all([loadMembers(), loadSectors()]);
    } catch (e) { console.error('Error refreshing team form data:', e); }

    const options = `<option value="">Selecione...</option>` + allMembers.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    ['tmGeneralDisp', 'tmSub1Disp', 'tmSub2Disp', 'tmSub3Disp'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = options;
    });

    const sectorSelect = document.getElementById('tSectorDisp');
    if (sectorSelect) {
        sectorSelect.innerHTML = '<option value="">Selecione o Setor...</option>' +
            allSectors.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    }

    document.getElementById('subdivisionsContainerDisp').innerHTML = '';
    window.addSubdivisionRow();
};

window.hideTeamForm = () => {
    document.getElementById('teamFormView').style.display = 'none';
    document.getElementById('cadastrosMainView').style.display = 'block';
    loadCadastros();
};

// Cadastros dashboard loader
async function loadCadastros() {
    try {
        const [membersRes, teamsRes, leadersRes, birthdaysRes, genderRes, sectorsRes, rolesRes] = await Promise.all([
            fetch(`${API_URL}/members`).catch(() => ({ ok: false })),
            fetch(`${API_URL}/teams`).catch(() => ({ ok: false })),
            fetch(`${API_URL}/stats/leaders`).catch(() => ({ ok: false })),
            fetch(`${API_URL}/birthdays/today`).catch(() => ({ ok: false })),
            fetch(`${API_URL}/stats/gender`).catch(() => ({ ok: false })),
            fetch(`${API_URL}/sectors`).catch(() => ({ ok: false })),
            fetch(`${API_URL}/roles`).catch(() => ({ ok: false })),
        ]);

        allMembers = membersRes.ok ? await membersRes.json() : [];
        cadTeams = teamsRes.ok ? await teamsRes.json() : [];
        const leadersData = leadersRes.ok ? await leadersRes.json() : { count: 0 };
        const birthdaysData = birthdaysRes.ok ? await birthdaysRes.json() : [];
        const genderData = genderRes.ok ? await genderRes.json() : { male: 0, female: 0 };
        const sectorsData = sectorsRes.ok ? await sectorsRes.json() : [];
        const rolesData = rolesRes.ok ? await rolesRes.json() : [];

        // Stats
        document.getElementById('cadStatMembers').textContent = allMembers.length;
        document.getElementById('cadStatTeams').textContent = cadTeams.length;
        document.getElementById('cadStatLeaders').textContent = leadersData.count;
        document.getElementById('cadStatBirthdays').textContent = birthdaysData.length;

        // Update Sectors & Functions counts dynamically
        const setoresEl = document.getElementById('cadStatSetores');
        if (setoresEl) setoresEl.textContent = sectorsData.length;
        const setoresEl2 = document.getElementById('cadStatSetores2');
        if (setoresEl2) setoresEl2.textContent = sectorsData.length;
        const funcoesEl = document.getElementById('cadStatFuncoes');
        if (funcoesEl) funcoesEl.textContent = rolesData.length;

        // Store sectors globally
        allSectors = sectorsData;

        // Render Gender Chart
        renderGenderChart(genderData);

        // Render tables
        renderMemberTable(allMembers);
        renderTeamTable(cadTeams);

    } catch (e) { console.error('loadCadastros error:', e); }
}

function renderGenderChart(data) {
    const ctx = document.getElementById('cadGenderChart').getContext('2d');
    if (window.cadGenderChartInstance) {
        window.cadGenderChartInstance.destroy();
    }

    // Simple bar chart: Male vs Female
    window.cadGenderChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Homens', 'Mulheres'],
            datasets: [{
                label: 'Membros',
                data: [data.male, data.female],
                backgroundColor: ['#36A2EB', '#FF6384'],
                borderWidth: 0,
                barThickness: 20
            }]
        },
        options: {
            response: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { display: false },
                x: { grid: { display: false }, ticks: { font: { size: 10 } } }
            },
            layout: { padding: 0 }
        }
    });
}

function renderMemberTable(members) {
    const searchVal = (document.getElementById('cadastroSearch')?.value || '').toLowerCase();
    let filtered = members;
    if (searchVal) {
        filtered = members.filter(m =>
            (m.name || '').toLowerCase().includes(searchVal) ||
            (m.phone || '').toLowerCase().includes(searchVal)
        );
    }

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (memberPage > totalPages) memberPage = totalPages;
    const start = (memberPage - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(start, start + PAGE_SIZE);

    const tbody = document.getElementById('memberTableBody');
    if (pageItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhum membro cadastrado</td></tr>';
    } else {
        tbody.innerHTML = pageItems.map(m => {
            const initial = m.name ? m.name.charAt(0).toUpperCase() : '?';
            const sector = m.sector || 'Nenhum';
            const role = m.role || 'Membro';
            return `<tr>
                <td>
                    <div class="member-row-info">
                        <div class="member-avatar-sm">${initial}</div>
                        <div>
                            <strong>${m.name}</strong>
                            <small>${m.phone || 'sem telefone'}</small>
                        </div>
                    </div>
                </td>
                <td>${sector}</td>
                <td>${role}</td>
                <td>
                    <button class="btn-icon" onclick="editMember(${m.id})" title="Editar" style="color:var(--primary); margin-right:5px;"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon-danger" onclick="deleteMember(${m.id})" title="Excluir"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        }).join('');
    }

    // Count info
    const showStart = total === 0 ? 0 : start + 1;
    const showEnd = Math.min(start + PAGE_SIZE, total);
    document.getElementById('memberCountInfo').textContent = `Mostrando ${showStart} de ${total} resultados`;
    document.getElementById('memberCountBottom').textContent = `Mostrando ${showStart} de ${total} resultados`;

    // Pagination
    const pagEl = document.getElementById('memberPagination');
    pagEl.innerHTML = renderPagination(memberPage, totalPages, 'changeMemberPage');
}

function renderTeamTable(teams) {
    const total = teams.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (teamPage > totalPages) teamPage = totalPages;
    const start = (teamPage - 1) * PAGE_SIZE;
    const pageItems = teams.slice(start, start + PAGE_SIZE);

    const tbody = document.getElementById('teamTableBody');
    if (pageItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum setor cadastrado</td></tr>';
    } else {
        tbody.innerHTML = pageItems.map(t => {
            const subCount = t.subdivisions ? t.subdivisions.length : 0;
            return `<tr>
                <td><strong>${t.name}</strong></td>
                <td>${t.name}</td>
                <td>${subCount} subdivisões</td>
                <td><span class="status-badge active">Ativo</span></td>
                <td>
                    <button class="btn-icon" onclick="editTeam(${t.id})" title="Editar" style="color:var(--primary); margin-right:5px;"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon-danger" onclick="deleteTeam(${t.id})" title="Excluir"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        }).join('');
    }

    document.getElementById('teamCountBottom').textContent = total === 0 ? 'Nenhum setor cadastrado' : `Mostrando ${Math.min(start + 1, total)}-${Math.min(start + PAGE_SIZE, total)} de ${total}`;

    const pagEl = document.getElementById('teamPagination');
    pagEl.innerHTML = renderPagination(teamPage, totalPages, 'changeTeamPage');
}

function renderPagination(current, totalPages, funcName) {
    if (totalPages <= 1) return '';
    let html = `<button class="pag-btn" onclick="${funcName}(${current - 1})" ${current <= 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="pag-btn ${i === current ? 'active' : ''}" onclick="${funcName}(${i})">${i}</button>`;
    }
    html += `<button class="pag-btn" onclick="${funcName}(${current + 1})" ${current >= totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
    return html;
}

window.changeMemberPage = (p) => { memberPage = p; renderMemberTable(allMembers); };
window.changeTeamPage = (p) => { teamPage = p; renderTeamTable(cadTeams); };
window.filterCadastros = () => { memberPage = 1; renderMemberTable(allMembers); };

window.showFolderForm = () => {
    document.getElementById('trainingsGridView').style.display = 'none';
    document.getElementById('trainingFormView').style.display = 'none';
    document.getElementById('folderFormView').style.display = 'block';
    document.getElementById('trainingActions').style.display = 'none';
    document.getElementById('btnBackToTrainings').style.display = 'block';
    document.getElementById('folderFormDisplay').reset();
};

window.showTrainingForm = () => {
    document.getElementById('trainingsGridView').style.display = 'none';
    document.getElementById('folderFormView').style.display = 'none';
    document.getElementById('trainingFormView').style.display = 'block';
    document.getElementById('trainingActions').style.display = 'none';
    document.getElementById('btnBackToTrainings').style.display = 'block';

    // Populate folders list
    const datalist = document.getElementById('folderListDisp');
    const folders = Array.from(document.querySelectorAll('.folder-card:not(.video-card)')).map(f => f.querySelector('h3').textContent);
    datalist.innerHTML = folders.map(f => `<option value="${f}">`).join('');

    document.getElementById('trainingFormDisplay').reset();
};

window.hideTrainingForms = () => {
    document.getElementById('folderFormView').style.display = 'none';
    document.getElementById('trainingFormView').style.display = 'none';
    document.getElementById('trainingsGridView').style.display = 'block';
    document.getElementById('trainingActions').style.display = 'flex';
    document.getElementById('btnBackToTrainings').style.display = 'none';
};

// Member View Handlers (hideMemberForm is defined above as alias for closeMemberRegistration)

window.toggleCpfFieldDisp = () => {
    const isForeigner = document.getElementById('mIsForeignerDisp').value === 'true';
    const cpfGroup = document.getElementById('cpfGroupDisp');
    if (isForeigner) {
        cpfGroup.style.display = 'none';
        document.getElementById('mCpfDisp').value = '';
        document.getElementById('mCpfDisp').required = false;
    } else {
        cpfGroup.style.display = 'block';
        document.getElementById('mCpfDisp').required = true;
    }
};

window.addSubdivisionRow = (data = null) => {
    const container = document.getElementById('subdivisionsContainerDisp');
    const row = document.createElement('div');
    row.className = 'subdivision-row-disp';
    row.style = 'display:grid; grid-template-columns: 2fr 1fr 1fr 40px; gap:10px; margin-bottom:10px; align-items:center; background:#f8fafc; padding:10px; border-radius:8px;';

    row.innerHTML = `
        <input type="text" class="sub-name" placeholder="Ex: Câmera" required value="${data ? data.name : ''}" style="padding:8px; border:1px solid #ddd; border-radius:6px;">
        <input type="number" class="sub-min" placeholder="Mín" required min="1" value="${data ? data.min_qty : 1}" style="padding:8px; border:1px solid #ddd; border-radius:6px;">
        <input type="number" class="sub-max" placeholder="Máx" required min="1" value="${data ? data.max_qty : 1}" style="padding:8px; border:1px solid #ddd; border-radius:6px;">
        <button type="button" class="btn-delete-row" onclick="this.parentElement.remove()" style="color:#ef4444; background:none; border:none; cursor:pointer;"><i class="fas fa-trash"></i></button>
    `;
    container.appendChild(row);
};

// Old modal handlers removed

// New Member Form Submission (View-based)
document.getElementById('memberFormDisplay').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Block if duplicate phone (if phone field exists in HTML, actually I removed it from personal fields grid in index.html to fix error, wait, I might have over-removed)
    const phoneField = document.getElementById('mPhoneDisp');
    if (phoneField && isDuplicatePhone) {
        phoneField.focus();
        phoneField.classList.add('shake-field');
        setTimeout(() => phoneField.classList.remove('shake-field'), 600);
        return;
    }

    console.log('Member registration submitted via display form');

    try {
        const id = document.getElementById('mIdDisp').value;
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_URL}/members/${id}` : `${API_URL}/members`;

        // Prepend country code for database
        const rawPhone = document.getElementById('mPhoneDisp') ? document.getElementById('mPhoneDisp').value : '';
        const countryCode = document.getElementById('mCountryCodeDisp') ? document.getElementById('mCountryCodeDisp').value : '+55';
        const formattedPhoneForDb = rawPhone ? `[${countryCode}] ${rawPhone}` : '';

        // Convert date DD/MM/AAAA to YYYY-MM-DD
        let birthDateDb = null;
        const birthDateInput = document.getElementById('mBirthDateDisp') ? document.getElementById('mBirthDateDisp').value : '';
        if (birthDateInput && birthDateInput.length === 10) {
            const parts = birthDateInput.split('/');
            if (parts.length === 3) {
                birthDateDb = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }

        const data = {
            name: document.getElementById('mNameDisp').value,
            phone: formattedPhoneForDb,
            birth_date: birthDateDb,
            gender: document.getElementById('mGenderDisp') ? document.getElementById('mGenderDisp').value : '',
            naturality: document.getElementById('mNaturalityDisp') ? document.getElementById('mNaturalityDisp').value : '',
            is_foreigner: document.getElementById('mIsForeignerDisp') ? document.getElementById('mIsForeignerDisp').value === 'true' : false,
            marital_status: document.getElementById('mMaritalDisp') ? document.getElementById('mMaritalDisp').value : '',
            education: document.getElementById('mEducationDisp') ? document.getElementById('mEducationDisp').value : '',
            profession: document.getElementById('mProfessionDisp') ? document.getElementById('mProfessionDisp').value : '',
            cpf: document.getElementById('mCpfDisp') ? document.getElementById('mCpfDisp').value : '',
            sector: document.getElementById('mSectorDisp') ? document.getElementById('mSectorDisp').value : '',
            age: 0,
            createAccess: document.getElementById('mCreateAccessDisp') ? document.getElementById('mCreateAccessDisp').checked : false,
            email: document.getElementById('mUserEmailDisp') ? document.getElementById('mUserEmailDisp').value : '',
            password: document.getElementById('mUserPasswordDisp') ? document.getElementById('mUserPasswordDisp').value : '',
            userRole: document.getElementById('mUserRoleDisp') ? document.getElementById('mUserRoleDisp').value : 'volunteer'
        };

        // Auto-calc age
        if (data.birth_date) {
            const birth = new Date(data.birth_date);
            const today = new Date();
            let age = today.getFullYear() - birth.getFullYear();
            const m = today.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
            data.age = age;
        }

        // Helper to validate password locally if creating access
        if (data.createAccess && !id) { // Only on create for now, or if password field is filled
            if (data.password) {
                const pErr = validatePassword(data.password);
                if (pErr) {
                    alert('Senha fraca: ' + pErr);
                    return;
                }
            }
        }

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error || `Server error: ${res.status}`);

        alert(id ? 'Membro atualizado com sucesso!' : 'Membro cadastrado com sucesso!');
        closeMemberRegistration();
        loadCadastros();
        loadDashboard();
    } catch (err) {
        console.error('Registration Error:', err);
        alert('Erro ao salvar cadastro: ' + err.message);
    }
});

function validatePassword(password) {
    if (password.length < 8) return "Senha muito curta (mínimo 8 caracteres).";
    if (!/[A-Z]/.test(password)) return "Senha deve conter pelo menos uma letra maiúscula.";
    if (!/[a-z]/.test(password)) return "Senha deve conter pelo menos uma letra minúscula.";
    if (!/[0-9]/.test(password)) return "Senha deve conter pelo menos um número.";
    if (!/[@$!%*#?&]/.test(password)) return "Senha deve conter pelo menos um caractere especial (@$!%*#?&).";
    return null;
}

// Edit Member Function
window.editMember = async (id) => {
    // Must look up member data. 
    // We can rely on 'allMembers' cache if available, or fetch specific.
    // Ideally fetch specific to get latest details.
    try {
        // If allMembers is empty, fetch it first or fetch single.
        // Let's iterate allMembers for now since we have it. 
        // NOTE: loadMembers() updates allMembers global.
        if (allMembers.length === 0) await loadMembers();
        const member = allMembers.find(m => m.id == id);
        if (!member) throw new Error('Membro não encontrado locally');

        // Populate fields
        document.getElementById('mIdDisp').value = member.id; // SET HIDDEN ID
        document.getElementById('mNameDisp').value = member.name;

        // Phone parsing: [Code] Number
        if (member.phone && member.phone.startsWith('[')) {
            const closing = member.phone.indexOf(']');
            if (closing > -1) {
                const country = member.phone.substring(1, closing);
                const num = member.phone.substring(closing + 1).trim();
                document.getElementById('mCountryCodeDisp').value = country;
                document.getElementById('mPhoneDisp').value = num;
            } else {
                document.getElementById('mPhoneDisp').value = member.phone;
            }
        } else {
            document.getElementById('mPhoneDisp').value = member.phone;
        }

        // DOB: YYYY-MM-DD to DD/MM/AAAA
        if (member.birth_date) {
            const parts = member.birth_date.split('-');
            if (parts.length === 3) {
                document.getElementById('mBirthDateDisp').value = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
        } else {
            document.getElementById('mBirthDateDisp').value = '';
        }

        if (document.getElementById('mGenderDisp')) document.getElementById('mGenderDisp').value = member.gender || '';
        if (document.getElementById('mNaturalityDisp')) document.getElementById('mNaturalityDisp').value = member.naturality || '';
        if (document.getElementById('mIsForeignerDisp')) {
            document.getElementById('mIsForeignerDisp').value = member.is_foreigner ? 'true' : 'false';
            toggleCpfFieldDisp();
        }
        if (document.getElementById('mMaritalDisp')) document.getElementById('mMaritalDisp').value = member.marital_status || '';
        if (document.getElementById('mEducationDisp')) document.getElementById('mEducationDisp').value = member.education || '';
        if (document.getElementById('mProfessionDisp')) document.getElementById('mProfessionDisp').value = member.profession || '';
        if (document.getElementById('mCpfDisp')) document.getElementById('mCpfDisp').value = member.cpf || '';
        if (document.getElementById('mSectorDisp')) document.getElementById('mSectorDisp').value = member.sector || '';

        // Open the member form view
        const view = document.getElementById('memberFormView');
        if (view) {
            view.style.display = 'block';
            const mainView = document.getElementById('cadastrosMainView');
            if (mainView) mainView.style.display = 'none';
        }

    } catch (e) {
        console.error(e);
        alert('Erro ao carregar dados do membro.');
    }
};

// Helper Functions
window.toggleCpfField = () => {
    const isForeigner = document.getElementById('mIsForeigner').value === 'true';
    const cpfGroup = document.getElementById('cpfGroup');
    if (isForeigner) {
        cpfGroup.style.display = 'none';
        document.getElementById('mCpf').value = '';
        document.getElementById('mCpf').required = false;
    } else {
        cpfGroup.style.display = 'block';
        document.getElementById('mCpf').required = true;
    }
};

// Logs Logic
window.loadLogs = async () => {
    try {
        const res = await fetch(`${API_URL}/logs`);
        const logs = await res.json();

        const list = document.getElementById('logsList');
        if (logs.length === 0) {
            list.innerHTML = '<p style="text-align:center; color:#666;">Nenhum log registrado.</p>';
            return;
        }

        list.innerHTML = logs.map(log => `
            <div class="team-card" style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <span style="display:inline-block; padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:bold; background:${getActionColor(log.action)}; color:white; margin-right:8px;">
                        ${log.action}
                    </span>
                    <strong>${log.target_type}: ${log.target_name || 'N/A'}</strong>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">
                        ${new Date(log.created_at).toLocaleString('pt-BR')}
                    </div>
                </div>
                <div style="font-size:0.8rem; color:#666; max-width:40%;">
                    ${formatDetails(log.details)}
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('Logs Error:', e);
        document.getElementById('logsList').innerHTML = '<p>Erro ao carregar logs.</p>';
    }
};

function getActionColor(action) {
    if (action === 'CREATE') return 'var(--success)';
    if (action === 'DELETE') return 'var(--danger)';
    if (action === 'UPDATE') return 'var(--primary)';
    return '#666';
}

function formatDetails(details) {
    if (!details) return '';
    try {
        const d = typeof details === 'string' ? JSON.parse(details) : details;
        if (typeof d !== 'object') return String(d);
        return Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(', ');
    } catch (e) { return String(details); }
}

// Input Masks
document.addEventListener('DOMContentLoaded', () => {
    // Phone and Date Formatting
    setupPhoneFormatting('mPhoneDisp', 'mCountryCodeDisp');
    setupDateFormatting('mBirthDateDisp');

    // CPF Mask
    const cpfInput = document.getElementById('mCpfDisp');
    if (cpfInput) {
        cpfInput.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, "");
            if (v.length > 11) v = v.substring(0, 11);
            v = v.replace(/(\d{3})(\d)/, "$1.$2");
            v = v.replace(/(\d{3})(\d)/, "$1.$2");
            v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
            e.target.value = v;
        });
    }
});

// Team Form Submit
document.getElementById('teamFormDisplay').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('tmIdDisp').value;
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/teams/${id}` : `${API_URL}/teams`;

    const payload = {
        name: document.getElementById('tmNameDisp').value,
        area: document.getElementById('tmNameDisp').value,
        sector_id: document.getElementById('tSectorDisp').value || null,
        general_leader_id: document.getElementById('tmGeneralDisp').value || null,
        sub_leader1_id: document.getElementById('tmSub1Disp').value || null,
        sub_leader2_id: document.getElementById('tmSub2Disp').value || null,
        sub_leader3_id: document.getElementById('tmSub3Disp').value || null,
        subdivisions: []
    };

    // Collect subdivisions
    const subRows = document.querySelectorAll('.subdivision-row-disp');
    subRows.forEach((row) => {
        const name = row.querySelector('.sub-name').value;
        const min = parseInt(row.querySelector('.sub-min').value);
        const max = parseInt(row.querySelector('.sub-max').value);
        if (name) {
            payload.subdivisions.push({ name, min_qty: min, max_qty: max });
        }
    });

    try {
        const res = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Erro ao salvar equipe');
        alert('Equipe salva com sucesso!');
        hideTeamForm();
        loadTeams(); // Assuming this should still be called
        loadDashboard(); // Assuming this should still be called
    } catch (e) {
        alert(e.message);
    }
});

// Edit Team Function
window.editTeam = async (id) => {
    try {
        const res = await fetch(`${API_URL}/teams/${id}`);
        const team = await res.json();

        await showTeamForm(); // Setup form

        document.getElementById('tmIdDisp').value = team.id;
        // Set area (which is the select) — use team.area first, fallback to team.name
        const areaSelect = document.getElementById('tmNameDisp');
        const areaValue = team.area || team.name || '';
        // Try to set the option. If not found, select will just stay on empty.
        areaSelect.value = areaValue;
        // If the value wasn't matched (e.g. old team name), keep it readable
        if (!areaSelect.value && areaValue) {
            const opt = document.createElement('option');
            opt.value = areaValue;
            opt.textContent = areaValue;
            areaSelect.appendChild(opt);
            areaSelect.value = areaValue;
        }
        document.getElementById('tSectorDisp').value = team.sector_id || '';

        // Load Leaders
        document.getElementById('tmGeneralDisp').value = '';
        ['tmSub1Disp', 'tmSub2Disp', 'tmSub3Disp'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        if (team.leaders && team.leaders.length > 0) {
            let subIdx = 1;
            team.leaders.forEach(l => {
                if (l.role === 'general') {
                    document.getElementById('tmGeneralDisp').value = l.member_id;
                } else if (l.role === 'assistant' || l.role === 'coordinator') {
                    if (subIdx <= 3) {
                        document.getElementById(`tmSub${subIdx}Disp`).value = l.member_id;
                        subIdx++;
                    }
                }
            });
        }

        // Load legacy photo if exists
        if (team.photo_url) {
            document.getElementById('teamPhotoImg').src = team.photo_url;
            document.getElementById('teamPhotoImg').style.display = 'block';
            document.getElementById('teamPhotoPreview').querySelector('.fa-user').style.display = 'none';
        }

        // Load Team Subdivisions
        const container = document.getElementById('subdivisionsContainerDisp');
        container.innerHTML = '';
        if (team.subdivisions && team.subdivisions.length > 0) {
            team.subdivisions.forEach(s => {
                addSubdivisionRow(s);
            });
        } else {
            addSubdivisionRow();
        }
    } catch (e) {
        console.error(e);
        alert('Erro ao carregar equipe: ' + e.message);
    }
};


// Folders and Trainings logic handled above in view-based functions

// Ensure DOM is ready before attaching events and auto-login
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);

    if (localStorage.getItem('shema_user')) {
        currentUser = JSON.parse(localStorage.getItem('shema_user'));
        initApp();
    }
});

// ========================================
// YouTube IFrame API Integration
// ========================================

// Load YouTube IFrame API
const ytTag = document.createElement('script');
ytTag.src = 'https://www.youtube.com/iframe_api';
document.head.appendChild(ytTag);

function extractYouTubeId(url) {
    if (!url) return null;
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/
    ];
    for (const p of patterns) {
        const match = url.match(p);
        if (match) return match[1];
    }
    return null;
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

window.openVideoPlayer = function (videoId, title, url, description, type) {
    currentVideoData = { id: videoId, title, url, description, type };
    accumulatedWatchTime = 0;

    const wp = userWatchProgress[videoId];
    if (wp) accumulatedWatchTime = wp.watched_seconds || 0;

    document.getElementById('trainingsGridView').style.display = 'none';
    document.getElementById('folderFormView').style.display = 'none';
    document.getElementById('trainingFormView').style.display = 'none';
    document.getElementById('trainingActions').style.display = 'none';
    document.getElementById('trainingBreadcrumb').style.display = 'none';
    document.getElementById('btnBackToTrainings').style.display = 'none';
    document.getElementById('videoPlayerView').style.display = 'block';

    document.getElementById('videoPlayerTitle').textContent = title;
    document.getElementById('videoPlayerDescription').textContent = description || 'Sem descrição';

    if (ytPlayer) { ytPlayer.destroy(); ytPlayer = null; }
    const container = document.getElementById('youtubePlayer');

    if (type === 'file' || (!extractYouTubeId(url) && url.includes('.'))) {
        const videoUrl = url.startsWith('/') ? `${API_URL.replace('/api', '')}${url}` : url;
        container.innerHTML = `<video id="html5VideoPlayer" controls style="width:100%; height:100%; max-height: 500px; background:#000; border-radius:12px;">
            <source src="${videoUrl}" type="video/mp4">
            Seu navegador não suporta vídeos HTML5.
        </video>`;

        const vidNode = document.getElementById('html5VideoPlayer');
        vidNode.currentTime = accumulatedWatchTime;

        vidNode.addEventListener('loadedmetadata', () => {
            document.getElementById('videoTotalTime').textContent = formatTime(vidNode.duration);
            updateProgressUI(accumulatedWatchTime, vidNode.duration);
        });

        vidNode.addEventListener('play', () => {
            stopWatchTracking();
            window.watchInterval = setInterval(() => {
                if (!vidNode) return;
                const cTime = vidNode.currentTime;
                const dur = vidNode.duration || 0;
                if (cTime > accumulatedWatchTime) accumulatedWatchTime = Math.floor(cTime);
                updateProgressUI(accumulatedWatchTime, dur);
                if (Math.floor(cTime) % 10 === 0) saveWatchProgress(false);
            }, 1000);
        });

        vidNode.addEventListener('pause', () => { stopWatchTracking(); saveWatchProgress(false); });
        vidNode.addEventListener('ended', () => { stopWatchTracking(); saveWatchProgress(true); });
    } else {
        const ytId = extractYouTubeId(url);
        if (!ytId) {
            container.innerHTML = '<p style="color:var(--danger); text-align:center; padding:40px;">URL de vídeo inválida.</p>';
            return;
        }
        if (window.YT && window.YT.Player) {
            createYTPlayer(ytId);
        } else {
            window.onYouTubeIframeAPIReady = () => createYTPlayer(ytId);
        }
    }
};

function createYTPlayer(videoId) {
    ytPlayer = new YT.Player('youtubePlayer', {
        width: '100%',
        height: '100%',
        videoId: videoId,
        playerVars: {
            autoplay: 1,
            rel: 0,
            modestbranding: 1,
            origin: window.location.origin
        },
        events: {
            onStateChange: onPlayerStateChange,
            onReady: onPlayerReady
        }
    });
}

function onPlayerReady(event) {
    const duration = ytPlayer.getDuration();
    document.getElementById('videoTotalTime').textContent = formatTime(duration);
    updateProgressUI(accumulatedWatchTime, duration);
    startWatchTracking();
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        startWatchTracking();
    } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
        stopWatchTracking();
        saveWatchProgress(event.data === YT.PlayerState.ENDED);
    }
}

function startWatchTracking() {
    stopWatchTracking(); // Clear any existing
    watchInterval = setInterval(() => {
        if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return;

        const currentTime = ytPlayer.getCurrentTime();
        const duration = ytPlayer.getDuration();

        // Track the maximum reached time
        if (currentTime > accumulatedWatchTime) {
            accumulatedWatchTime = Math.floor(currentTime);
        }

        updateProgressUI(accumulatedWatchTime, duration);

        // Auto-save every 10 seconds
        if (Math.floor(currentTime) % 10 === 0) {
            saveWatchProgress(false);
        }
    }, 1000);
}

function stopWatchTracking() {
    if (watchInterval) {
        clearInterval(watchInterval);
        watchInterval = null;
    }
}

function updateProgressUI(watched, total) {
    if (total <= 0) return;
    const pct = Math.min(100, Math.round((watched / total) * 100));
    document.getElementById('videoProgressBar').style.width = pct + '%';
    document.getElementById('videoWatchedTime').textContent = formatTime(watched);
    document.getElementById('videoTotalTime').textContent = formatTime(total);
    document.getElementById('videoProgressPercent').textContent = pct + '% assistido';

    // Color transition
    const bar = document.getElementById('videoProgressBar');
    if (pct >= 90) {
        bar.style.background = 'var(--primary)';
    } else if (pct >= 50) {
        bar.style.background = 'linear-gradient(90deg, var(--secondary), var(--primary))';
    }
}

async function saveWatchProgress(completed) {
    if (!currentUser || !currentVideoData) return;
    let duration = 0;
    if (ytPlayer && typeof ytPlayer.getDuration === 'function') {
        duration = ytPlayer.getDuration();
    } else {
        const vidNode = document.getElementById('html5VideoPlayer');
        if (vidNode) duration = vidNode.duration;
    }

    try {
        await fetch(`${API_URL}/watch-progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                training_id: currentVideoData.id,
                watched_seconds: Math.floor(accumulatedWatchTime),
                total_seconds: Math.floor(duration),
                completed: completed || (accumulatedWatchTime / duration >= 0.9)
            })
        });

        // Update local cache
        userWatchProgress[currentVideoData.id] = {
            training_id: currentVideoData.id,
            watched_seconds: Math.floor(accumulatedWatchTime),
            total_seconds: Math.floor(duration),
            completed: completed || (accumulatedWatchTime / duration >= 0.9) ? 1 : 0
        };
    } catch (e) { console.error('Save watch progress error:', e); }
}

window.closeVideoPlayer = function () {
    stopWatchTracking();
    // Save final progress BEFORE clearing state
    if (currentVideoData) {
        saveWatchProgress(false);
    }

    // Destroy player
    if (ytPlayer) {
        ytPlayer.destroy();
        ytPlayer = null;
    }
    document.getElementById('youtubePlayer').innerHTML = '';

    const savedFolderId = currentFolderId;
    currentVideoData = null;
    accumulatedWatchTime = 0;

    // Restore views
    document.getElementById('videoPlayerView').style.display = 'none';
    document.getElementById('trainingsGridView').style.display = 'block';
    document.getElementById('trainingActions').style.display = 'flex';
    document.getElementById('trainingBreadcrumb').style.display = 'block';

    // Reload to show updated progress badges
    if (savedFolderId) {
        const breadcrumb = document.getElementById('trainingBreadcrumb').querySelector('span:last-child');
        const folderName = breadcrumb ? breadcrumb.textContent : '';
        openFolder(savedFolderId, folderName);
    } else {
        loadTrainings();
    }
};

// ========================================
// Delete Handlers (Custom Confirm Modal)
// ========================================

function showConfirmModal(title, message) {
    return new Promise((resolve) => {
        document.getElementById('confirmModalTitle').textContent = title;
        document.getElementById('confirmModalMessage').textContent = message;
        document.getElementById('confirmModal').style.display = 'flex';

        const confirmBtn = document.getElementById('confirmModalConfirm');
        const cancelBtn = document.getElementById('confirmModalCancel');

        const cleanup = () => {
            document.getElementById('confirmModal').style.display = 'none';
            confirmBtn.replaceWith(confirmBtn.cloneNode(true));
            cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        };

        confirmBtn.addEventListener('click', () => { cleanup(); resolve(true); }, { once: true });
        cancelBtn.addEventListener('click', () => { cleanup(); resolve(false); }, { once: true });
    });
}

window.deleteFolder = async function (id) {
    const confirmed = await showConfirmModal(
        'Excluir Pasta',
        'Tem certeza que deseja excluir esta pasta e todos os vídeos dentro dela?'
    );
    if (!confirmed) return;
    try {
        const res = await fetch(`${API_URL}/folders/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
            loadTrainings();
        } else {
            alert('Erro: ' + (result.error || 'Falha ao excluir'));
        }
    } catch (e) { alert('Erro ao excluir pasta'); }
};

window.deleteTraining = async function (id) {
    const confirmed = await showConfirmModal(
        'Excluir Vídeo',
        'Tem certeza que deseja excluir este vídeo?'
    );
    if (!confirmed) return;
    try {
        const res = await fetch(`${API_URL}/trainings/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
            if (currentFolderId) {
                const breadcrumb = document.getElementById('trainingBreadcrumb').querySelector('span:last-child');
                const folderName = breadcrumb ? breadcrumb.textContent : '';
                openFolder(currentFolderId, folderName);
            } else {
                loadTrainings();
            }
        } else {
            alert('Erro: ' + (result.error || 'Falha ao excluir'));
        }
    } catch (e) { alert('Erro ao excluir vídeo'); }
};

// ========================================
// Real-time WhatsApp Duplicate Validation
// ========================================

// ========================================
// Phone and Date Formatting Utilities
// ========================================

/**
 * Formats a phone number string: [+DDD] (XX) X XXXX-XXXX
 */
function formatPhoneNumber(value, countryCode) {
    if (!value) return '';

    // Remote all non-digits
    let digits = value.replace(/\D/g, '');

    let formatted = '';

    if (digits.length > 0) {
        formatted += `(${digits.substring(0, 2)}`;
    }
    if (digits.length > 2) {
        formatted += `) ${digits.substring(2, 3)}`;
    }
    if (digits.length > 3) {
        formatted += ` ${digits.substring(3, 7)}`;
    }
    if (digits.length > 7) {
        formatted += `-${digits.substring(7, 11)}`;
    }

    return formatted;
}

/**
 * Setup real-time formatting for a phone input
 */
function setupPhoneFormatting(inputId, countrySelectId) {
    const input = document.getElementById(inputId);
    const select = document.getElementById(countrySelectId);

    if (!input || !select) return;

    const applyFormatting = () => {
        let cursorPosition = input.selectionStart;
        let oldLength = input.value.length;

        // Extract raw digits
        let rawDigits = input.value.replace(/\D/g, '');

        const countryCode = select.value;
        const newFormatted = formatPhoneNumber(rawDigits, countryCode);

        input.value = newFormatted;

        // Adjust cursor position if typing (rudimentary)
        let diff = newFormatted.length - oldLength;
        if (diff !== 0) {
            input.setSelectionRange(cursorPosition + diff, cursorPosition + diff);
        }

        // --- Duplicate Check Logic ---
        const tooltip = document.getElementById('phoneTooltip');
        const tooltipText = document.getElementById('phoneTooltipText');

        clearTimeout(phoneCheckTimer);

        if (rawDigits.length < 8) {
            isDuplicatePhone = false;
            input.classList.remove('field-error');
            if (tooltip) tooltip.style.display = 'none';
            return;
        }

        phoneCheckTimer = setTimeout(async () => {
            try {
                // Check using the raw digits (excluding the country code prefix for now, 
                // or we could include it if the backend handles it. 
                // Given the user saves it as [+55] ..., maybe we should check the full string?
                // But the backend usually checks the number itself.
                const res = await fetch(`${API_URL}/members/check-phone/${encodeURIComponent(rawDigits)}`);
                const data = await res.json();

                if (data.exists) {
                    isDuplicatePhone = true;
                    input.classList.add('field-error');
                    if (tooltipText) tooltipText.textContent = `WhatsApp já cadastrado para: ${data.memberName}`;
                    if (tooltip) tooltip.style.display = 'flex';
                } else {
                    isDuplicatePhone = false;
                    input.classList.remove('field-error');
                    if (tooltip) tooltip.style.display = 'none';
                }
            } catch (e) {
                console.error('Phone check error:', e);
            }
        }, 500);
    };

    input.addEventListener('input', applyFormatting);
    select.addEventListener('change', applyFormatting);
}

/**
 * Setup auto-skip for date segments (DD/MM/AAAA)
 */
function setupDateFormatting(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.addEventListener('input', function (e) {
        let value = this.value.replace(/\D/g, '');
        let formatted = '';

        if (value.length > 0) {
            formatted += value.substring(0, 2);
            if (value.length >= 2 && e.inputType !== 'deleteContentBackward') {
                if (value.length === 2) formatted += '/';
                else {
                    formatted += '/' + value.substring(2, 4);
                    if (value.length >= 4 && e.inputType !== 'deleteContentBackward') {
                        if (value.length === 4) formatted += '/';
                        else {
                            formatted += '/' + value.substring(4, 8);
                        }
                    }
                }
            } else if (value.length > 2) {
                formatted += '/' + value.substring(2, 4);
                if (value.length > 4) {
                    formatted += '/' + value.substring(4, 8);
                }
            }
        }

        this.value = formatted;
    });
}

// ========================================
// Team Calendar
// ========================================

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

async function loadTeamCalendar() {
    document.getElementById('calendarMonthLabel').textContent = `${MONTH_NAMES[calendarMonth - 1]} ${calendarYear}`;
    try {
        const res = await fetch(`${API_URL}/team-events?year=${calendarYear}&month=${calendarMonth}`);
        const events = await res.json();
        renderCalendar(calendarYear, calendarMonth, events);
    } catch (e) {
        console.error('Load calendar error:', e);
    }
}

function renderCalendar(year, month, events) {
    const grid = document.getElementById('calendarGrid');
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

    // Group events by day
    const eventsByDay = {};
    events.forEach(ev => {
        const d = parseInt(ev.event_date.split('-')[2]);
        if (!eventsByDay[d]) eventsByDay[d] = [];
        eventsByDay[d].push(ev);
    });

    let html = '';
    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="calendar-day other-month"></div>';
    }

    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = isCurrentMonth && d === today.getDate();
        const dayEvents = eventsByDay[d] || [];

        html += `<div class="calendar-day${isToday ? ' today' : ''}">`;
        html += `<span class="day-number">${d}</span>`;
        html += `<div class="event-indicators">`;
        dayEvents.forEach(ev => {
            const statusClass = `status-${ev.status || 'pending'}`;
            html += `<div class="event-capsule ${statusClass}" onclick="openEventSidePanel(${ev.id})">${ev.event_name}</div>`;
        });
        html += `</div></div>`;
    }

    grid.innerHTML = html;
}

window.changeMonth = function (delta) {
    calendarMonth += delta;
    if (calendarMonth > 12) { calendarMonth = 1; calendarYear++; }
    if (calendarMonth < 1) { calendarMonth = 12; calendarYear--; }

    // Reset side panel to empty state
    document.getElementById('sidePanelHeader').innerHTML = `
        <h3>Selecione um evento</h3>
        <p style="font-size:0.8rem; color:var(--text-muted);">Clique em um evento no calendário para gerenciar as escalas.</p>
    `;
    document.getElementById('sidePanelContent').innerHTML = `
        <div class="side-panel-empty">
            <i class="fas fa-calendar-day"></i>
            <p>Nenhum evento selecionado</p>
        </div>
    `;
    document.getElementById('sidePanelActions').style.display = 'none';

    loadTeamCalendar();
};

let currentEventId = null;

window.openEventSidePanel = async function (eventId) {
    currentEventId = eventId;
    const content = document.getElementById('sidePanelContent');
    const header = document.getElementById('sidePanelHeader');
    const actions = document.getElementById('sidePanelActions');

    content.innerHTML = '<div style="padding:20px; text-align:center;"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
    actions.style.display = 'block';

    try {
        const res = await fetch(`${API_URL}/team-events/${eventId}`);
        if (!res.ok) throw new Error('Falha ao carregar evento');
        const event = await res.json();

        header.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                    <h3 style="margin:0;">${event.event_name}</h3>
                    <p style="font-size:0.8rem; color:var(--text-muted); margin:4px 0;">
                        <i class="fas fa-clock"></i> ${event.event_time} | <i class="fas fa-calendar-alt"></i> ${event.event_date}
                    </p>
                </div>
                <div style="display:flex; gap:5px;">
                    <button class="btn-icon" onclick="editTeamEvent(${event.id})" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon-danger" onclick="deleteEvent(${event.id})" title="Excluir"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;

        await renderScaleContent(eventId);

        // Event Form
    } catch (e) {
        content.innerHTML = `<div class="error">Erro: ${e.message}</div>`;
    }
};

window.renderScaleContent = async function (eventId) {
    const content = document.getElementById('sidePanelContent');
    try {
        const res = await fetch(`${API_URL}/team-events/${eventId}/scales`);
        const scales = await res.json();

        let totalMin = 0;
        let totalAssigned = 0;
        scales.forEach(s => {
            s.subdivisions.forEach(sub => {
                totalMin += sub.min_qty;
                totalAssigned += sub.assignments ? sub.assignments.length : 0;
            });
        });

        const progressPercent = totalMin > 0 ? Math.min(100, Math.round((totalAssigned / totalMin) * 100)) : 0;

        let html = `
            <div class="progress-container">
                <div class="progress-label">
                    <span>Ocupação da Escala</span>
                    <span>${progressPercent}%</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${progressPercent}%"></div>
                </div>
            </div>
            <div class="accordion" id="teamsAccordion">
        `;

        if (scales.length === 0) {
            html += '<p style="text-align:center; color:var(--text-muted); padding:30px;">Nenhuma equipe vinculada.</p>';
        } else {
            const STATUS_LABELS = { complete: 'COMPLETO', partial: 'PARCIAL', pending: 'PENDENTE', critical: 'CRÍTICO' };
            scales.forEach(s => {
                const statusClass = (s.status || 'pending').toLowerCase();
                const statusLabel = STATUS_LABELS[statusClass] || statusClass.toUpperCase();
                html += `
                    <div class="accordion-item" id="accordion-team-${s.team_id}">
                        <div class="accordion-header" onclick="this.parentElement.classList.toggle('active')">
                            <h4><i class="fas fa-users"></i> ${s.team_name}</h4>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <span class="status-badge ${statusClass}">${statusLabel}</span>
                                <i class="fas fa-chevron-down"></i>
                            </div>
                        </div>
                        <div class="accordion-content">
                            <div class="sub-scales-list">
                                ${s.subdivisions.map(sub => `
                                    <div class="sub-scale-item">
                                        <div class="sub-scale-header">
                                            <span class="sub-scale-title">${sub.name}</span>
                                            <span class="sub-scale-count">${sub.assignments ? sub.assignments.length : 0}/${sub.min_qty}</span>
                                        </div>
                                        <div class="sub-scale-members">
                                            ${(sub.assignments || []).map(a => `
                                                <div class="member-chip">
                                                    ${a.member_name}
                                                    <i class="fas fa-times-circle btn-remove-member" onclick="removeAssignment(${eventId}, ${s.team_id}, ${sub.id}, ${a.member_id})"></i>
                                                </div>
                                            `).join('')}
                                        </div>
                                        <button class="btn-add-member-sub" onclick="showMemberPicker(${eventId}, ${s.team_id}, ${sub.id})">
                                            <i class="fas fa-plus"></i> Escalar membro
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                            <button class="btn-danger-outline full-width" style="margin-top:12px;" onclick="removeTeamFromScale(${eventId}, ${s.team_id})">
                                <i class="fas fa-unlink"></i> Desconectar Equipe
                            </button>
                        </div>
                    </div>
                `;
            });
        }
        html += '</div>';
        content.innerHTML = html;

        // Update Team Select
        const teamsRes = await fetch(`${API_URL}/teams`);
        const allTeams = await teamsRes.json();
        const connectedIds = scales.map(s => s.team_id);
        const teamSelect = document.getElementById('addTeamToEventSelect');
        if (teamSelect) {
            teamSelect.innerHTML = '<option value="">Conectar Equipe...</option>' +
                allTeams.filter(t => !connectedIds.includes(t.id))
                    .map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        }

    } catch (e) {
        content.innerHTML = `<div class="error">Erro ao carregar escalas: ${e.message}</div>`;
    }
};

window.addTeamToCurrentEventScale = async function () {
    if (!currentEventId) return;
    const teamId = document.getElementById('addTeamToEventSelect').value;
    if (!teamId) return;

    try {
        const res = await fetch(`${API_URL}/team-events/${currentEventId}/scales`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ team_id: parseInt(teamId) })
        });
        if (!res.ok) throw new Error('Erro ao conectar equipe');
        await renderScaleContent(currentEventId);
        loadTeamCalendar();
    } catch (e) { alert(e.message); }
};

window.removeTeamFromScale = async function (eventId, teamId) {
    if (!confirm('Desconectar esta equipe perderá todas as escalas feitas. Continuar?')) return;
    try {
        const res = await fetch(`${API_URL}/team-events/${eventId}/scales/${teamId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Erro ao desconectar');
        await renderScaleContent(eventId);
        loadTeamCalendar();
    } catch (e) { alert(e.message); }
};

window.showMemberPicker = async function (eventId, teamId, subId) {
    const modal = document.getElementById('teamMembersModal');
    const titleEl = document.getElementById('teamModalTitle');
    const bodyEl = document.getElementById('teamModalBody');

    titleEl.textContent = 'Selecionar Membro para Escala';
    bodyEl.innerHTML = '<div style="padding:20px; text-align:center;"><i class="fas fa-spinner fa-spin"></i> Carregando membros...</div>';
    modal.style.display = 'flex';

    try {
        const res = await fetch(`${API_URL}/members`);
        const members = await res.json();

        bodyEl.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:8px;">
                ${members.map(m => `
                    <div class="team-member-item" onclick="confirmMemberAssignment(${eventId}, ${teamId}, ${subId}, ${m.id}, '${m.name.replace(/'/g, "\\'")}')" style="cursor:pointer; border:1px solid #eee; padding:10px; border-radius:8px;">
                        <span class="team-member-name">${m.name}</span>
                        <i class="fas fa-chevron-right" style="color:#ccc;"></i>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (e) { alert('Erro ao carregar membros'); }
};

window.confirmMemberAssignment = async function (eventId, teamId, subId, memberId, memberName) {
    try {
        const res = await fetch(`${API_URL}/team-events/${eventId}/scales/${teamId}/assignments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subdivision_id: subId, member_id: memberId })
        });
        if (!res.ok) throw new Error('Erro ao realizar escala');
        document.getElementById('teamMembersModal').style.display = 'none';
        await renderScaleContent(eventId);
        loadTeamCalendar();
    } catch (e) { alert(e.message); }
};

window.removeAssignment = async function (eventId, teamId, subId, memberId) {
    if (!confirm('Remover este membro da escala?')) return;
    try {
        const res = await fetch(`${API_URL}/team-events/${eventId}/scales/${teamId}/assignments?subdivision_id=${subId}&member_id=${memberId}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Erro ao remover');
        await renderScaleContent(eventId);
        loadTeamCalendar();
    } catch (e) { alert(e.message); }
};

window.deleteEvent = async function (id) {
    const confirmed = await showConfirmModal('Excluir Evento', 'Tem certeza que deseja excluir este evento?');
    if (!confirmed) return;
    try {
        const res = await fetch(`${API_URL}/team-events/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
            loadTeamCalendar();
            document.getElementById('sidePanelHeader').innerHTML = '<h3>Selecione um evento</h3>';
            document.getElementById('sidePanelContent').innerHTML = '<div class="side-panel-empty"><i class="fas fa-calendar-day"></i><p>Nenhum evento selecionado</p></div>';
            document.getElementById('sidePanelActions').style.display = 'none';
        } else {
            throw new Error(result.error || 'Erro ao excluir');
        }
    } catch (e) { alert(e.message); }
};

window.closeTeamModal = function () {
    document.getElementById('teamMembersModal').style.display = 'none';
};
window.showEventForm = async function () {
    console.log('Exibindo formulário de evento...');
    document.getElementById('calendarView').style.display = 'none';
    document.getElementById('eventFormView').style.display = 'block';
    document.getElementById('btnNewEvent').style.display = 'none';
    document.getElementById('btnBackToCalendar').style.display = 'block';

    document.getElementById('eventFormDisplay').reset();
    document.getElementById('evId').value = '';

    // Setup Date Formatting
    setupDateFormatting('evDate');
    setupDateFormatting('evRecEnd');

    selectedRecurrence = 'none';
    document.querySelectorAll('.rec-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.rec-btn[data-rec="none"]').classList.add('active');
    document.getElementById('recurrenceDetails').style.display = 'none';
};

window.hideEventForm = function () {
    document.getElementById('eventFormView').style.display = 'none';
    document.getElementById('calendarView').style.display = 'block';
    document.getElementById('btnNewEvent').style.display = 'block';
    document.getElementById('btnBackToCalendar').style.display = 'none';
    loadTeamCalendar();
};

window.setRecurrence = function (type) {
    selectedRecurrence = type;
    document.querySelectorAll('.rec-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.rec-btn[data-rec="${type}"]`).classList.add('active');

    if (type === 'none') {
        document.getElementById('recurrenceDetails').style.display = 'none';
    } else {
        document.getElementById('recurrenceDetails').style.display = 'block';
        document.getElementById('recIntervalGroup').style.display = type === 'custom' ? 'block' : 'none';
    }
};

// Roles support removed for simplified event flow


// Event Form Submit
document.getElementById('eventFormDisplay').addEventListener('submit', async (e) => {
    e.preventDefault();

    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const id = document.getElementById('evId').value;
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/team-events/${id}` : `${API_URL}/team-events`;

    // Client-side validation
    const evTime = document.getElementById('evTime').value;
    const evDate = document.getElementById('evDate').value;
    const evRecEnd = document.getElementById('evRecEnd').value;

    const timeRegex = /^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(evTime)) {
        showToast('Horário inválido. Use o formato HH:MM (ex: 19:00)', 'error');
        return;
    }

    if (!evDate || evDate.length !== 10) {
        showToast('Data de início inválida.', 'error');
        return;
    }

    if (selectedRecurrence !== 'none') {
        if (!evRecEnd || evRecEnd.length !== 10) {
            showToast('Informe a data final da recorrência.', 'error');
            return;
        }
    }

    // Format dates from DD/MM/AAAA to YYYY-MM-DD
    const formatDateForDb = (val) => {
        if (!val || val.length !== 10) return val;
        const parts = val.split('/');
        return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : val;
    };

    const data = {
        event_name: document.getElementById('evName').value,
        event_time: evTime,
        event_date: formatDateForDb(evDate),
        recurrence_type: selectedRecurrence,
        recurrence_interval: selectedRecurrence === 'custom' ? parseInt(document.getElementById('evRecInterval').value) || 7 : 0,
        recurrence_end: selectedRecurrence !== 'none' ? formatDateForDb(evRecEnd) : null
    };

    try {
        submitBtn.disabled = true;
        const originalText = submitBtn.textContent;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if (!res.ok) throw new Error(result.error || 'Erro ao salvar');

        showToast(id ? 'Evento atualizado com sucesso!' : (result.totalEvents > 1
            ? `${result.totalEvents} eventos criados com sucesso!`
            : 'Evento criado com sucesso!'), 'success');

        hideEventForm();
        loadTeamCalendar(); // Refresh calendar
    } catch (e) {
        console.error(e);
        showToast(e.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = id ? 'Salvar Evento' : 'Salvar Evento'; // Reset to default text
    }
});

// Edit Event Function
window.editTeamEvent = async (id, eventData) => {
    try {
        // If eventData not provided (e.g. called from side panel), fetch it
        if (!eventData) {
            const res = await fetch(`${API_URL}/team-events/${id}`);
            if (!res.ok) throw new Error('Evento não encontrado');
            eventData = await res.json();
        }

        await showEventForm();

        // Format date for display (YYYY-MM-DD to DD/MM/AAAA)
        const formatDateForDisplay = (val) => {
            if (!val || val.length !== 10) return val;
            const parts = val.split('-');
            return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : val;
        };

        document.getElementById('evId').value = id;
        document.getElementById('evName').value = eventData.event_name;
        document.getElementById('evTime').value = eventData.event_time;
        document.getElementById('evDate').value = formatDateForDisplay(eventData.event_date);

        if (eventData.recurrence_end) {
            document.getElementById('evRecEnd').value = formatDateForDisplay(eventData.recurrence_end);
        } else {
            document.getElementById('evRecEnd').value = '';
        }

        // Recurrence display
        setRecurrence(eventData.recurrence_type || 'none');
        if (eventData.recurrence_type === 'custom') {
            document.getElementById('evRecInterval').value = eventData.recurrence_interval || 7;
        }

    } catch (e) {
        console.error(e);
        showToast('Erro ao carregar evento para edição', 'error');
    }
};

async function loadAvailabilitySummary(eventId) {
    try {
        const res = await fetch(`${API_URL}/team-events/${eventId}/availability-summary`);
        const data = await res.json();

        document.getElementById('availability-summary-panel').style.display = 'block';
        document.getElementById('summ-total').textContent = data.total;
        document.getElementById('summ-yes').textContent = data.yes;
        document.getElementById('summ-maybe').textContent = data.maybe;
        document.getElementById('summ-no').textContent = data.no;
        document.getElementById('summ-none').textContent = data.unresponsive;
    } catch (e) { console.error('Summary error', e); }
}

// Ensure YouTube API callback is available globally
window.onYouTubeIframeAPIReady = window.onYouTubeIframeAPIReady || function () { };

// ========================================
// User Dashboard / Availability
// ========================================

window.changeAvailabilityMonth = (delta) => {
    availabilityMonth += delta;
    if (availabilityMonth > 12) { availabilityMonth = 1; availabilityYear++; }
    if (availabilityMonth < 1) { availabilityMonth = 12; availabilityYear--; }
    loadAvailabilityCalendar();
};

async function loadAvailabilityCalendar() {
    const monthTitle = document.getElementById('availabilityMonthTitle');
    const calendarGrid = document.getElementById('availabilityCalendar');
    if (!monthTitle || !calendarGrid) return;

    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    monthTitle.textContent = `${months[availabilityMonth - 1]} ${availabilityYear}`;

    calendarGrid.innerHTML = '<div class="loading">Carregando...</div>';

    try {
        // 1. Fetch Events
        const resEvents = await fetch(`${API_URL}/team-events?year=${availabilityYear}&month=${availabilityMonth}`);
        const events = await resEvents.json();

        // 2. Fetch User Availabilities (linked to member)
        let availabilities = [];
        if (currentUser.linked_member_id) {
            const resAvail = await fetch(`${API_URL}/availabilities/${currentUser.linked_member_id}?year=${availabilityYear}&month=${availabilityMonth}`);
            availabilities = await resAvail.json();
            userAvailabilities = availabilities;
        }

        renderAvailabilityCalendar(events, availabilities);
    } catch (e) {
        console.error(e);
        calendarGrid.innerHTML = '<div class="error">Erro ao carregar calendário.</div>';
    }
}

function renderAvailabilityCalendar(events, availabilities) {
    const grid = document.getElementById('availabilityCalendar');
    grid.innerHTML = '';

    const firstDay = new Date(availabilityYear, availabilityMonth - 1, 1).getDay();
    const daysInMonth = new Date(availabilityYear, availabilityMonth, 0).getDate();

    // Days Header
    ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].forEach(day => {
        grid.innerHTML += `<div class="calendar-day-header">${day}</div>`;
    });

    // Empty spaces
    for (let i = 0; i < firstDay; i++) {
        grid.innerHTML += `<div class="calendar-day empty"></div>`;
    }

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${availabilityYear}-${String(availabilityMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayEvents = events.filter(e => e.event_date === dateStr);
        const dayAvail = availabilities.find(a => a.event_date === dateStr);

        let content = '';
        dayEvents.forEach(e => {
            content += `<div class="event-pill" style="font-size:10px; background:var(--primary-dark); margin:2px 0; border-radius:4px; padding:2px 4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${e.event_name}</div>`;
        });

        if (dayAvail) {
            content += `<div class="avail-indicator ${dayAvail.confirmed ? 'confirmed' : ''}" style="font-size:11px; color:var(--primary); margin-top:5px;">
                <i class="fas ${dayAvail.confirmed ? 'fa-check-circle' : 'fa-clock'}"></i> ${dayAvail.team_name || 'Alocado'}
            </div>`;
        }

        grid.innerHTML += `
            <div class="calendar-day ${dayEvents.length > 0 ? 'has-events' : ''} ${dayAvail ? 'has-avail' : ''}" onclick="openAvailabilityModal('${dateStr}')" style="min-height:80px; padding:5px; border:1px solid var(--border-color); cursor:pointer; position:relative;">
                <span class="day-number" style="font-weight:bold; font-size:14px;">${d}</span>
                <div class="day-content" style="margin-top:5px;">${content}</div>
            </div>
        `;
    }
}

let currentAvailDate = null;
window.openAvailabilityModal = async (dateStr) => {
    currentAvailDate = dateStr;
    const modal = document.getElementById('availabilityModal');
    const dateText = document.getElementById('availModalDate');
    const teamSelect = document.getElementById('availTeamSelect');

    const [y, m, d] = dateStr.split('-');
    dateText.textContent = `${d}/${m}/${y}`;

    // Load teams for selection
    try {
        const resTeams = await fetch(`${API_URL}/teams`);
        const teamsList = await resTeams.json();

        teamSelect.innerHTML = '<option value="">Nenhuma / Não posso servir</option>';
        teamsList.forEach(t => {
            teamSelect.innerHTML += `<option value="${t.id}">${t.name}</option>`;
        });

        // Pre-select current
        const existing = userAvailabilities.find(a => a.event_date === dateStr);
        if (existing) teamSelect.value = existing.team_id || "";
    } catch (e) { console.error(e); }

    modal.style.display = 'block';
};

window.closeAvailabilityModal = () => {
    document.getElementById('availabilityModal').style.display = 'none';
};

window.saveAvailability = async () => {
    if (!currentUser.linked_member_id) {
        alert('Seu usuário não está vinculado a um membro. Entre em contato com o admin.');
        return;
    }

    const teamId = document.getElementById('availTeamSelect').value;
    const payload = {
        member_id: currentUser.linked_member_id,
        event_date: currentAvailDate,
        team_id: teamId || null,
        confirmed: 0
    };

    try {
        const res = await fetch(`${API_URL}/availabilities`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            closeAvailabilityModal();
            loadAvailabilityCalendar();
        }
    } catch (e) { alert('Erro ao salvar disponibilidade.'); }
};

window.confirmAvailability = async () => {
    if (!currentUser.linked_member_id) return;
    alert('Suas seleções para este mês foram enviadas e confirmadas!');
};
// Event Listeners for Auth
document.getElementById('loginForm').addEventListener('submit', handleLogin);
document.getElementById('registerForm').addEventListener('submit', handleRegister);
document.getElementById('forgotForm').addEventListener('submit', handleForgot);
document.getElementById('resetForm').addEventListener('submit', handleReset);

let currentTeamId = null;

async function loadSubAdminTeam() {
    try {
        const res = await fetch(`${API_URL}/teams`);
        const teams = await res.json();
        const myTeam = teams.find(t => t.sub_leader1_id === currentUser.linked_member_id || t.general_leader_id === currentUser.linked_member_id);
        if (myTeam) {
            currentTeamId = myTeam.id;
            loadWhatsAppStatus();
        }
    } catch (e) { console.error(e); }
}

window.connectWhatsApp = async () => {
    const teamId = currentTeamId || document.getElementById('wa-team-select').value;
    if (!teamId) return alert('Selecione uma equipe primeiro.');

    const btn = document.getElementById('btn-wa-connect');
    btn.disabled = true;
    btn.textContent = 'Gerando QR...';

    try {
        const res = await fetch(`${API_URL}/whatsapp/connect/${teamId}`, { method: 'POST' });
        const data = await res.json();

        if (data.qrcode) {
            document.getElementById('wa-qr-container').style.display = 'block';
            document.getElementById('wa-qr-image').innerHTML = '';
            new QRCode(document.getElementById('wa-qr-image'), {
                text: data.qrcode,
                width: 256,
                height: 256
            });
            if (data.pairing_code) {
                document.getElementById('wa-pairing-code').textContent = `Código de Pareamento: ${data.pairing_code}`;
            }
            startStatusPolling(teamId);
        }
    } catch (e) {
        alert('Erro ao conectar: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Conectar WhatsApp';
    }
};

window.logoutWhatsApp = async () => {
    const teamId = currentTeamId || document.getElementById('wa-team-select').value;
    if (!teamId) return;
    if (!confirm('Deseja realmente desconectar o WhatsApp?')) return;
    try {
        await fetch(`${API_URL}/whatsapp/logout/${teamId}`, { method: 'DELETE' });
        loadWhatsAppStatus();
    } catch (e) { alert(e.message); }
};

async function checkWAStatusGlobal() {
    try {
        const res = await fetch(`${API_URL}/whatsapp/status-summary`);
        if (!res.ok) return;
        const data = await res.json();
        const dot = document.getElementById('wa-global-status-dot');
        if (dot) {
            dot.style.display = data.anyOffline ? 'block' : 'none';
        }
    } catch (e) {
        console.error('Global WA Check Error:', e);
    }
}

// Polling for global status every 30 seconds
setInterval(checkWAStatusGlobal, 30000);
document.addEventListener('DOMContentLoaded', checkWAStatusGlobal);

window.loadWhatsAppStatus = async () => {
    // This is now a generic function that can be used if needed
    // but connections.blade.php handles its own row-based status.
    checkWAStatusGlobal();
};

/* ==========================================================================
   Connections Module (WhatsApp Integration)
   ========================================================================== */

let allConnections = [];
let connectionPollingInterval = null;

async function loadConnectionsContent() {
    try {
        const res = await fetch(`${API_URL}/teams`);
        const teams = await res.json();

        const list = document.getElementById('connections-list');
        if (!list) return;

        list.innerHTML = '';
        allConnections = [];

        if (teams.length === 0) {
            list.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 40px;">Nenhuma equipe/líder encontrado.</td></tr>';
            return;
        }

        for (const team of teams) {
            if (team.leaders_data && team.leaders_data.length > 0) {
                // Sort by priority (1 = leader, 2 = sub1, etc.)
                const sortedLeaders = [...team.leaders_data].sort((a, b) => a.priority - b.priority);

                for (const leader of sortedLeaders) {
                    const label = leader.role === 'leader' ? 'Líder Geral' :
                        leader.role === 'sub1' ? 'Auxiliar 1' :
                            leader.role.charAt(0).toUpperCase() + leader.role.slice(1);

                    addConnectionRow(team, leader.role, `${leader.name} (${label})`, list);
                }
            } else {
                // Fallback for teams without dynamic leaders (should not happen after migration)
                if (team.general_leader_name || team.leader_name) {
                    addConnectionRow(team, 'leader', team.general_leader_name || team.leader_name, list);
                }
            }
        }
    } catch (e) {
        console.error('Failed to load connections', e);
    }
}

function addConnectionRow(team, role, displayName, list) {
    const connId = `${team.id}_${role}`;
    allConnections.push({ teamId: team.id, role: role });

    const tr = document.createElement('tr');
    tr.id = `conn-row-${connId}`;
    tr.innerHTML = `
        <td>${displayName}</td>
        <td><span class="conn-status-badge offline" id="status-badge-${connId}">Verificando...</span></td>
        <td style="text-align:right;">
            <span id="btn-group-${connId}">
                 <button class="btn-qr-small" onclick="handleRowConnect(${team.id}, '${role}')">Gerar QR Code</button>
            </span>
        </td>
    `;
    list.appendChild(tr);
    updateRowStatus(team.id, role);
}

async function updateRowStatus(teamId, role = 'leader') {
    const connId = `${teamId}_${role}`;
    try {
        const res = await fetch(`${API_URL}/whatsapp/status/${teamId}?role=${role}`);
        const data = await res.json();
        const badge = document.getElementById(`status-badge-${connId}`);
        const btnGroup = document.getElementById(`btn-group-${connId}`);

        if (!badge || !btnGroup) return;

        const isOnline = data.status === 'open' || data.status === 'connected';
        badge.className = 'conn-status-badge ' + (isOnline ? 'online' : 'offline');
        badge.textContent = isOnline ? 'Conectado' : 'Desconectado';

        if (isOnline) {
            btnGroup.innerHTML = `<button class="btn-qr-small" style="color:var(--danger);" onclick="handleWALogout(${teamId}, '${role}')">Desconectar</button>`;
        } else {
            // Only show Generate QR for Leader, not for Auxiliar (Sub1)
            btnGroup.innerHTML = `<button class="btn-qr-small" onclick="handleRowConnect(${teamId}, '${role}')">Gerar QR Code</button>`;
        }
    } catch (e) { console.error(e); }
}

window.handleRowConnect = async function(teamId, role = 'leader') {
    const connId = `${teamId}_${role}`;
    const badge = document.getElementById(`status-badge-${connId}`);
    if (badge && badge.textContent === 'Conectado') return;

    openQRModal();
    const display = document.getElementById('wa-qr-display');
    if (display) display.innerHTML = '<i class="fas fa-spinner fa-spin fa-2x"></i>';

    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

    try {
        const res = await fetch(`${API_URL}/whatsapp/connect/${teamId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrfToken || ''
            },
            body: JSON.stringify({ role: role })
        });
        const data = await res.json();

        if (data.error) throw new Error(data.error);

        if (data.qrcode) {
            let qrString = data.qrcode;

            // Validation: Ensure we have a string to work with
            if (typeof qrString !== 'string') {
                throw new Error('QR Code data invalid');
            }

            // Evolution API returns a base64 image. Check pattern.
            if (qrString.length > 200 || qrString.startsWith('data:image')) {
                if (!qrString.startsWith('data:image')) {
                    qrString = 'data:image/png;base64,' + qrString;
                }
                const container = document.getElementById('wa-qr-display');
                if (container) {
                    container.innerHTML = `<img src="${qrString}" style="width:256px;height:256px;object-fit:contain;" alt="WhatsApp QR Code">`;
                }
            } else if (qrString.trim() !== "") {
                // Short string = Pairing Code or raw text
                renderQRCode(qrString);
            } else {
                throw new Error('String de QR Code vazia');
            }

            const pairing = document.getElementById('wa-pairing-code');
            if (pairing) pairing.textContent = data.pairing_code || '';
            startConnectionPolling(teamId, role);
        } else {
            // Fallback if connected immediately
            if (data.status === 'open' || data.status === 'connected') {
                if (display) display.innerHTML = '<p style="color:var(--primary); font-weight:bold;">Conectado!</p>';
                setTimeout(() => {
                    closeQRModal();
                    updateRowStatus(teamId, role);
                }, 1500);
            } else {
                throw new Error('QR Code não recebido');
            }
        }
    } catch (e) {
        console.error('WhatsApp Connection Error:', e);
        alert('Erro ao conectar: ' + e.message);
        if (display) display.innerHTML = `<p style="color:var(--danger); font-size:0.9rem;">${e.message}</p>`;
    }
}

async function handleGlobalConnect() {
    const firstOffline = allConnections.find(c => {
        const connId = `${c.teamId}_${c.role}`;
        const badge = document.getElementById(`status-badge-${connId}`);
        return badge && badge.textContent === 'Desconectado';
    });
    if (firstOffline) {
        handleRowConnect(firstOffline.teamId, firstOffline.role);
    } else {
        alert('Todos os líderes estão conectados ou nenhuma equipe encontrada.');
    }
}

function renderQRCode(text) {
    const container = document.getElementById('wa-qr-display');
    if (!container || !text) return;

    try {
        container.innerHTML = '';
        new QRCode(container, {
            text: text,
            width: 256,
            height: 256,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    } catch (err) {
        console.error('QRCode Error:', err);
        container.innerHTML = '<p style="color:var(--danger);">Erro ao gerar QR Code: ' + err.message + '</p>';
    }
}

window.handleWALogout = async function(teamId, role = 'leader') {
    if (!confirm('Deseja realmente desconectar?')) return;
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    try {
        await fetch(`${API_URL}/whatsapp/logout/${teamId}?role=${role}`, {
            method: 'DELETE',
            headers: { 'X-CSRF-TOKEN': csrfToken }
        });
        // Force refresh
        setTimeout(() => updateRowStatus(teamId, role), 1000);
    } catch (e) { alert(e.message); }
}

// ========================================
// Shared Data Loaders
// ========================================

async function loadTeamsData() {
    try {
        // Cache busting with timestamp
        const res = await fetch(`${API_URL}/teams?t=${Date.now()}`);
        if (!res.ok) throw new Error('Falha ao buscar equipes: ' + res.statusText);
        allTeams = await res.json();
        console.log('loadTeamsData: Equipes obtidas do servidor:', allTeams.length);
        return allTeams;
    } catch (e) {
        console.error('loadTeamsData error:', e);
        alert('Erro de conexão: ' + e.message);
        allTeams = [];
        return [];
    }
}



function openQRModal() {
    const modal = document.getElementById('qrModal');
    if (modal) modal.classList.add('active');
}

function closeQRModal() {
    const modal = document.getElementById('qrModal');
    if (modal) modal.classList.remove('active');
    if (connectionPollingInterval) clearInterval(connectionPollingInterval);
}

function startConnectionPolling(teamId, role = 'leader') {
    if (connectionPollingInterval) clearInterval(connectionPollingInterval);
    connectionPollingInterval = setInterval(async () => {
        const res = await fetch(`${API_URL}/whatsapp/status/${teamId}?role=${role}`);
        const data = await res.json();
        if (data.status === 'open' || data.status === 'connected') {
            clearInterval(connectionPollingInterval);
            closeQRModal();
            updateRowStatus(teamId, role);
            checkWAStatusGlobal();
        }
    }, 5000);
}

function filterConnections() {
    const query = document.getElementById('connSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#connections-list tr');
    rows.forEach(row => {
        const nameCell = row.querySelector('td');
        if (nameCell) {
            const name = nameCell.textContent.toLowerCase();
            row.style.display = name.includes(query) ? '' : 'none';
        }
    });
}

// ===== MINHA CONTA FUNCTIONS =====

window.loadAccountPage = async function() {
    // Reset: show grid, hide detail views
    const overview = document.getElementById('account-overview');
    if (overview) overview.style.display = '';
    document.querySelectorAll('.account-detail-view').forEach(v => v.style.display = 'none');

    try {
        // Load user count for badge
        const usersRes = await fetch(`${API_URL}/users`);
        const usersData = await usersRes.json();
        const activeUsers = usersData.filter(u => u.status !== 'inactive').length || usersData.length;
        const ucEl = document.getElementById('account-user-count');
        if (ucEl) ucEl.textContent = activeUsers;

        // Load WhatsApp connection count
        const waRes = await fetch(`${API_URL}/whatsapp/instances`);
        const waData = await waRes.json();
        const connected = (waData || []).filter(i => i.status === 'connected').length;
        const ccEl = document.getElementById('account-conn-count');
        if (ccEl) ccEl.textContent = connected;
    } catch (e) {
        console.error('Account page load error:', e);
    }
}

window.showAccountSection = function(section) {
    console.log('Switching to account section:', section);
    const overview = document.getElementById('account-overview');
    if (overview) overview.style.display = 'none';
    document.querySelectorAll('.account-detail-view').forEach(v => v.style.display = 'none');
    
    const targetId = 'account-' + section;
    const target = document.getElementById(targetId);
    if (target) {
        target.style.display = 'block';
        console.log('Section visible:', targetId);
    } else {
        console.error('Target section not found:', targetId);
        showToast('Erro: Seção ' + section + ' não encontrada.', 'error');
    }

    // Load section data
    if (section === 'geral') loadAccountGeral();
    if (section === 'seguranca') loadAccountSeguranca();
    if (section === 'plano') loadAccountPlano();
    if (section === 'conexoes') loadAccountConexoes();
    if (section === 'usuarios') loadAccountUsuarios();
    if (section === 'preferencias') loadAccountPreferencias();
}

window.backToAccountGrid = function() {
    document.querySelectorAll('.account-detail-view').forEach(v => v.style.display = 'none');
    const overview = document.getElementById('account-overview');
    if (overview) overview.style.display = '';
}

window.filterAccountCards = function(value) {
    const q = value.toLowerCase();
    document.querySelectorAll('.account-card').forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(q) ? '' : 'none';
    });
}

// --- GERAL ---
window.loadAccountGeral = async function() {
    try {
        const res = await fetch(`${API_URL}/organization`);
        const org = await res.json();
        document.getElementById('org-name').value = org.name || '';
        document.getElementById('org-code').value = org.account_code || '';
        document.getElementById('org-created').value = org.created_at ? new Date(org.created_at).toLocaleDateString('pt-BR') : '';
        document.getElementById('org-email').value = org.contact_email || '';
        document.getElementById('org-phone').value = org.phone || '';
        document.getElementById('org-address').value = org.address || '';
        document.getElementById('org-responsible').value = org.responsible || '';

        // Status
        const badge = document.getElementById('org-status-badge');
        if (badge) {
            badge.innerHTML = org.status === 'active'
                ? '<span class="badge badge-green"><i class="fas fa-check-circle"></i> Ativa</span>'
                : '<span class="badge badge-red"><i class="fas fa-times-circle"></i> Suspensa</span>';
        }

        // Logo
        const preview = document.getElementById('org-logo-preview');
        if (preview) {
            if (org.logo_path) {
                preview.innerHTML = `<img src="${org.logo_path}" alt="Logo">`;
            } else {
                preview.innerHTML = '<i class="fas fa-image" style="font-size:2rem;color:#ccc;"></i><span>Nenhuma logo</span>';
            }
        }

        // QR Code
        const qrDisplay = document.getElementById('org-qr-display');
        if (qrDisplay && org.account_code) {
            qrDisplay.innerHTML = '';
            if (typeof QRCode !== 'undefined') {
                new QRCode(qrDisplay, { text: org.account_code, width: 160, height: 160, correctLevel: QRCode.CorrectLevel.M });
            }
        }
    } catch (e) { console.error('Load geral error:', e); }
}

window.saveAccountGeral = async function() {
    try {
        const data = {
            name: document.getElementById('org-name').value,
            contact_email: document.getElementById('org-email').value,
            phone: document.getElementById('org-phone').value,
            address: document.getElementById('org-address').value,
            responsible: document.getElementById('org-responsible').value
        };
        const res = await fetch(`${API_URL}/organization`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (res.ok) {
            showToast('Dados da organização salvos com sucesso!', 'success');
        } else {
            showToast('Erro ao salvar dados.', 'error');
        }
    } catch (e) { showToast('Erro: ' + e.message, 'error'); }
}

window.uploadOrgLogo = async function (input) {
    if (!input.files[0]) return;
    const fd = new FormData();
    fd.append('logo', input.files[0]);
    try {
        const res = await fetch(`${API_URL}/organization/logo`, { method: 'POST', body: fd });
        const data = await res.json();
        if (data.success) {
            document.getElementById('org-logo-preview').innerHTML = `<img src="${data.logo_path}" alt="Logo">`;
            showToast('Logo atualizada!', 'success');
        }
    } catch (e) { showToast('Erro ao enviar logo.', 'error'); }
};

window.removeOrgLogo = async function () {
    try {
        const res = await fetch(`${API_URL}/organization/logo`, { method: 'DELETE' });
        if (res.ok) {
            document.getElementById('org-logo-preview').innerHTML = '<i class="fas fa-image" style="font-size:2rem;color:#ccc;"></i><span>Nenhuma logo</span>';
            showToast('Logo removida.', 'success');
        }
    } catch (e) { showToast('Erro ao remover logo.', 'error'); }
};

// --- SEGURANÇA ---
window.loadAccountSeguranca = async function() {
    // Sessions
    try {
        const sessRes = await fetch(`${API_URL}/account/sessions`);
        const sessions = await sessRes.json();
        const sList = document.getElementById('sessions-list');
        if (sList) {
            if (sessions.length === 0) {
                sList.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">Nenhuma sessão ativa</td></tr>';
            } else {
                sList.innerHTML = sessions.map(s => `
                    <tr>
                        <td>${s.device_info || 'Desconhecido'}</td>
                        <td>${s.ip_address || '—'}</td>
                        <td>${s.last_active ? new Date(s.last_active).toLocaleString('pt-BR') : '—'}</td>
                        <td><button class="btn-sm btn-danger" onclick="endSession(${s.id})">Encerrar</button></td>
                    </tr>
                `).join('');
            }
        }
    } catch (e) { console.error('Sessions load error:', e); }

    // Login History
    try {
        const histRes = await fetch(`${API_URL}/account/login-history?limit=20`);
        const history = await histRes.json();
        const hList = document.getElementById('login-history-list');
        if (hList) {
            if (history.length === 0) {
                hList.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">Nenhum registro</td></tr>';
            } else {
                hList.innerHTML = history.map(h => `
                    <tr>
                        <td>${h.user_name || h.user_email || '—'}</td>
                        <td>${h.ip_address || '—'}</td>
                        <td>${h.success ? '<span class="badge badge-green">Sucesso</span>' : '<span class="badge badge-red">Falha</span>'}</td>
                        <td>${h.created_at ? new Date(h.created_at).toLocaleString('pt-BR') : '—'}</td>
                    </tr>
                `).join('');
            }
        }
    } catch (e) { console.error('Login history error:', e); }
}

window.changeAccountPassword = async function () {
    const current = document.getElementById('sec-current-pass').value;
    const newPass = document.getElementById('sec-new-pass').value;
    const confirm = document.getElementById('sec-confirm-pass').value;
    if (!current || !newPass) return showToast('Preencha todos os campos.', 'error');
    if (newPass.length < 6) return showToast('A nova senha deve ter no mínimo 6 caracteres.', 'error');
    if (newPass !== confirm) return showToast('As senhas não conferem.', 'error');

    const currentUser = JSON.parse(localStorage.getItem('shema_user') || '{}');
    try {
        const res = await fetch(`${API_URL}/account/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, currentPassword: current, newPassword: newPass })
        });
        const data = await res.json();
        if (res.ok) {
            showToast('Senha alterada com sucesso!', 'success');
            document.getElementById('sec-current-pass').value = '';
            document.getElementById('sec-new-pass').value = '';
            document.getElementById('sec-confirm-pass').value = '';
        } else {
            showToast(data.error || 'Erro ao alterar senha.', 'error');
        }
    } catch (e) { showToast('Erro: ' + e.message, 'error'); }
};

window.endSession = async function (id) {
    try {
        await fetch(`${API_URL}/account/sessions/${id}`, { method: 'DELETE' });
        showToast('Sessão encerrada.', 'success');
        loadAccountSeguranca();
    } catch (e) { showToast('Erro.', 'error'); }
};

window.endAllSessions = async function () {
    try {
        await fetch(`${API_URL}/account/sessions`, { method: 'DELETE' });
        showToast('Todas as sessões encerradas.', 'success');
        loadAccountSeguranca();
    } catch (e) { showToast('Erro.', 'error'); }
};

// --- PLANO ---
window.loadAccountPlano = async function() {
    try {
        const res = await fetch(`${API_URL}/account/plan`);
        const plan = await res.json();
        document.getElementById('plan-name').textContent = plan.plan_name || '—';
        document.getElementById('plan-status').innerHTML = `<span class="badge badge-green">${plan.status || '—'}</span>`;
        document.getElementById('plan-cycle').textContent = plan.billing_cycle || '—';
        document.getElementById('plan-next-billing').textContent = plan.next_billing ? new Date(plan.next_billing).toLocaleDateString('pt-BR') : '—';
        document.getElementById('plan-price').textContent = plan.price || '—';

        // Limits with progress bars
        const container = document.getElementById('plan-limits-container');
        if (container && plan.limits) {
            const labels = { members: 'Membros', teams: 'Equipes', trainings: 'Treinamentos', users: 'Usuários Admin' };
            container.innerHTML = Object.entries(plan.limits).map(([key, val]) => {
                const pct = Math.min((val.used / val.max) * 100, 100);
                let cls = '';
                if (pct > 80) cls = 'critical';
                else if (pct > 50) cls = 'high';
                return `
                    <div class="usage-limit-item">
                        <div class="usage-label"><strong>${labels[key] || key}</strong><span>${val.used} / ${val.max}</span></div>
                        <div class="usage-bar"><div class="usage-bar-fill ${cls}" style="width:${pct}%"></div></div>
                    </div>
                `;
            }).join('');
        }
    } catch (e) { console.error('Plan load error:', e); }
}

// --- CONEXÕES (in profile) ---
window.loadAccountConexoes = async function() {
    try {
        const res = await fetch(`${API_URL}/teams`);
        const teamsList = await res.json();
        const tbody = document.getElementById('account-connections-list');
        if (!tbody) return;
        if (teamsList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">Nenhuma equipe cadastrada</td></tr>';
            return;
        }
        tbody.innerHTML = teamsList.map(t => {
            const leader = t.general_leader_name || 'Sem líder';
            return `
                <tr data-team="${t.id}">
                    <td><strong>${leader}</strong><br><small style="color:var(--text-muted);">${t.name}</small></td>
                    <td><span class="badge badge-red" id="acc-status-${t.id}">Verificando...</span></td>
                    <td style="text-align:right;"><button class="btn-sm" id="acc-btn-${t.id}" onclick="handleRowConnect(${t.id})">Gerar QR Code</button></td>
                </tr>
            `;
        }).join('');

        // Check live status for each team
        for (const t of teamsList) {
            try {
                const statusRes = await fetch(`${API_URL}/whatsapp/status/${t.id}?role=leader`);
                const statusData = await statusRes.json();
                const badge = document.getElementById(`acc-status-${t.id}`);
                const btn = document.getElementById(`acc-btn-${t.id}`);
                const isOnline = statusData.status === 'open' || statusData.status === 'connected';
                if (badge) {
                    badge.className = isOnline ? 'badge badge-green' : 'badge badge-red';
                    badge.textContent = isOnline ? 'Conectado' : 'Desconectado';
                }
                if (btn && isOnline) {
                    btn.textContent = 'Desconectar';
                    btn.style.color = 'var(--danger)';
                    btn.onclick = () => handleWALogout(t.id, 'leader');
                }
            } catch (e) {
                const badge = document.getElementById(`acc-status-${t.id}`);
                if (badge) { badge.className = 'badge badge-red'; badge.textContent = 'Desconectado'; }
            }
        }
        
        if (typeof loadGoogleCalendarStatus === 'function') {
            loadGoogleCalendarStatus();
        }
        if (typeof loadAppleCalendarStatus === 'function') {
            loadAppleCalendarStatus();
        }
    } catch (e) { console.error('Account connections error:', e); }
}

// Redundant handleRowConnect removed as the main one is now global

window.filterAccountConnections = function (value) {
    const q = value.toLowerCase();
    document.querySelectorAll('#account-connections-list tr').forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
};

window.disconnectWhatsApp = async function () {
    showToast('Funcionalidade de desconexão requer EvolutionAPI configurada.', 'warning');
};

// --- USUÁRIOS ---
window.loadAccountUsuarios = async function() {
    try {
        const res = await fetch(`${API_URL}/users`);
        const usersList = await res.json();
        const tbody = document.getElementById('users-list');
        if (!tbody) return;
        const roleLabels = { admin: 'Admin', leader: 'Líder', volunteer: 'Voluntário' };
        tbody.innerHTML = usersList.map(u => {
            const status = u.status || 'active';
            const statusBadge = status === 'active'
                ? '<span class="badge badge-green">Ativo</span>'
                : '<span class="badge badge-gray">Inativo</span>';
            const lastLogin = u.last_login ? new Date(u.last_login).toLocaleString('pt-BR') : 'Nunca';
            return `
                <tr>
                    <td><strong>${u.name}</strong></td>
                    <td>${u.email}</td>
                    <td><span class="badge badge-blue">${roleLabels[u.role] || u.role}</span></td>
                    <td>${statusBadge}</td>
                    <td>${lastLogin}</td>
                    <td style="text-align:right; white-space:nowrap;">
                        <button class="btn-sm" onclick="editUserRole(${u.id},'${u.role}')" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn-sm" onclick="resetUserPassword(${u.id})" title="Redefinir Senha"><i class="fas fa-key"></i></button>
                        <button class="btn-sm" onclick="forceUserLogout(${u.id})" title="Forçar Logout"><i class="fas fa-sign-out-alt"></i></button>
                        <button class="btn-sm btn-danger" onclick="deactivateUser(${u.id},'${status}')" title="${status === 'active' ? 'Desativar' : 'Ativar'}"><i class="fas fa-${status === 'active' ? 'user-slash' : 'user-check'}"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) { console.error('Users load error:', e); }
}

window.showAddUserForm = function () {
    document.getElementById('add-user-form').style.display = '';
};

window.addNewUser = async function () {
    const name = document.getElementById('new-user-name').value;
    const email = document.getElementById('new-user-email').value;
    const password = document.getElementById('new-user-pass').value;
    const role = document.getElementById('new-user-role').value;
    if (!name || !email || !password) return showToast('Preencha todos os campos obrigatórios.', 'error');

    try {
        const res = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, role })
        });
        const data = await res.json();
        if (res.ok) {
            showToast('Usuário criado com sucesso!', 'success');
            document.getElementById('add-user-form').style.display = 'none';
            document.getElementById('new-user-name').value = '';
            document.getElementById('new-user-email').value = '';
            document.getElementById('new-user-pass').value = '';
            loadAccountUsuarios();
        } else {
            showToast(data.error || 'Erro ao criar usuário.', 'error');
        }
    } catch (e) { showToast('Erro: ' + e.message, 'error'); }
};

window.editUserRole = async function (id, currentRole) {
    const roles = ['admin', 'leader', 'volunteer'];
    const next = roles[(roles.indexOf(currentRole) + 1) % roles.length];
    const labels = { admin: 'Admin', leader: 'Líder', volunteer: 'Voluntário' };
    if (!confirm(`Alterar cargo para ${labels[next]}?`)) return;
    try {
        await fetch(`${API_URL}/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: next }) });
        showToast(`Cargo alterado para ${labels[next]}.`, 'success');
        loadAccountUsuarios();
    } catch (e) { showToast('Erro.', 'error'); }
};

window.resetUserPassword = async function (id) {
    const newPass = prompt('Nova senha (mínimo 6 caracteres):');
    if (!newPass || newPass.length < 6) return showToast('Senha deve ter no mínimo 6 caracteres.', 'error');
    try {
        await fetch(`${API_URL}/admin/users/${id}/password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPassword: newPass, adminId: JSON.parse(localStorage.getItem('currentUser') || '{}').id })
        });
        showToast('Senha redefinida!', 'success');
    } catch (e) { showToast('Erro.', 'error'); }
};

window.forceUserLogout = async function (id) {
    try {
        await fetch(`${API_URL}/users/${id}/force-logout`, { method: 'POST' });
        showToast('Sessões do usuário encerradas.', 'success');
    } catch (e) { showToast('Erro.', 'error'); }
};

window.deactivateUser = async function (id, currentStatus) {
    const action = currentStatus === 'active' ? 'Desativar' : 'Ativar';
    if (!confirm(`${action} este usuário?`)) return;
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
        await fetch(`${API_URL}/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
        showToast(`Usuário ${action.toLowerCase()}do.`, 'success');
        loadAccountUsuarios();
    } catch (e) { showToast('Erro.', 'error'); }
};

// --- PREFERÊNCIAS ---
window.loadAccountPreferencias = async function() {
    try {
        const res = await fetch(`${API_URL}/account/settings`);
        const s = await res.json();
        document.getElementById('pref-language').value = s.language || 'pt-BR';
        document.getElementById('pref-timezone').value = s.timezone || 'America/Sao_Paulo';
        document.getElementById('pref-notif-email').checked = !!s.notifications_email;
        document.getElementById('pref-notif-login').checked = !!s.notifications_login;
        document.getElementById('pref-notif-weekly').checked = !!s.notifications_weekly;
        document.getElementById('pref-notif-participation').checked = !!s.notifications_participation;
        document.getElementById('pref-theme-dark').checked = s.theme === 'dark';
        document.getElementById('pref-primary-color').value = s.primary_color || '#1EBE5D';
        document.getElementById('pref-color-hex').textContent = s.primary_color || '#1EBE5D';
        document.getElementById('pref-advanced-metrics').checked = !!s.show_advanced_metrics;

        // Color picker live update
        document.getElementById('pref-primary-color').addEventListener('input', function () {
            document.getElementById('pref-color-hex').textContent = this.value;
        });
    } catch (e) { console.error('Settings load error:', e); }
}

window.saveAccountPreferencias = async function () {
    try {
        const data = {
            language: document.getElementById('pref-language').value,
            timezone: document.getElementById('pref-timezone').value,
            theme: document.getElementById('pref-theme-dark').checked ? 'dark' : 'light',
            primary_color: document.getElementById('pref-primary-color').value,
            notifications_email: document.getElementById('pref-notif-email').checked ? 1 : 0,
            notifications_login: document.getElementById('pref-notif-login').checked ? 1 : 0,
            notifications_weekly: document.getElementById('pref-notif-weekly').checked ? 1 : 0,
            notifications_participation: document.getElementById('pref-notif-participation').checked ? 1 : 0,
            show_advanced_metrics: document.getElementById('pref-advanced-metrics').checked ? 1 : 0
        };
        const res = await fetch(`${API_URL}/account/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (res.ok) {
            showToast('Preferências salvas com sucesso!', 'success');
        } else {
            showToast('Erro ao salvar preferências.', 'error');
        }
    } catch (e) { showToast('Erro: ' + e.message, 'error'); }
};

window.toggleThemePreview = function (isDark) {
    // Preview only - actual save happens via the save button
    document.body.style.filter = isDark ? 'invert(0.85) hue-rotate(180deg)' : '';
};

// ===== STATS CARD NAVIGATION HELPERS =====

window.scrollToMemberList = function () {
    const el = document.querySelector('.cadastros-panels .cad-panel:first-child');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.scrollToTeamList = function () {
    const el = document.querySelector('.cadastros-panels .cad-panel:last-child');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.showRoleForm = function () {
    // Navigate to sector form view (roles/functions are managed alongside sectors)
    if (typeof showSectorForm === 'function') {
        showSectorForm();
    }
};

// ==========================================
// Google & Apple Calendar Integration
// ==========================================

window.loadGoogleCalendarStatus = async () => {
    const statusText = document.getElementById('gcal-status-text');
    const badge = document.getElementById('gcal-badge');
    const connectBtn = document.getElementById('gcal-connect-btn');
    const disconnectBtn = document.getElementById('gcal-disconnect-btn');

    if (!statusText) return;

    try {
        const res = await fetch(`${API_URL}/google-calendar/status`);
        const data = await res.json();

        if (data.connected) {
            statusText.innerHTML = `Conectado como <strong>Google User</strong>`;
            if (badge) badge.style.display = 'inline-flex';
            if (connectBtn) connectBtn.style.display = 'none';
            if (disconnectBtn) disconnectBtn.style.display = 'inline-flex';
        } else {
            statusText.textContent = 'Não conectado';
            if (badge) badge.style.display = 'none';
            if (connectBtn) connectBtn.style.display = 'inline-flex';
            if (disconnectBtn) disconnectBtn.style.display = 'none';
        }
    } catch (e) {
        console.error('Error loading Google status:', e);
    }
};

window.connectGoogleCalendar = async () => {
    try {
        const res = await fetch(`${API_URL}/google-calendar/auth-url`);
        const data = await res.json();
        if (data.url) {
            window.location.href = data.url;
        } else {
            showToast('Erro ao gerar link do Google.', 'error');
        }
    } catch (e) {
        showToast('Erro ao conectar com Google.', 'error');
    }
};

window.disconnectGoogleCalendar = async () => {
    if (!confirm('Deseja desconectar sua conta Google?')) return;
    try {
        await fetch(`${API_URL}/google-calendar/disconnect`, { method: 'POST' });
        showToast('Google Calendar desconectado.', 'success');
        loadGoogleCalendarStatus();
    } catch (e) {
        showToast('Erro ao desconectar.', 'error');
    }
};

// --- APPLE CALENDAR ---

window.loadAppleCalendarStatus = async () => {
    const statusText = document.getElementById('apple-cal-status-text');
    const badge = document.getElementById('apple-cal-badge');
    const connectBtn = document.getElementById('apple-connect-btn');
    const disconnectBtn = document.getElementById('apple-disconnect-btn');

    if (!statusText) return;

    try {
        const res = await fetch(`${API_URL}/apple-calendar/status`);
        const data = await res.json();

        if (data.connected) {
            statusText.innerHTML = `Conectado como <strong>${data.apple_id}</strong>`;
            if (badge) badge.style.display = 'inline-flex';
            if (connectBtn) connectBtn.style.display = 'none';
            if (disconnectBtn) disconnectBtn.style.display = 'inline-flex';
        } else {
            statusText.textContent = 'Não conectado';
            if (badge) badge.style.display = 'none';
            if (connectBtn) connectBtn.style.display = 'inline-flex';
            if (disconnectBtn) disconnectBtn.style.display = 'none';
        }
    } catch (e) {
        console.error('Error loading Apple status:', e);
    }
};

window.connectAppleCalendar = () => {
    const modal = document.getElementById('apple-cal-modal');
    if (modal) modal.style.display = 'block';
};

window.saveAppleCalendar = async () => {
    const email = document.getElementById('apple-cal-email').value;
    const pass = document.getElementById('apple-cal-apppass').value;

    if (!email || !pass) return showToast('Preencha e-mail e senha de app.', 'warning');

    try {
        const res = await fetch(`${API_URL}/apple-calendar/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apple_id: email, app_password: pass })
        });
        const data = await res.json();

        if (data.success) {
            showToast('Apple Calendar conectado com sucesso!', 'success');
            document.getElementById('apple-cal-modal').style.display = 'none';
            loadAppleCalendarStatus();
        } else {
            showToast(data.error || 'Erro ao conectar.', 'error');
        }
    } catch (e) {
        showToast('Erro na conexão com iCloud.', 'error');
    }
};

window.disconnectAppleCalendar = async () => {
    if (!confirm('Deseja desconectar sua conta Apple?')) return;
    try {
        await fetch(`${API_URL}/apple-calendar/disconnect`, { method: 'POST' });
        showToast('Apple Calendar desconectado.', 'success');
        loadAppleCalendarStatus();
    } catch (e) {
        showToast('Erro ao desconectar.', 'error');
    }
};

window.syncGoogleCalendar = async () => {
    const btn1 = document.getElementById('btn-gcal-sync-main');
    const btn2 = document.getElementById('btnGoogleCalSync');
    if (btn1) { btn1.disabled = true; btn1.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...'; }
    if (btn2) { btn2.disabled = true; btn2.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Aguarde...'; }

    try {
        const syncRes = await fetch(`${API_URL}/google-calendar/sync`, { method: 'POST' });
        const result = await syncRes.json();
        
        if (syncRes.ok) {
            showToast(`${result.added || 0} evento(s) sincronizados.`, 'success');
            loadGoogleCalendarStatus();
            if (typeof loadCalendarEvents === 'function') loadCalendarEvents();
        } else {
            throw new Error(result.error || 'Erro ao sincronizar');
        }
    } catch (e) {
        showToast(`Erro na sincronização: ${e.message}`, 'error');
    } finally {
        if (btn1) { btn1.disabled = false; btn1.innerHTML = '<i class="fas fa-sync"></i> Sincronizar Agora'; }
        if (btn2) { btn2.disabled = false; btn2.innerHTML = '<i class="fab fa-google" style="color:#EA4335;"></i> Sincronizar'; }
    }
};
