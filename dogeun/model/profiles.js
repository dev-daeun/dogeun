const Sequelize = require('sequelize');
const pool = require('../config/db_pool');
const AWS = require('../config/AWS');
const s3 = AWS.getS3();
const fs = require('fs');
const easyimage = require('easyimage');


class Profile {}

Profile.getRecord = function(req){  //저장, 수정에 들어갈 레코드 반환하는 메소드
    return {
                username: req.body.username,
                gender: req.body.gender,
                region: req.body.region,
                lifestyle: req.body.lifestyle,
                family_size: req.body.family_size,
                other_pets: req.body.other_pets
           };
};

Profile.uploadThumbToS3 = function(name, path){
    return new Promise((fulfill, reject) => {
        const params = { //버켓이 올리기 위한 config
            Bucket: 'yeonsudogndogn',
            Key: name,
            Body: fs.createReadStream(path), //로컬 디렉토리에서 썸네일 읽어오기
            ACL: 'public-read'
        };
        s3.putObject(params, (err, data) => { //s3에 읽어온 썸네일 올리기
            if(err) reject(err);
            else { 
                const imageUrl = s3.endpoint.href + params.Bucket + '/'+ name; //s3주소 + 버킷이름 + 썸네일 로컬 위치
                fs.unlinkSync(path); //로컬 디렉토리에 썸네일은 불필요하므로 삭제
                fulfill(imageUrl); //s3에 올라간 썸네일 url 반환.
            }
        });
    });
};

Profile.deleteFromS3 = function(key){
    return new Promise((fulfill, reject) => {
        const params = {
            Bucket: 'yeonsudogndogn',
            Key: key
        };
        s3.deleteObject(params, (err, data) => {
            if(err) reject(err);
            else fulfill(data);
        });
    });
};


Profile.readProfile = async function(id){
    let connection;
    let data = {};
    try{
        connection = await pool.getConnection();
        let query = 'select profile_image, username, gender, lifestyle, region, other_pets, family_size, profile_thumbnail from users where user_id = ? ';
        let user = await connection.query(query, id);
        return user[0];
    //    let keys = Object.keys(user[0]);
    //    for(let item of keys ){
    //        console.log(user[0][item]);
    //        data[item] = user[0][item];
    //    }
    //     return data;
    }catch(err){
        console.log(err);
        throw err;
    }finally{
        pool.releaseConnection(connection);
    }
;}

Profile.saveProfile = async function(req){
    try {
            var connection = await pool.getConnection();
            let record = this.getRecord(req);
            let query = 'insert into users set ?';
            let result;
            if(!req.file) result = await connection.query(query, record);
            else {
                let thumb_name = 'thumbnail_' + req.file.key; //썸네일이미지 이름
                let thumb_path = 'thumbnail/'+ thumb_name; //썸네일 저장 경로
                await easyimage.rescrop({
                    name: thumb_name,
                    src: req.file.location,
                    dst: thumb_path, //로컬 디렉토리에 썸네일 저장
                    width: 300, height: 300
                });
                let thumbnail_url = await this.uploadThumbToS3(thumb_name, thumb_path); //2. 로컬 디렉토리에 저장된 이미지를 s3에 올리기
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
    try { 
         var connection = await pool.getConnection();
         let result;
         let record = this.getRecord(req);
         let profile = await user.findOne({where: { user_id: req.params.id } });
         let original_url = profile[0].profile_image; //원본 이미지 url 가져오기

        if(req.file){
            if(original_url){ //원래 프로필에 이미지가 있었으면(null이 아니면)
                let key = original_url.split('/')[3];
                await this.deleteFromS3(key); //s3에서 원본 이미지 삭제
                await this.deleteFromS3('thumbnail_'+key); //s3에서 썸네일 삭제
            }
            let thumb_name = 'thumbnail_' + req.file.key; //썸네일이미지 이름
            let thumb_path = 'thumbnail/'+ thumb_name; //썸네일 저장 경로
            await easyimage.rescrop({
                name: thumb_name,
                src: req.file.location,
                dst: thumb_path, //로컬 디렉토리에 썸네일 저장
                width: 300, height: 300
            });
            let thumbnail_url = await this.uploadThumbToS3(thumb_name, thumb_path); //로컬에 저장된 썸네일을 s3에 업로드
            record.profile_image = req.file.location; //수정할 레코드에 새 이미지url 추가
            record.profile_thumbnail = thumbnail_url;       
        }
       
        result = await user.update(record,{ where:{ user_id: req.params.id }}); 
        return result;
        

    }
    catch(err) {
        console.log(err); 
        throw err;
    }
};


module.exports = Profile;

