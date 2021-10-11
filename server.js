require('dotenv').config()

const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const app = express();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 3000;
const session = require('express-session');

const nocache = require('nocache');
const { isArray } = require('util');
const { resolveSoa } = require("dns");

app.use(nocache());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({ secret: "Shh, its a secret!" }));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

const dbforms = path.join(__dirname, "data", "app.db");
const db = new sqlite3.Database(dbforms, err => {
    if (err) {
        return console.error(err.message);
    }
    console.log("Successful connection to the database 'apptest.db'");
});

const sql_create_user = `CREATE TABLE IF NOT EXISTS User (
    User_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Login VARCHAR(100),
    Password VARCHAR(100)
  );`;

const sql_create_message = `CREATE TABLE IF NOT EXISTS myUserMessages (
    MsgId INTEGER PRIMARY KEY AUTOINCREMENT,
    Mensagem TEXT,
    User VARCHAR(100)
  );`;

db.run(sql_create_user, err => {
    if (err) {
        return console.error(err.message);
    }
    console.log("User criados");

    const sql_insert_user = `INSERT INTO User (User_ID, Login, Password) VALUES
    (1, 'admin', 'admin123');`;
    db.run(sql_insert_user, err => {
        if (err) {
            return console.error(err.message);
        }
        console.log("Inserção em User foi executada com sucesso");
    });
});

db.run(sql_create_message, err => {
    if (err) {
        return console.error(err.message);
    }
    console.log("myUserMessages criados");

    const sql_insert_message = `INSERT INTO myUserMessages (MsgId, Mensagem, User) VALUES
    (1, 'mensagem de teste', 'admin');`;
    db.run(sql_insert_message, err => {
        if (err) {
            return console.error(err.message);
        }
        console.log("Inserção em myUserMessages foi executada com sucesso");
    });
});

function authenticateToken(req, res, next) {
    const authHeader = req.headers['x-access-token']
    if (authHeader) {
        jwt.verify(authHeader, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
            if (err) {
                return res.status(401).redirect('/');
            }
            req.session.user = user;
            next();
        })
    } else {
        console.log('token não enviado');
        return res.status(401).redirect('/');
    }
}

app.get("/", (req, res) => {
    {
        res.render("index");
    }
});

app.get("/cadastrar", (req, res) => {
    {
        res.render("create");
    }
});

app.get("/send", (req, res) => {
    {
        res.render("send");
    }
});

app.get("/idview", (req, res) => {
    {
        res.render("getId");
    }
});

app.get("/del", (req, res) => {
    {
        res.render("del");
    }
});

app.get("/:User/messages/", authenticateToken, (req, res) => {
    var User = req.params.User;
    db.get("SELECT * from myUserMessages where User=?", [User], function(err, row) {
        if (typeof row !== 'undefined' && row != null) {
            const sql = "SELECT Mensagem, MsgId, User FROM myUserMessages;"
            db.all(sql, [], function(err, rows) {
                if (err) {
                    throw err;
                }
                res.render("mensagem", { model: rows });
            });
        } else {
            db.run("INSERT INTO myUserMessages (Mensagem, User) VALUES (?, ?)", ["Bem-vindo " + User, User], function(err) {
                if (err) {
                    res.status(500).json({ 'validado': 'FALSE' });
                } else {
                    res.redirect('/' + User + '/messages/');
                }
            })
        }
    });
});

app.get("/:User/messages/:MsgId", (req, res) => {
    var User = req.params.User;
    var MsgId = req.params.MsgId;
    db.get("SELECT * from myUserMessages where MsgId=? and User=?", [MsgId, User], function(err, row) {
        if (typeof row !== 'undefined' && row != null) {
            const sql = "SELECT Mensagem FROM myUserMessages where MsgId=" + MsgId;
            db.all(sql, [], function(err, rows) {
                if (err) {
                    throw err;
                } else { res.status(200).json(rows); }
            });
        } else {
            res.status(200).json({ 'validado': 'FALSE' });
        }
    });
});

app.delete("/:User/messages/:MsgId", (req, res) => {
    var User = req.params.User;
    var MsgId = req.params.MsgId;
    db.run("DELETE FROM myUserMessages WHERE MsgId=? and User=?", [MsgId, User], function(err) {
        if (err) {
            res.status(200).json({ 'validado': 'FALSE' });
        } else {
            res.status(200).json({ 'validado': 'OK' });
        }
    });
});

app.post("/:User/messages", (req, res) => {
    var User = req.params.User;
    const sql = "INSERT INTO myUserMessages (Mensagem, User) VALUES (?, ?)";
    const msg = [req.body.Mensagem, req.body.User];
    db.get("SELECT * from User where Login=?", User, function(err, row) {
        if (typeof row !== 'undefined' && row != null) {
            db.run(sql, msg, err => {
                if (err) {
                    return console.error(err.message);
                } else {
                    res.status(200).json({ 'validado': 'OK' });
                }
            });
        } else {
            res.status(200).json({ 'validado': 'FALSE' });
        }
    });
});

app.post('/', (req, res) => {
    db.get("SELECT * from User where Login=? and Password=?", [req.body.Login, req.body.Password], function(err, row) {
        User = req.body.Login;
        Password = req.body.Password;
        const login = { Login: User, Password: Password };
        const accessToken = jwt.sign(login, process.env.ACCESS_TOKEN_SECRET);

        if (typeof row !== 'undefined' && row != null) {
            // res.set({
            //     'Content-Type': 'application/json',
            //     'x-access-token': accessToken
            // });
            // res.redirect('/' + User + '/messages/');
            res.status(200).json({ accessToken: accessToken });
        } else {
            res.status(200).json({ 'Acesso': 'Negado' });
        }
    });
});

app.post('/cadastrar', (req, res) => {
    db.get("INSERT INTO User (Login, Password) VALUES (?, ?)", [req.body.Login, req.body.Password], function(err, row) {
        if (err) {
            return console.error(err.message);
        } else {
            res.redirect('/');
        }
    });
});


app.listen(port, () => {
    {
        console.log("http://localhost:3000/");
    }
});