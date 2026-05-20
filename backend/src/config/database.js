// ==================== IMPORTAÇÕES ====================
const { Pool } = require('pg');
require('dotenv').config();

// ==================== CRIAR POOL DE CONEXÃO ====================
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// ==================== TESTAR CONEXÃO ====================
pool.on('connect', () => {
    console.log('✅ Conectado ao PostgreSQL');
});

pool.on('error', (err) => {
    console.error('❌ Erro na conexão com PostgreSQL:', err);
});

// ==================== EXECUTAR QUERY ====================
async function query(text, params) {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        return result;
    } catch (error) {
        console.error('❌ Erro na query:', error.message);
        throw error;
    }
}

// ==================== CRIAR TABELAS ====================
async function initDatabase() {
    try {
        console.log('🔄 Iniciando banco de dados...');

        await query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                tipo VARCHAR(50) DEFAULT 'user',
                email VARCHAR(255),
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Tabela "users" pronta');

        await query(`
            CREATE TABLE IF NOT EXISTS dashboards (
                id SERIAL PRIMARY KEY,
                secao VARCHAR(50) NOT NULL,
                nome VARCHAR(100),
                iframe_url TEXT,
                ordem INT DEFAULT 0,
                atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Tabela "dashboards" pronta');

        await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ultimo_login TIMESTAMP;`);
        await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS primeiro_acesso BOOLEAN DEFAULT TRUE;`);
        await query(`ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS nome VARCHAR(100);`);
        await query(`ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS ordem INT DEFAULT 0;`);
        await query(`UPDATE dashboards SET nome = secao WHERE nome IS NULL;`);

        await query(`
            CREATE TABLE IF NOT EXISTS user_dashboard_permissions (
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                dashboard_id INT REFERENCES dashboards(id) ON DELETE CASCADE,
                PRIMARY KEY (user_id, dashboard_id)
            );
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS roles (
                id SERIAL PRIMARY KEY,
                slug VARCHAR(50) UNIQUE NOT NULL,
                label VARCHAR(100) NOT NULL,
                icone VARCHAR(10) DEFAULT '👤',
                cor VARCHAR(7) DEFAULT '#607d8b',
                protegido BOOLEAN DEFAULT FALSE,
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        const rolesExist = await query('SELECT COUNT(*) FROM roles');
        if (parseInt(rolesExist.rows[0].count) === 0) {
            await query(`
                INSERT INTO roles (slug, label, icone, cor, protegido) VALUES
                ('admin', 'Administrador', '👨‍💼', '#e74c3c', TRUE),
                ('diretor', 'Diretor(a)', '🏆', '#9b59b6', FALSE),
                ('gestor', 'Gestor(a)', '📊', '#2ecc71', FALSE)
            `);
            console.log('✅ Categorias padrão criadas');
        }

        console.log('✅ Migrações aplicadas');

        const userExists = await query(
            'SELECT * FROM users WHERE username = $1',
            ['admin']
        );

        if (userExists.rows.length === 0) {
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash('admin', 10);

            await query(
                'INSERT INTO users (username, password, tipo, email) VALUES ($1, $2, $3, $4)',
                ['admin', hashedPassword, 'admin', 'admin@carstation.com']
            );
            console.log('✅ Usuário admin criado com sucesso');
        }

    } catch (error) {
        console.error('❌ Erro ao inicializar banco:', error);
        process.exit(1);
    }
}

// ==================== EXPORTAR ====================
module.exports = {
    query,
    pool,
    initDatabase,
};