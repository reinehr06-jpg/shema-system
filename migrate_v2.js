const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'shema.db'));

console.log('Starting Schema Migration...');

try {
    // 1. Create Logs Table
    console.log('Creating logs table...');
    db.exec(`
        CREATE TABLE IF NOT EXISTS system_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,      -- CREATE, UPDATE, DELETE
            target_type TEXT NOT NULL, -- MEMBER, TEAM, TRAINING
            target_name TEXT,          -- Name of the item affected
            details TEXT,              -- JSON details or description
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 2. Update Members Table
    // SQLite doesn't support adding multiple columns easily or constraints on existing tables easily.
    // We will check if columns exist, if not add them.

    const columnsToAdd = [
        { name: 'naturality', type: 'TEXT' },
        { name: 'is_foreigner', type: 'INTEGER DEFAULT 0' }, // boolean
        { name: 'marital_status', type: 'TEXT' },
        { name: 'gender', type: 'TEXT' },
        { name: 'education', type: 'TEXT' },
        { name: 'profession', type: 'TEXT' },
        { name: 'cpf', type: 'TEXT UNIQUE' }, // Unique constraint might fail if adding to existing table with data. 
        { name: 'birth_date', type: 'TEXT' }
    ];

    const currentColumns = db.prepare(`PRAGMA table_info(members)`).all().map(c => c.name);

    for (const col of columnsToAdd) {
        if (!currentColumns.includes(col.name)) {
            console.log(`Adding column ${col.name}...`);
            try {
                db.exec(`ALTER TABLE members ADD COLUMN ${col.name} ${col.type}`);
            } catch (err) {
                console.error(`Error adding ${col.name}:`, err.message);
                // If unique constraint fails on add column, we might need to recreate table or add without unique then create index
                if (err.message.includes('UNIQUE')) {
                    console.log('Retrying without UNIQUE constraint inline...');
                    db.exec(`ALTER TABLE members ADD COLUMN ${col.name} TEXT`);
                    console.log('Creating UNIQUE index for CPF...');
                    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_members_cpf ON members(cpf)`);
                }
            }
        }
    }

    // Ensure CPF index if it wasn't created above
    console.log('Ensuring CPF uniqueness...');
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_members_cpf ON members(cpf) WHERE cpf IS NOT NULL`);

    console.log('Migration Complete.');

} catch (e) {
    console.error('Migration Failed:', e);
}
