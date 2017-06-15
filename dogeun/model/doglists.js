const pool = require('../config/db_pool');
const aws = require('../config/AWS');
const fs = require('fs');
const easyimage = require('easyimage');
const upload = aws.getUpload();
const s3 = aws.getS3();
class DogList { }

// s3 삭제 함수 
DogList.deleteInS3 = async function (itemKey) {
    return new Promise((resolve, reject) => {

        const params = {
            Bucket: 'yeonsudogndogn',
            Delete: {
                Objects: [
                    {
                        Key: itemKey
                    }
                ]
            }

        }
        // 여러개 삭제할 경우
        s3.deleteObjects(params, (err, data) => {
            if (err) {
                reject(err);
            } else {
                console.log(data);
                resolve(data);
            }
        });
    })
};


// s3 업로드 함수
DogList.uploadToS3 = async function (itemKey, path) {
    return new Promise((resolve, reject) => {

        const params = {
            Bucket: 'yeonsudogndogn',
            Key: itemKey,
            ACL: 'public-read',
            Body: fs.createReadStream(path)
        }

        s3.putObject(params, (err, data) => {
            if (err) {
                fs.unlinkSync(path);
                reject(err);
            }
            else {
                const imageUrl = s3.endpoint.href + params.Bucket + path;
                fs.unlinkSync(path);
                resolve(imageUrl);

            }
        })
    })
};

// 펫 이미지 개수 확인하는 함수 
DogList.checkImages = async function(id){
    let connection;
    try{
        connection = await pool.getConnection();

        // TODO: 사진 개수 확인, 썸네일 만들기
        let query = 'select count(parcel_id) as count from pet_images where parcel_id = ? ';
        let imageNum = await connection.query(query, id);

        let count = imageNum[0].count;
        return count;

    }catch(err){
        console.log(err);
        throw err;
    }finally{
        await pool.releaseConnection(connection);
    }

};

// 분양글 저장하기 
DogList.postParcels = async function (parcelRecord, parentRecord, petRecord, thumbnailInfo) {
    let connection;
    let data = {}; // 응답 records, 객체 형태로 반환 
    try {
        connection = await pool.getConnection();

        await connection.beginTransaction();

        // 썸네일 만들기 
        // TODO : 데이터베이스에 키 저장
        if (thumbnailInfo) {
            let thumbnailFileName = 'thumbnail_' + thumbnailInfo[0].key;

            let thumbnailPath = 'thumbnail/' + thumbnailFileName;

            let thumbnail = await easyimage.rescrop({
                name: thumbnailFileName,
                src: thumbnailInfo[0].location,
                dst: thumbnailPath,
                width: 300, height: 400
            });

            let petThumbnail = await DogList.uploadToS3(thumbnailFileName, thumbnailPath);

            // 썸네일도 레코드에 추가
            parcelRecord.pet_thumbnail = petThumbnail;
        }

        // 분양글 항목 저장
        let query1 = 'INSERT INTO parcel SET ? ';
        let parcelOutput = await connection.query(query1, parcelRecord);
        let outputId = parcelOutput.insertId; //분양글 저장 -> 분양글 id가 parcel_id에 저장
        parcelRecord.parcel_id = outputId;
        data = parcelRecord;
        let id = parcelRecord.user_id;
        let query = 'SELECT username FROM users WHERE user_id = ? ';
        let users = await connection.query(query, id);
        if(users && users.length > 0){
            data.username = users[0].username;
        }


        // 부모견 이미지 저장
        data.parent = [];
        if (parentRecord && parentRecord.length > 0 ) {
            for (let parent of parentRecord) {
                parent.parcel_id = outputId;
                let query2 = 'INSERT INTO parent_pet_images SET ? ';
                let parentOutput = await connection.query(query2, parent);

                parent.image_id = parentOutput.insertId;
                data.parent.push(parent);
                data.parent = parent;

            }
        }

        // 펫 이미지 저장 
        data.pet = [];
        if (petRecord && petRecord.length > 0) {

            for (let pet of petRecord) {
                pet.parcel_id = outputId;
                let query3 = 'INSERT INTO pet_images SET ? ';

                let petOutput = await connection.query(query3, pet);
                pet.image_id = petOutput.insertId;
                data.pet.push(pet);
                await connection.query(query3, pet);
                data.pet = pet;
            }
        }

        //commit
        await connection.commit();

        return data;

    } catch (err) {
        try {
            await connection.rollback();
            console.log(err);
        } catch (err) {
            console.log(err);
        }
        throw err;

    } finally {
        pool.releaseConnection(connection);
    }

};

// 분양글 수정하기 
DogList.updateParcels = async function (changeId, removePet, petRecord, parcelRecord, removeParent, parentRecord) {
    let connection;
    let data = {}; //응답 records, 객체 형태로 반환 
    try {
        connection = await pool.getConnection();

        // 삭제할 펫 이미지 아이디가 있다면 
        if (removePet && removePet.length > 0) {
            for (let item of removePet) {
                // s3 삭제를 위해 url 
                let query1 = 'select image from pet_images where parcel_id = ? and image_id = ? ';
                let petImage = await connection.query(query1, [changeId, item]);

                for (let image of petImage) {
                    // record 삭제 
                    let url = image.image.split('/');
                    await DogList.deleteInS3(url[url.length - 1]);
                    let query2 = 'delete from pet_images where parcel_id = ? and image_id = ?';
                    let deleteResult = await connection.query(query2, [changeId, item]);
                }

            }
        }

        // 새로 추가할 펫 이미지가 있다면
        data.pet = [];
        if (petRecord && petRecord.length > 0) {

            for (let pet of petRecord) {
                let query3 = 'insert into pet_images set ?';
                let newPet = await connection.query(query3, pet);
                pet.image_id = newPet.insertId;
                data.pet.push(pet); 
                data.pet = pet;
            }
        }

        // 분양글 항목 업데이트
        let query5 = 'UPDATE parcel SET ? WHERE parcel_id = ?';
        let parcelOutput = await connection.query(query5, [parcelRecord, changeId]);
        data = parcelRecord;
        let id = parcelRecord.user_id; 
        let query = 'select username FROM users where user_id = ?';
        let users = await connection.query(query,id);
        if(users && users.length > 0){
            data.username = users[0].username;
        }


        // 삭제할 부모견 사진 아이디가 있다면
        if (removeParent && removeParent.length > 0) {
            for (let item of removeParent) {
                // s3 삭제를 위해, url
                let query6 = 'select image from parent_pet_images where parcel_id = ? and image_id = ?';
                let parentImage = await connection.query(query6, [changeId, item]);

                for (let image of parentImage) {
                    // s3 삭제
                    let url = image.image.split('/');
                    await DogList.deleteInS3(url[url.length - 1]);
                    // 부모견 이미지 삭제
                    let query7 = 'delete from parent_pet_images where parcel_id = ? and image_id = ?';
                    let deleteParent = await connection.query(query7, [changeId, item]);
                }

            }
        }

        // 새로운 부모견 사진이 있다면
        data.parent = [];
        if (parentRecord && parentRecord.length > 0) {

            for (let parent of parentRecord) {
                let query8 = 'insert into parent_pet_images set ?';
                let newParent = await connection.query(query8, parent);
                parent.image_id = newParent.insertId;
                data.parent.push(parent); 
            }
        }
        // 응답 record 리턴
        return data;
    } catch (err) {
        try {
            await connection.rollback();
            console.log(err);
        } catch (error) {
            console.log(err);
        }
        throw err;
    } finally {
        pool.releaseConnection(connection);
    }
};


// 분양글 삭제하기 
DogList.deleteParcles = async function (id) {
    let connection;
    try {
        connection = await pool.getConnection();

        // 펫 이미지 삭제
        let query1 = 'select image from pet_images where parcel_id = ? ';
        let petImage = await connection.query(query1, id);
        // s3 삭제
        let petKey = [];
        if (petImage && petImage.length > 0) {
            for (let pet of petImage) {
                petKey = pet.image.split('/');
                await DogList.deleteInS3(petKey[petKey.length - 1]);
            }
        }

        // 혈통서 삭제 from s3     
        let query2 = 'select lineage from parcel where parcel_id = ? ';
        let lineageImage = await connection.query(query2, id);
        // null일 때 length = 1
        if (lineageImage && lineageImage.length > 0) {
            let url = lineageImage[0].lineage.split('/');
            await DogList.deleteInS3(url[url.length - 1]);
        }

        // 부모견 삭제 from s3
        let query3 = 'select image from parent_pet_images where parcel_id = ? ';
        let parentImage = await connection.query(query3, id);
        let parentKey = [];
        if (parentImage && parentImage.length > 0) {
            for (let parent of parentImage) {
                parentKey = parent.image.split('/');
                await DogList.deleteInS3(parentKey[parentKey.length - 1]);
            }
        }

        // 레코드 삭제
        let query4 = 'DELETE FROM parcel WHERE parcel_id = ?';
        let deleteRecord = await connection.query(query, id);

        return deleteRecord;
    } catch (err) {
        console.log(err);
        throw err;
    } finally {
        pool.releaseConnection(connection);
    }
};


DogList.getWhere = function(qs){ //검색조회에 필요한 쿼리 만드는 함수
    let where = '', param_array=[];
    for(let i in qs){
      if(i=='page') continue;
      else if(qs[i]) {
	param_array.push(qs[i]);
      	where += ' and p.'+i+ ' = ? ';
      }
      
    }
    return {where: where, param_array: param_array};
};


DogList.getLists = async function(qs){ //전체목록 조회하기
     try { 
           var connection = await pool.getConnection();
           let query = `select p.parcel_id, p.title, p.pet_thumbnail, u.username, 
           (select 1 from favorites as f where p.parcel_id=f.parcel_id and f.user_id = ?) 
           as favorite from parcel as p, users as u where u.user_id = p.user_id`;
           let data;
              let where = this.getWhere(qs).where; //검색어 쿼리스트링으로 조건절 만들어서 가져오기
              let param_array = this.getWhere(qs).param_array; //placeholder에 들어갈 배열 가져오기
              param_array.unshift(1); //placeholder에 들어갈 user_id 앞에다 추가(가라로 추가함)
              data = await connection.query(query+where+' order by parcel_id desc;', param_array); //검색어로 쿼리 때리기. 
             //user_id는 현재 사용자 id. 토큰이냐 세션이냐 미정.
           if(qs.page * 10 > data.length) return [null]; //게시글 갯수를 넘기는 페이지 넘버가 날아오면 null 리턴
           else {
               let start = Math.min(data.length-1, qs.page * 10);
               let end = Math.min(data.length-1, start + 9);
               let array = [];
               for(let i = start; i<=end; i++) array.push(data[i]);
               return array;
           }
           
     } catch(err){ throw err; }
       finally { pool.releaseConnection(connection); }
};

 DogList.getEmergencyLists = async function(){ //메인화면 가로에 들어갈 분양 가장 시급한 글 6개 조회
     try { 
           var connection = await pool.getConnection();
           let query = `select p.parcel_id, p.title, p.pet_thumbnail, u.username, 
           (select 1 from favorites as f where p.parcel_id=f.parcel_id and f.user_id = ?) 
           as favorite from parcel as p, users as u where u.user_id = p.user_id and p.is_parceled = 0 order by p.parcel_id limit 6`;
           let data = await connection.query(query, 2); //전체 목록 쿼리 때리기
           return data;
     } catch(err){ throw err; }
       finally { pool.releaseConnection(connection); }
};
     
     
 DogList.getOneList = async function(parcelID){ //게시글 상세조회
    try {
      var connection = await pool.getConnection();
      let query3 = 'select * from parcel where parcel_id = ?';
      let parcel = await connection.query(query3, parcelID);
      if(parcel.length==0) return {};

      let query1 = 'select image_id, image from pet_images where parcel_id = ?';
      let petImages = await connection.query(query1, parcelID);

      let query2 = 'select image_id, image from parent_pet_images where parcel_id = ?'
      let parentPetImages =  await connection.query(query2, parcelID);
      
      delete parcel[0].createdAt;
      delete parcel[0].updatedAt;
      let query4 = 'select username from users where user_id = ?';
      let username = await connection.query(query4, parcel[0].user_id);
      
      let query5 = 'select count(*) from favorites where parcel_id = ?'
      let favor = await connection.query(query5, parcelID);
      //TODO : parcel 유무 예외처리 필요
      parcel[0].username = username[0].username;
      parcel[0].parent_pet_images = parentPetImages;
      parcel[0].pet_images = petImages;
      parcel[0].favorite_number = favor[0]["count(*)"];
      return parcel[0];
    }
    catch(err) {
      throw err;
    }
    finally {
      pool.releaseConnection(connection);
    }
  }

DogList.completeParcel = async function(parcelID){ //분양완료 or 완료 취소하기
    try {
      var connection = await pool.getConnection();
      let query = 'select is_parceled from parcel where parcel_id = ?';
      let is_parceled = await connection.query(query, parcelID);

      let query2 = 'update parcel set is_parceled = ? where parcel_id = ?';
      let result;
      if(is_parceled[0].is_parceled==0) result = await connection.query(query2, [1, parcelID]);
      else result = await connection.query(query2, [0, parcelID]);
    }
    catch(err) {
      throw err;
    } 
    finally {
      pool.releaseConnection(connection);
    }
};



module.exports = DogList;
