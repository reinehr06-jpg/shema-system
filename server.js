const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const cron = require('node-cron');
const { db, users, members, teams, serviceRecords, trainings, folders, stats, systemLogs, watchProgress, teamEvents, eventScales, scaleAssignments, sectors, availabilities, whatsappInstances, roles, eventAssignments, eventAvailability, organization, accountSettings, loginHistory, activeSessions, googleCalendar } = require('./database');
const { sendWhatsAppMessage, sendAvisoEscalasFuturas, cronLembretes12h, cronAniversarios, checkAndSendBirthdayOnSave } = require('./messageService');

// Load .env if exists
try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const [key, ...val] = line.split('=');
            if (key && val.length) process.env[key.trim()] = val.join('=').trim();
        });
    }
} catch (e) { console.warn('.env load warning:', e.message); }

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';

const app = express();
const PORT = process.env.PORT || 3000;

// Multer config for file uploads
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, uniqueSuffix + ext);
    }
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } }); // 500MB limit

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Set up Cron Jobs for Automatic Messaging
cron.schedule('0 * * * *', () => {
    // Roda no minuto 0 de cada hora
    console.log('Executando cron de lembretes (12h)...');
    cronLembretes12h().catch(console.error);
});

cron.schedule('0 9 * * *', () => {
    // Roda às 09:00 todos os dias
    console.log('Executando cron de aniversários...');
    cronAniversarios().catch(console.error);
});

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
        const { name, email, cpf_cnpj, phone, password } = req.body;

        if (email) {
            const existingEmail = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
            if (existingEmail) return res.status(400).json({ error: 'Este e-mail já está cadastrado em outra conta.' });
        }
        
        if (cpf_cnpj) {
            const existingCpf = db.prepare('SELECT id FROM users WHERE cpf_cnpj = ?').get(cpf_cnpj);
            if (existingCpf) return res.status(400).json({ error: 'Este CPF/CNPJ já está cadastrado em outra conta.' });
        }

        if (phone) {
            const existingPhone = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
            if (existingPhone) return res.status(400).json({ error: 'Este telefone já está cadastrado em outra conta.' });
        }

        // Create a new account for this user
        const accountResult = db.prepare('INSERT INTO accounts (name) VALUES (?)').run(`${name} Account`);
        const accountId = accountResult.lastInsertRowid;

        const result = users.create({
            account_id: accountId,
            name,
            email: email.toLowerCase(),
            phone,
            cpf_cnpj,
            password,
            role: 'admin' // Initial registrations are admins of their own account
        });
        res.json({ success: true, id: result.lastInsertRowid, accountId });
    } catch (e) {
        if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'E-mail já cadastrado em outra conta.' });
        }
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/auth/login', (req, res) => {
    try {
        const { email, password } = req.body;
        const user = users.findByEmail(email.toLowerCase());
        if (!user || !bcrypt.compareSync(password, user.password)) {
            if (user) loginHistory.create({ user_id: user.id, ip_address: req.ip, user_agent: req.headers['user-agent'], success: false });
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }
        loginHistory.create({ user_id: user.id, ip_address: req.ip, user_agent: req.headers['user-agent'], success: true });
        db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
        const { password: _, reset_token: __, reset_token_expiry: ___, ...safeUser } = user;
        res.json({ success: true, user: safeUser });
    } catch (e) { res.status(500).json({ error: e.message }); }
});


// Password Recovery Routes
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { identifier } = req.body; // Can be email or phone
        if (!identifier) return res.status(400).json({ error: 'Informe e-mail ou telefone.' });

        let user = users.findByEmail(identifier.toLowerCase());
        if (!user) {
            user = users.findByPhone(identifier);
        }

        if (!user) {
            // Security: don't reveal if user exists, but here we usually notify for simplicity in dev
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        const token = crypto.randomBytes(20).toString('hex');
        users.setResetToken(user.id, token);

        // Real recovery via WhatsApp
        const text = `Seu código de recuperação SHEMA: ${token}\n\nUse este código no site para redefinir sua senha.`;
        const sent = await sendWhatsAppMessage(user.phone || '', text);

        if (sent) {
            console.log(`[PASS_RECOVERY] Token sent via WhatsApp to ${user.phone}`);
            systemLogs.create('AUTH', 'RESET_TOKEN_SENT', user.name, { email: user.email, phone: user.phone });
        } else {
            console.error(`[PASS_RECOVERY] Failed to send WhatsApp to ${user.phone}`);
            // Fallback to console for debugging
            console.log(`[PASS_RECOVERY] TOKEN: ${token}`);
        }

        res.json({ success: true, message: 'Se o usuário possuir um telefone cadastrado e instância ativa, o código foi enviado.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/reset-password', (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) return res.status(400).json({ error: 'Token e nova senha são obrigatórios.' });

        const user = users.findByResetToken(token);
        if (!user) return res.status(400).json({ error: 'Token inválido ou expirado.' });

        users.updatePassword(user.id, newPassword);
        systemLogs.create('AUTH', 'PASSWORD_RESET', user.name, { userId: user.id });

        res.json({ success: true, message: 'Senha alterada com sucesso.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Admin Password Management
app.post('/api/admin/users/:id/password', (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword, adminId } = req.body;

        // Basic authorization check (adminId should be provided and have admin role)
        // In a real app, this would use JWT/Session roles
        const admin = db.prepare('SELECT * FROM users WHERE id = ?').get(adminId);
        if (!admin || admin.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem alterar senhas.' });
        }

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

        users.updatePassword(id, newPassword);
        systemLogs.create('ADMIN', 'PASSWORD_OVERRIDE', user.name, { changedBy: admin.name, userId: id });

        res.json({ success: true, message: `Senha do usuário ${user.name} alterada com sucesso.` });
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

app.get('/api/availabilities', (req, res) => {
    try {
        const { year, month } = req.query;
        if (!year || !month) return res.status(400).json({ error: 'Year and month required' });
        res.json(availabilities.getAllByMonth(year, month));
    } catch (e) { res.status(500).json({ error: e.message }); }
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
        const {
            name, phone, age, naturality, is_foreigner, marital_status,
            gender, education, profession, cpf, birth_date, sector,
            createAccess, email, password, userRole
        } = req.body;

        // Validation
        if (!name) return res.status(400).json({ error: 'O Nome é obrigatório.' });
        if (cpf && members.getByCpf(cpf)) return res.status(400).json({ error: 'CPF já cadastrado.' });
        if (phone && members.getByPhone(phone)) return res.status(400).json({ error: 'Telefone já cadastrado.' });

        // 1. Create Member
        const info = members.create({
            name, phone: phone || null, age: age || 0,
            naturality: naturality || null,
            is_foreigner: is_foreigner ? 1 : 0,
            marital_status: marital_status || null,
            gender: gender || null,
            education: education || null,
            profession: profession || null,
            cpf: (is_foreigner || !cpf || cpf === "") ? null : cpf,
            birth_date: birth_date || null,
            sector: sector || null
        });

        const memberId = info.lastInsertRowid;

        // 2. Create Linked User Access if requested
        if (createAccess && email && password) {
            try {
                users.create({
                    name,
                    email: email.toLowerCase(),
                    password,
                    role: userRole || 'volunteer',
                    linked_member_id: memberId
                });
            } catch (userErr) {
                console.error('Error creating linked user:', userErr);
                // We don't fail the member creation, but notify in logs
            }
        }

        systemLogs.create('CREATE', 'MEMBER', name, { id: memberId, name, phone });

        // Check if today is birthday and send message if within constraints
        checkAndSendBirthdayOnSave(memberId).catch(console.error);

        res.json({ success: true, id: memberId });
    } catch (e) {
        console.error('Member Create Error:', e);
        if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Dados duplicados (CPF ou Telefone).' });
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/members/:id', (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, phone, age, naturality, is_foreigner, marital_status,
            gender, education, profession, cpf, birth_date, sector
        } = req.body;

        if (!name) return res.status(400).json({ error: 'O Nome é obrigatório.' });
        if (cpf) {
            const existing = members.getByCpf(cpf);
            if (existing && existing.id !== parseInt(id)) return res.status(400).json({ error: 'CPF já cadastrado.' });
        }
        if (phone) {
            const existing = members.getByPhone(phone);
            if (existing && existing.id !== parseInt(id)) return res.status(400).json({ error: 'Telefone já cadastrado.' });
        }

        members.update(id, {
            name, phone: phone || null, age: age || 0,
            naturality: naturality || null,
            is_foreigner: is_foreigner ? 1 : 0,
            marital_status: marital_status || null,
            gender: gender || null,
            education: education || null,
            profession: profession || null,
            cpf: (is_foreigner || !cpf || cpf === "") ? null : cpf,
            birth_date: birth_date || null,
            sector: sector || null
        });

        systemLogs.create('UPDATE', 'MEMBER', name, { id, name, phone });

        // Check if today is birthday and send message if within constraints
        checkAndSendBirthdayOnSave(id).catch(console.error);

        res.json({ success: true, id });
    } catch (e) {
        console.error('Member Update Error:', e);
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
    try {
        const accountId = parseInt(req.query.accountId);
        const allTeams = teams.getAll(accountId);
        res.json(allTeams);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/teams', (req, res) => {
    try {
        const { name, area, sector_id, general_leader_id, sub_leader1_id, sub_leader2_id, sub_leader3_id, subdivisions, accountId } = req.body;

        const cleanId = (id) => (id && id !== "") ? id : null;

        // 1. Create Team
        const teamId = teams.create({
            name: name || area,
            area: area || null,
            sector_id: cleanId(sector_id) ? parseInt(sector_id) : null,
            general_leader_id: cleanId(general_leader_id) ? parseInt(general_leader_id) : null,
            sub_leader1_id: cleanId(sub_leader1_id) ? parseInt(sub_leader1_id) : null,
            sub_leader2_id: cleanId(sub_leader2_id) ? parseInt(sub_leader2_id) : null,
            sub_leader3_id: cleanId(sub_leader3_id) ? parseInt(sub_leader3_id) : null,
            account_id: accountId // Add accountId here
        });

        // 2. Add Subdivisions
        if (Array.isArray(subdivisions)) {
            for (const sub of subdivisions) {
                teams.addSubdivision({
                    team_id: teamId,
                    name: sub.name,
                    min_qty: parseInt(sub.min_qty) || 1,
                    max_qty: parseInt(sub.max_qty) || 1
                });
            }
        }

        res.json({ success: true, teamId });
        systemLogs.create('CREATE', 'TEAM', name || area, { id: teamId, subdivisionsCount: subdivisions ? subdivisions.length : 0, accountId });

    } catch (e) {
        console.error('Team Create Error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/teams/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { name, area, sector_id, general_leader_id, sub_leader1_id, sub_leader2_id, sub_leader3_id, subdivisions } = req.body;

        const cleanId = (v) => (v && v !== '' && v !== 'null') ? parseInt(v) : null;

        // 1. Update team
        teams.update(id, {
            name: name || area,
            area: area || null,
            sector_id: cleanId(sector_id),
            general_leader_id: cleanId(general_leader_id),
            sub_leader1_id: cleanId(sub_leader1_id),
            sub_leader2_id: cleanId(sub_leader2_id),
            sub_leader3_id: cleanId(sub_leader3_id)
        });

        // 2. Rebuild subdivisions
        teams.clearSubdivisions(id);
        if (Array.isArray(subdivisions)) {
            for (const sub of subdivisions) {
                teams.addSubdivision({
                    team_id: parseInt(id),
                    name: sub.name,
                    min_qty: parseInt(sub.min_qty) || 1,
                    max_qty: parseInt(sub.max_qty) || 1
                });
            }
        }

        systemLogs.create('UPDATE', 'TEAM', name || area, { id });
        res.json({ success: true });
    } catch (e) {
        console.error('Team Update Error:', e);
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

// Sector Routes
app.get('/api/sectors', (req, res) => {
    try {
        const accountId = parseInt(req.query.accountId);
        res.json(sectors.getAll(accountId));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sectors', (req, res) => {
    try {
        const { name, accountId } = req.body;
        if (!name) return res.status(400).json({ error: 'Nome do setor é obrigatório' });
        const result = sectors.create(accountId, name);
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/sectors/:id', (req, res) => {
    try {
        sectors.delete(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Roles Routes
app.get('/api/roles', (req, res) => {
    try {
        res.json(roles.getAll());
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/roles', (req, res) => {
    try {
        const result = roles.create(req.body);
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/roles/:id', (req, res) => {
    try {
        roles.delete(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
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

app.post('/api/trainings', upload.single('file'), (req, res) => {
    try {
        const { title, folder_id, type, url, description, notes } = req.body;
        const cleanFolderId = (folder_id && folder_id !== "") ? folder_id : null;

        let finalUrl = url || '';
        if (type === 'file' && req.file) {
            finalUrl = '/uploads/' + req.file.filename;
        }

        trainings.create({
            title,
            folder_id: cleanFolderId,
            type,
            url: finalUrl,
            description: description || '',
            notes: notes || ''
        });
        systemLogs.create('CREATE', 'TRAINING', title, { type, folder_id: cleanFolderId });
        res.json({ success: true });
    } catch (e) {
        console.error('Training Create Error:', e);
        res.status(500).json({ error: e.message });
    }
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

// Calendar view: group events by date
app.get('/api/team-events/calendar', (req, res) => {
    try {
        const { year, month } = req.query;
        const events = (year && month) ? teamEvents.getByMonth(parseInt(year), parseInt(month)) : teamEvents.getAll();
        const byDate = {};
        events.forEach(ev => {
            const d = ev.event_date;
            if (!byDate[d]) byDate[d] = [];
            byDate[d].push(ev);
        });
        res.json(byDate);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/team-events/:id', (req, res) => {
    try {
        const event = teamEvents.getById(parseInt(req.params.id));
        if (!event) return res.status(404).json({ error: 'Evento não encontrado.' });
        res.json(event);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/team-events', (req, res) => {
    try {
        const { event_name, event_time, event_date, recurrence_type, recurrence_interval, recurrence_end } = req.body;

        // Basic validation
        if (!event_name || !event_time || !event_date) {
            return res.status(400).json({ error: 'Campos obrigatórios: nome, horário e data.' });
        }

        // Time format validation (HH:MM or H:MM)
        const timeRegex = /^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(event_time)) {
            return res.status(400).json({ error: 'Horário inválido. Use o formato HH:MM.' });
        }

        // Date format validation (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
            return res.status(400).json({ error: 'Data de início inválida.' });
        }

        // Recurrence validation
        if (recurrence_type && recurrence_type !== 'none') {
            if (!recurrence_end) {
                return res.status(400).json({ error: 'Data final é obrigatória para eventos recorrentes.' });
            }
            if (new Date(recurrence_end) < new Date(event_date)) {
                return res.status(400).json({ error: 'Data final não pode ser anterior à data de início.' });
            }
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
                event_name,
                event_time,
                event_date: date,
                recurrence_type: recurrence_type || 'none',
                recurrence_interval: recurrence_interval || 0,
                recurrence_end: recurrence_end || null,
                status: 'critical' // Evento começa sem nenhuma escala preenchida
            });
            createdIds.push(info.lastInsertRowid);
        }

        systemLogs.create('CREATE', 'TEAM_EVENT', event_name, { dates: dates.length, recurrence_type });
        res.json({ success: true, ids: createdIds, totalEvents: dates.length });
    } catch (e) {
        console.error('Team Event Create Error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/team-events/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { event_name, event_time, event_date, recurrence_type, recurrence_interval, recurrence_end } = req.body;

        if (!event_name || !event_time || !event_date) {
            return res.status(400).json({ error: 'Campos obrigatórios faltando.' });
        }

        // Validation (same as POST but for a single instance)
        const timeRegex = /^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(event_time)) {
            return res.status(400).json({ error: 'Horário inválido.' });
        }

        teamEvents.update(id, {
            event_name,
            event_time,
            event_date,
            recurrence_type: recurrence_type || 'none',
            recurrence_interval: recurrence_interval || 0,
            recurrence_end: recurrence_end || null
        });

        systemLogs.create('UPDATE', 'TEAM_EVENT', event_name, { id });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// SCALES MANAGEMENT
app.get('/api/team-events/:id/scales', (req, res) => {
    try {
        res.json(eventScales.getByEvent(parseInt(req.params.id)));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/team-events/:id/scales', (req, res) => {
    try {
        const { team_id } = req.body;
        const info = eventScales.create({
            event_id: req.params.id,
            team_id,
            status: 'pending'
        });
        eventScales.recalculateEventStatus(parseInt(req.params.id));
        res.json({ success: true, id: info.lastInsertRowid });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/team-events/:id/scales/:teamId', (req, res) => {
    try {
        eventScales.delete(req.params.id, req.params.teamId);
        eventScales.recalculateEventStatus(parseInt(req.params.id));
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/team-events/:id/scales/:teamId/assignments', (req, res) => {
    try {
        const { subdivision_id, member_id } = req.body;
        scaleAssignments.add({
            event_id: req.params.id,
            team_id: req.params.teamId,
            subdivision_id,
            member_id
        });
        eventScales.recalculateEventStatus(parseInt(req.params.id));
        
        // Trigger automatic message for upcoming scales
        sendAvisoEscalasFuturas(member_id).catch(err => console.error('Error sending whatsapp aviso:', err));

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/team-events/:id/scales/:teamId/assignments', (req, res) => {
    try {
        const { subdivision_id, member_id } = req.query;
        scaleAssignments.remove(req.params.id, req.params.teamId, subdivision_id, member_id);
        eventScales.recalculateEventStatus(parseInt(req.params.id));
        res.json({ success: true });
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

// Enhanced Stats
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

        const org = organization.get();
        res.json({
            teamCounts,
            ageDistribution: ageDist,
            accountCode: org ? org.account_code : 'AH7-23X',
            statMembers: allMembers.length,
            statTeams: teamCounts.length,
            statTrainings: trainings.getAll().length
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// WhatsApp / Evolution API Management
app.get('/api/whatsapp/status-summary', (req, res) => {
    try {
        const instances = whatsappInstances.getAll();
        const anyOffline = instances.some(i => i.status !== 'connected' && i.status !== 'open');
        res.json({ anyOffline });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/whatsapp/instances', (req, res) => {
    try {
        res.json(whatsappInstances.getAll());
    } catch (e) { res.status(500).json({ error: e.message }); }
});



app.post('/api/whatsapp/connect/:teamId', async (req, res) => {
    try {
        const { teamId } = req.params;
        const role = req.body.role || 'leader';
        const instanceName = `team_${teamId}_${role}`;

        if (!EVOLUTION_API_KEY) {
            return res.status(500).json({ error: 'EvolutionAPI não configurada. Defina EVOLUTION_API_URL e EVOLUTION_API_KEY no arquivo .env' });
        }

        const headers = { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY };

        // Helper: sleep
        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        // 1. Try to create instance (or reuse existing)
        try {
            await axios.post(`${EVOLUTION_API_URL}/instance/create`, {
                instanceName: instanceName,
                qrcode: true,
                integration: 'WHATSAPP-BAILEYS'
            }, { headers });
        } catch (createErr) {
            // Instance may already exist - if so, delete and recreate to force new QR
            if (createErr.response && (createErr.response.status === 409 || createErr.response.status === 403)) {
                try {
                    await axios.delete(`${EVOLUTION_API_URL}/instance/delete/${instanceName}`, { headers });
                    await sleep(1000);
                    await axios.post(`${EVOLUTION_API_URL}/instance/create`, {
                        instanceName: instanceName,
                        qrcode: true,
                        integration: 'WHATSAPP-BAILEYS'
                    }, { headers });
                } catch (recreateErr) {
                    console.error('Instance recreate error:', recreateErr.response?.data || recreateErr.message);
                }
            } else {
                console.error('Instance create error:', createErr.response?.data || createErr.message);
            }
        }

        // Update local DB
        const existing = db.prepare('SELECT id FROM whatsapp_instances WHERE name = ?').get(instanceName);
        if (existing) {
            db.prepare('UPDATE whatsapp_instances SET status = ?, apikey = ? WHERE id = ?').run('connecting', EVOLUTION_API_KEY, existing.id);
        } else {
            whatsappInstances.create({ name: instanceName, instance_id: instanceName, status: 'connecting', apikey: EVOLUTION_API_KEY });
        }

        // 2. Poll for QR code — Evolution API may take a few seconds to generate it
        let qrCode = null;
        let pairingCode = null;
        let state = 'connecting';
        const MAX_RETRIES = 8;
        const RETRY_DELAY_MS = 2000;

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            if (attempt > 0) await sleep(RETRY_DELAY_MS);

            try {
                const connectRes = await axios.get(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, { headers });
                const data = connectRes.data;

                state = data.instance?.state || data.state || 'connecting';

                if (state === 'open' || state === 'connected') {
                    db.prepare('UPDATE whatsapp_instances SET status = ? WHERE name = ?').run('connected', instanceName);
                    return res.json({ status: 'connected' });
                }

                qrCode = data.base64 || data.qrcode?.base64 || (typeof data.qrcode === 'string' ? data.qrcode : null) || null;
                pairingCode = data.pairingCode || data.pairing_code || null;

                if (qrCode) break; // Got QR, stop polling
            } catch (pollErr) {
                console.warn(`QR poll attempt ${attempt + 1} failed:`, pollErr.response?.data || pollErr.message);
            }
        }

        res.json({
            qrcode: qrCode,
            pairing_code: pairingCode,
            status: 'connecting',
            base64: qrCode
        });
    } catch (e) {
        console.error('WhatsApp Connect Error:', e.response?.data || e.message);
        const errMsg = e.response?.data?.response?.message?.[0] || e.response?.data?.message || e.message;
        res.status(500).json({ error: 'Erro ao conectar WhatsApp: ' + errMsg });
    }
});

// WhatsApp status check via EvolutionAPI
app.get('/api/whatsapp/status/:teamId', async (req, res) => {
    try {
        const { teamId } = req.params;
        const role = req.query.role || 'leader';
        const instanceName = `team_${teamId}_${role}`;

        if (!EVOLUTION_API_KEY) {
            // Fallback to local DB
            const instance = db.prepare('SELECT * FROM whatsapp_instances WHERE name = ?').get(instanceName);
            if (!instance) return res.json({ status: 'not_created' });
            return res.json(instance);
        }

        const headers = { 'apikey': EVOLUTION_API_KEY };

        try {
            const stateRes = await axios.get(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, { headers });
            const state = stateRes.data?.instance?.state || stateRes.data?.state || 'disconnected';

            // Sync to local DB
            const mappedStatus = (state === 'open' || state === 'connected') ? 'connected' : 'disconnected';
            db.prepare('UPDATE whatsapp_instances SET status = ? WHERE name = ?').run(mappedStatus, instanceName);

            res.json({ status: mappedStatus, name: instanceName, raw_state: state });
        } catch (apiErr) {
            // Instance doesn't exist in EvolutionAPI
            res.json({ status: 'not_created' });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/whatsapp/logout/:teamId', async (req, res) => {
    try {
        const { teamId } = req.params;
        const role = req.query.role || 'leader';
        const instanceName = `team_${teamId}_${role}`;

        if (EVOLUTION_API_KEY) {
            const headers = { 'apikey': EVOLUTION_API_KEY };
            try {
                await axios.delete(`${EVOLUTION_API_URL}/instance/logout/${instanceName}`, { headers });
            } catch (apiErr) {
                console.warn('Logout API error (may already be disconnected):', apiErr.response?.data || apiErr.message);
            }
        }

        db.prepare('UPDATE whatsapp_instances SET status = ? WHERE name = ?').run('disconnected', instanceName);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Member Portal Routes
app.get('/api/member-portal/availability', (req, res) => {
    // Mock user for now - in real implementation would use req.user.linked_member_id
    res.json([]);
});

app.get('/api/member-portal/assignments', (req, res) => {
    res.json([]);
});

app.post('/api/member-portal/assignments/:id/confirm', (req, res) => {
    try {
        eventAssignments.updateStatus(req.params.id, 'confirmed');
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/member-portal/assignments/:id/decline', (req, res) => {
    try {
        eventAssignments.updateStatus(req.params.id, 'declined', req.body.reason);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== MINHA CONTA API ROUTES =====

// Organization
app.get('/api/organization', (req, res) => {
    try {
        const org = organization.get();
        res.json(org || {});
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/organization', (req, res) => {
    try {
        organization.update(req.body);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/organization/logo', upload.single('logo'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
        const logoPath = '/uploads/' + req.file.filename;
        organization.update({ logo_path: logoPath });
        res.json({ success: true, logo_path: logoPath });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/organization/logo', (req, res) => {
    try {
        const org = organization.get();
        if (org && org.logo_path) {
            const fullPath = path.join(__dirname, 'public', org.logo_path);
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        }
        organization.update({ logo_path: null });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Account Settings (Preferences)
app.get('/api/account/settings', (req, res) => {
    try {
        res.json(accountSettings.get() || {});
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/account/settings', (req, res) => {
    try {
        accountSettings.update(req.body);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Password Change
app.put('/api/account/password', (req, res) => {
    try {
        const { userId, currentPassword, newPassword } = req.body;
        if (!userId || !currentPassword || !newPassword) return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
        if (!bcrypt.compareSync(currentPassword, user.password)) return res.status(401).json({ error: 'Senha atual incorreta.' });
        users.updatePassword(userId, newPassword);
        res.json({ success: true, message: 'Senha alterada com sucesso.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Sessions
app.get('/api/account/sessions', (req, res) => {
    try {
        res.json(activeSessions.getAll());
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/account/sessions/:id', (req, res) => {
    try {
        activeSessions.delete(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/account/sessions', (req, res) => {
    try {
        activeSessions.deleteAll();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Login History
app.get('/api/account/login-history', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        res.json(loginHistory.getRecent(limit));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Plan Info
app.get('/api/account/plan', (req, res) => {
    try {
        const memberCount = db.prepare('SELECT COUNT(*) as c FROM members').get().c;
        const teamCount = db.prepare('SELECT COUNT(*) as c FROM teams').get().c;
        const trainingCount = db.prepare('SELECT COUNT(*) as c FROM trainings').get().c;
        const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
        res.json({
            plan_name: 'Plano Pro',
            status: 'Ativo',
            billing_cycle: 'Mensal',
            next_billing: '2026-03-24',
            price: 'R$ 49,90',
            limits: {
                members: { used: memberCount, max: 500 },
                teams: { used: teamCount, max: 50 },
                trainings: { used: trainingCount, max: 100 },
                users: { used: userCount, max: 10 }
            }
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// User Management (enhanced)
app.put('/api/users/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { role, status, name, email, phone } = req.body;
        const fields = [];
        const values = [];
        if (role) { fields.push('role = ?'); values.push(role); }
        if (status) { fields.push('status = ?'); values.push(status); }
        if (name) { fields.push('name = ?'); values.push(name); }
        if (email) { fields.push('email = ?'); values.push(email.toLowerCase()); }
        if (phone !== undefined) { fields.push('phone = ?'); values.push(phone); }
        if (fields.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
        values.push(id);
        db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users', (req, res) => {
    try {
        const { name, email, password, role, phone } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
        users.create({ name, email: email.toLowerCase(), password, role: role || 'volunteer', phone: phone || null });
        res.json({ success: true });
    } catch (e) {
        if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Email já cadastrado.' });
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/users/:id', (req, res) => {
    try {
        db.prepare('UPDATE users SET status = ? WHERE id = ?').run('inactive', req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users/:id/force-logout', (req, res) => {
    try {
        activeSessions.deleteByUser(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});


// Get single team by ID (for editTeam)
app.get('/api/teams/:id', (req, res) => {
    try {
        const { id } = req.params;
        const team = teams.getById(id);
        if (!team) return res.status(404).json({ error: 'Equipe não encontrada' });
        // Get subdivisions and leaders
        const subdivisions = db.prepare('SELECT * FROM team_subdivisions WHERE team_id = ? ORDER BY name').all(id);
        const leaders = db.prepare('SELECT tl.*, m.name as member_name FROM team_leaders tl JOIN members m ON tl.member_id = m.id WHERE tl.team_id = ?').all(id);
        res.json({ ...team, subdivisions, leaders });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// Google Calendar Integration Routes
// ==========================================

function getGoogleConfig(req) {
    const dbSettings = googleCalendar.get();
    const config = {
        clientId: dbSettings?.client_id || process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: dbSettings?.client_secret || process.env.GOOGLE_CLIENT_SECRET || '',
    };

    // Calculate dynamic redirect URI based on current request host
    // FALLBACK TO 3000 (Matches Docker config) instead of 3002/None
    let host = req ? req.get('host') : 'localhost:3000';
    let protocol = req ? req.protocol : 'http';
    
    // Nginx proxy check: Use X-Forwarded-Proto if available
    if (req && req.headers['x-forwarded-proto']) {
        protocol = req.headers['x-forwarded-proto'];
    }

    const redirectUri = `${protocol}://${host}/api/google-calendar/callback`;
    
    return {
        ...config,
        redirectUri: process.env.GOOGLE_REDIRECT_URI || redirectUri
    };
}

app.get('/api/google-calendar/status', (req, res) => {
    try {
        const settings = googleCalendar.get();
        // Return only safe flags
        res.json({
            connected: !!(settings && settings.refresh_token),
            last_sync: settings ? settings.last_sync : null
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/google-calendar/auth-url', (req, res) => {
    const config = getGoogleConfig(req);
    console.log('[GCAL_AUTH] Initiating Auth URL generation...');
    console.log('[GCAL_AUTH] Client ID:', config.clientId ? 'OK (Present)' : 'ERROR (Missing)');
    console.log('[GCAL_AUTH] Redirect URI:', config.redirectUri);
    
    if (!config.clientId) {
        return res.status(500).json({ error: 'Configuração OAuth do Google ausente. Configure no painel de Conexões.' });
    }
    const scopes = encodeURIComponent('https://www.googleapis.com/auth/calendar.readonly');
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(config.redirectUri)}&response_type=code&scope=${scopes}&access_type=offline&prompt=consent`;
    
    console.log('[GCAL_AUTH] Success. Returning URL.');
    res.json({ url });
});

app.get('/api/google-calendar/callback', async (req, res) => {
    const config = getGoogleConfig(req);
    const code = req.query.code;
    if (!code) {
        return res.send('<script>alert("Autenticação cancelada."); window.location.href="/";</script>');
    }

    try {
        const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
            redirect_uri: config.redirectUri,
            grant_type: 'authorization_code'
        });

        const { access_token, refresh_token, expires_in } = tokenRes.data;
        const token_expiry = new Date(Date.now() + expires_in * 1000).toISOString();

        googleCalendar.upsert({
            calendar_id: 'primary',
            access_token,
            refresh_token, // Provided because prompt=consent
            token_expiry,
            sync_enabled: 1
        });

        // Redirect back directly to UI
        res.send(`
            <script>
                window.location.href = '/?tab=connections&gcal=success';
            </script>
        `);
    } catch (e) {
        console.error('OAuth Callback Error:', e.response?.data || e.message);
        res.send(`<script>alert("Erro na autenticação com o Google."); window.location.href="/";</script>`);
    }
});

app.post('/api/google-calendar/disconnect', (req, res) => {
    try {
        googleCalendar.upsert({
            access_token: '',
            refresh_token: '',
            token_expiry: null,
            sync_enabled: 0
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// APPLE CALENDAR ROUTES
app.get('/api/apple-calendar/status', (req, res) => {
    try {
        const settings = appleCalendar.get();
        res.json({
            connected: !!(settings && settings.apple_id && settings.app_password),
            apple_id: settings ? settings.apple_id : null,
            sync_enabled: settings ? settings.sync_enabled : 0
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/apple-calendar/save', (req, res) => {
    try {
        const { apple_id, app_password } = req.body;
        if (!apple_id || !app_password) return res.status(400).json({ error: 'Apple ID e Senha de App são necessários.' });

        appleCalendar.upsert({
            apple_id,
            app_password,
            sync_enabled: 1
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/apple-calendar/disconnect', (req, res) => {
    try {
        appleCalendar.delete();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/google-calendar/save-config', (req, res) => {
    try {
        const { client_id, client_secret } = req.body;
        if (!client_id || !client_secret) return res.status(400).json({ error: 'Client ID e Client Secret são necessários.' });

        googleCalendar.upsert({
            client_id,
            client_secret
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Healthcheck Endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

async function syncGoogleCalendarImplementation(req = null) {
    const config = getGoogleConfig(req);
    const settings = googleCalendar.get();
    if (!settings || !settings.refresh_token) {
        throw new Error('Conta do Google não conectada.');
    }

    let accessToken = settings.access_token;
    const calendarId = settings.calendar_id || 'primary';

    // Check if token expired
    if (settings.refresh_token && settings.token_expiry) {
        const expiry = new Date(settings.token_expiry);
        if (expiry <= new Date()) {
            try {
                const refreshRes = await axios.post('https://oauth2.googleapis.com/token', {
                    client_id: config.clientId,
                    client_secret: config.clientSecret,
                    refresh_token: settings.refresh_token,
                    grant_type: 'refresh_token'
                });
                accessToken = refreshRes.data.access_token;
                const newExpiry = new Date(Date.now() + refreshRes.data.expires_in * 1000).toISOString();
                googleCalendar.upsert({ access_token: accessToken, token_expiry: newExpiry });
            } catch (refreshErr) {
                console.error('[CRON_GCAL] Token refresh failed:', refreshErr.response?.data || refreshErr.message);
                throw new Error('Credenciais expiradas. Por favor, desconecte e conecte novamente.');
            }
        }
    }

    // Fetch events from Google Calendar API
    const now = new Date();
    const timeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const timeMax = new Date(now.getFullYear(), now.getMonth() + 6, 0).toISOString();

    const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    
    const gcalRes = await axios.get(calendarUrl, {
        params: {
            timeMin, timeMax,
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 250
        },
        headers: { Authorization: `Bearer ${accessToken}` }
    });

    const googleEvents = gcalRes.data.items || [];
    let imported = 0, skipped = 0;

    for (const ev of googleEvents) {
        if (!ev.summary) continue;
        const eventDate = (ev.start.date || ev.start.dateTime || '').substring(0, 10);
        const eventTime = ev.start.dateTime ? ev.start.dateTime.substring(11, 16) : '00:00';
        if (!eventDate) { skipped++; continue; }

        // Check if event with same name and date already exists
        const existing = db.prepare('SELECT id FROM team_events WHERE event_name = ? AND event_date = ?').get(ev.summary, eventDate);
        if (existing) { skipped++; continue; }

        teamEvents.create({
            event_name: ev.summary,
            event_time: eventTime,
            event_date: eventDate,
            recurrence_type: 'none',
            recurrence_interval: 0,
            recurrence_end: null,
            status: 'critical'
        });
        imported++;
    }

    googleCalendar.upsert({ last_sync: new Date().toISOString() });
    return { imported, skipped, total: googleEvents.length };
}

app.post('/api/google-calendar/sync', async (req, res) => {
    try {
        const result = await syncGoogleCalendarImplementation(req);
        res.json({ success: true, ...result });
    } catch (e) {
        console.error('Google Calendar Sync Error:', e.response?.data || e.message);
        res.status(e.message === 'Conta do Google não conectada.' ? 400 : 500).json({ error: e.message });
    }
});

// AUTO-SYNC TRIGGER: Google Calendar Sync every 4 hours
cron.schedule('0 */4 * * *', async () => {
    console.log('[AUTONOMY] Executando sincronização automática do Google Calendar...');
    try {
        const stats = await syncGoogleCalendarImplementation();
        console.log(`[AUTONOMY] Sincronização concluída: ${stats.imported} importados, ${stats.skipped} ignorados.`);
    } catch (err) {
        if (err.message === 'Conta do Google não conectada.') {
             // Silently ignore if not connected
        } else {
            console.error('[AUTONOMY] Erro na sincronização automática:', err.message);
        }
    }
});

// ==========================================
// MASTER ADMIN ROUTES (v1.3.0)
// ==========================================

const masterCheck = (req, res, next) => {
    // Basic master-role check would go here in midleware
    next();
};

app.get('/api/master/accounts', masterCheck, (req, res) => {
    try {
        const query = `
            SELECT a.*, 
            (SELECT COUNT(*) FROM users u WHERE u.account_id = a.id) as user_count,
            (SELECT COUNT(*) FROM members m WHERE m.account_id = a.id) as member_count
            FROM accounts a
        `;
        const accountsList = db.prepare(query).all();
        res.json({ success: true, accounts: accountsList });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/master/impersonate', masterCheck, (req, res) => {
    try {
        const { accountId, masterId } = req.body;
        
        const master = db.prepare('SELECT role FROM users WHERE id = ?').get(masterId);
        if (!master || master.role !== 'master') {
            return res.status(403).json({ error: 'Acesso negado. Apenas Master Admin.' });
        }

        const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
        if (!account) return res.status(404).json({ error: 'Conta não encontrada.' });

        let targetUser = db.prepare('SELECT * FROM users WHERE account_id = ? AND role = "admin" LIMIT 1').get(accountId);
        if (!targetUser) {
            targetUser = db.prepare('SELECT * FROM users WHERE account_id = ? LIMIT 1').get(accountId);
        }

        if (!targetUser) return res.status(404).json({ error: 'Não há usuários nesta conta para personificar.' });

        systemLogs.create('MASTER', 'IMPERSONATION', `Master ${masterId} personificando conta ${accountId}`, { masterId, accountId, targetUserId: targetUser.id });
        
        const { password: _, ...safeUser } = targetUser;
        res.json({ success: true, user: safeUser, account });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ========================================
    🚀 SHEMA SERVER RUNNING
    📡 Port: ${PORT}
    ========================================
    `);
});
