const express = require('express');
const router = express.Router();
const pool = require('../config/db_pool.js');
const jwt = require('jsonwebtoken');
const User = require('../model/user');

router.post('/', async function(req, res, next){
    try {
            let ret = await User.login(req.body.email, req.body.password);
            if(ret==='noneEmail') res.status(404).send({message: 'email does not exist', user_token: ""});
            else if(ret==='wrongPW') res.status(404).send({message: 'wrong password', user_token: ""});
            else {
                    let option = {
                        algorithm: 'HS256',
                        expiresIn: 60 * 60 * 24 * 7
                    };
                    let payload = {
                        user_id: ret
                    };
                    let token = jwt.sign(payload, req.app.get('secret-key'), option);
                    res.status(200).send({ 
                        message: 'success',
                        user_token : token 
                    });
            }
            
    }
    catch(err) {
        next(err);
    }
});

module.exports = router;