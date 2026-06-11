# Lembretes

App web para salvar lembretes e recados importantes. Roda no navegador, funciona no desktop e no celular.

## Tecnologias

- **Backend:** Node.js + Express
- **Banco de dados:** SQLite (via better-sqlite3)
- **Frontend:** HTML, CSS e JavaScript puro, sem frameworks

## Estrutura

```
note-app/
├── server.js         - servidor e rotas da API
├── package.json
├── data/
│   └── notes.db      - banco de dados SQLite (criado automaticamente)
└── public/
    ├── index.html    - estrutura HTML
    ├── style.css     - estilos
    └── app.js        - lógica do frontend
```

## Como rodar

```bash
npm install
npm start
```

O app ficará disponível em `http://localhost:8080`.

Para usar uma porta diferente:

```bash
PORT=3000 npm start
```

## Funcionalidades

- Adicionar lembretes com titulo (opcional), mensagem e cor
- Editar lembretes existentes clicando neles
- Excluir lembretes
- Fixar lembretes importantes (aparecem no topo)
- Busca em tempo real por titulo ou conteudo
- 6 opcoes de cor para os lembretes

## API

| Metodo | Rota              | Descricao              |
|--------|-------------------|------------------------|
| GET    | /api/notes        | Lista todos os lembretes |
| POST   | /api/notes        | Cria um novo lembrete  |
| PUT    | /api/notes/:id    | Atualiza um lembrete   |
| DELETE | /api/notes/:id    | Remove um lembrete     |

## Deploy

Para subir em uma hospedagem com suporte a Node.js, copie todos os arquivos do projeto e rode `npm install && npm start`. O banco de dados fica salvo em `data/notes.db` — guarde esse arquivo em backup quando necessario.
