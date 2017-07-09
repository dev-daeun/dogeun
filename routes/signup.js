const express = require('express');
const router = express.Router();
const pool = require('../config/db_pool');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt-node');
const salt = bcrypt.genSaltSync(20);
const User = require('../config/ORM').Sign;

router.post('/', async (req, res, next) => {
    try {
        let email = req.body.email;
        let password = req.body.password;
        let checking_password = req.body.checking_password;
        if(!req.app.get('emailFormed')(email)){
            res.status(400).send({message: 'wrong form of email address'});
            return;
        } 
        else if(!req.app.get('pwFormed')(password)){
            res.status(400).send({message: 'wrong form of password'});
            return;
        }
        else{
            let dupEmail = await User.count({ 
                where: { email: email } 
            });
            if(dupEmail>0) {
                res.status(405).send({ message: 'the email is already being used'});
                return;
            }
            else {
                if(password!==checking_password){
                    res.status(405).send({message: 'please recheck your password'});
                    return;
                }
                let pw = bcrypt.hashSync(password, salt);
                let newUser = await User.create({
                    email: email,                        
                    password: pw
                });
                res.status(201).send({message: 'success'});        
            }
        }
    }
    catch(err) {
        next(err);
    }
});

module.exports = router;