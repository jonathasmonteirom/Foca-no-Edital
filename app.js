const fs = require('fs');
const express = require('express');
const session = require('express-session');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt'); 
const path = require('path');
const multer = require('multer');
                      
const app = express();
const prisma = new PrismaClient(); 

app.use(express.urlencoded({ extended: true }));
app.use(express.json());   

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
});
const upload = multer({ storage: storage });

app.set('view engine', 'ejs'); 
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); 

app.use(session({
    secret: process.env.SESSION_SECRET || 'chave_de_backup_provisoria',
    resave: false,
    saveUninitialized: true
}));

app.get('/', (req, res) => {
    res.render('login', { erro: null });
});

app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    
    const usuario = await prisma.usuario.findUnique({
        where: { email: email }
    });

    if (usuario && await bcrypt.compare(senha, usuario.senha)) {
        req.session.usuarioId = usuario.id;
        req.session.nomeUsuario = usuario.nome;
        return res.redirect('/dashboard');
    }
    
    res.render('login', { erro: "E-mail ou senha incorretos." });
});

app.get('/cadastro', (req, res) => {
    res.render('cadastro');
});

app.post('/cadastro', async (req, res) => {
    const { nome, email, senha } = req.body;
    
    const senhaCriptografada = await bcrypt.hash(senha, 10);
    
    try {
        await prisma.usuario.create({
            data: {
                nome,
                email,
                senha: senhaCriptografada
            }
        });
        res.redirect('/');
    } catch (error) {
        res.render('login', { erro: "Este e-mail já está cadastrado." });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(); 
    res.redirect('/');
});

app.post('/adicionar_edital', upload.single('arquivo_pdf'), async (req, res) => {
    if (!req.session.usuarioId) return res.redirect('/');
    
    const { titulo, data_prova } = req.body;
    const nomeDoArquivo = req.file ? req.file.filename : null;
    
    await prisma.edital.create({
        data: {
            titulo,
            data_prova,
            arquivo_pdf: nomeDoArquivo,
            usuarioId: req.session.usuarioId
        }
    });
    
    res.redirect('/dashboard');
});

app.get('/dashboard', async (req, res) => {
    if (!req.session.usuarioId) return res.redirect('/');

    const editais = await prisma.edital.findMany({
        where: { usuarioId: req.session.usuarioId },
        orderBy: { data_prova: 'asc' },
        include: { disciplinas: true } 
    });

    const editaisComProgresso = editais.map(edital => {
        const total = edital.disciplinas.length;
        const concluidas = edital.disciplinas.filter(d => d.status === 'Concluído').length;
        const progresso = total === 0 ? 0 : Math.round((concluidas / total) * 100);
        
        return { ...edital, progresso };
    });

    const totalEditais = editais.length;
    let totalDisciplinas = 0;
    let disciplinasConcluidas = 0;

    editais.forEach(edital => {
        totalDisciplinas += edital.disciplinas.length;
        disciplinasConcluidas += edital.disciplinas.filter(d => d.status === 'Concluído').length;
    });

    res.render('dashboard', { 
        editais: editaisComProgresso, 
        nomeUsuario: req.session.nomeUsuario,
        totalEditais,
        totalDisciplinas,
        disciplinasConcluidas
    });
});

app.get('/excluir_edital/:id', async (req, res) => {
    if (!req.session.usuarioId) return res.redirect('/');
    const editalId = parseInt(req.params.id);

    const edital = await prisma.edital.findUnique({ where: { id: editalId } });
    await prisma.edital.delete({ where: { id: editalId } });

    if (edital && edital.arquivo_pdf) {
        const caminhoArquivo = path.join(__dirname, 'uploads', edital.arquivo_pdf);
        fs.unlink(caminhoArquivo, (erro) => {
            if (erro) console.log("Erro ao apagar o PDF físico:", erro);
        });
    }
    res.redirect('/dashboard');
});

app.get('/baixar_edital/:id', async (req, res) => {
    if (!req.session.usuarioId) return res.redirect('/');
    
    const edital = await prisma.edital.findUnique({
        where: { id: parseInt(req.params.id) }
    });

    if (edital && edital.arquivo_pdf) {
        const caminhoArquivo = path.join(__dirname, 'uploads', edital.arquivo_pdf);
        res.sendFile(caminhoArquivo);
    } else {
        res.redirect('/dashboard');
    }
});

app.get('/editar_edital/:id', async (req, res) => {
    if (!req.session.usuarioId) return res.redirect('/');
    const edital = await prisma.edital.findUnique({
        where: { id: parseInt(req.params.id) }
    });
    res.render('editar_edital', { edital });
});

app.post('/editar_edital/:id', async (req, res) => {
    const { titulo, data_prova } = req.body;
    await prisma.edital.update({
        where: { id: parseInt(req.params.id) },
        data: { titulo, data_prova }
    });
    res.redirect('/dashboard');
});

app.get('/disciplinas/:id', async (req, res) => {
    if (!req.session.usuarioId) return res.redirect('/');
    
    const editalId = parseInt(req.params.id);

    const edital = await prisma.edital.findFirst({
        where: { 
            id: editalId,
            usuarioId: req.session.usuarioId
        }
    });

    const disciplinas = await prisma.disciplina.findMany({
        where: { editalId: editalId }
    });

    if (!edital) return res.redirect('/dashboard');

    res.render('disciplinas', { 
        edital: edital, 
        disciplinas: disciplinas, 
        nomeUsuario: req.session.nomeUsuario 
    });
});

app.post('/adicionar_disciplina', async (req, res) => {
    const { nome_materia, editalId } = req.body;
    await prisma.disciplina.create({
        data: {
            nome_materia,
            editalId: parseInt(editalId)
        }
    });
    res.redirect(`/disciplinas/${editalId}`);
});

app.get('/editar_disciplina/:id/:id_edital', async (req, res) => {
    const disciplina = await prisma.disciplina.findUnique({
        where: { id: parseInt(req.params.id) }
    });
    res.render('editar_disciplina', { disciplina, id_edital: req.params.id_edital });
});

app.post('/editar_disciplina/:id/:id_edital', async (req, res) => {
    const { nome_materia, status } = req.body;
    await prisma.disciplina.update({
        where: { id: parseInt(req.params.id) },
        data: { nome_materia, status }
    });
    res.redirect(`/disciplinas/${req.params.id_edital}`);
});

app.get('/excluir_disciplina/:id/:id_edital', async (req, res) => {
    await prisma.disciplina.delete({
        where: { id: parseInt(req.params.id) }
    });
    res.redirect(`/disciplinas/${req.params.id_edital}`);
});

app.post('/api/enviar_pergunta', async (req, res) => {
    if (!req.session.usuarioId) return res.status(401).json({ erro: 'Acesso negado' });
    
    const { pergunta, arquivo_pdf } = req.body;

    try {
        const respostaFlask = await fetch('http://api_python:5000/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pergunta, arquivo_pdf })
        });
        
        const dados = await respostaFlask.json();
        
        res.json(dados);
    } catch (erro) {
        console.error("Erro na ponte Node-Python:", erro);
        res.status(500).json({ erro: 'A IA está off. Verifique se o servidor python está ligado.' });
    }
});

const port = 3000;
app.listen(port, () => console.log(`Servidor a correr em http://localhost:${port}`));