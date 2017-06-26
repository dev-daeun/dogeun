const express = require('express');
const router = express.Router();
const pool = require('../config/db_pool.js');
const jwt = require('jsonwebtoken');


router.post('/', async function(req, res, next){
    try {
            let option = {
                algorithm: 'HS256',
                expiresIn: 60 * 60 * 24 * 7
            };
            let payload = {
                user_id: req.body.kakao_id 
            };
            let token = jwt.sign(payload, req.app.get('secret-key'), option);
            res.status(201).send({ user_token : token });
        
    }
    catch(err) {
         next(err);
    }
    finally {
        pool.releaseConnection(connection);
    }
    
});

module.exports = router;