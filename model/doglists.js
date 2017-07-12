
const pool = require('../config/db_pool');
const sequelize = require('sequelize');
const User  = require('../config/ORM').User;
const Parcel = require('../config/ORM').Parcel;
const Favorites = require('../config/ORM').Favorites;
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
                const imageUrl = s3.endpoint.href + params.Bucket + '/' + itemKey;
                fs.unlinkSync(path);
                resolve(imageUrl);

            }
        })
    })
};

// 펫 이미지 개수 확인하는 함수 
DogList.checkImages = async function (id) {
    let connection;
    try {
        connection = await pool.getConnection();

        // TODO: 사진 개수 확인, 썸네일 만들기
        let query = 'select count(parcel_id) as count from pet_images where parcel_id = ? ';
        let imageNum = await connection.query(query, id);

        let count = imageNum[0].count;
        return count;

    } catch (err) {
        console.log(err);
        throw err;
    } finally {
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
        if (thumbnailInfo && thumbnailInfo.length > 0) {

            let thumbnailFileName = 'thumbnail_' + thumbnailInfo[0].key;
            let thumbnailPath = 'thumbnail/' + thumbnailFileName;

            try {
                let thumbnail = await easyimage.rescrop({
                    name: thumbnailFileName,
                    src: thumbnailInfo[0].location,
                    dst: thumbnailPath,
                    width: 400, height: 300
                });

                let petThumbnail = await DogList.uploadToS3(thumbnailFileName, thumbnailPath);

                // 썸네일도 레코드에 추가
                parcelRecord.pet_thumbnail = petThumbnail;
                console.log('Thumnail success');
            } catch (err) {
                console.log('err: thumbnail err', petRecord[0].image);
                parcelRecord.pet_thumbnail = petRecord[0].image;
            }
        }

        // 분양글 항목 저장
        let query1 = 'INSERT INTO parcel SET ? ';
        let parcelOutput = await connection.query(query1, parcelRecord);
        let outputId = parcelOutput.insertId; //분양글 저장 -> 분양글 id가 parcel_id에 저장
        parcelRecord.parcel_id = outputId;
        data = parcelRecord;
        console.log('parcel success');

        // username return 하기 위해
        let userId = parcelRecord.user_id;
        let query = 'SELECT username FROM users WHERE user_id = ? ';
        let users = await connection.query(query, userId);
        if (users && users.length > 0) {
            data.username = users[0].username;
        }


        // 부모견 이미지 저장
        data.parent = [];
        if (parentRecord && parentRecord.length > 0) {
            for (let parent of parentRecord) {
                parent.parcel_id = outputId;
                let query2 = 'INSERT INTO parent_pet_images SET ? ';
                let parentOutput = await connection.query(query2, parent);

                parent.image_id = parentOutput.insertId;
                data.parent.push({ 'image_id': parent.image_id, 'image': parent.image });
            }
        }
        console.log('parent success');

        // 펫 이미지 저장 
        data.pet = [];
        if (petRecord && petRecord.length > 0) {
            for (let pet of petRecord) {
                pet.parcel_id = outputId;

                // 모든 펫이미지 썸네일 만들어 주기 
                let thumbnailFileName = 'thumbnail_' + pet.image_key;
                let thumbnailPath = 'thumbnail/' + thumbnailFileName;

                try {
                    let thumbnail = await easyimage.rescrop({
                        name: thumbnailFileName,
                        src: pet.image,
                        dst: thumbnailPath,
                        width: 400, height: 300
                    });

                    let petThumbnail = await DogList.uploadToS3(thumbnailFileName, thumbnailPath);

                    pet.thumbnail = petThumbnail;
                    pet.thumbnail_key = thumbnailFileName;
                    console.log('pet thumbnail success');
                } catch (err) {
                    //썸네일 만들어지지 않으면 원본으로..
                    console.log('Thumbnail error', pet.image);
                    pet.thumbnail = pet.image;
                    pet.thumbnail_key = thumbnailFileName;
                }

                let query3 = 'INSERT INTO pet_images SET ? ';

                let petOutput = await connection.query(query3, pet);
                pet.image_id = petOutput.insertId;
                data.pet.push({ 'image_id': pet.image_id, 'image': pet.image });
            }
        }
        console.log('pet success');

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
DogList.updateParcel = async(user, changeId, record, removedPet, removedParent, newPet, newParent, newLineage) => {
    var connection;
    var data = {}; //응답 records, 객체 형태로 반환 
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        let checkQuery = 'select * from parcel where parcel_id = ?';
        let count = await connection.query(checkQuery, changeId);
        if(count.length===0) return -1;

        // 삭제할 펫 이미지 아이디가 있다면 
        if (removedPet>0) {
            //s3에 기존 펫 이미지 삭제
            let query1 = 'select image_key, thumbnail_key from pet_images where parcel_id = ? and image_id = ? ;';
            let petImage = await connection.query(query1, [changeId, removedPet]);
            if(petImage.length===0) return -1;
            await DogList.deleteInS3(petImage[0].image_key);
            await DogList.deleteInS3(petImage[0].thumbnail_key);
            let query2 = 'delete from pet_images where parcel_id = ? and image_id = ?';
            let deleteResult = await connection.query(query2, [changeId, removedPet]);
            console.log('s3에서 펫 이미지 삭제');
            //새로운 펫 이미지 썸네일 만들어 주기 
            let thumbnailFileName = 'thumbnail_' + newPet.key;
            let thumbnailPath = 'thumbnail/' + thumbnailFileName;
            let thumbnail = await easyimage.rescrop({
                name: thumbnailFileName,
                src: newPet.location,
                dst: thumbnailPath,
                width: 300, height: 400
            });

            //s3에 새로 만든 썸네일 업로드
            let petThumbnail = await DogList.uploadToS3(thumbnailFileName, thumbnailPath);
            let pet_record = {
                thumbnail: petThumbnail,
                thumbnail_key: thumbnailFileName,
                image: newPet.location,
                image_key: newPet.key,
                parcel_id: changeId
            };

            //pet_image 테이블에 원본이미지, 썸네일 넣기
            let query3 = 'insert into pet_images set ?';
            let insertedPet = await connection.query(query3, pet_record);
            console.log('new pet image upload success');
            let pet = {};
            pet.image_id = insertedPet.insertId;
            pet.image = newPet.location;
            data.pet = pet;
        }
         // 삭제할 부모견 사진 아이디가 있다면
        if (removedParent>0) {
           //기존의 부모견 이미지 삭제   
            let query6 = 'select image_key from parent_pet_images where parcel_id = ? and image_id = ?';
            let parentImage = await connection.query(query6, [changeId, removedParent]);
    
            // s3 삭제
            await DogList.deleteInS3(parentImage[0].image_key);
            let query7 = 'delete from parent_pet_images where parcel_id = ? and image_id = ?';
            let deleteParent = await connection.query(query7, [changeId, removedParent]);

            //s3에 새 부모견 이미지 업로드
            let parent_record = {
                image: newParent.location,
                image_key: newParent.key,
                parcel_id: changeId
            };

            //parent_pet_images에 새 부모견 이미지 넣기
            let parent = {};
            let query8 = 'insert into parent_pet_images set ?';
            let insertedParent = await connection.query(query8, parent_record);
            parent.image_id = insertedParent.insertId;
            parent.image = newParent.location;
            data.parent = parent;
        }
        

        //pet_image에 있는 썸네일 주소를 가져와서 parcel에 업데이트(다른 수정된 정보 포함)
        let selectThumb = 'select thumbnail from pet_images where image_id = ?';
        let thumb = await connection.query(selectThumb, insertedPet.insertId);
        let query5 = 'UPDATE parcel SET ? WHERE parcel_id = ?';
        let addedRecord = record; //테이블 insert용 레코드
        if(newLineage) addedRecord.lineage = newLineage.location;
           
        addedRecord.pet_thumbnail = thumb[0].thumbnail;
        await connection.query(query5, [addedRecord, changeId]);
        
        for(let i in addedRecord)
            data[i] = addedRecord[i];

        // username 반환 
        let user_query = 'select username FROM users where user_id = ?';
        let users = await connection.query(user_query, user);
        if (users && users.length > 0) {
            data.username = users[0].username;
        }

        connection.commit();
        return data;
    } catch (err) {
        await connection.rollback();
        console.log(err);
        throw err;
    } finally {
        pool.releaseConnection(connection);
    }
};


// 분양글 삭제하기 
DogList.deleteParcel = async function (id, user_id) {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        // 펫 이미지, 썸네일 key
        let query1 = 'select image_key, thumbnail_key from pet_images where parcel_id = ? ';
        let petImage = await connection.query(query1, id);

        // s3 삭제
        if (petImage && petImage.length > 0) {
            for (let pet of petImage) {
                try {
                    await DogList.deleteInS3(pet.image_key);
                    await DogList.deleteInS3(pet.thumbnail_key);
                    console.log('pet image s3 delete success');
                } catch (err) {
                    console.log('error : pet image s3 delete fail', pet.image_key, pet.thumbnail_key);
                }
            }
        }

        // 혈통서 삭제 from s3     
        let query2 = 'select lineage from parcel where parcel_id = ? ';
        let lineageImage = await connection.query(query2, id);
        // null일 때 length = 1
        if (lineageImage[0] && lineageImage[0].length > 0) {
            let url = lineageImage[0].lineage.split('/');
            try {
                await DogList.deleteInS3(url[url.length - 1]);
                console.log('lineage s3 delete success');
            } catch (err) {
                console.log('error: lineage s3 delete error');
            }
        }

        // 부모견 키
        let query3 = 'select image_key from parent_pet_images where parcel_id = ? ';
        let parentImage = await connection.query(query3, id);
        // 부모견 삭제 from s3
        if (parentImage && parentImage.length > 0) {
            for (let parent of parentImage) {
                try {
                    await DogList.deleteInS3(parent.image_key);
                    console.log('parent s3 delete success');
                } catch (err) {
                    console.log('error : parent s3 delete error');
                }
            }
        }
        // 레코드 삭제
        let query4 = 'DELETE FROM parcel WHERE parcel_id = ? and user_id = ?';
        let deleteRecord = await connection.query(query4, [id, user_id]);
        console.log('delete success');
        await connection.commit();
        return deleteRecord;
    } catch (err) {
        console.log(err);
        await connection.rollback();
        throw err;
    } finally {
        pool.releaseConnection(connection);
    }
};

DogList.getMyList  = async function(user_id){
    try {
        let array = [];
        let ret = await Parcel.findAll({
            attributes: ['parcel_id','title', 'pet_thumbnail'],
            where: {user_id: user_id}
        });
        for(let i = ret.length-1; i>-1; i--) array.push({
            title: ret[i].dataValues.title,
            pet_thumbnail: ret[i].dataValues.pet_thumbnail,
            parcel_id: ret[i].dataValues.parcel_id
        });
        return array;
    }
    catch(err) {
        console.log(err);
        throw err;
    }


};
DogList.getLists = async function (user_id, keywords, page) { //전체목록 조회하기
    try {
        const total = await Parcel.count({ //조화한 결과 총 개수 
                where: keywords
        });

        const start = Math.min( ( (page-1) * 10) , total );
        const end = Math.min( page * 10, total );

        const posts = await Parcel.findAndCountAll({ //offset & limit으로 page애 해당하는 분양글 find
                attributes: ['parcel_id', 'title', 'pet_thumbnail'],
                include: [{
                    model: User,
                    where: { state: sequelize.col('parcel.user_id') }
                }],
                where: keywords, 
                order: sequelize.literal('parcel_id desc'),
                offset: start,
                limit: end - start 
        });
        const count = (end==start) ? 0 : posts.rows.length;
        const next = (end<total-1)? true: false; //다음 페이지 유무 여부

        let favorites = await Favorites.findAll({ //현재 사용자가 찜한 분양글 id 가져오기(dataValues배열)
            attributes: ['parcel_id'],
            where: {user_id: user_id}
        });
        
        let post_array = [];
        for(let i = 0; i<end-start; i++) { 
            let post = posts.rows[i].dataValues;
            post.username = post.user.username; //사용자이름 뽑아오기
            post.favorite = 0; //기본적으로 찜 여부는 0
            delete post.user;
            for(let j = 0; j<favorites.length; j++){
                if(post.parcel_id==favorites[j].dataValues.parcel_id) { //쿼리에 user_id가 없으면 0으로 유지됨.
                    post.favorite = 1;
                    break;
                }
            }
            post_array.push(post);
        }
        
        let result = {
            page: parseInt(page),
            post_count: count,
            has_next: next,
            result: post_array
        };
        return result;
     } 
     catch(err){ console.log(err); throw err; }
       
};

DogList.getEmergencyLists = async function(user_id) { //메인화면 가로에 들어갈 분양 가장 시급한 글 6개 조회
    try {
        let urgent_array = [];
        let posts = await Parcel.findAll({ //dataValues배열
                attributes: ['parcel_id', 'title', 'pet_thumbnail'],
                where: {is_parceled: false},
                include: [{
                            model: User,
                            where: { state: sequelize.col('parcel.user_id') }
                }],
                order: sequelize.literal('parcel_id'),
                limit: 6
        });
        let favorites = await Favorites.findAll({ //현재 사용자가 찜한 분양글 id 가져오기(dataValues배열)
            attributes: ['parcel_id'],
            where: {user_id: user_id}
        });

        for(let i = 0; i<posts.length; i++) { 
            let post = posts[i].dataValues;
            post.username = post.user.username; //사용자이름 뽑아오기
            post.favorite = 0; //기본적으로 찜 여부는 0
            delete post.user;
            for(let j = 0; j<favorites.length; j++){
                if(post.parcel_id==favorites[j].dataValues.parcel_id) { //쿼리에 user_id가 없으면 0으로 유지됨.
                    post.favorite = 1;
                    break;
                }
            }
            urgent_array.push(post);
        }
    
        return urgent_array;
    } catch (err) { console.log(err); throw err; }

};
     
     

DogList.getOneList = async function(parcelID){ //게시글 상세조회
    try {
      var connection = await pool.getConnection();
      let query3 = 'select * from parcel where parcel_id = ?';
      let parcel = await connection.query(query3, parcelID);
      if(parcel.length==0) return 0;
      else {
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
        parcel[0].username = username[0].username;
        parcel[0].parent_pet_images = parentPetImages;
        parcel[0].pet_images = petImages;
        parcel[0].favorite_number = favor[0]["count(*)"];
        return parcel[0];
      }

    }
    catch(err) {
        console.log(err);
        throw err;
    }
    finally {
        pool.releaseConnection(connection);
    }
  };

DogList.completeParcel = async function (parcelID, user_id) { //분양완료 or 완료 취소하기
    try {
      var connection = await pool.getConnection();
      let query = 'select is_parceled from parcel where parcel_id = ? and user_id = ?';
      let is_parceled = await connection.query(query, [parcelID, user_id]);
      if(is_parceled.length==0) return 0;
      else {
        let query2 = 'update parcel set is_parceled = ? where parcel_id = ? and user_id = ?';
        if(is_parceled[0].is_parceled===0){
            await connection.query(query2, [1, parcelID, user_id]);
            return 1;
        } 
        else {
            await connection.query(query2, [0, parcelID, user_id]);
            return 2;
        }
      }
    }
    finally {
        pool.releaseConnection(connection);
    }
};

DogList.reportParcel = async function (repo_id, parcel_id, content) {
    try {
        var connection = await pool.getConnection();
        let query1 = 'insert into report set ? ';
        let record = {
            reporter_id: repo_id,
            parcel_id: parcel_id,
            content: content
        };
        let report = await connection.query(query1, record);
        return report.insertId;

    } catch (err) {
        console.log(err);
        throw err;

    } finally {
        pool.releaseConnection(connection);

    }
}

module.exports = DogList;

