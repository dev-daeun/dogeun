const pool = require('../config/db_pool');
const AWS = require('../config/AWS');
const s3 = AWS.getS3();
const fs = require('fs');
const easyimage = require('easyimage');
class Profile {}

Profile.uploadToS3 = function(name, path){
    return new Promise((fulfill, reject) => {
        const params = { //버켓이 올리기 위한 config
            Bucket: 'yeonsudogndogn',
            Key: name,
            Body: fs.createReadStream(path), //로컬 디렉토리에서 썸네일 읽어오기
            ACL: 'public-read'
        };
        s3.putObject(params, (err, data) => { //s3에 읽어온 썸네일 올리기
            if(err) return err;
            else { 
                const imageUrl = s3.endpoint.href + params.Bucket + path; //s3주소 + 버킷이름 + 썸네일 로컬 위치
                fs.unlinkSync(path); //로컬 디렉토리에 썸네일은 불필요하므로 삭제
                fulfill(imageUrl); //s3에 올라간 썸네일 url 반환.
            }
        });
    });
}

Profile.saveProfile = async function(req){
    try {
            var connection = await pool.getConnection();
            let record = req.body;
            let query = 'insert into users set ?';
            if(!req.file) {
                let result = await connection.query(query, record); 
                return result;
            }
            else {
                let thumbnail_name = 'thumbnail_' + req.file.key; //썸네일이미지 이름
                let thumbnail_path = 'thumbnail/'+ thumbnail_name; //썸네일 저장 경로
                let result2 = await easyimage.rescrop({
                    name: thumbnail_name,
                    src: req.file.location,
                    dst: thumbnail_path, //썸네일 저장 경로에 파일을 저장하겠다?
                    width: 300, height: 300
                });
                let thumbnail_url = await uploadToS3(thumbnail_name, thumbnail_path); //2. 로컬 디렉토리에 저장된 이미지를 s3에 올리기
                record.profile_image = req.file.location;
                record.profile_thumbnail = thumbnail_url;
                let result = await connection.query(query, record);
                return result;
            }
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
        let key_array = Object.keys(req.body);
        let key_length = key_array.length;
        let value_array = [];

        let query = 'update users set ';
        for(let i = 0; i<key_length; i++) {
            if(i==key_length-1) query +=  key_array[i] + ' = ? ';
            else query += key_array[i] + ' = ?, '
            value_array.push(req.body.key_array[i]);
        }
        value_array.push(req.params.id);
        query += 'where user_id = ?';
        console.log(query);
        let ret = connection.query(query, value_array);
        return ret;
    }
    catch(err) {
        console.log(err); 
        throw err;
    }
    finally {
        pool.releaseConnection(connection);
    }
    

};

Profile.editProfile = async function(req){
    try {
        var connection = await pool.getConnection();
        let key_array = Object.keys(req.body);
        let key_length = key_array.length;
        let value_array = [];

        let query = 'update users set ';
        for(let i = 0; i<key_length; i++) {
            if(i==key_length-1) query +=  key_array[i] + ' = ? ';
            else query += key_array[i] + ' = ?, '
            value_array.push(req.body.key_array[i]);
        }
        value_array.push(req.params.id);
        query += 'where user_id = ?';
        console.log(query);
        let ret = connection.query(query, value_array);
        return ret;
    }
    catch(err) {
        console.log(err); 
        throw err;
    }
    finally {
        pool.releaseConnection(connection);
    }
    

};
module.exports = Profile;