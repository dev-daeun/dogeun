const express = require('express');
const router = express.Router();
const aws = require('../config/AWS');
aws.loadAccess();
const Doglist = require('../model/doglist');

router.get('/', async function(req, res){
   try {
       let ret = await Doglist.getLists(req.query);
       res.status(200).send(ret);
   } catch(err) {
        res.status(500).send({total: 0, message: "fail : "+err});
        console.log(err);
   }
});



module.exports = router;