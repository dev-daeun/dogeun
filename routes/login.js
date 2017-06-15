const express = require('express');
const router = express.Router();
const pool = require('../config/db_pool.js');
const jwt = require('jsonwebtoken');


router.post('/', async function(req, res){
    try {
            let option = {
                algorithm: 'HS256',
                expiresIn: 60 * 60 * 365
            };
            let payload = {
                user_id: req.body.kakao_id 
            };
            let token = jwt.sign(payload, req.app.get('secret-key'), option);
            res.status(201).send({ user_token : token });
        
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