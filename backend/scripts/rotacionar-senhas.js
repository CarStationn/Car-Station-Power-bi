/**
 * Rotaciona a senha de todos os usuarios do Portal BI.
 *
 * Gera uma senha temporaria nova para cada usuario e marca a conta
 * como "primeiro acesso" (primeiro_acesso = TRUE) — o mesmo mecanismo
 * ja usado quando um usuario e cadastrado pela primeira vez. Na
 * proxima vez que a pessoa for logar:
 *   1. A senha antiga NAO funciona mais.
 *   2. A senha temporaria nova entra, e o portal obriga a criar uma
 *      senha propria na hora (tela "Crie sua senha").
 *
 * IMPORTANTE: uma sessao ja aberta no navegador (token ainda valido)
 * NAO e derrubada por este script — a rotacao vale a partir do
 * proximo LOGIN de cada pessoa, nao imediatamente. Se a intencao for
 * tambem forcar logout de sessoes ja abertas, isso e uma acao
 * diferente (nao feita aqui).
 *
 * ---------------------------------------------------------------
 * COMO USAR (rode da pasta backend/, com o mesmo .env de producao):
 *
 *   node scripts/rotacionar-senhas.js
 *       -> MODO SEGURO (padrao). So mostra quem seria afetado.
 *          Nao muda nada no banco.
 *
 *   node scripts/rotacionar-senhas.js --aplicar
 *       -> Executa de verdade: gera as senhas novas, atualiza o
 *          banco e grava um relatorio local com a senha de cada
 *          usuario, para voce distribuir.
 *
 * O relatorio (rotacao-senhas-<data>.csv) fica em backend/scripts/ e
 * NUNCA deve ser commitado — ja esta coberto pelo .gitignore do
 * projeto. Apague o arquivo assim que terminar de avisar todo mundo.
 * ---------------------------------------------------------------
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const APLICAR = process.argv.includes('--aplicar');

// Sem 0/O/1/I/l — caracteres que as pessoas confundem ao digitar uma
// senha temporaria a partir de um e-mail ou mensagem.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

function gerarSenhaTemporaria(tamanho = 10) {
  let senha = '';
  const bytes = crypto.randomBytes(tamanho);
  for (let i = 0; i < tamanho; i++) {
    senha += ALFABETO[bytes[i] % ALFABETO.length];
  }
  return senha;
}

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  try {
    const resultado = await client.query(
      'SELECT id, username, email, tipo FROM users ORDER BY tipo, username'
    );
    const usuarios = resultado.rows;

    if (usuarios.length === 0) {
      console.log('Nenhum usuario encontrado. Nada a fazer.');
      return;
    }

    console.log(`\nEncontrados ${usuarios.length} usuarios:\n`);
    usuarios.forEach(u => {
      console.log(`  #${u.id}  ${u.username.padEnd(20)} ${(u.email || '-').padEnd(30)} ${u.tipo}`);
    });

    if (!APLICAR) {
      console.log('\n---------------------------------------------');
      console.log('MODO SEGURO: nada foi alterado no banco.');
      console.log('Revise a lista acima. Se estiver correta, rode:');
      console.log('  node scripts/rotacionar-senhas.js --aplicar');
      console.log('---------------------------------------------\n');
      return;
    }

    console.log('\n--aplicar detectado: gerando senhas novas e atualizando o banco...\n');

    const relatorio = [['id', 'username', 'email', 'tipo', 'senha_temporaria']];

    await client.query('BEGIN');
    try {
      for (const u of usuarios) {
        const senhaTemp = gerarSenhaTemporaria();
        const hash = await bcrypt.hash(senhaTemp, 10);

        await client.query(
          `UPDATE users
             SET password = $1,
                 primeiro_acesso = TRUE,
                 atualizado_em = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [hash, u.id]
        );

        relatorio.push([u.id, u.username, u.email || '', u.tipo, senhaTemp]);
        console.log(`  OK  #${u.id}  ${u.username}`);
      }
      await client.query('COMMIT');
    } catch (erro) {
      await client.query('ROLLBACK');
      throw erro;
    }

    const dataHoje = new Date().toISOString().slice(0, 10);
    const caminhoRelatorio = path.join(__dirname, `rotacao-senhas-${dataHoje}.csv`);
    const csv = relatorio.map(linha => linha.join(';')).join('\n');
    fs.writeFileSync(caminhoRelatorio, csv, 'utf-8');

    console.log('\n---------------------------------------------');
    console.log(`Pronto. ${usuarios.length} contas rotacionadas.`);
    console.log(`Relatorio com as senhas novas: ${caminhoRelatorio}`);
    console.log('Distribua a cada usuario a senha correspondente e');
    console.log('apague este arquivo depois. Ele NAO deve ser commitado.');
    console.log('---------------------------------------------\n');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(erro => {
  console.error('\nErro ao rotacionar senhas:', erro.message);
  process.exit(1);
});
