"use strict";
const express = require('express');
const cors = require('cors');
const SQLite = require('./sqlite');
const fs = require('fs');
require('dotenv').config();

const srv = express();
const db = new SQLite();

srv.use(cors());

srv.use(express.json());

// API GET functions
srv.get('/allUsers', (req, res) => {
    let usrs = getDbUsers();
    setTimeout(() => {
        res.json(usrs);
    }, 1000);
});

// API POST functions
srv.post('/login', (req, res, _next) => {        
    let usrs = getDbUsers();
    let query = req.body;
    usrs.forEach((usr) => {
        if (usr.username === query.username) {
            if (usr.password === query.password) {
                res.json({ login: true, type: usr.type });
            }
        }
    });
    res.json({ login: false });
});

srv.post('/createUser', (req, res, _next) => {
    let users = getDbUsers();
    let dat = req.body;
    let val = true;
    console.log(req.body);
    for (const user in users) {
        if (user.username === dat.user) {
          val = false;
          break;
        }
    }
    if (val) {
        db.query({
        type: "insert",
        obj: {
            table: "users",
            fields: `'username', 'password', 'type'`,
            values: `'${dat.user}', '${dat.pass}', '${dat.type}'`,
        }});
        res.json({ createUser: true });
    } else res.json({ createUser: false });
});

srv.post('/delUser', (req, res, _next) => {
    let users = getDbUsers();
    let dat = req.body;
    let val = false;
    console.log(req.body);
    for (const user of users) {
      if (user.username === dat.user) {
        val = true;
        break;
      }
    }
    if (val) {
      db.query({
        type: "delete",
        obj: {
          table: "users",
          field: "username",
          value: `${dat.user}`,
        },
      });
      res.json({ delUser: true });
    } else res.json({ delUser: false });
});

// DB functions
function getDbUsers() {
    return db.query({type: 'get', obj: {sql: `SELECT * FROM users`}});
}

function initDb() {
    let sql = `CREATE TABLE users (username TEXT NOT NULL, password TEXT NOT NULL, type TEXT CHECK( type IN ('admin','student','jefdep','profes')));`;
    db.query({ type: "create", obj: { sql: sql } });
    db.query({
      type: "insert",
      obj: {
        table: "users",
        fields: `'username', 'password', 'type'`,
        values: `'admin', 'adminS2@', 'admin'`,
      },
    });
}

srv.listen(process.env.PORT, () => { 
    if (! fs.existsSync('./database.db')) {
        initDb();
    }
    console.log(`Servidor escuchando en el puerto ${process.env.PORT}`);
});
