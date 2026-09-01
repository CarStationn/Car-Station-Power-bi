require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { initDatabase } = require('./src/config/database');
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const dashboardRoutes = require('./src/routes/dashboards');
const rolesRoutes = require('./src/routes/roles');
const secoesRoutes = require('./src/routes/secoes');
const { authMiddleware } = require('./src/middleware/auth');

const app = express();

// ==================== SEGURANÇA ====================
// O Render serve a aplicação atrás de um proxy. Sem isto o Express lê o IP do
// proxy em vez do IP real, e o rate limit do login passa a contar as tentativas
// de todos os usuários num balde só — um atacante estouraria a cota e deixaria
// todo mundo sem conseguir entrar.
// O valor é 1 (confia só no primeiro salto), e não `true`: confiar na cadeia
// inteira permitiria forjar o IP pelo cabeçalho X-Forwarded-For.
app.set('trust proxy', 1);

app.use(helmet());

const origensPermitidas = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:3000', 'http://localhost:5500', 'http://127.0.0.1:5500'];

app.use(cors({
    origin: origensPermitidas,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Rate limit no login (5 tentativas por 15 min)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { sucesso: false, mensagem: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/auth/login', loginLimiter);

// ==================== ROTAS ====================
app.get('/', (req, res) => res.send('API rodando 🚀'));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboards', dashboardRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/secoes', secoesRoutes);

app.get('/api/dashboard', authMiddleware, (req, res) => {
    res.json({ sucesso: true, mensagem: 'Acesso autorizado', usuario: req.usuario });
});

// ==================== ERRO GLOBAL ====================
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        sucesso: false,
        mensagem: 'Erro interno do servidor',
    });
});

// ==================== INICIAR ====================
const PORT = process.env.PORT || 3001;

app.listen(PORT, async () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    await initDatabase();
});
