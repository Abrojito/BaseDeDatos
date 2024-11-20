import express from 'express';
import pkg from "sqlite3";
const { Database } = pkg;

const router = express.Router();
const db = new Database("./movies.db");

// Middleware para verificar si el usuario está logueado
const isLoggedIn = (req, res, next) => {
    const userId = req.cookies?.user_id;
    if (!userId) {
        return res.status(401).send("No estás logueado");
    }
    next();
};

// GET route para listar usuarios
router.get('/list', isLoggedIn, (req, res) => {
    db.all("SELECT user_id, user_username, user_email, user_role FROM user", [], (err, users) => {
        if (err) {
            console.error("Error al obtener la lista de usuarios:", err);
            return res.status(500).send("Error al obtener la lista de usuarios");
        }

        // Obtener el rol del usuario actual desde la cookie
        const userId = req.cookies?.user_id;
        let currentUserRole = 'user'; // Rol por defecto

        if (userId) {
            db.get("SELECT user_role FROM user WHERE user_id = ?", [userId], (err, user) => {
                if (err) {
                    console.error("Error al obtener el rol del usuario:", err);
                    return res.status(500).send("Error al obtener el rol del usuario");
                }
                if (user) {
                    currentUserRole = user.user_role;
                }
                res.render('user-list', { users, currentUserRole });
            });
        } else {
            res.render('user-list', { users, currentUserRole });
        }
    });
});

// GET route para perfil de usuario
router.get('/profile/:id', isLoggedIn, (req, res) => {
    const userId = req.params.id;

    db.get("SELECT user_id, user_username, user_email, user_role FROM user WHERE user_id = ?",
        [userId],
        (err, user) => {
            if (err) {
                console.error("Error al obtener el perfil del usuario:", err);
                return res.status(500).send("Error al obtener el perfil del usuario");
            }
            if (!user) {
                return res.status(404).send("Usuario no encontrado");
            }
            res.render('user-profile', { user });
        });
});

// POST route para actualizar perfil
router.post('/profile/:id/update', isLoggedIn, (req, res) => {
    const userId = req.params.id;
    const { username, email } = req.body;

    db.run("UPDATE user SET user_username = ?, user_email = ? WHERE user_id = ?",
        [username, email, userId],
        (err) => {
            if (err) {
                console.error("Error al actualizar el perfil:", err);
                return res.status(500).send("Error al actualizar el perfil");
            }
            res.redirect(`/user/profile/${userId}`);
        });
});

// GET route para crear nuevo usuario
router.get('/new', isLoggedIn, (req, res) => {
    res.render('user_create');
});

// POST route para crear nuevo usuario
router.post('/new', isLoggedIn, (req, res) => {
    const { username, email, password, role = 'user' } = req.body;

    db.run("INSERT INTO user (user_username, user_email, user_password, user_role) VALUES (?, ?, ?, ?)",
        [username, email, password, role],
        function (err) {
            if (err) {
                console.error("Error al crear el usuario:", err);
                return res.status(500).send("Error al crear el usuario");
            }
            res.redirect('/user/list');
        });
});

// Ruta para obtener todos los usuarios (sin restricciones de admin)
router.get('/all', (req, res) => {
    db.all("SELECT user_id, user_username, user_email, user_role FROM user", [], (err, users) => {
        if (err) {
            console.error("Error al obtener usuarios:", err);
            return res.status(500).send("Error al obtener usuarios");
        }
        res.json(users); // Responde con los usuarios en formato JSON
    });
});

export default router;
