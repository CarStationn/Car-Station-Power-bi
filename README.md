# 🚗 Car Station Indicadores

Sistema web interno para visualização de dashboards Power BI com controle de acesso por perfil de usuário.

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![JWT](https://img.shields.io/badge/JWT-000000?style=flat&logo=jsonwebtokens&logoColor=white)

---

## Sobre o projeto

O **Car Station Indicadores** centraliza dashboards do Power BI em um portal com autenticação. Gestores acessam os dashboards de sua área e o administrador gerencia usuários e configura os links de cada seção — tudo sem precisar mexer no código.

---

## Funcionalidades

- Autenticação com JWT e senhas criptografadas com bcrypt
- Dois perfis de acesso: **Admin** e **Gestor**
- Dashboards Power BI embarcados por seção (Vendas, Financeiro, Estoque)
- Configuração de links Power BI via painel admin (sem mexer no código)
- Cadastro, edição e remoção de usuários
- Interface responsiva com suporte a mobile

---

## Tecnologias

**Backend**
- Node.js + Express
- PostgreSQL
- JWT (jsonwebtoken)
- bcryptjs
- dotenv / cors

**Frontend**
- HTML, CSS e JavaScript puro (sem frameworks)
- Poppins (Google Fonts)

---

## Onde roda hoje

| Camada   | Serviço  | Endereço                      |
|----------|----------|-------------------------------|
| Frontend | Vercel   | `car-station-rho.vercel.app`  |
| Backend  | Render   | `car-station.onrender.com`    |
| Banco    | Supabase | PostgreSQL gerenciado         |

O endereço da API fica em **`config.js`, na raiz** — é o único arquivo a editar ao
trocar de servidor. Ele é carregado tanto pela tela de login quanto pelo portal.

> **Migrando para servidor próprio?** Existe um roteiro completo de migração
> (banco, systemd, Nginx, HTTPS, firewall e verificação). Peça o link à equipe.

---

## Pré-requisitos

- [Node.js](https://nodejs.org/) v18 ou superior
- [PostgreSQL](https://www.postgresql.org/) rodando localmente

---

## Como rodar

### 1. Clone o repositório

```bash
git clone https://github.com/CarStationn/Car-Station-Power-bi.git
cd Car-Station-Power-bi
```

### 2. Configure as variáveis de ambiente

Copie `backend/.env.example` para `backend/.env` e preencha. O arquivo de exemplo
explica cada variável, inclusive como gerar o `JWT_SECRET`.

```bash
cp backend/.env.example backend/.env
```

> O `.env` nunca vai para o Git. Se precisar dos valores de produção, peça a quem
> administra o ambiente — não os copie de prints nem de mensagens.

### 3. Instale as dependências e suba o servidor

```bash
cd backend
npm install
node server.js
```

O servidor sobe em `http://localhost:3001`.  
As tabelas são criadas automaticamente na primeira execução.

### 4. Abra o frontend

Abra o arquivo `index.html` no navegador ou use o **Live Server** do VS Code.

### 5. Acesso inicial

Num banco vazio, a primeira subida cria o administrador `admin@carstation.com`
com uma **senha aleatória, mostrada uma única vez no log do servidor**:

```
✅ Banco sem usuários: administrador inicial criado
   usuário: admin@carstation.com  senha temporária: ••••••••••••
```

O sistema exige a troca dessa senha no primeiro login. Não existe senha padrão:
se o banco já tem qualquer usuário, nada é criado.

---

## Estrutura do projeto

```
├── index.html              # Página de login
├── script.js               # Lógica do login
├── style.css               # Estilo do login
│
├── Dash/
│   ├── dashboard.html      # Dashboard principal
│   ├── dashboard.js        # Lógica do dashboard
│   └── dashboard.css       # Estilo do dashboard
│
└── backend/
    ├── server.js
    └── src/
        ├── config/
        │   └── database.js
        ├── controllers/
        │   ├── authController.js
        │   ├── userController.js
        │   └── dashboardController.js
        ├── middleware/
        │   └── auth.js
        └── routes/
            ├── auth.js
            ├── users.js
            └── dashboards.js
```

---

## API

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/auth/login` | Público | Login |
| GET | `/api/auth/validar` | Token | Valida sessão |
| GET | `/api/users` | Token | Lista usuários |
| POST | `/api/users` | Admin | Cria usuário |
| PUT | `/api/users/:id` | Admin | Edita usuário |
| DELETE | `/api/users/:id` | Admin | Remove usuário |
| GET | `/api/dashboards` | Token | Lista configs dos dashboards |
| PUT | `/api/dashboards/:secao` | Admin | Salva link do Power BI |

---

## Como configurar um dashboard Power BI

1. No Power BI, publique o relatório via **Arquivo → Publicar na Web**
2. Copie o link ou o código `<iframe>` gerado
3. No sistema, acesse **Configurações → Dashboards Power BI**
4. Selecione a seção desejada, cole o link e salve

---

## Autor

**Davi Ferreira**  
davimachado0610@hotmail.com
