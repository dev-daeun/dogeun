const express = require('express');
const router = express.Router();
const aws = require('../config/AWS');
aws.loadAccess();
const multer = require('multer');
const multerS3 = require('multer-s3');
const Doglist = require('../model/doglists');
const easyimg = require('easyimage');
const fs = require('fs');

const s3 = new aws.S3();
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: 'yeonsudogndogn',
        acl: 'public-read',
        key: function (req, file, cb) {
            cb(null, Date.now().toString() + '.' + file.originalname.split('.').pop());
        }
    })
});
const arrUpload = upload.fields([{ name: 'pet', maxCount: 5 }, { name: 'lineage', maxCount: 1 }, { name: 'parent', maxCount: 2 }
]);

router.post('/',arrUpload, async function(req,res){
    //error 처리
    if (!req.body.user_id || !req.body.spiece || !req.body.gender || !req.body.age || !req.body.region1
        || !req.body.region2 || !req.body.price || !req.body.size || !req.body.introduction
        || !req.body.condition || !req.body.title) {

        res.status(400).send({ message: 'fail' });
        return;
    }

    // pet 이미지는 필수 
    if(!req.files['pet']){
        res.status(400).send({message: 'fail'});
        return;
    }
    
    // 없으면 디폴트 0 값
    if(!req.body.kennel) req.body.kennel=0;
    if(!req.body.corona) req.body.corona=0;
    if(!req.body.DHPPL) req.body.DHPPL = 0;


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
    }

  
    //parcel 테이블에 들어갈 파일 record 추가
    if(!req.files['lineage']){
        parcelRecords.lineage = null;
    }else{
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
    let imageRecords = [];

    for(let petImage of req.files['pet']){
        imageRecords.push({'image': petImage.location});
    }

  
    // 썸네일 만드는 부분 
    let thumnailFileName = 'thumnbnail_' + req.files['pet'][0].key;

    let thumbnailPath = 'thumbnail/' + thumnailFileName;

    let thumbnail = await easyimg.rescrop({
        name: thumnailFileName,
        src: req.files['pet'][0].location,
        dst: thumbnailPath,
        width: 300, height: 400
    });
    console.log(req.files['pet'][0].location);

    let petThumbnail = await uploadToS3(thumnailFileName, thumbnailPath);

    // 썸네일도 레코드에 추가
    parcelRecords.pet_thumbnail = petThumbnail;

    // 함수 호출부분 
    // record 넘기고 클라이언트에 응답

    try {
     
        let ret = await Parcels.postParcels(parcelRecords, parentImageRecords, imageRecords);
        res.status(200).send({ message: 'save' });
    }
    catch (err) {
        console.log('error message : ', err);
        res.status(500).send({ message: 'fail' });

    }

});

router.delete('/:parcel_id',async function(req,res){
      let removeId = req.params.parcel_id;

    try {
        // s3 이미지 지우기
        let whatIs = 'pet';
        let pets = await Parcels.searchImage(removeId,whatIs);
        var petKey = [];

        for (let petItem of pets) {
            petKey = petItem.image.split('/');
            await deleteInS3(petKey[petKey.length-1]);
        }
        
        whatIs = 'parent';
        let parents = await Parcels.searchImage(removeId,whatIs);
        var parentKey = [];

        for(let parentItem of parents){
            parentKey = parentItem.image.split('/');
            
            await deleteInS3(parentKey[parentKey.length-1]);
        }

        whatIs = 'parcel';
        let parcels = await Parcels.searchImage(removeId,whatIs);
        var thumbnailKey = [];
        
        thumbnailKey = parcels[0].pet_thumbnail.split('/');
        await deleteInS3(thumbnailKey[thumbnailKey.length-1]);

        var lineageKey = [];

        lineageKey = parcels[0].lineage.split('/');
        await deleteInS3(lineageKey[lineageKey.length-1]);
        
        let result = Parcels.deleteParcles(removeId);
       
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