const express = require('express');
const router = express.Router();
const pool = require('../config/db_pool');
const jwt = require('jsonwebtoken');
const User = require('../model/user');

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
            let ret = await User.signup(email, password, checking_password);
            if(ret==='dupEmail') {
                res.status(405).send({ message: 'the email is already being used'});
                return;
            }
            else if(ret==='wrongPW'){
                res.status(405).send({message: 'please recheck your password'});
                return;
            }
            else{
                res.status(201).send({message: 'success'});        
                return;
            }
        }
    }
    catch(err) {
        next(err);
    }
});

module.exports = router;