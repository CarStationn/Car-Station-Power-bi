const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// ==================== VERIFICAR TOKEN ====================
// Alem de validar a assinatura, reconsulta o usuario no banco a cada
// requisicao e usa o tipo ATUAL dele, em vez do que estava gravado no
// token no momento do login. Sem isso, deletar um usuario ou rebaixar
// um admin nao surtia efeito enquanto o token de 7 dias continuasse
// valido — a conta continuava com acesso mesmo apos ser removida.
async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            sucesso: false,
            mensagem: 'Token não fornecido'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const resultado = await query(
            'SELECT id, username, tipo FROM users WHERE id = $1',
            [decoded.id]
        );

        if (resultado.rows.length === 0) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Token inválido'
            });
        }

        // Sempre os dados atuais do banco — nunca o que veio no token
        req.usuario = resultado.rows[0];
        next();
    } catch (error) {
        return res.status(401).json({
            sucesso: false,
            mensagem: 'Token inválido'
        });
    }
}

// ==================== APENAS ADMIN ====================
function adminMiddleware(req, res, next) {
    if (req.usuario.tipo !== 'admin') {
        return res.status(403).json({
            sucesso: false,
            mensagem: 'Apenas administradores'
        });
    }
    next();
}

module.exports = {
    authMiddleware,
    adminMiddleware
};
