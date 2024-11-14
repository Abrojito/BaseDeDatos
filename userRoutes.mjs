import express from 'express';
import pkg from "sqlite3";
const { Database } = pkg;

const router = express.Router();
const db = new Database("./movies.db");

// GET route para listar usuarios (sin restricción de rol)
router.get('/list', (req, res) => {
    db.all("SELECT user_id, user_username, user_email, user_role FROM user", [], (err, users) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error al obtener la lista de usuarios");
        }

        // Obtener el rol del usuario actual desde la cookie
        const userId = req.cookies?.user_id;
        let currentUserRole = 'user'; // Rol por defecto

        // Si hay un usuario logueado, buscar su rol
        if (userId) {
            db.get("SELECT user_role FROM user WHERE user_id = ?", [userId], (err, user) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send("Error al obtener el rol del usuario");
                }
                if (user) {
                    currentUserRole = user.user_role;
                }
                res.render('user_list', { users, currentUserRole });
            });
        } else {
            res.render('user_list', { users, currentUserRole });
        }
    });
});

// GET route para perfil de usuario
router.get('/profile/:id', (req, res) => {
    const userId = req.params.id;

    db.get("SELECT user_id, user_username, user_email, user_role FROM user WHERE user_id = ?",
        [userId],
        (err, user) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Error retrieving user profile");
            }
            if (!user) {
                return res.status(404).send("User not found");
            }
            res.render('user_profile', { user });
        });
});

// POST route para actualizar perfil
router.post('/profile/:id/update', (req, res) => {
    const userId = req.params.id;
    const { username, email } = req.body;

    db.run("UPDATE user SET user_username = ?, user_email = ? WHERE user_id = ?",
        [username, email, userId],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Error updating user profile");
            }
            res.redirect(`/user/profile/${userId}`);
        });
});

// DELETE route para eliminar cuenta (solo para admin o el mismo usuario)
router.delete('/:id', (req, res) => {
    const userId = req.params.id;

    // Verificar si el usuario que realiza la acción es admin
    const requestingUserId = req.cookies?.user_id;

    db.get("SELECT user_role FROM user WHERE user_id = ?", [requestingUserId], (err, requestingUser) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error verificando permisos");
        }

        // Solo permitir eliminar si es admin o si es el propio usuario
        if (requestingUser?.user_role === 'admin' || requestingUserId === userId) {
            db.run("DELETE FROM user WHERE user_id = ?",
                [userId],
                (err) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).send("Error deleting user");
                    }
                    res.status(200).send("User deleted successfully");
                });
        } else {
            res.status(403).send("No tienes permiso para realizar esta acción");
        }
    });
});

// Nueva ruta GET para crear usuario (formulario) solo para admin
router.get('/new', (req, res) => {
    const requestingUserId = req.cookies?.user_id;

    db.get("SELECT user_role FROM user WHERE user_id = ?", [requestingUserId], (err, user) => {
        if (err || !user || user.user_role !== 'admin') {
            return res.status(403).send("No tienes permiso para crear usuarios");
        }
        res.render('user_create');
    });
});

// Nueva ruta POST para crear usuario (solo para admin)
router.post('/new', (req, res) => {
    const { username, email, password, role = 'user' } = req.body;
    const requestingUserId = req.cookies?.user_id;

    db.get("SELECT user_role FROM user WHERE user_id = ?", [requestingUserId], (err, user) => {
        if (err || !user || user.user_role !== 'admin') {
            return res.status(403).send("No tienes permiso para crear usuarios");
        }

        db.run("INSERT INTO user (user_username, user_email, user_password, user_role) VALUES (?, ?, ?, ?)",
            [username, email, password, role],
            function(err) {
                if (err) {
                    console.error(err);
                    return res.status(500).send("Error al crear el usuario");
                }
                res.redirect('/user/list');
            });
    });
});

export default router;
