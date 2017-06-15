const express = require('express');
const router = express.Router();
const aws = require('../config/AWS');
aws.loadAccess();
const multer = require('multer');
const multerS3 = require('multer-s3');
const Doglist = require('../model/doglists');
const easyimg = require('easyimage');
const fs = require('fs');
const s3 = aws.getS3();

const upload = aws.getUpload();
const arrUpload = upload.fields([{ name: 'pet', maxCount: 5 }, { name: 'lineage', maxCount: 1 }, { name: 'parent', maxCount: 2 }]);

router.post('/', arrUpload, async function (req, res) {

    //토큰 검증 TODO: aouth 토큰으로 변경
    let user_id = req.headers.user_token;
    if(user_id!=20){
        res.status(400).send({message: 'wrong user_token'});
        return;
    } 
    
    //error 처리
    if (!req.body.user_id || !req.body.spiece || !req.body.gender || !req.body.age || !req.body.region1
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
        user_id: req.body.user_id,
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
    let thumbnailFileName = 'thumbnail_' + req.files['pet'][0].key;

    let thumbnailPath = 'thumbnail/' + thumbnailFileName;

    let thumbnail = await easyimg.rescrop({
        name: thumbnailFileName,
        src: req.files['pet'][0].location,
        dst: thumbnailPath,
        width: 300, height: 400
    });
    
    let petThumbnail = await uploadToS3(thumbnailFileName, thumbnailPath);

    // 썸네일도 레코드에 추가
    parcelRecords.pet_thumbnail = petThumbnail;
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
        console.log('error message : ', err);
        res.status(500).send({ message: 'fail' + err.code });
    }

});

// 분양글 수정하기 
router.put('/:parcel_id', arrUpload, async function (req, res) {
    let changeId = req.params.parcel_id;
    let userId = req.body.user_id;

    try {
        let removePet; // 삭제 요청 받은 펫 이미지 id
        let removePetNums; // 삭제 요청 받은 펫 이미지 개수 (null 체크 하기 위해)

        // 삭제할 이미지가 있으면 
    
        if (req.body.pet_image_id) {
            removePet = req.body.pet_image_id;
            if(removePet instanceof Array){
                removePetNums = removePet.length;
            }else{
                removePetNums = 1;
            }
        } else {
            //삭제할 이미지가 없으면
            removePetNums = 0;
        }
       
        // 펫 이미지 레코드
        let petImageRecords = [];

        let newPetNums; // 새로 업로드할 펫 이미지 개수 

        // 새로운 펫 이미지 파일이 있으면
        if (req.files['pet']) {
            for (let item of req.files['pet']) {
                petImageRecords.push({ 'image': item.location, 'parcel_id': changeId, 'image_key': item.key });
            }
            newPetNums = req.files['pet'].length;
        } else {
            // 새로운 펫이미지가 없으면 
            newPetNums = 0;
        }

        // 기존의 펫 이미지 개수 
        let imageNums = await Doglist.checkImages(changeId);


        // 널값 확인하기 위해
        if (imageNums - removePetNums + newPetNums <= 0) {
            res.status(400).send({ message: 'pet image null error' });
            return;
        }

        // 업데이트할 글 레코드 
        let parcelRecords = {
            spiece: req.body.spiece,
            gender: req.body.gender,
            age: req.body.age,
            region1: req.body.region1,
            region2: req.body.region2,
            price: req.body.price,
            size: req.body.size,
            introduction: req.body.introduction,
            condition: req.body.condition,
            fur: req.body.fur,
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

        // 삭제 요청 받은 부모견 이미지 id
        let removeParent;

        // 삭제할 부모견 이미지가 있으면 
        if (req.body.parent_image_id) {
            removeParent = req.body.parent_image_id;
        }

        // 부모견 이미지 레코드 
        let parentImageRecords = [];

        // 새로운 부모견 이미지 파일이 있으면
        if (req.files['parent']) {
            for (let item of req.files['parent']) {
                parentImageRecords.push({ 'image': item.location, 'parcel_id': changeId, 'image_key': item.key });
            }
        }


        let result = []; // 배열로 결과 
        result = await Doglist.updateParcels(changeId, userId, removePet, petImageRecords, parcelRecords, removeParent, parentImageRecords);
        res.status(200).send({ 'results': result });
    } catch (err) {
        console.log('err message : ', err);
        res.status(500).send({ message: 'fail' });
    }

});

router.delete('/:parcel_id', async function (req, res) {
    let removeId = req.params.parcel_id;

    try {
        let result = Doglist.deleteParcles(removeId);
        res.status(200).send({ message: 'save' });
    } catch (err) {
        console.log('err message : ', err);
        res.status(500).send({ message: 'fail' });
    }
});


router.get('/', async function (req, res) {
    try {
        let ret = await Doglist.getLists(req.query);
        res.status(200).send(ret);
    } catch (err) {
        console.log(err);
        res.status(500).send({ message: "fail : " + err });

    }
});

router.get('/emergency', async function (req, res) {
    try {
        let ret = await Doglist.getEmergencyLists();
        res.status(200).send(ret);
    } catch (err) {
        res.status(500).send({ message: "fail : " + err });
        console.log(err);
    }
});

router.get('/:id', async function (req, res) {
    try {
        let ret = await Doglist.getOneList(req.params.id);
        if(ret===0) res.status(400).send({message: 'parcel does not exist'});
        else res.status(200).send(ret);
    }
    catch (err) {
        res.status(500).send({ message: 'fail: ' + err });
    }
});

router.put('/:id/done', async function (req, res) { //분양완료/완료취소하기
    try {
        let ret = Doglist.completeParcel(req.params.id);
        if(ret===0) res.status(400).send({message: 'parcel does not exist'});
        else res.status(201).send( { message: 'success'});
    }
    catch (err) {
        res.status(500).send({ message: 'fail: ' + err });
    }
});

router.post('/reports/:parcel_id', async function (req, res) {
    let parcel_id = req.params.parcel_id;

    let reporter_id = req.body.user_id;
    let content = req.body.content;

    let reportRecods = [];
    reportRecods.push({ 'reporter_id': reporter_id, 'parcel_id': parcel_id, 'content': content });

    try {
        let result = await Doglist.reportParcel(reportRecods);
        res.status(200).send({ message: "save" });
    } catch (err) {
        res.status(500).send({ message: 'fail: ' + err });
    }
});


module.exports = router;
