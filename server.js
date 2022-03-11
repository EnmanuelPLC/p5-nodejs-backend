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

function secureMiddleware(req, res, next) {
  if (req.headers.origin !== 'http://localhost:3000') {
    console.log('Access to api from unknown source');
    res.send('<h1>Access Forbidden</h1>');
  } else {
    console.log(`Api call detected from Authorized origin, Method -> ${req.method}, Path -> ${req.path}`);
    next();
  }
}

srv.use(secureMiddleware);

// Gestionar usuarios
srv.get('/adminInfo', (req, res, next) => {
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
    next();
  }, 1000);
});

srv.get('/getUser', (req, res, next) => {
  let user = getDbUser(req.query.user), isGroupLeader = getDbUserIsGroupleader(user[0].year, user[0].group),
    isViceGroupLeader = getDbUserIsViceGroupleader(user[0].year, user[0].group);
  if (isGroupLeader[0].groupLeader === user[0].username) isGroupLeader = true;
  else isGroupLeader = false;
  if (isViceGroupLeader[0].viceGroupLeader === user[0].username) isViceGroupLeader = true;
  else isViceGroupLeader = false;
  user[0]['isGroupLeader'] = isGroupLeader;
  user[0]['isViceGroupLeader'] = isViceGroupLeader;
  setTimeout(() => {
    res.json(user);
    next();
  }, 1000);
});

srv.post('/createUser', async (req, res, next) => {
  let dat = req.body, user = getDbUser(dat.username); // 1
  if (user?.length === 0) { // 2
    let hashpass = await bcrypt.hash(dat.password, 10); // 3
    if (dat.userType === 'student') { // 3
      db.query({
        type: "insert",
        obj: {
          table: "users",
          fields: `'username', 'fullname', 'password', 'year', 'group', 'systemCharge', 'groupCharge', 'feuCharge'`,
          values: `'${dat.username}', '${dat.userFullName}', '${hashpass}', '${dat.studentYear}', '${dat.studentGroup}', '${dat.userType}', '${dat.studentCharge}', '${dat.studentFeuCharge}'`,
        }
      });
      if (dat.studentCharge !== 'none') { // 4
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
    } else if (dat.userType === 'teacher') { // 5
      db.query({
        type: "insert",
        obj: {
          table: "users",
          fields: `'username', 'fullname', 'password', 'year', 'group', 'systemCharge'`,
          values: `'${dat.username}', '${dat.userFullName}', '${hashpass}', '${dat.teacherYear}', '${dat.teacherGroup}', '${dat.userType}'`,
        }
      });
      if (dat.teacherGroupGuide !== 'none') { // 6
        db.query({
          type: "update",
          obj: {
            table: `"groups"`,
            field: `"teacherGuide"`,
            value: `'${dat.username}'`,
            cond: `"year" = ${dat.teacherYear} AND "group" = ${dat.teacherGroup}`
          }
        });
      }
      if (dat.teacherPrincipalYear !== 'none') { // 7
        db.query({
          type: "update",
          obj: {
            table: `"years"`,
            field: `"principalTeacher"`,
            value: `'${dat.username}'`,
            cond: `"year" = ${dat.teacherYear}`
          }
        });
      }
    }
    res.json({ createUser: true, msg: 'Usuario creado' }); // 8
  } else res.json({ createUser: false, msg: 'El usuario ya existe en el sistema' }); // 9
  next();
});

srv.put("/editUser", async (req, res, next) => {
  let dat = req.body, val = false, editUser = getDbUser(dat.username);
  if (editUser.length > 0) {
    editUser = editUser[0];
    val = true;
  }

  if (val) {
    let user = false, pass = false, type = false, year = false, group = false, teacherYear = false, teacherGroup = false, groupCharge = false, feuCharge = false, teacherPrincipal = false, teacherGuide = false;

    if (dat.editedUser.usernameEdit !== "" && editUser.username !== dat.editedUser.usernameEdit) {
      db.query({
        type: "update",
        obj: {
          table: "users",
          field: `"username"`,
          value: `'${dat.editedUser.usernameEdit}'`,
          cond: `"username" = '${editUser.username}'`,
        },
      });
      editUser = getDbUser(dat.editedUser.usernameEdit)[0];
      user = true;
    }

    if (dat.editedUser.pwdEdit !== "" && editUser.password !== dat.editedUser.pwdEdit) {
      const auth = await bcrypt.compare(dat.editedUser.pwdEdit, editUser.password);
      if (!auth) {
        db.query({
          type: "update",
          obj: {
            table: "users",
            field: `"password"`,
            value: `'${dat.editedUser.pwdEdit}'`,
            cond: `"username" = '${dat.username}'`,
          },
        });
        pass = true;
      }
    }

    if (editUser.systemCharge === 'student') {
      if (dat.editedUser.userTypeEdit !== 'student') {
        db.query({
          type: "update",
          obj: {
            table: "users",
            field: `"systemCharge"`,
            value: `'${dat.editedUser.userTypeEdit}'`,
            cond: `"username" = '${editUser.username}'`,
          },
        });
      }

      if (editUser.groupCharge !== dat.editedUser.studentEditCharge) {
        db.query({
          type: "update",
          obj: {
            table: "users",
            field: `"groupCharge"`,
            value: `'${dat.editedUser.studentEditCharge}'`,
            cond: `"username" = '${dat.username}'`
          },
        });
        groupCharge = true;
      }

      if (editUser.feuCharge !== dat.editedUser.studentEditFeuCharge) {
        db.query({
          type: "update",
          obj: {
            table: "users",
            field: `"feuCharge"`,
            value: `'${dat.editedUser.studentEditFeuCharge}'`,
            cond: `"username" = '${dat.username}'`
          },
        });
        feuCharge = true;
      }

      if (editUser.year !== dat.editedUser.studentEditYear) {
        db.query({
          type: "update",
          obj: {
            table: "users",
            field: `"year"`,
            value: `'${dat.editedUser.studentEditYear}'`,
            cond: `"username" = '${dat.username}'`
          },
        });
        year = true;
      }

      if (editUser.group !== dat.editedUser.studentEditGroup) {
        db.query({
          type: "update",
          obj: {
            table: "users",
            field: `"group"`,
            value: `'${dat.editedUser.studentEditGroup}'`,
            cond: `"username" = '${dat.username}'`
          },
        });
        group = true;
      }
    } else {
      if (dat.editedUser.teacherEditYear !== "" && editUser.year !== dat.editedUser.teacherEditYear) {
        db.query({
          type: "update",
          obj: {
            table: "users",
            field: `"year"`,
            value: `'${dat.editedUser.teacherEditYear}'`,
            cond: `"username" = '${editUser.username}'`
          },
        });
        teacherYear = true;
      }

      if (dat.editedUser.teacherEditGroup !== "" && editUser.group !== dat.editedUser.teacherEditGroup) {
        db.query({
          type: "update",
          obj: {
            table: "users",
            field: `"group"`,
            value: `'${dat.editedUser.teacherEditGroup}'`,
            cond: `"username" = '${editUser.username}'`
          },
        });
        teacherGroup = true;
      }

      let isPrincipalTeacher = db.query({ type: 'get', obj: { sql: `SELECT "principalTeacher" FROM "years" WHERE  "year"='${editUser.year}';` } });
      if (dat.editedUser.teacherEditPrincipalYear && isPrincipalTeacher[0].principalTeacher === null || !dat.editedUser.teacherEditPrincipalYear && isPrincipalTeacher[0].principalTeacher !== null) {
        db.query({
          type: "update",
          obj: {
            table: `"years"`,
            field: `"principalTeacher"`,
            value: isPrincipalTeacher[0].principalTeacher === null ? `'${editUser.username}'` : null,
            cond: `"year" = ${dat.editedUser.teacherEditYear}`
          }
        });
        teacherPrincipal = true;
      }

      let isGuideTeacher = db.query({ type: 'get', obj: { sql: `SELECT "teacherGuide" FROM "groups" WHERE "year"=${editUser.year} AND "group"='${editUser.group}';` } });
      if (dat.editedUser.teacherEditGroupGuide && isGuideTeacher[0].teacherGuide === null || !dat.editedUser.teacherEditGroupGuide && isGuideTeacher[0].teacherGuide !== null) {
        db.query({
          type: "update",
          obj: {
            table: `"groups"`,
            field: `"teacherGuide"`,
            value: isGuideTeacher[0].teacherGuide === null ? `'${editUser.username}'` : null,
            cond: `"year" = ${dat.editedUser.teacherEditYear} AND "group" = '${dat.editedUser.teacherEditGroup}'`
          }
        });
        teacherGuide = true;
      }
    }

    if (user || pass || type || groupCharge || feuCharge || group || year || teacherGuide || teacherPrincipal || teacherYear || teacherGroup) res.json({ editUser: true, msg: "Datos editados correctamente" });
    else res.json({ editUser: false, msg: "No hubieron cambios en ningun dato" });
  } else res.json({ editUser: false, msg: "Usuario no encontrado" });
  next();
});

srv.post('/delUser', (req, res, next) => {
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
    res.json({ delUser: true, msg: 'Usuario eliminado correctamente' });
  } else res.json({ delUser: false, msg: 'El usuario NO existe en el sistema' });
  next();
});

// Gestionar Integralidades
srv.get('/getIntegrality', (req, res, next) => {
  let integrality = getDbIntegrality(req.query.user);
  res.json(integrality);
  next();
});

srv.post('/createIntegralityAct', async (req, res, next) => {
  let dat = req.body;
  db.query({
    type: "insert",
    obj: {
      table: "integralityAct",
      fields: `'username', 'group', 'year', 'information', 'status', 'date', 'modifyDate'`,
      values: `'${dat.user}', '${dat.group}', '${dat.year}', '${dat.information}', 'Creada y enviada para revision', '${dat.date}', '${dat.date}'`,
    }
  });
  res.json({ create: true, msg: 'Acta de integralidad creada' });
  next();
});

srv.put('/editIntegralityAct', async (req, res, next) => {
  let dat = req.body;
  db.query({
    type: "update",
    obj: {
      table: "integralityAct",
      field: `"information"`,
      value: `'${dat.description}'`,
      cond: `"username" = '${dat.user}'`,
    },
  });
  db.query({
    type: "update",
    obj: {
      table: "integralityAct",
      field: `"modifyDate"`,
      value: `'${dat.modifyDate}'`,
      cond: `"username" = '${dat.user}'`,
    },
  });
  res.json({ edited: true, msg: 'Acta de integralidad editada' });
  next();
});

srv.post('/delIntegralityAct', async (req, res, next) => {
  let dat = req.body;
  let integrality = getDbIntegrality(dat.user);
  if (integrality.length > 0) {
    db.query({
      type: "delete",
      obj: {
        table: "integralityAct",
        field: `"username"`,
        value: `${dat.user}`,
      }
    });
    res.json({ deleted: true, msg: 'Acta de integralidad eliminada' });
  } else {
    res.json({ deleted: false, msg: 'El acta de integralidad NO existe en el sistema' });
  }
  next();
});

// Gestionar Actas de Reunion
srv.get('/getMeetingAct', (req, res, next) => {
  let meetingAct = getDbMeeting(req.query.user);
  setTimeout(() => {
    res.json(meetingAct);
    next();
  }, 500);
});

srv.post('/createMeetingAct', async (req, res, next) => {
  let dat = req.body;
  db.query({
    type: "insert",
    obj: {
      table: "meetingAct",
      fields: `'username', 'group', 'year', 'description', 'date', 'modifyDate'`,
      values: `'${dat.user}', '${dat.group}', '${dat.year}', '${dat.information}', '${dat.date}', '${dat.date}'`,
    }
  });
  res.json({ create: true, msg: 'Acta de integralidad creada' });
  next();
});

srv.put('/editMeetingAct', async (req, res, next) => {
  let dat = req.body;
  db.query({
    type: "update",
    obj: {
      table: "meetingAct",
      field: `"description"`,
      value: `'${dat.information}'`,
      cond: `"username" = '${dat.user}'`,
    },
  });
  db.query({
    type: "update",
    obj: {
      table: "meetingAct",
      field: `"modifyDate"`,
      value: `'${dat.date}'`,
      cond: `"username" = '${dat.user}'`,
    },
  });
  res.json({ edited: true, msg: 'Acta de integralidad editada' });
  next();
});

srv.post('/delMeetingAct', (req, res, next) => {
  let dat = req.body;
  let meetingAct = getDbMeeting(dat.user);
  if (meetingAct.length > 0) {
    db.query({
      type: "delete",
      obj: {
        table: "meetingAct",
        field: "username",
        value: `${dat.user}`,
      },
    });
    res.json({ deleted: true, msg: 'Acta de reunion eliminada correctamente' });
  } else res.json({ deleted: false, msg: 'El acta de reunion NO existe en el sistema' });
  next();
});

// Gestionar Plan de Actividades
srv.get('/getActivityPlan', (req, res, next) => {
  let activityPlan = getDbActivityPlan(req.query.user);
  setTimeout(() => {
    res.json(activityPlan);
    next();
  }, 500);
});

srv.post('/createActivityPlan', async (req, res, next) => {
  let dat = req.body;
  db.query({
    type: "insert",
    obj: {
      table: "activityPlan",
      fields: `'name','username', 'group', 'year', 'description', 'date', 'modifyDate'`,
      values: `'${dat.name}', '${dat.user}', '${dat.group}', '${dat.year}', '${dat.information}', '${dat.date}', '${dat.date}'`,
    }
  });
  res.json({ create: true, msg: 'Acta de integralidad creada' });
  next();
});

srv.put('/editActivityPlan', async (req, res, next) => {
  let dat = req.body;
  db.query({
    type: "update",
    obj: {
      table: "activityPlan",
      field: `"description"`,
      value: `'${dat.information}'`,
      cond: `"username" = '${dat.user}'`,
    },
  });
  db.query({
    type: "update",
    obj: {
      table: "activityPlan",
      field: `"name"`,
      value: `'${dat.name}'`,
      cond: `"username" = '${dat.user}'`,
    },
  });
  db.query({
    type: "update",
    obj: {
      table: "activityPlan",
      field: `"modifyDate"`,
      value: `'${dat.date}'`,
      cond: `"username" = '${dat.user}'`,
    },
  });
  res.json({ edited: true, msg: 'Acta de integralidad editada' });
  next();
});

// Teacher Calls
srv.get('/teacherInfo', (req, res, next) => {
  let user = getDbUser(req.query.user), data = getDbTeacherIntegralities(user[0].year, user[0].group), 
    principal = getDbTeacherIsPrincipal(user[0].year), teacherMeetingsAct = getDbTeacherMeetings(user[0].year);
  if (principal.length > 0) {
    principal[0].principalTeacher === user[0].username ? principal = true : principal = false;
  } else {
    principal = false;
    teacherMeetingsAct = [];
  }
  setTimeout(() => {
    res.json({integralities: data, principal: principal, meetingActs: teacherMeetingsAct});
    next();
  }, 500);
});

srv.put('/checkIntegralityAct', async (req, res, next) => {
  let dat = req.body;
  db.query({
    type: "update",
    obj: {
      table: "integralityAct",
      field: `"status"`,
      value: `'${dat.dat}'`,
      cond: `"username" = '${dat.user}'`,
    },
  });
  res.json({ edited: true, msg: 'Acta de integralidad aprobada' });
  next();
});

// Autenticacion
srv.get('/login', async function (req, res, next) {
  let usrs = getDbUsers();
  let query = req.query, val = false, userIs = false, msg = 'Usuario no encontrado, contacte al administrador';
  let name = '', tok = 0, type = '';
  usrs.forEach((usr) => {
    if (usr.username === query.user) userIs = { name: usr.fullname, pass: usr.password, type: usr.systemCharge };
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
  next();
});

// GET DB functions
const getDbUsers = () => db.query({ type: 'get', obj: { sql: `SELECT * FROM users` } });
const getDbUser = (user) => db.query({ type: 'get', obj: { sql: `SELECT * FROM users WHERE "username" = '${user}';` } });
const getDbYearsInfo = () => db.query({ type: 'get', obj: { sql: `SELECT * FROM years` } });
const getDbGroupsCharges = () => db.query({ type: 'get', obj: { sql: `SELECT * FROM groupsCharges` } });
const getDbFeuCharges = () => db.query({ type: 'get', obj: { sql: `SELECT * FROM feuCharges` } });
const getDbIntegrality = (user) => db.query({ type: 'get', obj: { sql: `SELECT * FROM integralityAct WHERE "username" = '${user}';` } });
const getDbMeeting = (user) => db.query({ type: 'get', obj: { sql: `SELECT * FROM meetingAct WHERE "username" = '${user}';` } });
const getDbActivityPlan= (user) => db.query({ type: 'get', obj: { sql: `SELECT * FROM activityPlan WHERE "username" = '${user}';` } });
const getDbUserIsGroupleader = (year, group) => db.query({ type: 'get', obj: { sql: `SELECT "groupLeader" FROM "groups" WHERE "year" = ${year} AND "group" = '${group}';` } });
const getDbUserIsViceGroupleader = (year, group) => db.query({ type: 'get', obj: { sql: `SELECT "viceGroupLeader" FROM "groups" WHERE "year" = ${year} AND "group" = '${group}';` } });
const getDbTeacherIntegralities = (year, group) => db.query({ type: 'get', obj: { sql: `SELECT * FROM "integralityAct" WHERE "year" = ${year} AND "group" = '${group}';` } });
const getDbTeacherIsPrincipal = (year) => db.query({ type: 'get', obj: { sql: `SELECT "principalTeacher" FROM "years" WHERE "year" = ${year};` } });
const getDbTeacherMeetings = (year) => db.query({ type: 'get', obj: { sql: `SELECT * FROM "meetingAct" WHERE "year" = ${year};` } });


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
