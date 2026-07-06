# 🎯 Foca no Edital - Sistema RAG com Inteligência Artificial

Um sistema completo baseado em microsserviços para análise inteligente de editais e documentos em PDF. A aplicação integra um backend em Node.js para gestão de usuários e upload de arquivos com um motor de Inteligência Artificial em Python que utiliza a técnica de RAG (Retrieval-Augmented Generation) para responder perguntas sobre o conteúdo dos documentos de forma precisa.

## 🚀 Tecnologias Utilizadas

O projeto foi construído utilizando uma arquitetura conteinerizada (Docker) separada em dois microsserviços principais:

**Serviço Principal (Web & API):**
- **Node.js & Express:** Gerenciamento de rotas, sessões e upload de PDFs.
- **Prisma ORM & SQLite:** Banco de dados relacional para persistência de usuários e cadastros.

**Serviço de Inteligência Artificial:**
- **Python & Flask:** API dedicada para processamento de linguagem natural.
- **LangChain:** Framework para orquestração do fluxo do LLM.
- **ChromaDB:** Banco de dados vetorial para armazenar os *embeddings* dos documentos.
- **OpenAI (GPT-4o-mini & Text Embedding 3):** Modelos de geração de texto e vetorização.

**Infraestrutura:**
- **Docker & Docker Compose:** Orquestração dos contêineres e sincronização de volumes.

---

## ⚙️ Como executar o projeto localmente

### 1. Pré-requisitos
Você precisará ter instalado em sua máquina:
- [Git](https://git-scm.com/)
- [Docker](https://www.docker.com/) e [Docker Compose](https://docs.docker.com/compose/)
- Uma chave de API válida da [OpenAI](https://platform.openai.com/)

### 2. Clonando o Repositório
```bash
git clone [https://github.com/jonathasmonteirom/Foca-no-Edital.git](https://github.com/jonathasmonteirom/Foca-no-Edital.git)
cd Foca-no-Edital
```

### 3. Configurando as Variáveis de Ambiente
O projeto precisa de arquivos `.env` para funcionar. Use os arquivos de exemplo para criar os oficiais:

Na raiz do projeto, crie um arquivo `.env` baseado no `.env.example`:
```env
DATABASE_URL="file:/app/prisma/dev.db"
SESSION_SECRET="uma_senha_aqui"
```

Dentro da pasta `python_api`, crie outro arquivo `.env` baseado no `.env.example`:
```env
CHAVE_API_IA="sua_chave_da_openai_aqui"
```

### 4. Construindo e Iniciando os Contêineres
Na raiz do projeto, execute o comando do Docker Compose para construir as imagens e iniciar o sistema:
```bash
docker compose up --build
```

### 5. Sincronizando o Banco de Dados
Com o servidor rodando, abra um **novo terminal** e execute a migração do Prisma para criar as tabelas no SQLite:
```bash
docker compose exec app_node npx prisma db push
```

### 6. Acessando a Aplicação
Tudo pronto! Abra o seu navegador e acesse:
👉 **http://localhost:3000**

---

## 🧠 Como o sistema funciona
1. O usuário faz o cadastro no sistema Node.js e envia um edital em formato PDF.
2. O arquivo é salvo em um volume Docker compartilhado (`/uploads`).
3. Ao enviar uma pergunta no chat, o Node.js aciona a API Python via rede interna do Docker.
4. O Python lê o PDF do volume compartilhado, divide o texto em blocos (*chunks*), gera *embeddings* e armazena no ChromaDB.
5. O LangChain cruza a pergunta do usuário com os fragmentos mais relevantes do documento e envia o contexto para a OpenAI gerar uma resposta baseada estritamente no edital enviado.