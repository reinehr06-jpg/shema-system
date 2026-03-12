const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new Database(path.join(__dirname, 'shema.db'));

// Enable FKs
db.pragma('foreign_keys = ON');

// Init Tables
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        password TEXT NOT NULL,
        service_areas TEXT DEFAULT '[]', -- JSON array
        role TEXT DEFAULT 'volunteer', -- admin, leader, volunteer
        courses TEXT,
        cpf_cnpj TEXT,
        linked_member_id INTEGER,
        reset_token TEXT,
        reset_token_expiry DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (linked_member_id) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        age INTEGER,
        naturality TEXT,
        is_foreigner INTEGER DEFAULT 0,
        marital_status TEXT,
        gender TEXT,
        education TEXT,
        profession TEXT,
        cpf TEXT UNIQUE,
        birth_date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        general_leader_id INTEGER,
        sub_leader1_id INTEGER,
        sub_leader2_id INTEGER,
        sub_leader3_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (general_leader_id) REFERENCES members(id),
        FOREIGN KEY (sub_leader1_id) REFERENCES members(id),
        FOREIGN KEY (sub_leader2_id) REFERENCES members(id),
        FOREIGN KEY (sub_leader3_id) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS team_members (
        team_id INTEGER,
        member_id INTEGER,
        FOREIGN KEY (team_id) REFERENCES teams(id),
        FOREIGN KEY (member_id) REFERENCES members(id),
        PRIMARY KEY (team_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS service_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        date TEXT,
        area TEXT,
        status TEXT DEFAULT 'served',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS trainings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        folder_id INTEGER,
        type TEXT, -- 'youtube', 'drive'
        url TEXT NOT NULL,
        description TEXT,
        notes TEXT, -- 'Lembretes'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (folder_id) REFERENCES folders(id)
    );

    CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        target_type TEXT,
        target_name TEXT,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS watch_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        training_id INTEGER NOT NULL,
        watched_seconds INTEGER DEFAULT 0,
        total_seconds INTEGER DEFAULT 0,
        completed INTEGER DEFAULT 0,
        last_watched DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, training_id)
    );

    CREATE TABLE IF NOT EXISTS team_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_name TEXT NOT NULL,
        event_time TEXT NOT NULL,
        event_date TEXT NOT NULL,
        recurrence_type TEXT DEFAULT 'none',
        recurrence_interval INTEGER DEFAULT 0,
        recurrence_end TEXT,
        status TEXT DEFAULT 'critical', -- Automático: completo, parcial, critico
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS team_subdivisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        min_qty INTEGER DEFAULT 1,
        max_qty INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS event_scales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        team_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending', -- Automático: completo, parcial, pendente
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES team_events(id) ON DELETE CASCADE,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        UNIQUE(event_id, team_id)
    );

    CREATE TABLE IF NOT EXISTS scale_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        team_id INTEGER NOT NULL,
        subdivision_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES team_events(id) ON DELETE CASCADE,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        FOREIGN KEY (subdivision_id) REFERENCES team_subdivisions(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
        UNIQUE(event_id, team_id, subdivision_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS availabilities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        event_date TEXT NOT NULL,
        team_id INTEGER,
        confirmed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES members(id),
        FOREIGN KEY (team_id) REFERENCES teams(id),
        UNIQUE(member_id, event_date, team_id)
    );

    CREATE TABLE IF NOT EXISTS sectors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS whatsapp_instances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        instance_id TEXT NOT NULL,
        status TEXT DEFAULT 'disconnected',
        apikey TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS event_availability_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        response TEXT CHECK(response IN ('yes', 'maybe', 'no')),
        note TEXT,
        responded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES team_events(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
        UNIQUE(event_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS event_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        role_id INTEGER,
        role_name TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'declined')),
        confirmed_at DATETIME,
        declined_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES team_events(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS team_leaders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        leader_role TEXT NOT NULL, -- general, assistant, coordinator
        priority INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS role_requirements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_id INTEGER NOT NULL,
        folder_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS team_event_roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        role_name TEXT NOT NULL,
        member_id INTEGER NOT NULL,
        FOREIGN KEY (event_id) REFERENCES team_events(id),
        FOREIGN KEY (member_id) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS organization (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT DEFAULT 'Minha Organização',
        logo_path TEXT,
        account_code TEXT,
        status TEXT DEFAULT 'active',
        contact_email TEXT,
        phone TEXT,
        address TEXT,
        responsible TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS account_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        language TEXT DEFAULT 'pt-BR',
        timezone TEXT DEFAULT 'America/Sao_Paulo',
        theme TEXT DEFAULT 'light',
        primary_color TEXT DEFAULT '#1EBE5D',
        notifications_email INTEGER DEFAULT 1,
        notifications_login INTEGER DEFAULT 1,
        notifications_weekly INTEGER DEFAULT 0,
        notifications_participation INTEGER DEFAULT 1,
        show_advanced_metrics INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS login_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        success INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS active_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_token TEXT UNIQUE NOT NULL,
        device_info TEXT,
        ip_address TEXT,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
`);

// Migration for existing installations
try { db.prepare("ALTER TABLE users ADD COLUMN cpf_cnpj TEXT").run(); } catch (e) { }
try { db.prepare("ALTER TABLE users ADD COLUMN linked_member_id INTEGER").run(); } catch (e) { }
try { db.prepare("ALTER TABLE users ADD COLUMN reset_token TEXT").run(); } catch (e) { }
try { db.prepare("ALTER TABLE users ADD COLUMN reset_token_expiry DATETIME").run(); } catch (e) { }
try { db.prepare("ALTER TABLE members ADD COLUMN sector TEXT").run(); } catch (e) { }
try { db.prepare("ALTER TABLE team_events ADD COLUMN status TEXT DEFAULT 'draft'").run(); } catch (e) { }
try { db.prepare("ALTER TABLE availabilities ADD COLUMN whatsapp_confirmation TEXT DEFAULT 'none'").run(); } catch (e) { }
try { db.prepare("ALTER TABLE availabilities ADD COLUMN whatsapp_sent_at DATETIME").run(); } catch (e) { }
try { db.prepare("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'").run(); } catch (e) { }
try { db.prepare("ALTER TABLE users ADD COLUMN last_login DATETIME").run(); } catch (e) { }
try { db.prepare("ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER DEFAULT 0").run(); } catch (e) { }
try { db.prepare("ALTER TABLE users ADD COLUMN two_factor_type TEXT DEFAULT 'app'").run(); } catch (e) { }
try { db.prepare("ALTER TABLE teams ADD COLUMN area TEXT").run(); } catch (e) { }
try { db.prepare("ALTER TABLE teams ADD COLUMN sector_id INTEGER").run(); } catch (e) { }
try { db.prepare(`CREATE TABLE IF NOT EXISTS google_calendar_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    calendar_id TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expiry DATETIME,
    sync_enabled INTEGER DEFAULT 0,
    last_sync DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`).run(); } catch (e) { }

try { db.prepare(`CREATE TABLE IF NOT EXISTS message_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    content TEXT NOT NULL
)`).run(); } catch (e) { }

try { db.prepare(`CREATE TABLE IF NOT EXISTS message_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    template_id INTEGER NOT NULL,
    event_id INTEGER,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES message_templates(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES team_events(id) ON DELETE CASCADE
)`).run(); } catch (e) { }

// Seed organization if empty
try {
    const orgCount = db.prepare('SELECT COUNT(*) as c FROM organization').get().c;
    if (orgCount === 0) {
        const code = require('crypto').randomBytes(3).toString('hex').toUpperCase().match(/.{1,3}/g).join('-');
        db.prepare('INSERT INTO organization (name, account_code) VALUES (?, ?)').run('Minha Organização', code);
    }
} catch (e) { console.warn('Org seed:', e.message); }

// Seed account_settings if empty
try {
    const settingsCount = db.prepare('SELECT COUNT(*) as c FROM account_settings').get().c;
    if (settingsCount === 0) {
        db.prepare('INSERT INTO account_settings DEFAULT VALUES').run();
    }
} catch (e) { console.warn('Settings seed:', e.message); }

// Models
const users = {
    create: (data) => {
        const stmt = db.prepare(`
            INSERT INTO users (name, email, phone, password, service_areas, role, courses, cpf_cnpj, linked_member_id)
            VALUES (@name, @email, @phone, @password, @service_areas, @role, @courses, @cpf_cnpj, @linked_member_id)
        `);
        // Hash password
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(data.password, salt);

        return stmt.run({
            name: data.name,
            email: data.email,
            phone: data.phone || null,
            password: hash,
            service_areas: data.service_areas || '[]',
            role: data.role || 'volunteer',
            courses: data.courses || '',
            cpf_cnpj: data.cpf_cnpj || null,
            linked_member_id: data.linked_member_id || null
        });
    },
    findByEmail: (email) => {
        return db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);
    },
    findByPhone: (phone) => {
        return db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    },
    findByResetToken: (token) => {
        return db.prepare('SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > CURRENT_TIMESTAMP').get(token);
    },
    setResetToken: (userId, token, expiryMinutes = 60) => {
        return db.prepare(`
            UPDATE users 
            SET reset_token = ?, 
                reset_token_expiry = datetime('now', '+' || ? || ' minutes') 
            WHERE id = ?
        `).run(token, expiryMinutes, userId);
    },
    updatePassword: (userId, newPassword) => {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(newPassword, salt);
        return db.prepare('UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?').run(hash, userId);
    },
    getAll: () => {
        return db.prepare('SELECT id, name, email, phone, service_areas, role, courses, cpf_cnpj, linked_member_id FROM users').all();
    }
};

const availabilities = {
    save: (data) => {
        return db.prepare(`
            INSERT INTO availabilities (member_id, event_date, team_id, confirmed)
            VALUES (@member_id, @event_date, @team_id, @confirmed)
            ON CONFLICT(member_id, event_date, team_id) DO UPDATE SET
                confirmed = @confirmed
        `).run(data);
    },
    getByMember: (memberId) => {
        return db.prepare(`
            SELECT a.*, t.name as team_name 
            FROM availabilities a
            LEFT JOIN teams t ON a.team_id = t.id
            WHERE a.member_id = ?
        `).all(memberId);
    },
    getByMonth: (memberId, year, month) => {
        const pattern = `${year}-${String(month).padStart(2, '0')}-%`;
        return db.prepare(`
            SELECT a.*, t.name as team_name 
            FROM availabilities a
            LEFT JOIN teams t ON a.team_id = t.id
            WHERE a.member_id = ? AND a.event_date LIKE ?
        `).all(memberId, pattern);
    },
    getAllByMonth: (year, month) => {
        const pattern = `${year}-${String(month).padStart(2, '0')}-%`;
        return db.prepare('SELECT * FROM availabilities WHERE event_date LIKE ?').all(pattern);
    }
};

const systemLogs = {
    create: (action, target_type, target_name, details) => {
        try {
            db.prepare(`
                INSERT INTO system_logs (action, target_type, target_name, details)
                VALUES (?, ?, ?, ?)
            `).run(action, target_type, target_name, JSON.stringify(details));
        } catch (e) {
            console.error('Logging failed:', e);
        }
    },
    getAll: () => db.prepare('SELECT * FROM system_logs ORDER BY created_at DESC').all()
};

const members = {
    create: (data) => {
        const stmt = db.prepare(`
            INSERT INTO members (
                name, phone, age, 
                naturality, is_foreigner, marital_status, gender, education, profession, cpf, birth_date, sector
            ) VALUES (
                @name, @phone, @age,
                @naturality, @is_foreigner, @marital_status, @gender, @education, @profession, @cpf, @birth_date, @sector
            )
        `);
        return stmt.run(data);
    },
    getAll: () => db.prepare('SELECT * FROM members ORDER BY name').all(),
    getById: (id) => db.prepare('SELECT * FROM members WHERE id = ?').get(id),
    getByCpf: (cpf) => db.prepare('SELECT * FROM members WHERE cpf = ?').get(cpf),
    getByPhone: (phone) => db.prepare('SELECT * FROM members WHERE phone = ?').get(phone),
    getBirthdays: (month, day) => {
        return db.prepare(`
            SELECT id, name, phone, birth_date,
            (strftime('%Y', 'now') - strftime('%Y', birth_date)) - (strftime('%m-%d', 'now') < strftime('%m-%d', birth_date)) as age
            FROM members 
            WHERE strftime('%m', birth_date) = ? AND strftime('%d', birth_date) = ?
        `).all(month, day);
    },
    getGenderStats: () => {
        return db.prepare(`
            SELECT 
                CASE 
                    WHEN gender IN ('Masculino', 'M', 'm') THEN 'Masculino'
                    WHEN gender IN ('Feminino', 'F', 'f') THEN 'Feminino'
                    ELSE 'Outro' 
                END as gender_normalized,
                COUNT(*) as count 
            FROM members 
            WHERE gender IS NOT NULL AND gender != ''
            GROUP BY gender_normalized
        `).all();
    },
    update: (id, data) => {
        const stmt = db.prepare(`
            UPDATE members SET 
                name = @name, 
                phone = @phone, 
                age = @age, 
                naturality = @naturality, 
                is_foreigner = @is_foreigner, 
                marital_status = @marital_status, 
                gender = @gender, 
                education = @education, 
                profession = @profession, 
                cpf = @cpf, 
                birth_date = @birth_date, 
                sector = @sector
            WHERE id = @id
        `);
        return stmt.run({ ...data, id });
    }
};

const teams = {
    create: (data) => {
        const info = db.prepare(`
            INSERT INTO teams (name, area, sector_id, general_leader_id, sub_leader1_id, sub_leader2_id, sub_leader3_id)
            VALUES (@name, @area, @sector_id, @general_leader_id, @sub_leader1_id, @sub_leader2_id, @sub_leader3_id)
        `).run(data);
        return info.lastInsertRowid;
    },
    update: (id, data) => {
        return db.prepare(`
            UPDATE teams SET
                name = @name,
                area = @area,
                sector_id = @sector_id,
                general_leader_id = @general_leader_id,
                sub_leader1_id = @sub_leader1_id,
                sub_leader2_id = @sub_leader2_id,
                sub_leader3_id = @sub_leader3_id
            WHERE id = @id
        `).run({ ...data, id });
    },
    getById: (id) => db.prepare('SELECT * FROM teams WHERE id = ?').get(id),
    getAll: () => {
        const teams = db.prepare(`
            SELECT t.*, 
            m1.name as general_leader_name,
            m2.name as sub1_name,
            m3.name as sub2_name,
            m4.name as sub3_name
            FROM teams t
            LEFT JOIN members m1 ON t.general_leader_id = m1.id
            LEFT JOIN members m2 ON t.sub_leader1_id = m2.id
            LEFT JOIN members m3 ON t.sub_leader2_id = m3.id
            LEFT JOIN members m4 ON t.sub_leader3_id = m4.id
            ORDER BY t.name
        `).all();

        for (const t of teams) {
            t.subdivisions = db.prepare('SELECT * FROM team_subdivisions WHERE team_id = ? ORDER BY name').all(t.id);
            t.members = db.prepare(`
                SELECT m.name FROM team_members tm
                JOIN members m ON tm.member_id = m.id
                WHERE tm.team_id = ?
            `).all(t.id).map(m => m.name);
        }
        return teams;
    },
    addSubdivision: (data) => db.prepare('INSERT INTO team_subdivisions (team_id, name, min_qty, max_qty) VALUES (@team_id, @name, @min_qty, @max_qty)').run(data),
    clearSubdivisions: (teamId) => db.prepare('DELETE FROM team_subdivisions WHERE team_id = ?').run(teamId),
    getLeaderCount: () => {
        try {
            const result = db.prepare(`
                SELECT COUNT(DISTINCT leader_id) as count FROM (
                    SELECT general_leader_id as leader_id FROM teams WHERE general_leader_id IS NOT NULL
                    UNION
                    SELECT sub_leader1_id FROM teams WHERE sub_leader1_id IS NOT NULL
                    UNION
                    SELECT sub_leader2_id FROM teams WHERE sub_leader2_id IS NOT NULL
                    UNION
                    SELECT sub_leader3_id FROM teams WHERE sub_leader3_id IS NOT NULL
                )
            `).get();
            return result ? result.count : 0;
        } catch (e) {
            console.error('Error counting leaders:', e);
            return 0;
        }
    }
};

const serviceRecords = {
    create: (data) => db.prepare('INSERT INTO service_records (user_id, date, area, status) VALUES (@user_id, @date, @area, @status)').run(data),
    getAll: () => db.prepare(`
        SELECT sr.*, u.name as user_name 
        FROM service_records sr 
        JOIN users u ON sr.user_id = u.id
    `).all()
};

const folders = {
    create: (data) => db.prepare('INSERT INTO folders (name) VALUES (@name)').run(data),
    getAll: () => db.prepare('SELECT * FROM folders ORDER BY name').all(),
    getById: (id) => db.prepare('SELECT * FROM folders WHERE id = ?').get(id),
    delete: (id) => {
        // Delete all trainings inside the folder first
        db.prepare('DELETE FROM watch_progress WHERE training_id IN (SELECT id FROM trainings WHERE folder_id = ?)').run(id);
        db.prepare('DELETE FROM trainings WHERE folder_id = ?').run(id);
        return db.prepare('DELETE FROM folders WHERE id = ?').run(id);
    }
};

const trainings = {
    create: (data) => db.prepare('INSERT INTO trainings (title, folder_id, type, url, description, notes) VALUES (@title, @folder_id, @type, @url, @description, @notes)').run(data),
    getAll: () => db.prepare('SELECT t.*, f.name as folder_name FROM trainings t LEFT JOIN folders f ON t.folder_id = f.id').all(),
    getById: (id) => db.prepare('SELECT * FROM trainings WHERE id = ?').get(id),
    delete: (id) => {
        db.prepare('DELETE FROM watch_progress WHERE training_id = ?').run(id);
        return db.prepare('DELETE FROM trainings WHERE id = ?').run(id);
    }
};

const watchProgress = {
    upsert: (data) => {
        return db.prepare(`
            INSERT INTO watch_progress (user_id, training_id, watched_seconds, total_seconds, completed, last_watched)
            VALUES (@user_id, @training_id, @watched_seconds, @total_seconds, @completed, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, training_id) DO UPDATE SET
                watched_seconds = @watched_seconds,
                total_seconds = @total_seconds,
                completed = @completed,
                last_watched = CURRENT_TIMESTAMP
        `).run(data);
    },
    getByUser: (userId) => db.prepare('SELECT * FROM watch_progress WHERE user_id = ?').all(userId),
    getByUserAndTraining: (userId, trainingId) => db.prepare('SELECT * FROM watch_progress WHERE user_id = ? AND training_id = ?').get(userId, trainingId)
};

const stats = {
    getCounts: () => {
        const teamCounts = db.prepare(`
            SELECT s.name, COUNT(m.id) as count 
            FROM sectors s 
            LEFT JOIN members m ON s.name = m.sector 
            GROUP BY s.id
        `).all();
        return { teamCounts };
    }
};

const teamEvents = {
    create: (data) => {
        return db.prepare(`
            INSERT INTO team_events (event_name, event_time, event_date, recurrence_type, recurrence_interval, recurrence_end, status)
            VALUES (@event_name, @event_time, @event_date, @recurrence_type, @recurrence_interval, @recurrence_end, @status)
        `).run(data);
    },
    getByMonth: (year, month) => {
        const pattern = `${year}-${String(month).padStart(2, '0')}-%`;
        return db.prepare('SELECT * FROM team_events WHERE event_date LIKE ? ORDER BY event_date, event_time').all(pattern);
    },
    getAll: () => db.prepare('SELECT * FROM team_events ORDER BY event_date DESC, event_time ASC').all(),
    getById: (id) => db.prepare('SELECT * FROM team_events WHERE id = ?').get(id),
    update: (id, data) => {
        return db.prepare(`
            UPDATE team_events 
            SET event_name = @event_name, 
                event_time = @event_time, 
                event_date = @event_date,
                recurrence_type = @recurrence_type,
                recurrence_interval = @recurrence_interval,
                recurrence_end = @recurrence_end
            WHERE id = @id
        `).run({ ...data, id });
    },
    delete: (id) => db.prepare('DELETE FROM team_events WHERE id = ?').run(id),
    updateStatus: (id, status) => db.prepare('UPDATE team_events SET status = ? WHERE id = ?').run(status, id)
};

const eventScales = {
    create: (data) => db.prepare('INSERT INTO event_scales (event_id, team_id, status) VALUES (@event_id, @team_id, @status)').run(data),
    getByEvent: (eventId) => {
        const scales = db.prepare(`
            SELECT es.*, t.name as team_name 
            FROM event_scales es
            JOIN teams t ON es.team_id = t.id
            WHERE es.event_id = ?
        `).all(eventId);

        for (const s of scales) {
            // Load subdivisions for this team
            const subdivisions = db.prepare(
                'SELECT * FROM team_subdivisions WHERE team_id = ? ORDER BY name'
            ).all(s.team_id);

            // Load assignments for each subdivision
            for (const sub of subdivisions) {
                sub.assignments = db.prepare(`
                    SELECT sa.*, m.name as member_name
                    FROM scale_assignments sa
                    JOIN members m ON sa.member_id = m.id
                    WHERE sa.event_id = ? AND sa.team_id = ? AND sa.subdivision_id = ?
                `).all(eventId, s.team_id, sub.id);
            }

            s.subdivisions = subdivisions;
        }
        return scales;
    },
    updateStatus: (eventId, teamId, status) => db.prepare('UPDATE event_scales SET status = ? WHERE event_id = ? AND team_id = ?').run(status, eventId, teamId),
    recalculateEventStatus: (eventId) => {
        const scales = db.prepare('SELECT * FROM event_scales WHERE event_id = ?').all(eventId);

        if (scales.length === 0) {
            db.prepare('UPDATE team_events SET status = ? WHERE id = ?').run('critical', eventId);
            return;
        }

        for (const s of scales) {
            const subdivisions = db.prepare('SELECT * FROM team_subdivisions WHERE team_id = ?').all(s.team_id);
            let allComplete = true;
            let anyComplete = false;

            for (const sub of subdivisions) {
                const count = db.prepare(
                    'SELECT COUNT(*) as c FROM scale_assignments WHERE event_id = ? AND team_id = ? AND subdivision_id = ?'
                ).get(eventId, s.team_id, sub.id).c;
                if (count >= sub.min_qty) {
                    anyComplete = true;
                } else {
                    allComplete = false;
                }
            }

            // If team has no subdivisions, treat as pending
            if (subdivisions.length === 0) {
                allComplete = false;
            }

            const teamStatus = allComplete ? 'complete' : (anyComplete ? 'partial' : 'pending');
            db.prepare('UPDATE event_scales SET status = ? WHERE event_id = ? AND team_id = ?').run(teamStatus, eventId, s.team_id);
        }

        // Now calculate event-level status
        const updatedScales = db.prepare('SELECT status FROM event_scales WHERE event_id = ?').all(eventId);
        const allComplete = updatedScales.every(s => s.status === 'complete');
        const anyPending = updatedScales.some(s => s.status === 'pending');

        let eventStatus;
        if (allComplete) eventStatus = 'complete';
        else if (anyPending) eventStatus = 'critical';
        else eventStatus = 'partial';

        db.prepare('UPDATE team_events SET status = ? WHERE id = ?').run(eventStatus, eventId);
    },
    delete: (eventId, teamId) => {
        db.prepare('DELETE FROM scale_assignments WHERE event_id = ? AND team_id = ?').run(eventId, teamId);
        return db.prepare('DELETE FROM event_scales WHERE event_id = ? AND team_id = ?').run(eventId, teamId);
    }
};

const scaleAssignments = {
    add: (data) => db.prepare('INSERT INTO scale_assignments (event_id, team_id, subdivision_id, member_id) VALUES (@event_id, @team_id, @subdivision_id, @member_id)').run(data),
    remove: (eventId, teamId, subdivisionId, memberId) => db.prepare('DELETE FROM scale_assignments WHERE event_id = ? AND team_id = ? AND subdivision_id = ? AND member_id = ?').run(eventId, teamId, subdivisionId, memberId),
    getBySubdivision: (eventId, subdivisionId) => db.prepare('SELECT sa.*, m.name as member_name FROM scale_assignments sa JOIN members m ON sa.member_id = m.id WHERE sa.event_id = ? AND sa.subdivision_id = ?').all(eventId, subdivisionId)
};


const whatsappInstances = {
    create: (data) => db.prepare('INSERT INTO whatsapp_instances (name, instance_id, status, apikey) VALUES (@name, @instance_id, @status, @apikey)').run(data),
    getAll: () => db.prepare('SELECT * FROM whatsapp_instances ORDER BY created_at DESC').all(),
    getById: (id) => db.prepare('SELECT * FROM whatsapp_instances WHERE id = ?').get(id),
    updateStatus: (id, status) => db.prepare('UPDATE whatsapp_instances SET status = ? WHERE id = ?').run(status, id),
    delete: (id) => db.prepare('DELETE FROM whatsapp_instances WHERE id = ?').run(id)
};

const roles = {
    create: (data) => db.prepare('INSERT INTO roles (name, description) VALUES (@name, @description)').run(data),
    getAll: () => db.prepare('SELECT * FROM roles ORDER BY name').all(),
    delete: (id) => db.prepare('DELETE FROM roles WHERE id = ?').run(id)
};

const eventAssignments = {
    create: (data) => db.prepare('INSERT INTO event_assignments (event_id, member_id, role_id, role_name, status) VALUES (@event_id, @member_id, @role_id, @role_name, @status)').run(data),
    getByEvent: (eventId) => db.prepare(`
        SELECT ea.*, m.name as member_name, r.name as role_display_name
        FROM event_assignments ea
        LEFT JOIN members m ON ea.member_id = m.id
        LEFT JOIN roles r ON ea.role_id = r.id
        WHERE ea.event_id = ?
    `).all(eventId),
    updateStatus: (id, status, reason = null) => db.prepare('UPDATE event_assignments SET status = ?, declined_reason = ?, confirmed_at = ? WHERE id = ?').run(status, reason, status === 'confirmed' ? new Date().toISOString() : null, id)
};

const eventAvailability = {
    save: (data) => db.prepare(`
        INSERT INTO event_availability_responses (event_id, member_id, response, note)
        VALUES (@event_id, @member_id, @response, @note)
        ON CONFLICT(event_id, member_id) DO UPDATE SET
            response = @response,
            note = @note,
            responded_at = CURRENT_TIMESTAMP
    `).run(data),
    getByEvent: (eventId) => db.prepare(`
        SELECT ear.*, m.name as member_name
        FROM event_availability_responses ear
        LEFT JOIN members m ON ear.member_id = m.id
        WHERE ear.event_id = ?
    `).all(eventId)
};

const sectors = {
    create: (name) => db.prepare('INSERT INTO sectors (name) VALUES (?)').run(name),
    getAll: () => db.prepare('SELECT * FROM sectors ORDER BY name').all(),
    delete: (id) => db.prepare('DELETE FROM sectors WHERE id = ?').run(id)
};

const organization = {
    get: () => db.prepare('SELECT * FROM organization LIMIT 1').get(),
    update: (data) => {
        const org = db.prepare('SELECT id FROM organization LIMIT 1').get();
        if (!org) return;
        const fields = [];
        const values = [];
        for (const [key, val] of Object.entries(data)) {
            if (['name', 'logo_path', 'contact_email', 'phone', 'address', 'responsible', 'status'].includes(key)) {
                fields.push(`${key} = ?`);
                values.push(val);
            }
        }
        if (fields.length === 0) return;
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(org.id);
        db.prepare(`UPDATE organization SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }
};

const accountSettings = {
    get: () => db.prepare('SELECT * FROM account_settings LIMIT 1').get(),
    update: (data) => {
        const s = db.prepare('SELECT id FROM account_settings LIMIT 1').get();
        if (!s) return;
        const fields = [];
        const values = [];
        for (const [key, val] of Object.entries(data)) {
            if (['language', 'timezone', 'theme', 'primary_color', 'notifications_email', 'notifications_login', 'notifications_weekly', 'notifications_participation', 'show_advanced_metrics'].includes(key)) {
                fields.push(`${key} = ?`);
                values.push(val);
            }
        }
        if (fields.length === 0) return;
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(s.id);
        db.prepare(`UPDATE account_settings SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }
};

const loginHistory = {
    create: (data) => db.prepare('INSERT INTO login_history (user_id, ip_address, user_agent, success) VALUES (?, ?, ?, ?)').run(data.user_id, data.ip_address || '', data.user_agent || '', data.success ? 1 : 0),
    getRecent: (limit = 50) => db.prepare('SELECT lh.*, u.name as user_name, u.email as user_email FROM login_history lh LEFT JOIN users u ON lh.user_id = u.id ORDER BY lh.created_at DESC LIMIT ?').all(limit)
};

const activeSessions = {
    create: (data) => db.prepare('INSERT INTO active_sessions (user_id, session_token, device_info, ip_address) VALUES (?, ?, ?, ?)').run(data.user_id, data.session_token, data.device_info || '', data.ip_address || ''),
    getByUser: (userId) => db.prepare('SELECT * FROM active_sessions WHERE user_id = ? ORDER BY last_active DESC').all(userId),
    getAll: () => db.prepare('SELECT s.*, u.name as user_name FROM active_sessions s LEFT JOIN users u ON s.user_id = u.id ORDER BY s.last_active DESC').all(),
    touch: (token) => db.prepare('UPDATE active_sessions SET last_active = CURRENT_TIMESTAMP WHERE session_token = ?').run(token),
    delete: (id) => db.prepare('DELETE FROM active_sessions WHERE id = ?').run(id),
    deleteByUser: (userId) => db.prepare('DELETE FROM active_sessions WHERE user_id = ?').run(userId),
    deleteAll: () => db.prepare('DELETE FROM active_sessions').run()
};

const googleCalendar = {
    get: () => db.prepare('SELECT * FROM google_calendar_settings LIMIT 1').get(),
    upsert: (data) => {
        const existing = db.prepare('SELECT id FROM google_calendar_settings LIMIT 1').get();
        if (existing) {
            const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
            return db.prepare(`UPDATE google_calendar_settings SET ${fields} WHERE id = ?`).run(...Object.values(data), existing.id);
        } else {
            const keys = Object.keys(data).join(', ');
            const placeholders = Object.keys(data).map(() => '?').join(', ');
            return db.prepare(`INSERT INTO google_calendar_settings (${keys}) VALUES (${placeholders})`).run(...Object.values(data));
        }
    }
};

const messageTemplates = {
    getAllByCategory: (category) => db.prepare('SELECT * FROM message_templates WHERE category = ?').all(category),
    insertMany: (templates) => {
        const insert = db.prepare('INSERT INTO message_templates (category, content) VALUES (?, ?)');
        const insertTransaction = db.transaction((items) => {
            for (const item of items) insert.run(item.category, item.content);
        });
        insertTransaction(templates);
    },
    count: () => db.prepare('SELECT COUNT(*) as c FROM message_templates').get().c
};

const messageHistory = {
    create: (data) => db.prepare('INSERT INTO message_history (member_id, category, template_id, event_id) VALUES (?, ?, ?, ?)').run(data.member_id, data.category, data.template_id, data.event_id || null),
    getRecentByMemberAndCategory: (memberId, category, limit = 3) => db.prepare('SELECT template_id FROM message_history WHERE member_id = ? AND category = ? ORDER BY sent_at DESC LIMIT ?').all(memberId, category, limit),
    hasSentReminder: (memberId, eventId, category) => db.prepare('SELECT COUNT(*) as c FROM message_history WHERE member_id = ? AND event_id = ? AND category = ?').get().c > 0,
    hasSentBirthdayThisYear: (memberId, year) => db.prepare(`SELECT COUNT(*) as c FROM message_history WHERE member_id = ? AND category = 'aniversario' AND strftime('%Y', sent_at) = ?`).get().c > 0
};

module.exports = { db, users, members, teams, serviceRecords, trainings, folders, stats, systemLogs, watchProgress, teamEvents, eventScales, scaleAssignments, availabilities, sectors, whatsappInstances, roles, eventAssignments, eventAvailability, organization, accountSettings, loginHistory, activeSessions, googleCalendar, messageTemplates, messageHistory };

// Seed templates se estiver vazio
try {
    require('./messageTemplatesSeed')();
} catch (e) {
    console.error('Falha ao rodar seed de message templates:', e);
}
