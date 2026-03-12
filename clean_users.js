const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const db = new Database('./shema.db');

try {
    db.prepare('DELETE FROM login_history').run();
    db.prepare('DELETE FROM active_sessions').run();
    db.prepare('DELETE FROM service_records').run();
    db.prepare('DELETE FROM watch_progress').run();
    db.prepare('DELETE FROM users').run();

    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare("INSERT INTO users (name, email, password, role) VALUES ('Admin', 'admin@shema.com', ?, 'admin')").run(hash);

    console.log("Successfully wiped login DB and recreated admin.");
} catch (e) {
    console.error("Error wiping db:", e);
}
