const express = require('express');
const router = express.Router();
const pool = require('../config/db_pool.js');
const jwt = require('jsonwebtoken');


router.post('/', async function(req, res){
    try {
        var connection = await pool.getConnection();
        const email = req.body.email;
        const password = req.body.password;
        let query = 'select id, password from user where email = ?';
        let user_info = await connection.query(query, email) || null;

        if(password!=user_info[0].password) res.status(401).send({message: 'wrong email or password'});
        else {
            let option = {
                algorithm: 'HS256',
                expiresIn: 60 * 60 * 24
            };
            let payload = {
                user_id: user_info[0].id
            };
            let token = jwt.sign(payload, req.app.get('secret-key'), option);
            res.status(201).send({ token : token });
        } 
    }
    catch(err) {
        console.log(err);
        res.status(500).send({message: err });
    }
    finally {
        pool.releaseConnection(connection);
    }
    
});

module.exports = router;