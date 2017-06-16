const express = require('express');
const router = express.Router();
const Profile = require('../model/profiles');
const AWS = require('../config/AWS');
AWS.loadAccess();
const upload = AWS.getUpload();


router.use(function(req, res, next){
  if(!req.headers.user_token) res.status(401).send({ message: 'user unauthorized'});
  else if(req.headers.user_token!=20) res.status(400).send({message: 'wrong token'});
  else next();
});

router.get('/:user_id', async function(req,res){
    try{
        let userId = req.params.user_id;

        if(!userId){
            res.status(400).send({message: 'no user error'});
        }else{
            let ret = await Profile.readProfile(userId);
            res.status(200).send(ret);
        }
        
    }catch(err){
        console.log(err);
        throw err;
    }
})

router.post('/', upload.single('profile'),async function(req, res){
    try {
	let body = req.body;
        if(!(body.username&&body.gender&&body.lifestyle&&body.region&&body.other_pets&&body.family_size)) {
            res.status(400).send({ message: 'input unsatisfied' });
            return;
        }
        let name_dup = await Profile.isNameDup(null, req.body.username);
        if(name_dup) {
                res.status(400).send({message: 'username already used'});
                return;
        }
        else {
            let ret = await Profile.saveProfile(req);
            res.status(201).send({ message: 'success', user_id: ret.insertId });
        }
    }
    catch(err) {
        res.status(500).send({ message: err });
    }
});


router.put('/:id', upload.single('profile'), async function(req ,res){
    try {
	    let body = req.body;
        if(!(body.username&&body.gender&&body.lifestyle&&body.region&&body.other_pets&&body.family_size)) {
            res.status(401).send({ message: 'input unsatisfied' });
            return;
         }
        else {
            let name_dup = await Profile.isNameDup(req.params.id, req.body.username);
            if(name_dup) {
                res.status(400).send({message: 'username already used'});
                return;
            }
            else {
                let ret = await Profile.editProfile(req);
                res.status(201).send({ message: 'success'});
            }
        }
    }
    catch(err) {
        res.status(500).send({ message: err });
    }
});


module.exports = router;
