const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { 
    userMethods, 
    projectMethods, 
    activityMethods, 
    notificationMethods 
} = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Middleware de autenticação
const authenticateUser = async (req, res, next) => {
    const userId = req.headers['user-id'];
    if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
    }
    req.userId = userId;
    next();
};

// Rotas de usuário
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = await userMethods.createUser(name, email, hashedPassword);
        res.json({ userId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await userMethods.getUser(email);
        
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        res.json({ 
            userId: user.id,
            name: user.name,
            email: user.email
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rotas de projetos
app.post('/api/projects', authenticateUser, async (req, res) => {
    try {
        const { name, description, deadline } = req.body;
        const projectId = await projectMethods.createProject(req.userId, name, description, deadline);
        
        // Cria uma atividade para o novo projeto
        await activityMethods.addActivity(req.userId, projectId, `Novo projeto "${name}" criado`, 'create_project');
        
        // Cria uma notificação
        await notificationMethods.addNotification(
            req.userId,
            'Novo Projeto',
            `O projeto "${name}" foi criado com sucesso!`
        );

        res.json({ projectId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/projects', authenticateUser, async (req, res) => {
    try {
        const projects = await projectMethods.getUserProjects(req.userId);
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/projects/:id', authenticateUser, async (req, res) => {
    try {
        const projectId = req.params.id;
        const project = await projectMethods.getProject(projectId, req.userId);
        
        if (!project) {
            return res.status(404).json({ error: 'Projeto não encontrado' });
        }

        res.json(project);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/projects/:id', authenticateUser, async (req, res) => {
    try {
        const projectId = req.params.id;
        
        // Primeiro verifica se o projeto existe e pertence ao usuário
        const project = await projectMethods.getProject(projectId, req.userId);
        if (!project) {
            return res.status(404).json({ error: 'Projeto não encontrado' });
        }

        // Exclui o projeto e suas atividades relacionadas
        const result = await projectMethods.deleteProject(projectId, req.userId);
        
        if (result) {
            // Registra a atividade de exclusão
            await activityMethods.addActivity(
                req.userId,
                null,
                `Projeto "${project.name}" foi excluído`,
                'delete_project'
            );
        }

        res.json({ success: result > 0 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rotas de atividades
app.get('/api/activities', authenticateUser, async (req, res) => {
    try {
        const activities = await activityMethods.getUserActivities(req.userId);
        res.json(activities);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rotas de notificações
app.get('/api/notifications', authenticateUser, async (req, res) => {
    try {
        const notifications = await notificationMethods.getUserNotifications(req.userId);
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/notifications/:id/read', authenticateUser, async (req, res) => {
    try {
        const notificationId = req.params.id;
        const result = await notificationMethods.markNotificationAsRead(notificationId, req.userId);
        res.json({ success: result > 0 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota para obter contagens
app.get('/api/counts', authenticateUser, async (req, res) => {
    try {
        const [projectCount, activityCount, unreadNotifications] = await Promise.all([
            projectMethods.getProjectCount(req.userId),
            activityMethods.getActivityCount(req.userId),
            notificationMethods.getUnreadCount(req.userId)
        ]);

        res.json({
            projects: projectCount,
            activities: activityCount,
            notifications: unreadNotifications
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
}); 