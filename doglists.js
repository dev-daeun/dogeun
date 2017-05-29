const express = require('express');
const router = express.Router();
const pool = require('../model/db_pool');
const multer = require('multer');
const multerS3 = require('multer-s3');
const aws = require('aws-sdk');
try {
    aws.config.loadFromPath('./config/aws_config.json');
} catch (err) { console.log('aa'); }
const Parcels = require('../model/parcels');
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

const easyimg = require('easyimage');
const fs = require('fs');

// client로부터 받은 파일 업로드
const arrUpload = upload.fields([{ name: 'pet', maxCount: 3 }, { name: 'lineage', maxCount: 1 }, { name: 'parent', maxCount: 2 }
]);

router.post('/', showReq, arrUpload, addParcels);
router.put('/', arrUpload, changeParcels);
router.delete('/', removeParcels);

function showReq(req, res, next) {
    console.log(req.headers);
    next();
}

async function removeParcels(req, res, next) {

    let remove_id = req.body.parcel_id;

    try {
        let ret = await Parcels.deleteParcels(remove_id);
        res.send({ message: 'save' });
    } catch (err) {
        console.log('err message : ', err);
        res.send({ message: 'fail' });
    }
};



async function deleteInS3(itemKey, path) {
    return new Promise((resolve, reject) => {

        const params = {
            Bucket: 'yeonsudogndogn',
            Key: itemKey,
            ACL: 'public-read',
            Body: fs.createReadStream(path)
        }

        s3.deleteObjects(params, function (err, data) {
            if (err) {
                return res.send({ "error": err });
            }
            res.send({ data });
        });
    })
};


// 만든 파일을 s3에 업로드하기위해, 업로드 후 썸네일 삭제
async function uploadToS3(itemKey, path) {
    return new Promise((resolve, reject) => {

        const params = {
            Bucket: 'yeonsudogndogn',
            Key: itemKey,
            ACL: 'public-read',
            Body: fs.createReadStream(path)
        }

        s3.putObject(params, (err, data) => {
            if (err) {
                reject(err);
            }
            else {
                const imageUrl = s3.endpoint.href + params.Bucket + path;
                fs.unlinkSync(path);
                resolve(imageUrl);

            }
        })
    })
}

async function changeParcels(req, res, next) {
    let change_id = req.body.parcel_id;
   
    let parcel_records = req.body;

    parcel_records.lineage = req.files['lineage'][0].location;
    console.log(parcel_records);

    let parent_image_records = [];

    for (let i in req.files['parent']) {
        parent_image_records.push({
            'image': req.files['parent'][i].location,
            'image_id': req.body.image_id
        });
    }

    console.log(parent_image_records);
    //pet_images 테이블에 들어갈 record 배열 
    let image_records = [];

    // pet 이미지 파일 개수만큼 record 추가 , key값과 함께 배열에 push
    for (let i in req.files['pet']) {
        image_records.push({
            'image': req.files['pet'][i].location,
            'image_id': req.body.image_id
        });
    }


    try {
        let result = await Parcels.updateParcels(change_id, parcel_records, parent_image_records, image_records);
        res.send({ message: 'save' });
    } catch (err) {
        console.log('error message: ', err);
        res.send({ message: 'fail' });
    }
};



async function addParcels(req, res, next) {
    console.log(req.files);
    
    if (!req.files['pet']) imageUrl = null;

    //파일 제외하고 body부분 record
    let parcel_records = req.body;

    //parcel 테이블에 들어갈 파일 record 추가
    let lineage = req.files['lineage'];
    console.log(lineage);
    parcel_records.lineage = req.files['lineage'].location;


    //부모견 사진 테이블
    let parent_image_records = [];

    for (let i in req.files['parent']) {
        parent_image_records.push({ 'image': i.location });
    }

    //pet_images 테이블에 들어갈 record 배열 
    let image_records = [];

    // pet 이미지 파일 개수만큼 record 추가 , key값과 함께 배열에 push
    for (let i in req.files['pet']) {
        image_records.push({ 'image': i.location });
    }

    let thumnail_fileName = 'thumnbnail_' + req.files['pet'][0].key;

    let thumbnailPath = 'thumbnail/' + thumnail_fileName;

    let thumbnail = await easyimg.rescrop({
        name: thumnail_fileName,
        src: req.files['pet'][0].location,
        dst: thumbnailPath,
        width: 300, height: 400
    });

    let pet_thumbnail = await uploadToS3(thumnail_fileName, thumbnailPath);

    parcel_records.pet_thumbnail = pet_thumbnail;

    // 함수 호출부분 
    // record 넘기고 클라이언트에 응답

    try {
        let ret = await Parcels.postParcels(parcel_records, parent_image_records, image_records);
        res.send({ message: 'save' });
    }
    catch (err) {
        console.log('error message : ', err);
        res.send({ message: 'fail' });

    }
};


module.exports = router;