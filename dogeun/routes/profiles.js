const express = require('express');
const router = express.Router();
const Profile = require('../model/profiles');
const AWS = require('../config/AWS');
AWS.loadAccess();
const upload = AWS.getUpload();

router.get('/:user_id', async function(req,res){
    try{
        let userId = req.params.user_id;

        if(!userId){
            res.status(400).send({message: 'fail'});
        }else{
            let ret = await Profile.readProfile(userId);
            res.status(200).send(ret);
        }
        
    }catch(err){
        console.log(err);
        throw err;
    }
})



router.post('/', upload.single('profile'), async function(req, res){
    try {
	let body = req.body;
        if(!(body.username&&body.gender&&body.lifestyle&&body.region&&body.other_pets&&body.family_size))
            res.status(401).send({ message: 'input unsatisfied' });
        else {
            let ret = await Profile.saveProfile(req);
            res.status(201).send({ message: 'success', profile_id: ret });
        }
    }
    catch(err) {
        res.status(500).send({ message: err });
    }
});


router.put('/:id', upload.single('profile'), async function(req ,res){
    try {
        let ret = await Profile.editProfile(req);
        res.status(201).send({ message: 'success', profile_id: ret });
    }
    catch(err) {
        res.status(500).send({ message: err });
    }
});


module.exports = router;
