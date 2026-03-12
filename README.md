# Shemá - Sistema de Escalas para Igrejas v4.0

Sistema web completo para gerenciamento de escalas, equipes e treinamentos de igrejas.

## Funcionalidades

- **Dashboard** — Estatísticas, gráficos de distribuição etária e de gênero, aniversariantes do dia
- **Cadastro de Membros** — Dados completos (nome, telefone, CPF, data de nascimento, escolaridade, profissão, etc.)
- **Cadastro de Equipes** — Equipes com líder geral e até 3 líderes auxiliares, membros vinculados
- **Calendário de Equipes** — Calendário visual com eventos por equipe, botões coloridos com popup de membros
- **Treinamentos** — Pastas de conteúdo com vídeos do YouTube, controle de progresso de visualização
- **Relatórios/Logs** — Registro de todas as ações do sistema

## Tecnologias

- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Backend:** Node.js + Express.js
- **Banco de Dados:** SQLite (better-sqlite3)
- **Autenticação:** bcryptjs

## Deploy no Render

### Configurações do Render:

| Campo | Valor |
|-------|-------|
| **Language** | Node |
| **Branch** | main |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |

### Variáveis de Ambiente (opcionais):

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `PORT` | Porta do servidor | 3002 |

### Passos:

1. Crie um novo **Web Service** no [Render](https://render.com)
2. Conecte ao repositório GitHub: `reinehr06-jpg/Shema`
3. Configure conforme a tabela acima
4. Clique **Deploy**

## Executar Localmente

```bash
# Instalar dependências
npm install

# Iniciar servidor
npm start

# Acesse em http://localhost:3002
```

## Estrutura do Projeto

```
shema-system/
├── server.js          # API Express + rotas
├── database.js        # Modelos SQLite (members, teams, events, etc.)
├── package.json       # Dependências Node.js
├── .gitignore         # Arquivos ignorados
└── public/
    ├── index.html     # Interface principal (SPA)
    ├── app.js         # Lógica do frontend
    ├── styles.css     # Estilos CSS
    └── logo.png       # Logo do sistema
```

## Login Padrão

- **Usuário:** admin
- **Senha:** admin123
