const express = require('express');
const router = express.Router();
const Profile = require('../model/profiles');
const AWS = require('../config/AWS');
AWS.loadAccess();
const upload = AWS.getUpload();

router.use(function(req, res, next){
  if(!req.headers.user_token) res.status(401).send({ message: 'user unauthorized'});
  else if(req.headers.user_token!=21) res.status(400).send({message: 'wrong token'});
  else next();
});

router.delete('/:user_id', async(req, res, next) => {
    try {
        let ret = await Profile.deleteProfile(req.params.user_id);
        if(ret===-1) res.status(400).send({ message: 'user_id does not exist '});
        else res.status(201).send({message: 'delete success' });
    }
    catch(err){
         next(err);
    }
});

module.exports = router;
