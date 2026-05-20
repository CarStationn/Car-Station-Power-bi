const { query } = require('../config/database');
const bcrypt = require('bcryptjs');

// ==================== LISTAR TODOS OS USUÁRIOS ====================
async function listarUsuarios(req, res) {
    try {
        const resultado = await query(
            'SELECT id, username, tipo, email, criado_em, ultimo_login FROM users ORDER BY criado_em DESC'
        );

        return res.status(200).json({
            sucesso: true,
            usuarios: resultado.rows,
            total: resultado.rows.length,
        });
    } catch (error) {
        console.error('❌ Erro ao listar usuários:', error);
        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao listar usuários',
        });
    }
}

// ==================== CRIAR NOVO USUÁRIO ====================
async function criarUsuario(req, res) {
    try {
        const { username, password, tipo, email } = req.body;

        if (!username || !password || !email) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Nome, email e senha são obrigatórios',
            });
        }

        const roleValida = await query('SELECT id FROM roles WHERE slug = $1', [tipo]);
        if (roleValida.rows.length === 0) {
            return res.status(400).json({ sucesso: false, mensagem: 'Tipo inválido' });
        }

        const usuarioExiste = await query(
            'SELECT * FROM users WHERE username = $1 OR email = $2',
            [username, email.toLowerCase().trim()]
        );

        if (usuarioExiste.rows.length > 0) {
            return res.status(409).json({
                sucesso: false,
                mensagem: 'Usuário ou email já existe',
            });
        }

        const senhaHasheada = await bcrypt.hash(password, 10);

        const resultado = await query(
            'INSERT INTO users (username, password, tipo, email, primeiro_acesso) VALUES ($1, $2, $3, $4, TRUE) RETURNING id, username, tipo, email, criado_em',
            [username, senhaHasheada, tipo, email.toLowerCase().trim()]
        );

        const novoUsuario = resultado.rows[0];

        console.log(`✅ Usuário criado: ${username}`);
        return res.status(201).json({
            sucesso: true,
            mensagem: 'Usuário criado com sucesso',
            usuario: novoUsuario,
        });

    } catch (error) {
        console.error('❌ Erro ao criar usuário:', error);
        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao criar usuário',
        });
    }
}

// ==================== DELETAR USUÁRIO ====================
async function deletarUsuario(req, res) {
    try {
        const { id } = req.params;

        if (req.usuario.id === parseInt(id)) {
            return res.status(403).json({
                sucesso: false,
                mensagem: 'Você não pode deletar sua própria conta',
            });
        }

        const usuarioExiste = await query(
            'SELECT username FROM users WHERE id = $1',
            [id]
        );

        if (usuarioExiste.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Usuário não encontrado',
            });
        }

        await query('DELETE FROM users WHERE id = $1', [id]);

        console.log(`✅ Usuário deletado: ${usuarioExiste.rows[0].username}`);
        return res.status(200).json({
            sucesso: true,
            mensagem: 'Usuário deletado com sucesso',
        });

    } catch (error) {
        console.error('❌ Erro ao deletar usuário:', error);
        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao deletar usuário',
        });
    }
}

// ==================== EDITAR USUÁRIO ====================
async function editarUsuario(req, res) {
    try {
        const { id } = req.params;
        const { password, tipo, username } = req.body;

        const usuarioExiste = await query(
            'SELECT id, username, tipo FROM users WHERE id = $1',
            [id]
        );

        if (usuarioExiste.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Usuário não encontrado',
            });
        }

        if (tipo) {
            const roleValida = await query('SELECT id FROM roles WHERE slug = $1', [tipo]);
            if (roleValida.rows.length === 0) {
                return res.status(400).json({ sucesso: false, mensagem: 'Tipo inválido' });
            }
        }

        // Admin não pode rebaixar a própria conta
        if (req.usuario.id === parseInt(id) && tipo && tipo !== req.usuario.tipo) {
            return res.status(403).json({
                sucesso: false,
                mensagem: 'Você não pode alterar seu próprio tipo',
            });
        }

        const campos = [];
        const valores = [];
        let i = 1;

        if (username) {
            if (username.length < 3) {
                return res.status(400).json({ sucesso: false, mensagem: 'Usuário deve ter no mínimo 3 caracteres' });
            }
            const usuarioJaExiste = await query('SELECT id FROM users WHERE username = $1 AND id != $2', [username, id]);
            if (usuarioJaExiste.rows.length > 0) {
                return res.status(409).json({ sucesso: false, mensagem: 'Nome de usuário já está em uso' });
            }
            campos.push(`username = $${i++}`);
            valores.push(username);
        }

        if (password) {
            if (password.length < 3) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Senha deve ter no mínimo 3 caracteres',
                });
            }
            const senhaHasheada = await bcrypt.hash(password, 10);
            campos.push(`password = $${i++}`);
            valores.push(senhaHasheada);
        }

        if (tipo) {
            campos.push(`tipo = $${i++}`);
            valores.push(tipo);
        }

        if (campos.length === 0) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Nenhum campo para atualizar',
            });
        }

        campos.push(`atualizado_em = CURRENT_TIMESTAMP`);
        valores.push(id);

        await query(
            `UPDATE users SET ${campos.join(', ')} WHERE id = $${i}`,
            valores
        );

        console.log(`✅ Usuário editado: ${usuarioExiste.rows[0].username}`);
        return res.status(200).json({
            sucesso: true,
            mensagem: 'Usuário atualizado com sucesso',
        });

    } catch (error) {
        console.error('❌ Erro ao editar usuário:', error);
        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao editar usuário',
        });
    }
}

// ==================== LISTAR PERMISSÕES DO USUÁRIO ====================
async function listarPermissoes(req, res) {
    try {
        const { id } = req.params;
        const resultado = await query(
            'SELECT dashboard_id FROM user_dashboard_permissions WHERE user_id = $1',
            [id]
        );
        return res.status(200).json({
            sucesso: true,
            permissoes: resultado.rows.map(r => r.dashboard_id),
        });
    } catch (error) {
        console.error('❌ Erro ao listar permissões:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar permissões' });
    }
}

// ==================== SALVAR PERMISSÕES DO USUÁRIO ====================
async function salvarPermissoes(req, res) {
    try {
        const { id } = req.params;
        const { dashboard_ids } = req.body;

        await query('DELETE FROM user_dashboard_permissions WHERE user_id = $1', [id]);

        if (Array.isArray(dashboard_ids) && dashboard_ids.length > 0) {
            for (const dashId of dashboard_ids) {
                await query(
                    'INSERT INTO user_dashboard_permissions (user_id, dashboard_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [id, dashId]
                );
            }
        }

        return res.status(200).json({ sucesso: true, mensagem: 'Permissões atualizadas' });
    } catch (error) {
        console.error('❌ Erro ao salvar permissões:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao salvar permissões' });
    }
}

module.exports = {
    listarUsuarios,
    criarUsuario,
    editarUsuario,
    deletarUsuario,
    listarPermissoes,
    salvarPermissoes,
};