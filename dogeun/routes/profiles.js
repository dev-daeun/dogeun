const express = require('express');
const router = express.Router();
const Profile = require('../model/profiles');
const AWS = require('../config/AWS');
AWS.loadAccess();
const upload = AWS.getUpload();

var verifyUser = function(req, res, next){
  if(!req.headers.user_token) res.status(401).send({ message: 'user unauthorized'});
  else if(req.headers.user_token!=20) res.status(400).send({message: 'wrong token'});
  else next();
}
router.use(verifyUser);

router.post('/', upload.single('profile'),async function(req, res){
    try {
	let body = req.body;
        if(!(body.username&&body.gender&&body.lifestyle&&body.region&&body.other_pets&&body.family_size))
            res.status(400).send({ message: 'input unsatisfied' });
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
<<<<<<< HEAD
	    let body = req.body;
         if(!(body.username&&body.gender&&body.lifestyle&&body.region&&body.other_pets&&body.family_size))
            res.status(401).send({ message: 'input unsatisfied' });
        else {
            let ret = await Profile.editProfile(req);
            res.status(201).send({ message: 'success', profile_id: ret });
        }
        let ret = await Profile.editProfile(req);
        res.status(201).send({ message: 'success', profile_id: ret });
=======
	let body = req.body;
        if(!(body.username&&body.lifestyle&&body.region&&body.other_pets&&body.family_size))
            res.status(400).send({ message: 'input unsatisfied' });
        else {
            let ret = await Profile.editProfile(req);
            res.status(201).send({ message: 'success' });
        }
>>>>>>> 0d314bba816316916422b5263624a4da4e30dea0
    }
    catch(err) {
        res.status(500).send({ message: err });
    }
});


module.exports = router;
