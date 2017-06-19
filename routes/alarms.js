const express = require('express');
const router = express.Router();
const Profile = require('../model/profiles');

router.put('/:user_id', async function(req,res,next){
    let userId = req.params.user_id;
    
    try{
        let result = await Profile.setAlarms(userId);
        res.status(201).send({message: 'alarm change'});
    }catch(err){
        console.log('error message',err);
        next(err);
    }
});

module.exports = router;