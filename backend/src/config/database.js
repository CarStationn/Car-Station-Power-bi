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

        await query(`
            CREATE TABLE IF NOT EXISTS secoes (
                id SERIAL PRIMARY KEY,
                slug VARCHAR(50) UNIQUE NOT NULL,
                nome VARCHAR(100) NOT NULL,
                icone VARCHAR(30) DEFAULT 'grid',
                cor VARCHAR(7) DEFAULT '#4CE0B3',
                ordem INT DEFAULT 0,
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        const secoesExist = await query('SELECT COUNT(*) FROM secoes');
        if (parseInt(secoesExist.rows[0].count) === 0) {
            await query(`
                INSERT INTO secoes (slug, nome, icone, cor, ordem) VALUES
                ('vendas', 'Vendas', 'chart', '#4CE0B3', 1),
                ('locacao', 'Locação', 'car', '#5AA6FF', 2)
            `);
            console.log('✅ Seções padrão criadas');
        }

        // Adota seções que já existiam soltas em dashboards.secao antes desta tabela
        const orfas = await query(`
            SELECT DISTINCT d.secao
            FROM dashboards d
            LEFT JOIN secoes s ON s.slug = d.secao
            WHERE s.id IS NULL AND d.secao IS NOT NULL AND d.secao <> ''
        `);
        for (const linha of orfas.rows) {
            const slug = linha.secao;
            const nome = slug.charAt(0).toUpperCase() + slug.slice(1);
            await query(
                `INSERT INTO secoes (slug, nome, icone, cor, ordem)
                 VALUES ($1, $2, 'grid', '#9BB0AB', (SELECT COALESCE(MAX(ordem), 0) + 1 FROM secoes))
                 ON CONFLICT (slug) DO NOTHING`,
                [slug, nome]
            );
            console.log(`✅ Seção "${slug}" adotada a partir dos dashboards existentes`);
        }

        console.log('✅ Migrações aplicadas');

        // Administrador inicial: só num banco sem nenhum usuário. Antes,
        // bastava não existir alguém chamado "admin" para a API recriar
        // admin/admin a cada reinício — apagar ou renomear essa conta
        // reabria a porta. A senha é aleatória, aparece uma única vez
        // neste log e precisa ser trocada no primeiro login.
        const totalUsuarios = await query('SELECT COUNT(*) FROM users');

        if (parseInt(totalUsuarios.rows[0].count) === 0) {
            const bcrypt = require('bcryptjs');
            const crypto = require('crypto');
            const senhaInicial = crypto.randomBytes(9).toString('base64url');
            const hashedPassword = await bcrypt.hash(senhaInicial, 10);

            await query(
                'INSERT INTO users (username, password, tipo, email, primeiro_acesso) VALUES ($1, $2, $3, $4, TRUE)',
                ['admin', hashedPassword, 'admin', 'admin@carstation.com']
            );
            console.log('✅ Banco sem usuários: administrador inicial criado');
            console.log(`   usuário: admin@carstation.com  senha temporária: ${senhaInicial}`);
            console.log('   A troca de senha é exigida no primeiro login.');
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