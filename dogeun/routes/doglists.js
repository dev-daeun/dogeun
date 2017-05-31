const express = require('express');
const router = express.Router();
const aws = require('../config/AWS');
aws.loadAccess();
const Doglist = require('../model/doglists');

router.get('/', async function(req, res){
   try {
       let ret = await Doglist.getLists(req.query);
       res.status(200).send(ret);
   } catch(err) {
        res.status(500).send({message: "fail : "+err});
        console.log(err);
   }
});

router.get('/emergency', async function(req, res){
   try {
       let ret = await Doglist.getEmergencyLists();
       res.status(200).send(ret);
   } catch(err) {
        res.status(500).send({message: "fail : "+err});
        console.log(err);
   }
});

router.get('/:id', async function(req, res){
    try {
        let ret = await Doglist.getOneList(req.params.id);
        res.status(200).send(ret);
    }
    catch(err) {
        res.status(500).send({ message: 'fail: '+err });
    }
});

router.put('/:id/done', async function(req, res){ //분양완료/완료취소하기
    try {
        let ret = Doglist.completeParcel(req.params.id);
        res.status(201).send( { message: 'success'});
    }
    catch(err) {
        res.status(500).send( { message: 'fail: '+err });
    }
})

module.exports = router;