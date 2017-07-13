const express = require('express');
const router = express.Router();
const Profile = require('../model/profiles');
const Doglist = require('../model/doglists');
const AWS = require('../config/AWS');
const auth = require('./auth');
AWS.loadAccess();
const upload = AWS.getUpload();

router.get('/:user_id', auth, async function(req, res, next){
    try{
            let userId = req.params.user_id;
            let profile = await Profile.readProfile(userId);
            if(profile===-1) res.status(400).send({message: 'user_id does not exist'});
            else {
                let mylist = await Doglist.getMyList(userId);
                profile.mylist = mylist;
                res.status(200).send(profile);
            }
        
    }catch(err){
        next(err);
    }
})

router.post('/', auth, upload.single('profile'),async function(req, res, next){
    try {
	let body = req.body;
        if(!(body.username&&body.gender&&body.lifestyle&&body.region&&body.other_pets&&body.family_size)) {
            res.status(400).send({ message: 'input unsatisfied', user_id: 0 });
            return;
        }
        let name_dup = await Profile.isNameDup(null, req.body.username);
        if(name_dup) {
                res.status(400).send({message: 'username already used', user_id: 0});
                return;
        }
        else {

            let ret = await Profile.saveProfile(req);
            res.status(201).send({ message: 'success', user_id: req.user});
        }
    }
    catch(err) {
        next(err);
    }
});


router.put('/', auth, upload.single('profile'), async function(req, res, next){
    try {
	    let body = req.body;
        if(!(body.username&&body.gender&&body.lifestyle&&body.region&&body.other_pets&&body.family_size)) {
            res.status(401).send({ message: 'input unsatisfied' });
            return;
         }
        else {
            let name_dup = await Profile.isNameDup(req.user, req.body.username);
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
         next(err);
    }
});


module.exports = router;
