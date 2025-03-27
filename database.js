const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Cria conexão com o banco de dados
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err);
    } else {
        console.log('Conectado ao banco de dados SQLite');
        initDatabase();
    }
});

// Inicializa as tabelas do banco de dados
function initDatabase() {
    db.serialize(() => {
        // Tabela de Usuários
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Tabela de Projetos
        db.run(`CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            deadline DATE,
            status TEXT DEFAULT 'em_andamento',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        // Tabela de Atividades
        db.run(`CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            project_id INTEGER,
            description TEXT NOT NULL,
            type TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (project_id) REFERENCES projects (id)
        )`);

        // Tabela de Notificações
        db.run(`CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            read BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);
    });
}

// Funções para gerenciar usuários
const userMethods = {
    createUser: (name, email, password) => {
        return new Promise((resolve, reject) => {
            db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
                [name, email, password],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    },

    getUser: (email) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
};

// Funções para gerenciar projetos
const projectMethods = {
    createProject: (userId, name, description, deadline) => {
        return new Promise((resolve, reject) => {
            db.run('INSERT INTO projects (user_id, name, description, deadline) VALUES (?, ?, ?, ?)',
                [userId, name, description, deadline],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    },

    getUserProjects: (userId) => {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },

    getProject: (projectId, userId) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM projects WHERE id = ? AND user_id = ?', [projectId, userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    deleteProject: (projectId, userId) => {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                try {
                    // Primeiro, exclui todas as atividades relacionadas ao projeto
                    db.run('DELETE FROM activities WHERE project_id = ? AND user_id = ?', [projectId, userId]);

                    // Depois, exclui o projeto
                    db.run('DELETE FROM projects WHERE id = ? AND user_id = ?', [projectId, userId], function(err) {
                        if (err) {
                            db.run('ROLLBACK');
                            reject(err);
                        } else {
                            db.run('COMMIT');
                            resolve(this.changes);
                        }
                    });
                } catch (error) {
                    db.run('ROLLBACK');
                    reject(error);
                }
            });
        });
    },

    getProjectCount: (userId) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM projects WHERE user_id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
    }
};

// Funções para gerenciar atividades
const activityMethods = {
    addActivity: (userId, projectId, description, type) => {
        return new Promise((resolve, reject) => {
            db.run('INSERT INTO activities (user_id, project_id, description, type) VALUES (?, ?, ?, ?)',
                [userId, projectId, description, type],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    },

    getUserActivities: (userId, limit = 10) => {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM activities WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
                [userId, limit],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    },

    getActivityCount: (userId) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM activities WHERE user_id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
    }
};

// Funções para gerenciar notificações
const notificationMethods = {
    addNotification: (userId, title, message) => {
        return new Promise((resolve, reject) => {
            db.run('INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)',
                [userId, title, message],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    },

    getUserNotifications: (userId) => {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    },

    markNotificationAsRead: (notificationId, userId) => {
        return new Promise((resolve, reject) => {
            db.run('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?',
                [notificationId, userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    },

    getUnreadCount: (userId) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0',
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row.count);
                }
            );
        });
    }
};

module.exports = {
    db,
    userMethods,
    projectMethods,
    activityMethods,
    notificationMethods
}; 