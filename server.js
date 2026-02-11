const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const { db, users, members, teams, serviceRecords, trainings, folders, stats, systemLogs, watchProgress, teamEvents } = require('./database');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Request Logging Middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} - ${req.method} ${req.url}`);
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        console.log('Payload:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// Logs
app.get('/api/logs', (req, res) => {
    try {
        const logs = systemLogs.getAll();
        res.json(logs);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Auth Routes
app.post('/api/auth/register', (req, res) => {
    try {
        const { name, email, phone, password } = req.body; // Removed service_areas
        // NOTE: Checkout phase simplified as requested (no area selection)

        const result = users.create({
            name, email, phone, password,
            service_areas: '[]', // Default empty
            role: 'volunteer',
            courses: ''
        });
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (e) {
        if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Email já cadastrado.' });
        }
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/auth/login', (req, res) => {
    try {
        const { email, password } = req.body;
        const user = users.findByEmail(email);
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }
        const { password: _, ...safeUser } = user;
        res.json({ success: true, user: safeUser });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/cleanup', (req, res) => {
    try {
        // Delete all users except admin@shema.com
        const info = db.prepare("DELETE FROM users WHERE email != 'admin@shema.com'").run();

        // Ensure admin exists with correct password
        const hash = bcrypt.hashSync('admin123', 10);
        const adminCheck = db.prepare("SELECT * FROM users WHERE email = 'admin@shema.com'").get();

        if (adminCheck) {
            db.prepare("UPDATE users SET password = ? WHERE email = 'admin@shema.com'").run(hash);
        } else {
            db.prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)").run('Admin', 'admin@shema.com', hash, 'admin');
        }

        res.json({ success: true, deleted: info.changes });
    } catch (e) {
        console.error('Cleanup error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Member Routes (Cadastros)
app.get('/api/members', (req, res) => {
    try { res.json(members.getAll()); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/birthdays/today', (req, res) => {
    try {
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const list = members.getBirthdays(month, day);
        res.json(list);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stats/leaders', (req, res) => {
    try {
        const count = teams.getLeaderCount();
        res.json({ count });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stats/gender', (req, res) => {
    try {
        const stats = members.getGenderStats();
        // stats is [{ gender_normalized: 'Masculino', count: 5 }, ...]
        let male = 0, female = 0;
        stats.forEach(s => {
            if (s.gender_normalized === 'Masculino') male = s.count;
            if (s.gender_normalized === 'Feminino') female = s.count;
        });
        res.json({ male, female });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/members/check-phone/:phone', (req, res) => {
    try {
        const existing = members.getByPhone(req.params.phone);
        res.json({ exists: !!existing, memberName: existing ? existing.name : null });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/members', (req, res) => {
    try {
        const { name, phone, age, naturality, is_foreigner, marital_status, gender, education, profession, cpf, birth_date } = req.body;

        // Validation
        if (!name || !phone) return res.status(400).json({ error: 'Nome e Telefone são obrigatórios.' });
        if (cpf && members.getByCpf(cpf)) return res.status(400).json({ error: 'CPF já cadastrado.' });
        if (members.getByPhone(phone)) return res.status(400).json({ error: 'Telefone já cadastrado.' });

        const info = members.create({
            name, phone, age: age || 0,
            naturality, is_foreigner: is_foreigner ? 1 : 0,
            marital_status, gender, education, profession,
            cpf: (is_foreigner || !cpf || cpf === "") ? null : cpf,
            birth_date
        });

        systemLogs.create('CREATE', 'MEMBER', name, { id: info.lastInsertRowid, name, phone });

        res.json({ success: true, id: info.lastInsertRowid });
    } catch (e) {
        console.error('Member Create Error:', e);
        if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Dados duplicados (CPF ou Telefone).' });
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/members/:id', (req, res) => {
    try {
        const { id } = req.params;

        // Transaction-like sequence to handle FK constraints manually
        // 1. Remove from team_members
        db.prepare('DELETE FROM team_members WHERE member_id = ?').run(id);

        // 2. Unset as leader in any team
        db.prepare('UPDATE teams SET general_leader_id = NULL WHERE general_leader_id = ?').run(id);
        db.prepare('UPDATE teams SET sub_leader1_id = NULL WHERE sub_leader1_id = ?').run(id);
        db.prepare('UPDATE teams SET sub_leader2_id = NULL WHERE sub_leader2_id = ?').run(id);
        db.prepare('UPDATE teams SET sub_leader3_id = NULL WHERE sub_leader3_id = ?').run(id);

        // 3. Delete member
        const info = db.prepare('DELETE FROM members WHERE id = ?').run(id);

        if (info.changes === 0) return res.status(404).json({ error: 'Membro não encontrado' });

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Team Routes
app.get('/api/teams', (req, res) => {
    try { res.json(teams.getAll()); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/teams', (req, res) => {
    try {
        const { name, general_leader_id, sub_leader1_id, sub_leader2_id, sub_leader3_id, members: memberIds } = req.body;

        const allowedTeams = [
            'Projeção', 'Iluminação', 'Transmissão', 'Fotografia',
            'Stories', 'Sonoplastia', 'Edição'
        ];

        if (!allowedTeams.includes(name)) {
            return res.status(400).json({ error: 'Nome de equipe inválido.' });
        }

        // Helper to clean IDs (empty string -> null)
        const cleanId = (id) => (id && id !== "") ? id : null;

        console.log('Creating team:', { name, general_leader_id, memberIds }); // Debug log

        // 1. Create Team
        const teamId = teams.create({
            name,
            general_leader_id: cleanId(general_leader_id) ? parseInt(general_leader_id) : null,
            sub_leader1_id: cleanId(sub_leader1_id) ? parseInt(sub_leader1_id) : null,
            sub_leader2_id: cleanId(sub_leader2_id) ? parseInt(sub_leader2_id) : null,
            sub_leader3_id: cleanId(sub_leader3_id) ? parseInt(sub_leader3_id) : null
        });

        // 2. Add Members
        const errors = [];
        if (Array.isArray(memberIds)) {
            for (const mid of memberIds) {
                try {
                    const memberIdInt = parseInt(mid);
                    if (isNaN(memberIdInt)) throw new Error(`ID de membro inválido: ${mid}`);
                    teams.addMember(teamId, memberIdInt);
                } catch (err) {
                    console.error(`Error adding member ${mid} to team ${teamId}:`, err.message);
                    errors.push(err.message);
                }
            }
        }

        res.json({ success: true, teamId, warnings: errors.length ? errors : null });
        systemLogs.create('CREATE', 'TEAM', name, { id: teamId, membersCount: memberIds ? memberIds.length : 0 });

    } catch (e) {
        console.error('Team Create Error Stack:', e.stack);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/teams/:id', (req, res) => {
    try {
        const { id } = req.params;
        // 1. Remove members association first
        db.prepare('DELETE FROM team_members WHERE team_id = ?').run(id);
        // 2. Delete team
        const team = teams.getById(id);
        const teamName = team ? team.name : 'Unknown';

        const info = db.prepare('DELETE FROM teams WHERE id = ?').run(id);

        if (info.changes === 0) return res.status(404).json({ error: 'Equipe não encontrada' });

        systemLogs.create('DELETE', 'TEAM', teamName, { id });

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Stats Routes
app.get('/api/stats', (req, res) => {
    try {
        const { teamCounts } = stats.getCounts();

        // Calculate Age Distribution
        const allMembers = members.getAll();
        const ageDist = { '12-17': 0, '18-25': 0, '26-35': 0, '36+': 0 };

        allMembers.forEach(m => {
            const age = parseInt(m.age);
            if (age >= 12 && age <= 17) ageDist['12-17']++;
            else if (age >= 18 && age <= 25) ageDist['18-25']++;
            else if (age >= 26 && age <= 35) ageDist['26-35']++;
            else if (age >= 36) ageDist['36+']++;
        });

        console.log('Stats calculated successfully');

        const accountCode = "AH7-23X";

        res.json({
            accountCode,
            teamCounts,
            ageDistribution: ageDist
        });
    } catch (e) {
        console.error('Stats Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// User/Staff Routes (Old team logic, keeping for compatibility if needed)
app.get('/api/users', (req, res) => {
    try { res.json(users.getAll()); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Folder Routes
app.get('/api/folders', (req, res) => {
    try {
        const allFolders = folders.getAll();
        res.json(allFolders);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/folders', (req, res) => {
    try {
        const { name } = req.body;
        folders.create({ name });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Training Routes
app.get('/api/trainings', (req, res) => {
    try {
        const allTrainings = trainings.getAll();
        res.json(allTrainings);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/trainings', (req, res) => {
    try {
        const { title, folder_id, type, url, description, notes } = req.body;
        const cleanFolderId = (folder_id && folder_id !== "") ? folder_id : null;

        trainings.create({
            title,
            folder_id: cleanFolderId,
            type, url, description, notes
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/trainings/:id', (req, res) => {
    try {
        const { id } = req.params;
        const training = trainings.getById(id);
        const trainingTitle = training ? training.title : 'Unknown';
        const info = trainings.delete(id);
        if (info.changes === 0) return res.status(404).json({ error: 'Treinamento não encontrado' });
        systemLogs.create('DELETE', 'TRAINING', trainingTitle, { id });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/folders/:id', (req, res) => {
    try {
        const { id } = req.params;
        const folder = folders.getById(id);
        const folderName = folder ? folder.name : 'Unknown';
        const info = folders.delete(id);
        if (info.changes === 0) return res.status(404).json({ error: 'Pasta não encontrada' });
        systemLogs.create('DELETE', 'FOLDER', folderName, { id });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Watch Progress Routes
app.get('/api/watch-progress/:userId', (req, res) => {
    try {
        const progress = watchProgress.getByUser(req.params.userId);
        res.json(progress);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/watch-progress', (req, res) => {
    try {
        const { user_id, training_id, watched_seconds, total_seconds, completed } = req.body;
        watchProgress.upsert({
            user_id,
            training_id,
            watched_seconds: watched_seconds || 0,
            total_seconds: total_seconds || 0,
            completed: completed ? 1 : 0
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========== Team Events ==========

app.get('/api/team-events', (req, res) => {
    try {
        const { year, month } = req.query;
        if (year && month) {
            res.json(teamEvents.getByMonth(parseInt(year), parseInt(month)));
        } else {
            res.json(teamEvents.getAll());
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/team-events', (req, res) => {
    try {
        const { team_id, event_name, event_time, event_date, recurrence_type, recurrence_interval, recurrence_end, roles } = req.body;
        if (!team_id || !event_name || !event_time || !event_date) {
            return res.status(400).json({ error: 'Campos obrigatórios faltando.' });
        }

        // Generate dates based on recurrence
        const dates = [event_date];
        if (recurrence_type && recurrence_type !== 'none' && recurrence_end) {
            const start = new Date(event_date);
            const end = new Date(recurrence_end);
            let current = new Date(start);

            while (current <= end) {
                if (recurrence_type === 'weekly') {
                    current.setDate(current.getDate() + 7);
                } else if (recurrence_type === 'monthly') {
                    current.setMonth(current.getMonth() + 1);
                } else if (recurrence_type === 'custom') {
                    current.setDate(current.getDate() + (recurrence_interval || 1));
                }
                if (current <= end) {
                    dates.push(current.toISOString().split('T')[0]);
                }
            }
        }

        const createdIds = [];
        for (const date of dates) {
            const info = teamEvents.create({
                team_id,
                event_name,
                event_time,
                event_date: date,
                recurrence_type: recurrence_type || 'none',
                recurrence_interval: recurrence_interval || 0,
                recurrence_end: recurrence_end || null
            });
            const eventId = info.lastInsertRowid;
            createdIds.push(eventId);

            // Add roles
            if (roles && Array.isArray(roles)) {
                for (const role of roles) {
                    if (role.role_name && role.member_id) {
                        teamEvents.addRole(eventId, role.role_name, role.member_id);
                    }
                }
            }
        }

        systemLogs.create('CREATE', 'TEAM_EVENT', event_name, { team_id, dates: dates.length, recurrence_type });
        res.json({ success: true, ids: createdIds, totalEvents: dates.length });
    } catch (e) {
        console.error('Team Event Create Error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/team-events/:id/roles', (req, res) => {
    try {
        res.json(teamEvents.getRolesByEvent(req.params.id));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/team-events/:id', (req, res) => {
    try {
        const { id } = req.params;
        const event = teamEvents.getById(id);
        const eventName = event ? event.event_name : 'Unknown';
        const info = teamEvents.delete(id);
        if (info.changes === 0) return res.status(404).json({ error: 'Evento não encontrado' });
        systemLogs.create('DELETE', 'TEAM_EVENT', eventName, { id });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => {
    console.log(`Shemá Server running on http://localhost:${PORT}`);
});
