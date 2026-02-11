const API_URL = 'http://localhost:3002/api';
let currentUser = null;
let chartInstance = null;
let allMembers = []; // Cache for members
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

// ========================================
// Auth Logic
// ========================================

function showRegister() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
}

function showLogin() {
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (data.success) {
            currentUser = data.user;
            localStorage.setItem('shema_user', JSON.stringify(currentUser));
            initApp();
        } else {
            alert(data.error);
        }
    } catch (err) { alert('Erro na conexão'); }
}

async function handleRegister(e) {
    e.preventDefault();
    // Simplified registration - no areas check
    const payload = {
        name: document.getElementById('regName').value,
        email: document.getElementById('regEmail').value,
        phone: document.getElementById('regPhone').value,
        password: document.getElementById('regPassword').value,
        // Service areas handled by backend as empty
    };

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
            alert(data.error || 'Erro ao cadastrar');
        }
    } catch (err) { alert('Erro no cadastro'); }
}

function logout() {
    localStorage.removeItem('shema_user');
    location.reload();
}

// ========================================
// App Logic
// ========================================

function initApp() {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('app-screen').style.display = 'flex';

    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userRole').textContent = currentUser.role === 'admin' ? 'Líder' : 'Voluntário';
    document.getElementById('userAvatar').textContent = currentUser.name.charAt(0);

    loadDashboard();
}

function showTab(tabId) {
    // Reset Views Logic (Always show main view of the tab)
    if (tabId === 'members') {
        document.getElementById('memberFormView').style.display = 'none';
        document.getElementById('teamFormView').style.display = 'none';
        document.getElementById('cadastrosMainView').style.display = 'block';
    }
    if (tabId === 'teamCalendar') {
        document.getElementById('eventFormView').style.display = 'none';
        document.getElementById('calendarView').style.display = 'block';
    }
    if (tabId === 'trainings') {
        document.getElementById('folderView').style.display = 'none';
        document.getElementById('videoPlayerView').style.display = 'none';
        document.getElementById('trainingsMainView').style.display = 'block';
        loadTrainings(); // Reload to refresh folders
    }

    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');

    // Clear all active states
    document.querySelectorAll('.nav-links > li').forEach(l => l.classList.remove('active'));

    // Map tab IDs to nav positions (flat nav now)
    const directTabs = { dashboard: 0, members: 1, teamCalendar: 2, trainings: 3, logs: 4 };
    if (directTabs[tabId] !== undefined) {
        document.querySelectorAll('.nav-links > li')[directTabs[tabId]].classList.add('active');
    }

    if (tabId === 'dashboard') loadDashboard();
    if (tabId === 'members') loadCadastros();
    if (tabId === 'trainings') loadTrainings();
    if (tabId === 'logs') loadLogs();
    if (tabId === 'teamCalendar') loadTeamCalendar();
}

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
        if (document.getElementById('folderView').style.display === 'block') {
            closeFolderView();
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

async function loadDashboard() {
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

        // Use real data from API with fallbacks
        document.getElementById('accountCodeDisplay').textContent = statsData.accountCode || 'AH7-23X';

        document.getElementById('statMembers').textContent = Array.isArray(membersData) ? membersData.length : '0';
        document.getElementById('statTeams').textContent = Array.isArray(teamsData) ? teamsData.length : '0';
        document.getElementById('statTrainings').textContent = Array.isArray(trainingsData) ? trainingsData.length : '0';

        // Participation is still a static or calculated value
        document.getElementById('statParticipation').textContent = '62%';

        // Render charts if data exists
        if (statsData.teamCounts) renderServiceChart(statsData.teamCounts);
        if (statsData.ageDistribution) renderAgeChart(statsData.ageDistribution);

    } catch (e) {
        console.error('Critical Dashboard Error:', e);
    }
}

function renderServiceChart(teamCounts) {
    if (!teamCounts || teamCounts.length === 0) return;
    const ctx = document.getElementById('serviceChart').getContext('2d');
    const labels = teamCounts.map(t => t.name);
    const dataPoints = teamCounts.map(t => t.count);

    // Color palette matching reference
    const colors = [
        'rgba(30, 190, 93, 0.8)',   // Green
        'rgba(30, 190, 93, 0.6)',   // Light Green
        'rgba(59, 130, 246, 0.8)',  // Blue
        'rgba(201, 162, 39, 0.8)',  // Gold
        'rgba(239, 68, 68, 0.8)',   // Red
        'rgba(139, 92, 246, 0.8)',  // Purple
        'rgba(34, 197, 94, 0.8)'    // Emerald
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
    const ctx = document.getElementById('ageChart').getContext('2d');
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
                    '#ef4444', // Red
                    '#3b82f6', // Blue
                    '#22c55e', // Green
                    '#C9A227'  // Gold
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

window.generateQRCode = () => {
    const code = document.getElementById('accountCodeDisplay').textContent;
    const container = document.getElementById('qrcode');
    container.innerHTML = ''; // Clear previous
    new QRCode(container, {
        text: `https://shema.system/register?code=${code}`,
        width: 128,
        height: 128
    });
    document.getElementById('qrOverlay').style.display = 'block';
};

// Members (Cadastros)
async function loadMembers() {
    try {
        const res = await fetch(`${API_URL}/members`);
        allMembers = await res.json();

        const list = document.getElementById('memberList');
        if (allMembers.length === 0) {
            list.innerHTML = '<p style="color:#666; text-align:center;">Nenhum cadastro encontrado.</p>';
            return;
        }

        list.innerHTML = allMembers.map(m => `
            <div class="team-card">
                <button class="btn-delete" onclick="deleteMember(${m.id})"><i class="fas fa-trash"></i></button>
                <div>
                    <strong>${m.name}</strong>
                    <div style="font-size:0.8rem; color:var(--text-muted);">${m.phone || 'Sem telefone'} • ${m.age} anos</div>
                </div>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}

async function deleteMember(id) {
    const confirmed = await showConfirmModal('Excluir Membro', 'Tem certeza que deseja excluir este membro? Esta ação não pode ser desfeita.');
    if (!confirmed) return;
    try {
        const res = await fetch(`${API_URL}/members/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
            loadCadastros();
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
let currentFolderId = null;

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

    const watchBtn = isYouTube
        ? `<button onclick="event.stopPropagation(); openVideoPlayer(${video.id}, '${video.title.replace(/'/g, "\\'")}', '${video.url.replace(/'/g, "\\'")}', '${(video.description || '').replace(/'/g, "\\'")}')" class="btn-primary" style="display:inline-block; margin-top:10px; padding:6px 15px; font-size:0.8rem; border:none; cursor:pointer;">
            <i class="fas fa-play"></i> Assistir
          </button>`
        : `<a href="${video.url}" target="_blank" class="btn-primary" style="display:inline-block; margin-top:10px; padding:6px 15px; font-size:0.8rem; text-decoration:none;">
            <i class="fas fa-external-link-alt"></i> Abrir Link
          </a>`;

    return `
        <div class="folder-card video-card">
            ${progressBadge}
            <button class="btn-delete" onclick="event.stopPropagation(); deleteTraining(${video.id})" title="Excluir vídeo">
                <i class="fas fa-trash"></i>
            </button>
            <div class="folder-icon" style="color: ${color}"><i class="${icon}"></i></div>
            <h3>${video.title}</h3>
            <p style="color:#aaa; font-size:0.85rem; margin-top:5px; height: 32px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                ${video.description || 'Sem descri\u00e7\u00e3o'}
            </p>
            ${watchBtn}
        </div>
    `;
}

// Video card helper removed and integrated or kept as is

window.createFolder = async () => {
    const name = prompt("Nome da nova pasta:");
    if (!name) return;

    try {
        await fetch(`${API_URL}/folders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        loadTrainings();
    } catch (e) { alert('Erro ao criar pasta'); }
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

    // Reset photo state
    document.getElementById('photoImg').src = '';
    document.getElementById('photoImg').style.display = 'none';
    document.querySelector('.photo-circle i').style.display = 'block';

    // Set initial hover state (Empty)
    const actions = document.getElementById('photoActionsHover');
    actions.classList.remove('is-full', 'has-photo');
    actions.classList.add('is-empty');

    // Populate Teams in new select
    const teamSelect = document.getElementById('mTeamDisp');
    teamSelect.innerHTML = '<option value="">Selecionar Equipe</option>';
    if (cadTeams && cadTeams.length > 0) {
        cadTeams.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            teamSelect.appendChild(opt);
        });
    }

    if (window.toggleCpfFieldDisp) window.toggleCpfFieldDisp();
};

window.closeMemberRegistration = () => {
    showTab('members');
};

// Alias for backward compatibility
window.hideMemberForm = window.closeMemberRegistration;

window.showTeamForm = async () => {
    document.getElementById('cadastrosMainView').style.display = 'none';
    document.getElementById('memberFormView').style.display = 'none';
    document.getElementById('teamFormView').style.display = 'block';
    document.getElementById('teamFormDisplay').reset();

    // Populate Selects with Members
    if (allMembers.length === 0) {
        try {
            const res = await fetch(`${API_URL}/members`);
            allMembers = await res.json();
        } catch (e) { console.error(e); }
    }
    const options = `<option value="">Selecione...</option>` + allMembers.map(m => `<option value="${m.id}">${m.name}</option>`).join('');

    ['tmGeneralDisp', 'tmSub1Disp', 'tmSub2Disp', 'tmSub3Disp'].forEach(id => {
        document.getElementById(id).innerHTML = options;
    });

    document.getElementById('memberSelectTemplateDisp').innerHTML = `<option value="">Selecione um membro...</option>` + allMembers.map(m => `<option value="${m.id}">${m.name}</option>`).join('');

    document.getElementById('membersContainerDisp').innerHTML = '';
    window.addMemberRowDisp();
    document.getElementById('teamFormDisplay').reset();
};

window.hideTeamForm = () => {
    document.getElementById('teamFormView').style.display = 'none';
    document.getElementById('cadastrosMainView').style.display = 'block';
    loadCadastros();
};

// Cadastros dashboard loader
async function loadCadastros() {
    try {
        const [membersRes, teamsRes, leadersRes, birthdaysRes, genderRes] = await Promise.all([
            fetch(`${API_URL}/members`).catch(() => ({ ok: false })),
            fetch(`${API_URL}/teams`).catch(() => ({ ok: false })),
            fetch(`${API_URL}/stats/leaders`).catch(() => ({ ok: false })),
            fetch(`${API_URL}/birthdays/today`).catch(() => ({ ok: false })),
            fetch(`${API_URL}/stats/gender`).catch(() => ({ ok: false })),
        ]);

        allMembers = membersRes.ok ? await membersRes.json() : [];
        cadTeams = teamsRes.ok ? await teamsRes.json() : [];
        const leadersData = leadersRes.ok ? await leadersRes.json() : { count: 0 };
        const birthdaysData = birthdaysRes.ok ? await birthdaysRes.json() : [];
        const genderData = genderRes.ok ? await genderRes.json() : { male: 0, female: 0 };

        // Stats
        document.getElementById('cadStatMembers').textContent = allMembers.length;
        document.getElementById('cadStatTeams').textContent = cadTeams.length;
        document.getElementById('cadStatLeaders').textContent = leadersData.count;
        document.getElementById('cadStatBirthdays').textContent = birthdaysData.length;

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
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum membro cadastrado</td></tr>';
    } else {
        tbody.innerHTML = pageItems.map(m => {
            const initial = m.name ? m.name.charAt(0).toUpperCase() : '?';
            const teamName = m.team_name || 'Nenhuma';
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
                <td>${m.email || 'tomas@example.com'}</td>
                <td>${teamName}</td>
                <td>${sector}</td>
                <td>${role}</td>
                <td><button class="btn-icon-danger" onclick="deleteMember(${m.id})" title="Excluir"><i class="fas fa-trash"></i></button></td>
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
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhuma equipe cadastrada</td></tr>';
    } else {
        tbody.innerHTML = pageItems.map(t => {
            const count = t.members ? t.members.length : 0;
            return `<tr>
                <td><strong>${t.name}</strong></td>
                <td>${t.name}</td>
                <td>${count}</td>
                <td><span class="status-badge active">Ativa</span></td>
                <td><button class="btn-icon-danger" onclick="deleteTeam(${t.id})" title="Excluir"><i class="fas fa-trash"></i></button></td>
            </tr>`;
        }).join('');
    }

    document.getElementById('teamCountBottom').textContent = total === 0 ? 'Nenhuma equipe cadastrada' : `Mostrando ${Math.min(start + 1, total)}-${Math.min(start + PAGE_SIZE, total)} de ${total}`;

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

window.addMemberRowDisp = () => {
    const container = document.getElementById('membersContainerDisp');
    const template = document.getElementById('memberSelectTemplateDisp');

    const row = document.createElement('div');
    row.className = 'member-row';
    row.style = 'display:flex; gap:10px; margin-bottom:10px;';

    const select = document.createElement('select');
    select.innerHTML = template.innerHTML;
    select.className = 'member-select-disp';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.innerHTML = '&times;';
    removeBtn.style = 'background:var(--danger); border:none; color:white; padding:0 10px; border-radius:4px; cursor:pointer;';
    removeBtn.onclick = () => row.remove();

    row.appendChild(select);
    row.appendChild(removeBtn);
    container.appendChild(row);
};

// Old modal handlers removed

// New Member Form Submission (View-based)
document.getElementById('memberFormDisplay').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Block if duplicate phone
    if (isDuplicatePhone) {
        const phoneField = document.getElementById('mPhoneDisp');
        phoneField.focus();
        phoneField.classList.add('shake-field');
        setTimeout(() => phoneField.classList.remove('shake-field'), 600);
        return;
    }

    console.log('Member registration submitted via display form');

    try {
        const data = {
            name: document.getElementById('mNameDisp').value,
            email: document.getElementById('mEmailDisp') ? document.getElementById('mEmailDisp').value : '',
            naturality: document.getElementById('mNaturalityDisp').value,
            is_foreigner: document.getElementById('mIsForeignerDisp').value === 'true',
            marital_status: document.getElementById('mMaritalDisp').value,
            gender: document.getElementById('mGenderDisp').value,
            education: document.getElementById('mEducationDisp').value,
            profession: document.getElementById('mProfessionDisp').value,
            phone: document.getElementById('mPhoneDisp').value,
            birth_date: document.getElementById('mBirthDateDisp').value,
            cpf: document.getElementById('mCpfDisp').value,
            team_id: document.getElementById('mTeamDisp') ? document.getElementById('mTeamDisp').value : '',
            role: document.getElementById('mRoleDisp') ? document.getElementById('mRoleDisp').value : '',
            sector: document.getElementById('mSectorDisp') ? document.getElementById('mSectorDisp').value : '',
            age: 0
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

        const res = await fetch(`${API_URL}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error || `Server error: ${res.status}`);

        alert('Membro cadastrado com sucesso!');
        closeMemberRegistration();
    } catch (err) {
        console.error('Registration Error:', err);
        alert('Erro ao salvar cadastro: ' + err.message);
    }
});

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

function formatDetails(detailsJson) {
    try {
        const d = JSON.parse(detailsJson);
        return Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(', ');
    } catch (e) { return detailsJson; }
}

// Input Masks
document.addEventListener('DOMContentLoaded', () => {
    // Phone Mask
    const phoneInput = document.getElementById('mPhoneDisp');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, "");
            if (v.length > 11) v = v.substring(0, 11);
            if (v.length > 2) v = `(${v.substring(0, 2)}) ${v.substring(2)}`;
            if (v.length > 5) v = `${v.substring(0, 5)} ${v.substring(5)}`;
            if (v.length > 10) v = `${v.substring(0, 10)}-${v.substring(10)}`;
            e.target.value = v;
        });
    }

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

// Team Form Submission (View-based)
document.getElementById('teamFormDisplay').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const selects = document.querySelectorAll('.member-select-disp');
        const memberIds = Array.from(selects).map(s => s.value).filter(val => val !== "");
        const uniqueIds = new Set(memberIds);
        if (uniqueIds.size !== memberIds.length) return alert('Existem membros duplicados.');

        const data = {
            name: document.getElementById('tmNameDisp').value,
            general_leader_id: document.getElementById('tmGeneralDisp').value,
            sub_leader1_id: document.getElementById('tmSub1Disp').value,
            sub_leader2_id: document.getElementById('tmSub2Disp').value,
            sub_leader3_id: document.getElementById('tmSub3Disp').value,
            members: memberIds
        };

        const res = await fetch(`${API_URL}/teams`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            alert('Equipe registrada com sucesso!');
            hideTeamForm();
        } else {
            alert('Erro: ' + result.error);
        }
    } catch (err) { alert('Erro ao salvar equipe'); }
});

// Training (Video) Form Submission (View-based)
document.getElementById('trainingFormDisplay').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const data = {
            title: document.getElementById('tTitleDisp').value,
            folder_id: currentFolderId,
            type: document.getElementById('tTypeDisp').value,
            url: document.getElementById('tUrlDisp').value,
            description: document.getElementById('tDescDisp').value,
            notes: "" // Removed notes from UI simplified front
        };

        await fetch(`${API_URL}/trainings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        hideTrainingForms();
        loadTrainings();
    } catch (err) { alert('Erro ao salvar vídeo'); }
});

// Folder Form Submission (View-based)
document.getElementById('folderFormDisplay').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('fNameDisp').value;
    try {
        await fetch(`${API_URL}/folders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        hideTrainingForms();
        loadTrainings();
    } catch (e) { alert('Erro ao criar pasta'); }
});

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

window.openVideoPlayer = function (videoId, title, url, description) {
    currentVideoData = { id: videoId, title, url, description };
    accumulatedWatchTime = 0;

    // Load existing progress
    const wp = userWatchProgress[videoId];
    if (wp) {
        accumulatedWatchTime = wp.watched_seconds || 0;
    }

    // Switch views
    document.getElementById('trainingsGridView').style.display = 'none';
    document.getElementById('folderFormView').style.display = 'none';
    document.getElementById('trainingFormView').style.display = 'none';
    document.getElementById('trainingActions').style.display = 'none';
    document.getElementById('trainingBreadcrumb').style.display = 'none';
    document.getElementById('btnBackToTrainings').style.display = 'none';
    document.getElementById('videoPlayerView').style.display = 'block';

    // Set info
    document.getElementById('videoPlayerTitle').textContent = title;
    document.getElementById('videoPlayerDescription').textContent = description || 'Sem descrição';

    const ytId = extractYouTubeId(url);
    if (!ytId) {
        document.getElementById('youtubePlayer').innerHTML = '<p style="color:var(--danger); text-align:center; padding:40px;">URL de vídeo inválida.</p>';
        return;
    }

    // Create or recreate player
    if (ytPlayer) {
        ytPlayer.destroy();
        ytPlayer = null;
    }

    // Ensure the API is loaded
    if (window.YT && window.YT.Player) {
        createYTPlayer(ytId);
    } else {
        // Wait for API to load
        window.onYouTubeIframeAPIReady = () => createYTPlayer(ytId);
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
    const duration = ytPlayer && typeof ytPlayer.getDuration === 'function' ? ytPlayer.getDuration() : 0;

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
    if (currentVideoData && ytPlayer && typeof ytPlayer.getDuration === 'function') {
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

document.getElementById('mPhoneDisp').addEventListener('input', function () {
    const phone = this.value.trim();
    const tooltip = document.getElementById('phoneTooltip');
    const tooltipText = document.getElementById('phoneTooltipText');

    clearTimeout(phoneCheckTimer);

    // Reset state if empty or too short
    if (phone.length < 8) {
        isDuplicatePhone = false;
        this.classList.remove('field-error');
        tooltip.style.display = 'none';
        return;
    }

    // Debounce 500ms
    phoneCheckTimer = setTimeout(async () => {
        try {
            const res = await fetch(`${API_URL}/members/check-phone/${encodeURIComponent(phone)}`);
            const data = await res.json();

            if (data.exists) {
                isDuplicatePhone = true;
                this.classList.add('field-error');
                tooltipText.textContent = `WhatsApp já cadastrado para: ${data.memberName}`;
                tooltip.style.display = 'flex';
            } else {
                isDuplicatePhone = false;
                this.classList.remove('field-error');
                tooltip.style.display = 'none';
            }
        } catch (e) {
            console.error('Phone check error:', e);
        }
    }, 500);
});

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
        const day = parseInt(ev.event_date.split('-')[2]);
        if (!eventsByDay[day]) eventsByDay[day] = [];
        eventsByDay[day].push(ev);
    });

    let html = '';

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="calendar-day empty"></div>';
    }

    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = isCurrentMonth && d === today.getDate();
        const dayEvents = eventsByDay[d] || [];
        const hasEvents = dayEvents.length > 0;

        html += `<div class="calendar-day${isToday ? ' today' : ''}${hasEvents ? ' has-event' : ''}" onclick="showDayDetail(${year}, ${month}, ${d})">`;
        html += `<span class="day-number">${d}</span>`;
        if (hasEvents) {
            html += '<div class="event-dots">';
            dayEvents.slice(0, 3).forEach(ev => {
                html += `<div class="event-dot" title="${ev.event_name} - ${ev.team_name || ''}"></div>`;
            });
            if (dayEvents.length > 3) html += `<span class="event-more">+${dayEvents.length - 3}</span>`;
            html += '</div>';
            html += `<div class="event-preview">${dayEvents[0].event_name}</div>`;
        }
        html += '</div>';
    }

    grid.innerHTML = html;
}

window.changeMonth = function (delta) {
    calendarMonth += delta;
    if (calendarMonth > 12) { calendarMonth = 1; calendarYear++; }
    if (calendarMonth < 1) { calendarMonth = 12; calendarYear--; }
    // Reset side panel to empty state
    document.getElementById('dayDetailContent').innerHTML = `
        <div class="side-panel-empty">
            <i class="fas fa-calendar-day"></i>
            <p>Selecione um dia no calendário para ver os eventos</p>
        </div>
    `;
    loadTeamCalendar();
};

const TEAM_COLORS = ['blue', 'yellow', 'red', 'green', 'purple', 'orange', 'teal', 'pink'];
const TEAM_ICONS = ['fa-broadcast-tower', 'fa-music', 'fa-hands-helping', 'fa-check-circle', 'fa-camera', 'fa-lightbulb', 'fa-desktop', 'fa-film'];

window.showDayDetail = async function (year, month, day) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const contentDiv = document.getElementById('dayDetailContent');

    try {
        const res = await fetch(`${API_URL}/team-events?year=${year}&month=${month}`);
        const allEvents = await res.json();
        const dayEvents = allEvents.filter(ev => ev.event_date === dateStr);

        if (dayEvents.length === 0) {
            contentDiv.innerHTML = `
                <div class="side-panel-no-events">
                    <i class="fas fa-calendar-times" style="font-size:2rem; color:#cbd5e1; display:block; margin-bottom:10px;"></i>
                    Nenhum evento em ${day} de ${MONTH_NAMES[month - 1]}
                </div>
            `;
            return;
        }

        let html = '';
        // Group events — show each event
        for (const ev of dayEvents) {
            html += `<div class="side-panel-event">`;
            html += `<div class="side-panel-event-name">${ev.event_name}</div>`;
            html += `<div class="side-panel-event-date"><i class="fas fa-calendar"></i> ${day} de ${MONTH_NAMES[month - 1]} | ${ev.event_time}</div>`;

            // Fetch roles/teams for this event
            try {
                const rolesRes = await fetch(`${API_URL}/team-events/${ev.id}/roles`);
                const roles = await rolesRes.json();

                // Team button for the event's team
                const colorIdx = (ev.team_id - 1) % TEAM_COLORS.length;
                const color = TEAM_COLORS[colorIdx];
                const icon = TEAM_ICONS[colorIdx];
                const teamName = ev.team_name || 'Equipe';

                html += `<button class="team-btn team-btn-${color}" onclick="toggleTeamMembers(${ev.team_id}, ${ev.id}, this)">
                    <div class="team-btn-icon"><i class="fas ${icon}"></i></div>
                    <div class="team-btn-info">
                        <span class="team-btn-name">${teamName}</span>
                        <span class="team-btn-desc">Equipe de ${teamName}</span>
                    </div>
                </button>`;
                html += `<div id="teamMembersPanel_${ev.id}_${ev.team_id}"></div>`;

                // Show any additional roles as separate colored buttons
                if (roles.length > 0) {
                    const uniqueRoles = [...new Set(roles.map(r => r.role_name))];
                    uniqueRoles.forEach((roleName, idx) => {
                        const roleMembers = roles.filter(r => r.role_name === roleName);
                        const roleColor = TEAM_COLORS[(colorIdx + idx + 1) % TEAM_COLORS.length];
                        html += `<button class="team-btn team-btn-${roleColor}" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                            <div class="team-btn-icon"><i class="fas fa-user-tag"></i></div>
                            <div class="team-btn-info">
                                <span class="team-btn-name">${roleName}</span>
                                <span class="team-btn-desc">${roleMembers.map(r => r.member_name).join(', ')}</span>
                            </div>
                        </button>`;
                        html += `<div class="team-members-panel" style="display:none;">
                            <div class="team-members-panel-header">${roleName}</div>`;
                        roleMembers.forEach(rm => {
                            const initials = rm.member_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                            html += `<div class="team-member-item">
                                <div class="team-member-avatar">${initials}</div>
                                <span class="team-member-name">${rm.member_name}</span>
                                <span class="team-member-role">${roleName}</span>
                            </div>`;
                        });
                        html += `</div>`;
                    });
                }
            } catch (err) {
                console.error('Error fetching roles:', err);
            }

            html += `<button class="side-panel-delete-btn" onclick="deleteTeamEvent(${ev.id})">
                <i class="fas fa-trash"></i> Excluir evento
            </button>`;
            html += `</div>`;
        }

        contentDiv.innerHTML = html;
    } catch (e) {
        console.error('Show day detail error:', e);
    }
};

window.toggleTeamMembers = async function (teamId, eventId, btn) {
    const panelId = `teamMembersPanel_${eventId}_${teamId}`;
    const panel = document.getElementById(panelId);

    // Toggle: if already open, close it
    if (panel.innerHTML.trim() !== '') {
        panel.innerHTML = '';
        return;
    }

    try {
        const res = await fetch(`${API_URL}/teams`);
        const teams = await res.json();
        const team = teams.find(t => t.id === teamId);

        if (!team) {
            panel.innerHTML = '<div class="team-members-panel"><div class="team-member-item">Equipe não encontrada</div></div>';
            return;
        }

        let html = `<div class="team-members-panel">
            <div class="team-members-panel-header">
                Membros de ${team.name}
                <button class="close-panel" onclick="document.getElementById('${panelId}').innerHTML=''"><i class="fas fa-times"></i></button>
            </div>`;

        // Show leaders
        if (team.general_leader_name) {
            const initials = team.general_leader_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            html += `<div class="team-member-item">
                <div class="team-member-avatar">${initials}</div>
                <span class="team-member-name">${team.general_leader_name}</span>
                <span class="team-member-role">Líder Geral</span>
            </div>`;
        }
        if (team.sub1_name) {
            const initials = team.sub1_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            html += `<div class="team-member-item">
                <div class="team-member-avatar">${initials}</div>
                <span class="team-member-name">${team.sub1_name}</span>
                <span class="team-member-role">Líder Aux. 1</span>
            </div>`;
        }
        if (team.sub2_name) {
            const initials = team.sub2_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            html += `<div class="team-member-item">
                <div class="team-member-avatar">${initials}</div>
                <span class="team-member-name">${team.sub2_name}</span>
                <span class="team-member-role">Líder Aux. 2</span>
            </div>`;
        }
        if (team.sub3_name) {
            const initials = team.sub3_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            html += `<div class="team-member-item">
                <div class="team-member-avatar">${initials}</div>
                <span class="team-member-name">${team.sub3_name}</span>
                <span class="team-member-role">Líder Aux. 3</span>
            </div>`;
        }

        // Show regular members
        if (team.members && team.members.length > 0) {
            team.members.forEach(memberName => {
                const initials = memberName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                html += `<div class="team-member-item">
                    <div class="team-member-avatar">${initials}</div>
                    <span class="team-member-name">${memberName}</span>
                    <span class="team-member-role">Membro</span>
                </div>`;
            });
        }

        if (!team.general_leader_name && (!team.members || team.members.length === 0)) {
            html += `<div class="team-member-item" style="justify-content:center; color: var(--text-muted);">Nenhum membro cadastrado</div>`;
        }

        html += `</div>`;
        panel.innerHTML = html;
    } catch (e) {
        console.error('Error loading team members:', e);
        panel.innerHTML = '<div class="team-members-panel"><div class="team-member-item">Erro ao carregar membros</div></div>';
    }
};

window.deleteTeamEvent = async function (id) {
    const confirmed = await showConfirmModal('Excluir Evento', 'Tem certeza que deseja excluir este evento?');
    if (!confirmed) return;
    try {
        const res = await fetch(`${API_URL}/team-events/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
            loadTeamCalendar();
            // Reset side panel
            document.getElementById('dayDetailContent').innerHTML = `
                <div class="side-panel-empty">
                    <i class="fas fa-calendar-day"></i>
                    <p>Selecione um dia no calendário para ver os eventos</p>
                </div>
            `;
        } else {
            alert('Erro: ' + (result.error || 'Falha ao excluir'));
        }
    } catch (e) { alert('Erro ao excluir evento'); }
};

// Event Form
window.showEventForm = async function () {
    document.getElementById('calendarView').style.display = 'none';
    document.getElementById('eventFormView').style.display = 'block';
    document.getElementById('btnNewEvent').style.display = 'none';
    document.getElementById('btnBackToCalendar').style.display = 'block';

    // Populate team select
    try {
        const res = await fetch(`${API_URL}/teams`);
        const teams = await res.json();
        const teamSelect = document.getElementById('evTeamSelect');
        teamSelect.innerHTML = '<option value="">Selecione a equipe...</option>' + teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    } catch (e) { console.error('Load teams error:', e); }

    // Populate member template for roles
    if (allMembers.length === 0) await loadMembers();
    const memberTemplate = document.getElementById('roleMemberTemplate');
    memberTemplate.innerHTML = '<option value="">Selecione um membro...</option>' + allMembers.map(m => `<option value="${m.id}">${m.name}</option>`).join('');

    document.getElementById('rolesContainer').innerHTML = '';
    addRoleRow();

    selectedRecurrence = 'none';
    document.querySelectorAll('.rec-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.rec-btn[data-rec="none"]').classList.add('active');
    document.getElementById('recurrenceDetails').style.display = 'none';

    document.getElementById('eventFormDisplay').reset();
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

window.addRoleRow = function () {
    const container = document.getElementById('rolesContainer');
    const template = document.getElementById('roleMemberTemplate');

    const row = document.createElement('div');
    row.className = 'role-row';

    const roleInput = document.createElement('input');
    roleInput.type = 'text';
    roleInput.placeholder = 'Função (ex: Projeção)';
    roleInput.required = true;
    roleInput.className = 'role-name-input';

    const memberSelect = document.createElement('select');
    memberSelect.innerHTML = template.innerHTML;
    memberSelect.required = true;
    memberSelect.className = 'role-member-select';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.innerHTML = '&times;';
    removeBtn.style = 'background:var(--danger); border:none; color:white; padding:0 10px; border-radius:4px; cursor:pointer; font-size:1.2rem;';
    removeBtn.onclick = () => row.remove();

    row.appendChild(roleInput);
    row.appendChild(memberSelect);
    row.appendChild(removeBtn);
    container.appendChild(row);
};

// Event Form Submit
document.getElementById('eventFormDisplay').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Collect roles
    const roleRows = document.querySelectorAll('#rolesContainer .role-row');
    const roles = [];
    for (const row of roleRows) {
        const roleName = row.querySelector('.role-name-input').value.trim();
        const memberId = row.querySelector('.role-member-select').value;
        if (roleName && memberId) {
            roles.push({ role_name: roleName, member_id: parseInt(memberId) });
        }
    }

    if (roles.length === 0) {
        alert('Adicione pelo menos uma função com responsável.');
        return;
    }

    const data = {
        team_id: parseInt(document.getElementById('evTeamSelect').value),
        event_name: document.getElementById('evName').value,
        event_time: document.getElementById('evTime').value,
        event_date: document.getElementById('evDate').value,
        recurrence_type: selectedRecurrence,
        recurrence_interval: selectedRecurrence === 'custom' ? parseInt(document.getElementById('evRecInterval').value) || 7 : 0,
        recurrence_end: selectedRecurrence !== 'none' ? document.getElementById('evRecEnd').value : null,
        roles
    };

    try {
        const res = await fetch(`${API_URL}/team-events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Erro ao salvar');

        const msg = result.totalEvents > 1
            ? `Evento criado com ${result.totalEvents} ocorrências!`
            : 'Evento criado com sucesso!';
        alert(msg);
        hideEventForm();
    } catch (err) {
        console.error('Event creation error:', err);
        alert('Erro ao salvar evento: ' + err.message);
    }
});

// Ensure YouTube API callback is available globally
window.onYouTubeIframeAPIReady = window.onYouTubeIframeAPIReady || function () { };
