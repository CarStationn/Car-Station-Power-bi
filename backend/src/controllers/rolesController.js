const { query } = require('../config/database');

// ==================== LISTAR CATEGORIAS ====================
async function listarRoles(req, res) {
    try {
        const resultado = await query('SELECT * FROM roles ORDER BY id ASC');
        return res.status(200).json({ sucesso: true, roles: resultado.rows });
    } catch (error) {
        console.error('❌ Erro ao listar categorias:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar categorias' });
    }
}

// ==================== CRIAR CATEGORIA ====================
async function criarRole(req, res) {
    try {
        const { slug, label, icone, cor } = req.body;

        if (!slug || !label) {
            return res.status(400).json({ sucesso: false, mensagem: 'Identificador e nome são obrigatórios' });
        }

        const slugLimpo = slug.toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (!slugLimpo) {
            return res.status(400).json({ sucesso: false, mensagem: 'Identificador inválido (use letras, números e _)' });
        }

        const existe = await query('SELECT id FROM roles WHERE slug = $1', [slugLimpo]);
        if (existe.rows.length > 0) {
            return res.status(409).json({ sucesso: false, mensagem: 'Já existe uma categoria com esse identificador' });
        }

        const resultado = await query(
            'INSERT INTO roles (slug, label, icone, cor) VALUES ($1, $2, $3, $4) RETURNING *',
            [slugLimpo, label.trim(), icone || '👤', cor || '#607d8b']
        );

        console.log(`✅ Categoria criada: ${slugLimpo}`);
        return res.status(201).json({ sucesso: true, role: resultado.rows[0] });
    } catch (error) {
        console.error('❌ Erro ao criar categoria:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao criar categoria' });
    }
}

// ==================== EDITAR CATEGORIA ====================
async function editarRole(req, res) {
    try {
        const { id } = req.params;
        const { label, icone, cor } = req.body;

        const roleExiste = await query('SELECT * FROM roles WHERE id = $1', [id]);
        if (roleExiste.rows.length === 0) {
            return res.status(404).json({ sucesso: false, mensagem: 'Categoria não encontrada' });
        }

        const campos = [];
        const valores = [];
        let i = 1;

        if (label) { campos.push(`label = $${i++}`); valores.push(label.trim()); }
        if (icone) { campos.push(`icone = $${i++}`); valores.push(icone); }
        if (cor) { campos.push(`cor = $${i++}`); valores.push(cor); }

        if (campos.length === 0) {
            return res.status(400).json({ sucesso: false, mensagem: 'Nenhum campo para atualizar' });
        }

        valores.push(id);
        await query(`UPDATE roles SET ${campos.join(', ')} WHERE id = $${i}`, valores);

        console.log(`✅ Categoria editada: ${roleExiste.rows[0].slug}`);
        return res.status(200).json({ sucesso: true, mensagem: 'Categoria atualizada' });
    } catch (error) {
        console.error('❌ Erro ao editar categoria:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao editar categoria' });
    }
}

// ==================== DELETAR CATEGORIA ====================
async function deletarRole(req, res) {
    try {
        const { id } = req.params;

        const roleExiste = await query('SELECT * FROM roles WHERE id = $1', [id]);
        if (roleExiste.rows.length === 0) {
            return res.status(404).json({ sucesso: false, mensagem: 'Categoria não encontrada' });
        }

        if (roleExiste.rows[0].protegido) {
            return res.status(403).json({ sucesso: false, mensagem: 'Esta categoria não pode ser removida' });
        }

        const usersComRole = await query('SELECT COUNT(*) FROM users WHERE tipo = $1', [roleExiste.rows[0].slug]);
        if (parseInt(usersComRole.rows[0].count) > 0) {
            return res.status(409).json({ sucesso: false, mensagem: 'Não é possível remover uma categoria com usuários ativos' });
        }

        await query('DELETE FROM roles WHERE id = $1', [id]);

        console.log(`✅ Categoria removida: ${roleExiste.rows[0].slug}`);
        return res.status(200).json({ sucesso: true, mensagem: 'Categoria removida' });
    } catch (error) {
        console.error('❌ Erro ao remover categoria:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao remover categoria' });
    }
}

module.exports = { listarRoles, criarRole, editarRole, deletarRole };
