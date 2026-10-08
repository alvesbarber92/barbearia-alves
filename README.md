# Barbearia Alves

Sistema de agendamento online da Barbearia Alves: o cliente marca o horário pelo link da barbearia e a equipe acompanha agenda, clientes, estoque e caixa.

## Tecnologias

- **Frontend:** React, Vite, Tailwind CSS, React Router, TanStack Query (em `frontend/`)
- **Banco e autenticação:** Supabase (estrutura em `supabase/`)
- **Hospedagem:** Vercel, com *Root Directory* `frontend`

## Rodando localmente

```bash
cd frontend
npm install
```

Crie o arquivo `frontend/.env` a partir do `frontend/.env.example` e preencha:

```env
VITE_SUPABASE_URL=https://<id-do-projeto>.supabase.co
VITE_SUPABASE_ANON_KEY=<chave anon do painel do Supabase>
VITE_EMAIL_CONTATO=<e-mail de contato exibido nos Termos e na Privacidade>
```

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento em `http://localhost:5173` |
| `npm run build` | Build de produção em `frontend/dist` |
| `npm run lint` | Verificação do código com ESLint |

As mesmas variáveis `VITE_*` precisam estar cadastradas na Vercel.
