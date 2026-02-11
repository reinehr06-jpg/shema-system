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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
        team_id INTEGER NOT NULL,
        event_name TEXT NOT NULL,
        event_time TEXT NOT NULL,
        event_date TEXT NOT NULL,
        recurrence_type TEXT DEFAULT 'none',
        recurrence_interval INTEGER DEFAULT 0,
        recurrence_end TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams(id)
    );

    CREATE TABLE IF NOT EXISTS team_event_roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        role_name TEXT NOT NULL,
        member_id INTEGER NOT NULL,
        FOREIGN KEY (event_id) REFERENCES team_events(id),
        FOREIGN KEY (member_id) REFERENCES members(id)
    );
`);

// Models
const users = {
    create: (data) => {
        const stmt = db.prepare(`
            INSERT INTO users (name, email, phone, password, service_areas, role, courses)
            VALUES (@name, @email, @phone, @password, @service_areas, @role, @courses)
        `);
        // Hash password
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(data.password, salt);

        return stmt.run({ ...data, password: hash });
    },
    findByEmail: (email) => {
        return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    },
    getAll: () => {
        return db.prepare('SELECT id, name, email, phone, service_areas, role, courses FROM users').all();
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
                naturality, is_foreigner, marital_status, gender, education, profession, cpf, birth_date
            ) VALUES (
                @name, @phone, @age,
                @naturality, @is_foreigner, @marital_status, @gender, @education, @profession, @cpf, @birth_date
            )
        `);
        return stmt.run(data);
    },
    getAll: () => db.prepare('SELECT * FROM members ORDER BY name').all(),
    getById: (id) => db.prepare('SELECT * FROM members WHERE id = ?').get(id),
    getByCpf: (cpf) => db.prepare('SELECT * FROM members WHERE cpf = ?').get(cpf),
    getByPhone: (phone) => db.prepare('SELECT * FROM members WHERE phone = ?').get(phone),
    getBirthdays: (month, day) => {
        // month and day should be zero-padded strings if needed, but strftime returns '01'-'12', '01'-'31'
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
    }
};

const teams = {
    create: (data) => {
        const info = db.prepare(`
            INSERT INTO teams (name, general_leader_id, sub_leader1_id, sub_leader2_id, sub_leader3_id)
            VALUES (@name, @general_leader_id, @sub_leader1_id, @sub_leader2_id, @sub_leader3_id)
        `).run(data);
        return info.lastInsertRowid;
    },
    getById: (id) => db.prepare('SELECT * FROM teams WHERE id = ?').get(id), // Helper for logging
    addMember: (teamId, memberId) => {
        // Check constraint: Is member in >= 2 teams already?
        const count = db.prepare('SELECT COUNT(*) as c FROM team_members WHERE member_id = ?').get(memberId).c;
        if (count >= 2) {
            throw new Error(`Membro ID ${memberId} já está em 2 equipes.`);
        }
        db.prepare('INSERT INTO team_members (team_id, member_id) VALUES (?, ?)').run(teamId, memberId);
    },
    getAll: () => {
        // Complex query to fetch teams with leader names
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
        `).all();

        // Attach members
        for (const t of teams) {
            t.members = db.prepare(`
                SELECT m.name FROM team_members tm
                JOIN members m ON tm.member_id = m.id
                WHERE tm.team_id = ?
            `).all(t.id).map(m => m.name);
        }
        return teams;
    },
    getLeaderCount: () => {
        // Count unique leaders across all leadership positions
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
            SELECT t.name, COUNT(tm.member_id) as count 
            FROM teams t 
            LEFT JOIN team_members tm ON t.id = tm.team_id 
            GROUP BY t.id
        `).all();
        return { teamCounts };
    }
};

const teamEvents = {
    create: (data) => {
        return db.prepare(`
            INSERT INTO team_events (team_id, event_name, event_time, event_date, recurrence_type, recurrence_interval, recurrence_end)
            VALUES (@team_id, @event_name, @event_time, @event_date, @recurrence_type, @recurrence_interval, @recurrence_end)
        `).run(data);
    },
    getByMonth: (year, month) => {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endMonth = month === 12 ? 1 : month + 1;
        const endYear = month === 12 ? year + 1 : year;
        const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
        return db.prepare(`
            SELECT te.*, t.name as team_name
            FROM team_events te
            LEFT JOIN teams t ON te.team_id = t.id
            WHERE te.event_date >= ? AND te.event_date < ?
            ORDER BY te.event_date, te.event_time
        `).all(startDate, endDate);
    },
    getAll: () => {
        return db.prepare(`
            SELECT te.*, t.name as team_name
            FROM team_events te
            LEFT JOIN teams t ON te.team_id = t.id
            ORDER BY te.event_date DESC, te.event_time
        `).all();
    },
    getById: (id) => db.prepare('SELECT * FROM team_events WHERE id = ?').get(id),
    delete: (id) => {
        db.prepare('DELETE FROM team_event_roles WHERE event_id = ?').run(id);
        return db.prepare('DELETE FROM team_events WHERE id = ?').run(id);
    },
    addRole: (eventId, roleName, memberId) => {
        return db.prepare('INSERT INTO team_event_roles (event_id, role_name, member_id) VALUES (?, ?, ?)').run(eventId, roleName, memberId);
    },
    getRolesByEvent: (eventId) => {
        return db.prepare(`
            SELECT ter.*, m.name as member_name
            FROM team_event_roles ter
            LEFT JOIN members m ON ter.member_id = m.id
            WHERE ter.event_id = ?
        `).all(eventId);
    }
};

module.exports = { db, users, members, teams, serviceRecords, trainings, folders, stats, systemLogs, watchProgress, teamEvents };
