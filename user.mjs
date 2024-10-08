import express from "express"
import pkg from 'sqlite3';

const { Database } = pkg

const db = new Database("./movies.db")

const user = express()

user.get("/", (req, res) => {
    db.all("SELECT * FROM user", null, (err, rows) => {
        res.send(rows)
    })
})

export { user }
