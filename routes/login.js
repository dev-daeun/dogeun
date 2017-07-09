const express = require('express');
const router = express.Router();
const pool = require('../config/db_pool.js');
const jwt = require('jsonwebtoken');
const User = require('../config/ORM').Sign;
const bcrypt = require('bcrypt-node');

router.post('/', async function(req, res, next){
    try {
            let emailExist = await User.findAndCount({
                where: { email: req.body.email }
            }); //이메일 있는지 확인

            if(emailExist.count===0) res.status(404).send({message: 'email does not exist', user_token: ""});
            else{
                let info = await User.findOne({
                    where: {email: req.body.email},
                    attributes: ['id','password']
                }); //비번 맞는지 확인
                let pwCorrect = bcrypt.compareSync(req.body.password, info.dataValues.password);
                if(!pwCorrect) res.status(404).send({message: 'wrong password', user_token: ""});
                else {
                    let option = {
                        algorithm: 'HS256',
                        expiresIn: 60 * 60 * 24 * 7
                    };
                    let payload = {
                        user_id: info.dataValues.id
                    };
                    let token = jwt.sign(payload, req.app.get('secret-key'), option);
                    res.status(200).send({ 
                        message: 'success',
                        user_token : token 
                    });
                }
            }
    }
    catch(err) {
        next(err);
    }
});

module.exports = router;