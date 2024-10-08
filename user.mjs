import express from "express"
import pkg from 'sqlite3';

const { Database } = pkg

const db = new Database("./movies.db")

const user = express()

user.get("/", (_, res) => {
    db.all("SELECT * FROM user", [], (error, rows) => {
        if (error) {
            return res.status(500).send(error.message)
        }
        res.render("users", { users: rows })
    })
})

user.get("/add", (_, res) => {
    res.render("add-user")
})

user.get("/edit", (_, res) => {
    res.render("edit-user")
})

user.post("/", (req, res) => {
    const { username, name, email } = req.body
    const query = "INSERT INTO user VALUES (NULL, ?, ?, ?)"
    db.run(query, [username, name, email], (error) => {
        if (error) {
            return res.status(500).send(error.message)
        }
        res.status(200).send(`El usuario ${username} ha sido creado`)
    })
})

user.put("/:id", (req, res) => {
    const { id } = req.params
    const { username, name, email } = req.body
    const query = "UPDATE user SET user_username = ?, user_name = ?, user_email = ? WHERE user_id = ?"
    db.run(query, [username, name, email, id], (error) => {
        if (error) {
            return res.status(500).send(error.message)
        }
        res.status(200).send(`El usuario ${username} ha sido actualizado`)
    })
})

user.delete("/:id", (req, res) => {
    const { id } = req.params
    const query = "DELETE FROM user WHERE user_id = ?"
    db.run(query, [id], (error) => {
        if (error) {
            return res.status(500).send(error.message)
        }
        res.status(200).send(`El usuario con id ${id} ha sido borrado`)
    })
})

export { user }
