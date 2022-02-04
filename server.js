"use strict";
const express = require('express');
const cors = require('cors');
const SQLite = require('./sqlite');
const fs = require('fs');
require('dotenv').config();

const bcrypt = require('bcrypt');

const srv = express();
const db = new SQLite();

srv.use(cors());

srv.use(express.json());

// Gestionar usuarios
srv.get('/adminInfo', (req, res) => {
  let usrs = getDbUsers(), yearsInfo = getDbYearsInfo(),
  groupsCharges = getDbGroupsCharges(), feuCharges = getDbFeuCharges(), yearObj = {}, dbInfo = {};
  yearsInfo.forEach((val) => {
    yearObj[val.year] = val.groups;
  });
  groupsCharges.forEach((val, i) => {
    groupsCharges[i] = val.charge;
  });
  feuCharges.forEach((val, i) => {
    feuCharges[i] = val.charge;
  });
  dbInfo = {
    'users': usrs,
    'yearsInfo': yearObj,
    'groupsCharges': groupsCharges,
    'feuCharges': feuCharges
  };
  setTimeout(() => {
    res.json(dbInfo);
  }, 1000);
});

srv.post('/createUser', async (req, res, _next) => {
  let users = getDbUsers(), dat = req.body, val = true;
  for (const user in users) {
    if (user.username === dat.username) {
      val = false;
      break;
    }
  }
  if (val) {
    let hashpass = await bcrypt.hash(dat.password, 10);
    if (dat.userType === 'student') {
      db.query({
        type: "insert",
        obj: {
          table: "users",
          fields: `'username', 'fullname', 'password', 'year', 'group', 'systemCharge', 'groupCharge', 'feuCharge'`,
          values: `'${dat.username}', '${dat.userFullName}', '${hashpass}', '${dat.studentYear}', '${dat.studentGroup}', '${dat.userType}', '${dat.studentCharge}', '${dat.studentFeuCharge}'`,
        }
      });
      if (dat.studentCharge !== 'none') {
        let field = '', charge = dat.studentCharge;
        charge === 'Presidente' ? field = 'groupLeader' : charge === 'Vicepresidente' ? field = 'viceGroupLeader' : field = 'groupSecretary';
        db.query({
          type: "update",
          obj: {
            table: `"groups"`,
            field: `"${field}"`,
            value: `'${dat.username}'`,
            cond: `"year" = ${dat.studentYear} AND "group" = ${dat.studentGroup}`
          }
        });
      }
    }
    res.json({ createUser: true, msg: 'Usuario creado' });
  } else res.json({ createUser: false, msg: 'El usuario ya existe en el sistema' });
});

srv.put("/editUser", (req, res, _next) => {
  let users = getDbUsers();
  let dat = req.body, val = false;
  let editUser;
  for (const user of users) {
    if (user.username === dat.user) {
      editUser = user;
      val = true;
      break;
    }
  }

  if (val) {
    let pass = false, type = false;
    if (editUser.password !== dat.newpass) {
      db.query({
        type: "update",
        obj: {
          table: "users",
          field: `password`,
          value: `${dat.newpass}`,
          id: editUser.username,
        },
      });
      pass = true;
    }

    if (editUser.type !== dat.type) {
      db.query({
        type: "update",
        obj: {
          table: "users",
          field: `type`,
          value: `${dat.type}`,
          id: editUser.username
        },
      });
      type = true;
    }

    if (pass || type) res.json({ editUser: true, msg: "Datos editado correctamente" });
    else res.json({ editUser: false, msg: "No hubieron cambios en ningun dato" });
  } else res.json({ editUser: false, msg: "Usuario no encontrado" });
});

srv.post('/delUser', (req, res, _next) => {
  let users = getDbUsers();
  let dat = req.body;
  let val = false;
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

// Autenticacion
srv.post('/login', async function (req, res, _next) {
  let usrs = getDbUsers();
  let query = req.body, val = false, userIs = false, msg = 'Usuario no encontrado, contacte con el administrador';
  let name = '', tok = 0, type = '';
  usrs.forEach((usr) => {
    if (usr.username === query.name) userIs = { name: usr.fullname, pass: usr.password, type: usr.systemCharge };
  });
  if (userIs) {
    const auth = await bcrypt.compare(query.pass, userIs.pass);
    if (typeof auth === 'object') console.log(auth);
    else {
      if (auth) {
        val = true;
        name = userIs.name; tok = Math.floor(Math.random() * 10000000); type = userIs.type; msg = 'Usted se ha autenticado';
      } else {
        val = false;
        msg = 'Contraseña incorrecta';
      }
    }
  }
  res.json({ login: val, name: name, type: type, token: tok.toString(), msg: msg });
});

// GET DB functions
const getDbUsers = () => db.query({ type: 'get', obj: { sql: `SELECT * FROM users` } });
const getDbYearsInfo = () => db.query({ type: 'get', obj: { sql: `SELECT * FROM years` } });
const getDbGroupsCharges = () => db.query({ type: 'get', obj: { sql: `SELECT * FROM groupsCharges` } });
const getDbFeuCharges = () => db.query({ type: 'get', obj: { sql: `SELECT * FROM feuCharges` } });

const initDb = async () => {
  let usersType = ["'admin'", "'student'", "'teacher'", "'p_feu'", "'vp_feu'", "'o_feu'"];
  let sql = `CREATE TABLE users (username TEXT NOT NULL, name TEXT NOT NULL, password TEXT NOT NULL, year INTEGER, 'group' INTEGER, charge TEXT CHECK( charge IN (${usersType.toLocaleString()})));`;
  db.query({ type: "create", obj: { sql: sql } });
  sql = `CREATE TABLE years (year INT NOT NULL);`;
  db.query({ type: "create", obj: { sql: sql } });
  sql = `CREATE TABLE groups (groups TEXT NOT NULL);`;
  db.query({ type: "create", obj: { sql: sql } });
  for (let i = 0; i < 5; i++) {
    db.query({
      type: "insert",
      obj: {
        table: "years",
        fields: `'year'`,
        values: `${i + 1}`,
      }
    });
    db.query({
      type: "insert",
      obj: {
        table: "groups",
        fields: `'group'`,
        values: `${i + 1}`,
      }
    });
  }
  // sql = `CREATE TABLE integralidad ();`;
  // db.query({ type: "create", obj: { sql: sql } });
}

srv.listen(process.env.PORT, async () => {
  if (!fs.existsSync('./database.sqlite')) {
    await initDb();
  }
  console.log(`Servidor escuchando en el puerto ${process.env.PORT}`);
});
