const pool = require('../config/db_pool');
const AWS = require('../config/AWS');
const s3 = AWS.getS3();
const fs = require('fs');
const easyimage = require('easyimage');
const user = require('./models').user;
class Profile {}

Profile.uploadThumbToS3 = function(name, path){
    return new Promise((fulfill, reject) => {
        const params = { //버켓이 올리기 위한 config
            Bucket: 'yeonsudogndogn',
            Key: name,
            Body: fs.createReadStream(path), //로컬 디렉토리에서 썸네일 읽어오기
            ACL: 'public-read'
        };
        s3.putObject(params, (err) => { //s3에 읽어온 썸네일 올리기
            if(err) return reject(err);
            else { 
                const imageUrl = s3.endpoint.href + params.Bucket + path; //s3주소 + 버킷이름 + 썸네일 로컬 위치
                fs.unlinkSync(path); //로컬 디렉토리에 썸네일은 불필요하므로 삭제
                fulfill(imageUrl); //s3에 올라간 썸네일 url 반환.
            }
        });
    });
}

Profile.deleteFromS3 = function(key){
    return new Promise((fulfill, reject) => {
        const params = {
            Bucket: 'yeonsudogndogn',
            Key: key
        };
        s3.deleteObject(params, (err, data) => {
            if(err) reject(params);
            else {
                fulfill(data);
            }
        });
    });
}

Profile.saveProfile = async function(req){
    try {
            var connection = await pool.getConnection();
            let record = req.body;
            let query = 'insert into users set ?';
            let result;
            if(!req.file) result = await connection.query(query, record);
            else {
                let thumbnail_name = 'thumbnail_' + req.file.key; //썸네일이미지 이름
                let thumbnail_path = 'thumbnail/'+ thumbnail_name; //썸네일 저장 경로
                await easyimage.rescrop({
                    name: thumbnail_name,
                    src: req.file.location,
                    dst: thumbnail_path, //썸네일 저장 경로에 파일을 저장하겠다?
                    width: 300, height: 300
                });
                let thumbnail_url = await this.uploadThumbToS3(thumbnail_name, thumbnail_path); //2. 로컬 디렉토리에 저장된 이미지를 s3에 올리기
                record.profile_image = req.file.location;
                record.profile_thumbnail = thumbnail_url;
                result = await connection.query(query, record);
            }
            return result;
    } 
    catch(err) {
        throw err;
    }
    finally {
        pool.releaseConnection(connection);
    }
};

Profile.editProfile = async function(req){
    try { //이미지 수정 추가 해야됨.
        if(req.file){
            let profile_url = user.findAll({
                attributes: [profile_image]
            },
            {
                where: {user_id: req.params.id} //TODO : 토큰 검증해서 값 가져오기
            });

            let key = profile_url.split('/')[3];
            console.log(key);
            await this.deleteFromS3(key); //s3에서 원본 이미지 삭제
            await this.deleteFromS3('thumbnail_'+key); //s3에서 썸네일 삭제
            let thumbnail_name = 'thumbnail_' + req.file.key; //썸네일이미지 이름
            let thumbnail_path = 'thumbnail/'+ thumbnail_name; //썸네일 저장 경로
            await easyimage.rescrop({
                    name: thumbnail_name,
                    src: req.file.location,
                    dst: thumbnail_path, //썸네일 저장 경로에 파일을 저장하겠다?
                    width: 300, height: 300
            });
            let thumbnail_url = await this.uploadThumbToS3(thumbnail_name, thumbnail_path);            
            let ret = await user.update({
                username: req.body.username,
                gender: req.body.gender,
                region: req.body.region,
                lifestyle: req.body.lifestyle,
                family_size: req.body.family_size,
                other_pets: req.body.other_pets,
                profile_image: req.file.location,
                profile_thumbnail: thumbnail_url
            },
            {
                where:{ user_id: 30 } //가라로 박아넣음
            }); 
            return ret;
        }
        else {
            let ret = await user.update({
                username: req.body.username,
                gender: req.body.gender,
                region: req.body.region,
                lifestyle: req.body.lifestyle,
                family_size: req.body.family_size,
                other_pets: req.body.other_pets
            },
            {
                where:{ user_id: 30 } //가라로 박아넣음
            }); 
            return ret;
        }

    }
    catch(err) {
        console.log(err); 
        throw err;
    }
};


module.exports = Profile;