const { query } = require('../config/database');

// Ícones disponíveis para as seções — precisam existir no sprite do dashboard.html
const ICONES_VALIDOS = [
    'chart', 'car', 'money', 'box', 'users', 'calendar', 'target',
    'wrench', 'truck', 'building', 'pie', 'clipboard', 'trend', 'grid'
];

const COR_PADRAO = '#4CE0B3';

function corValida(cor) {
    return typeof cor === 'string' && /^#[0-9a-fA-F]{6}$/.test(cor);
}

// ==================== LISTAR SEÇÕES ====================
async function listarSecoes(req, res) {
    try {
        const resultado = await query('SELECT * FROM secoes ORDER BY ordem ASC, id ASC');
        return res.status(200).json({ sucesso: true, secoes: resultado.rows });
    } catch (error) {
        console.error('❌ Erro ao listar seções:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar seções' });
    }
}

// ==================== CRIAR SEÇÃO ====================
async function criarSecao(req, res) {
    try {
        const { slug, nome, icone, cor } = req.body;

        if (!slug || !nome) {
            return res.status(400).json({ sucesso: false, mensagem: 'Identificador e nome são obrigatórios' });
        }

        const slugLimpo = String(slug).toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (!slugLimpo) {
            return res.status(400).json({ sucesso: false, mensagem: 'Identificador inválido (use letras, números e _)' });
        }

        const existe = await query('SELECT id FROM secoes WHERE slug = $1', [slugLimpo]);
        if (existe.rows.length > 0) {
            return res.status(409).json({ sucesso: false, mensagem: 'Já existe uma seção com esse identificador' });
        }

        const iconeFinal = ICONES_VALIDOS.includes(icone) ? icone : 'grid';
        const corFinal = corValida(cor) ? cor : COR_PADRAO;

        // Nova seção entra no fim da lista
        const maxOrdem = await query('SELECT COALESCE(MAX(ordem), 0) AS max FROM secoes');
        const ordem = parseInt(maxOrdem.rows[0].max, 10) + 1;

        const resultado = await query(
            'INSERT INTO secoes (slug, nome, icone, cor, ordem) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [slugLimpo, String(nome).trim(), iconeFinal, corFinal, ordem]
        );

        console.log(`✅ Seção criada: ${slugLimpo}`);
        return res.status(201).json({ sucesso: true, secao: resultado.rows[0] });
    } catch (error) {
        console.error('❌ Erro ao criar seção:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao criar seção' });
    }
}

// ==================== EDITAR SEÇÃO ====================
async function editarSecao(req, res) {
    try {
        const { id } = req.params;
        const { nome, icone, cor } = req.body;

        const secaoExiste = await query('SELECT * FROM secoes WHERE id = $1', [id]);
        if (secaoExiste.rows.length === 0) {
            return res.status(404).json({ sucesso: false, mensagem: 'Seção não encontrada' });
        }

        const campos = [];
        const valores = [];
        let i = 1;

        if (nome) { campos.push(`nome = $${i++}`); valores.push(String(nome).trim()); }
        if (icone && ICONES_VALIDOS.includes(icone)) { campos.push(`icone = $${i++}`); valores.push(icone); }
        if (corValida(cor)) { campos.push(`cor = $${i++}`); valores.push(cor); }

        if (campos.length === 0) {
            return res.status(400).json({ sucesso: false, mensagem: 'Nenhum campo para atualizar' });
        }

        valores.push(id);
        await query(`UPDATE secoes SET ${campos.join(', ')} WHERE id = $${i}`, valores);

        console.log(`✅ Seção editada: ${secaoExiste.rows[0].slug}`);
        return res.status(200).json({ sucesso: true, mensagem: 'Seção atualizada' });
    } catch (error) {
        console.error('❌ Erro ao editar seção:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao editar seção' });
    }
}

// ==================== DELETAR SEÇÃO ====================
async function deletarSecao(req, res) {
    try {
        const { id } = req.params;

        const secaoExiste = await query('SELECT * FROM secoes WHERE id = $1', [id]);
        if (secaoExiste.rows.length === 0) {
            return res.status(404).json({ sucesso: false, mensagem: 'Seção não encontrada' });
        }

        const slug = secaoExiste.rows[0].slug;

        // Mesma regra das categorias: não remove nada que ainda esteja em uso
        const paineis = await query('SELECT COUNT(*) FROM dashboards WHERE secao = $1', [slug]);
        const total = parseInt(paineis.rows[0].count, 10);

        if (total > 0) {
            return res.status(409).json({
                sucesso: false,
                mensagem: `Esta seção ainda tem ${total} ${total === 1 ? 'painel' : 'painéis'}. Remova ou mova antes de excluir a seção.`
            });
        }

        await query('DELETE FROM secoes WHERE id = $1', [id]);

        console.log(`✅ Seção removida: ${slug}`);
        return res.status(200).json({ sucesso: true, mensagem: 'Seção removida' });
    } catch (error) {
        console.error('❌ Erro ao remover seção:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao remover seção' });
    }
}

module.exports = { listarSecoes, criarSecao, editarSecao, deletarSecao, ICONES_VALIDOS };
