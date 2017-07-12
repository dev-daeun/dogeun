const express = require('express');
const router = express.Router();
const aws = require('../config/AWS');
aws.loadAccess();
const Favorites = require('../model/favorites');
const auth = require('./auth');

router.get('/', auth, async(req, res, next) => {
    try {
            let data = await Favorites.getFavorites(req.user);
            res.status(200).send(data);
    }
    catch(err){
        next(err);
    }
});

router.put('/:parcel_id', auth, async(req, res, next) => {
    try {
        let result = await Favorites.setFavorites(req.params.parcel_id, req.user);
        if(result===-1) res.status(400).send({message: 'parcel_id do not exist'});
        else if(result==='delete') res.status(201).send({message: 'delete'});
        else res.status(201).send({message: 'add'});
    }
    catch(err){
        next(err);
    }

});


module.exports = router;
