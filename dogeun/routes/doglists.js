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

router.post('/', arrUpload, async function(req,res){

    //error 처리
    if (!req.body.user_id || !req.body.spiece || !req.body.gender || !req.body.age || !req.body.region1
        || !req.body.region2 || !req.body.price || !req.body.size || !req.body.introduction
        || !req.body.condition || !req.body.title) {

        res.status(400).send({ message: 'fail' });
        return;
    }

    // pet 이미지는 필수 
    if (!req.files['pet']) {
        res.status(400).send({ message: 'fail' });
        return;
    }

    // 없으면 디폴트 0 값
    if (!req.body.kennel) req.body.kennel = 0;
    if (!req.body.corona) req.body.corona = 0;
    if (!req.body.DHPPL) req.body.DHPPL = 0;


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
        fur: req.body.fur,
        title: req.body.title,
        kennel: req.body.kennel,
        corona: req.body.corona,
        DHPPL: req.body.DHPPL
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
            parentImageRecords.push({ 'image': parentImage.location });
        }
    }

    //pet_images 테이블에 들어갈 record 배열 
    let petImageRecords = [];

    for (let petImage of req.files['pet']) {
        petImageRecords.push({ 'image': petImage.location });
    }

    // 썸네일 만드는 부분 
    let thumbnailInfo = [];
    thumbnailInfo.push({ 'key': req.files['pet'][0].key, 'location': req.files['pet'][0].location });

    // 함수 호출부분 
    // record 넘기고 클라이언트에 응답

    try {
        let result = [];
        result = await Doglist.postParcels(parcelRecords, parentImageRecords, petImageRecords, thumbnailInfo);
        res.status(200).send({ message: 'save', results: result });
    }
    catch (err) {
        console.log('error message : ', err);
        res.status(500).send({ message: 'fail' });

    }

});

router.put('/', arrUpload, async function (req, res) {
    let changeId = req.body.parcel_id;

    try {
        let removePet; // 삭제 요청 받은 펫 이미지 id
        let removePetNums; // 삭제 요청 받은 펫 이미지 개수 (null 체크 하기 위해)
        
        // 삭제할 이미지가 있으면 
        if (req.body.pet_image_id) {
            removePet = [req.body.pet_image_id];
            removePetNums = removePet.length;
        }else{
            //삭제할 이미지가 없으면
            removePetNums = 0;
        }
        
        // 펫 이미지 레코드
        let petImageRecords = [];

        let newPetNums; // 새로 업로드할 펫 이미지 개수 

        // 새로운 펫 이미지 파일이 있으면
        if (req.files['pet']) {
            for (let item of req.files['pet']) {
                petImageRecords.push({ 'image': item.location, 'parcel_id': changeId });
            }
            newPetNums = req.files['pet'].length;
        }else{
            // 새로운 펫이미지가 없으면 
           newPetNums = 0;
        }
        
        // 기존의 펫 이미지 개수 
        let imageNums = await Doglist.checkImages(changeId);
     
        // 널값 확인하기 위해
        if(imageNums - removePetNums + newPetNums <= 0 ){
             res.status(400).send({ message: 'fail' });
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
            lineage: req.files['lineage'].location,
            title: req.body.title,
            kennel: req.body.kennel,
            corona: req.body.corona,
            DHPPL: req.body.DHPPL
        };

        // 삭제 요청 받은 부모견 이미지 id
        let removeParent;

        // 삭제할 부모견 이미지가 있으면 
        if (req.body.parent_image_id) {
            removeParent = [req.body.parent_image_id];
        }
        
        // 부모견 이미지 레코드 
        let parentImageRecords = [];

        // 새로운 부모견 이미지 파일이 있으면
        if (req.files['parent']) {
            for (let item of req.files['parent']) {
                parentImageRecords.push({ 'image': item.location, 'parcel_id': changeId });
            }
        }
        let result = []; // 배열로 결과 
        result = await Doglist.updateParcels(changeId, removePet, petImageRecords, parcelRecords, removeParent, parentImageRecords);
        res.send({ message: 'save', 'results': result });
    } catch (err) {
        console.log('err message : ', err);
        res.status(500).send({ message: 'fail' });
    }

});

router.delete('/:parcel_id', async function (req, res) {
    let removeId = req.params.parcel_id;

    try {
        let result = Doglist.deleteParcles(removeId);
        res.send({ message: 'save' });
    } catch (err) {
        console.log('err message : ', err);
        res.status(500).send({ message: 'fail' });
    }
});


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