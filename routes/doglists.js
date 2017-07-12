const express = require('express');
const router = express.Router();
const aws = require('../config/AWS');
aws.loadAccess();
const multer = require('multer');
const multerS3 = require('multer-s3');
const Doglist = require('../model/doglists');
const User = require('../model/user');
const easyimg = require('easyimage');
const fs = require('fs');
const s3 = aws.getS3();
const upload = aws.getUpload();
const arrUpload = upload.fields([{ name: 'pet', maxCount: 5 }, { name: 'lineage', maxCount: 1 }, { name: 'parent', maxCount: 2 }]);
const auth = require('./auth');

router.post('/', auth, arrUpload, async function (req, res, next) {
    
    //error 처리
    if (!req.body.spiece || !req.body.gender || !req.body.age || !req.body.region1
        || !req.body.region2 || !req.body.price || !req.body.size || !req.body.introduction
        || !req.body.condition || !req.body.title) {

        res.status(400).send({ message: 'please input all info' });
        return;
    }

    // pet 이미지는 필수 
    if (!req.files['pet']) {
        res.status(400).send({ message: 'please upload pet images' });
        return;
    }

    //파일 제외하고 body부분 record
    //let parcelRecords = req.body; 에러날 가능성 있다.
    let parcelRecords = {
        user_id: req.user,
        spiece: req.body.spiece,
        gender: req.body.gender,
        age: req.body.age,
        region1: req.body.region1,
        region2: req.body.region2,
        price: req.body.price,
        size: req.body.size,
        introduction: req.body.introduction,
        condition: req.body.condition,
        fur: req.body.fur ,
        title: req.body.title,
        kennel: req.body.kennel || 0,
        corona: req.body.corona || 0,
        DHPPL: req.body.DHPPL || 0
    };

    //parcel 테이블에 들어갈 파일 record 추가
    if (!req.files['lineage']) {
        parcelRecords.lineage = null;
    } else {
        parcelRecords.lineage = req.files['lineage'][0].location;
    }

    // parentImageRecords 테이블에 들어갈 record 추가
    let parentImageRecords = [];

    if (req.files['parent']) {
        for (let parentImage of req.files['parent']) {
            parentImageRecords.push({ 'image': parentImage.location, 'image_key': parentImage.key });
        }
    }

    //pet_images 테이블에 들어갈 record 배열 
    let petImageRecords = [];

    for (let petImage of req.files['pet']) {
        //petImageRecords.push({ 'image': petImage.location, 'key': petImage.key});
        petImageRecords.push({ 'image': petImage.location, 'image_key': petImage.key });
    }

 
     // 썸네일 만드는 부분 
    let thumbnailInfo = [];
    thumbnailInfo.push({ 'key': req.files['pet'][0].key, 'location': req.files['pet'][0].location });
  

    // 함수 호출부분 
    // record 넘기고 클라이언트에 응답

    try {
        let result = [];
        result = await Doglist.postParcels(parcelRecords, parentImageRecords, petImageRecords, thumbnailInfo);
        res.status(200).send({ results: result });
    }
    catch (err) {
        next(err);
    }

});

// 분양글 수정하기 
router.put('/:parcel_id', auth, arrUpload, async function (req, res, next) {
    let changeId = req.params.parcel_id;
    let userId = req.user;
    try{
        if (!req.body.spiece || !req.body.gender || !req.body.age || !req.body.region1
        || !req.body.region2 || !req.body.price || !req.body.size || !req.body.introduction
        || !req.body.condition || !req.body.title) {
            res.status(400).send({ message: 'please input all info' });
            return;
        }
        else{
            let record = {
                user_id: req.user,
                spiece: req.body.spiece,
                gender: req.body.gender,
                age: req.body.age,
                region1: req.body.region1,
                region2: req.body.region2,
                price: req.body.price,
                size: req.body.size,
                introduction: req.body.introduction,
                condition: req.body.condition,
                fur: req.body.fur ,
                title: req.body.title,
                kennel: req.body.kennel,
                corona: req.body.corona,
                DHPPL: req.body.DHPPL
            };

            let removedPet = req.body.pet_image_id || 0;
            let removedParent = req.body.parent_image_id || 0;
            let newLineage = req.files['lineage'] ? req.files['lineage'][0] : null;
            let newPet = req.files['pet'] ? req.files['pet'][0] : null;
            let newParent = req.files['parent'] ? req.files['parent'][0] : null;
            let ret = await Doglist.updateParcel(req.user, changeId, record, removedPet, removedParent, newPet, newParent, newLineage);
            if(ret===-1) res.status(404).send({message: 'parcel or image_id does not exist'});
            res.status(200).send({results: ret});
    }
    }
    catch (err) {
        next(err);
    }

});

router.delete('/:parcel_id', auth, async function (req, res, next) {
    let removeId = req.params.parcel_id;

    try {
        let result = Doglist.deleteParcel(removeId, req.user);
        res.status(200).send({ message: 'success' });
    } catch (err) {
        next(err);
    }
});


router.get('/',  async function (req, res, next) {
    try {
            let page;
            if(req.query.page==0) page = 1; //page=0으로 날릴 경우 
            else page = req.query.page || 1;
            let keywords = {}; //TODO : if문 줄일 방법 찾기
            if(req.query.spiece!=0) keywords.spiece = req.query.spiece;
            if(req.query.region1!=0) keywords.region1 = req.query.region1;
            if(req.query.region2!=0) keywords.region2 = req.query.region2;
            if(req.query.gender!=0) keywords.gender = req.query.gender;
            if(req.query.age!=0) keywords.age = req.query.age;
            let ret = await Doglist.getLists(User.getUserId(), keywords, page);
            res.status(200).send(ret);
        
    } catch (err) {
        console.log(err);
        next(err);
    }
});

router.get('/emergency', async function (req, res, next) {
    try {
        let ret = await Doglist.getEmergencyLists(User.getUserId());
        res.status(200).send(ret);
    } catch (err) {
         next(err);
    }
});

router.get('/:id', async function (req, res, next) {
    try {
        let ret = await Doglist.getOneList(req.params.id);
        if(ret===0) res.status(400).send({message: 'parcel does not exist'});
        else res.status(200).send(ret);
    }
    catch (err) {
        next(err);
    }
});

router.put('/:id/done', auth, async function (req, res, next) { //분양완료/완료취소하기
    try {
        let ret = await Doglist.completeParcel(req.params.id, req.user);
        if(ret===0) res.status(400).send({message: 'parcel does not exist'});
        else if(ret===1) res.status(200).send({message: 'complete'});
        else if(ret===2) res.status(200).send({message: 'canceled'});
    }
    catch (err) {
        next(err);
    }
});

router.post('/reports', auth, async function (req, res, next) {
    let reporter_id = req.user;
    let parcel_id = req.body.parcel_id;
    let content = req.body.content;
    if(!parcel_id) res.status(404).send({message: 'parcel does not exist'});
    else if(!content) res.status(400).send({message: 'content is empty'});
    else{
        try {
            let result = await Doglist.reportParcel(reporter_id, parcel_id, content);
            res.status(200).send({ message: "success" });
        } catch (err) {
            next(err);
        }
    }

});


module.exports = router;
