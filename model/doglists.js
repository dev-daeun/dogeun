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
DogList.updateParcels = async function (changeId, userId, removePet, petRecord, parcelRecord, removeParent, parentRecord) {
    let connection;
    let data = {}; //응답 records, 객체 형태로 반환 
    try {
        connection = await pool.getConnection();

        // 삭제할 펫 이미지 아이디가 있다면 
        if (removePet && removePet.length > 0) {
            // 삭제할 펫 이미지 아이디가 객체라면 (여러 개)
            if (removePet instanceof Array) {
                for (let item of removePet) {
                    // s3 삭제를 위해 url
                    let query1 = 'select image_key, thumbnail_key from pet_images where parcel_id = ? and image_id = ? ;';
                    let petImage = await connection.query(query1, [changeId, item]);
                    try {
                        await DogList.deleteInS3(petImage[0].image_key);
                        await DogList.deleteInS3(petImage[0].thumbnail_key);
                        console.log('pet image array s3 delete success');
                    } catch (err) {
                        console.log('error : pet image array s3 delete fail');
                    }
                    let query2 = 'delete from pet_images where parcel_id = ? and image_id = ?';
                    let deleteResult = await connection.query(query2, [changeId, item]);
                }
            } else { //삭제할 아이디 1개 라면
                let queryOne = 'select image_key, thumbnail_key from pet_images where parcel_id = ? and image_id = ? ;';
                let petImageOne = await connection.query(queryOne, [changeId, removePet]);
                try {
                    await DogList.deleteInS3(petImageOne[0].image_key);
                    await DogList.deleteInS3(petImageOne[0].thumbnail_key);
                    console.log('pet image s3 delete success');
                } catch (err) {
                    console.log('error : pet image s3 delete fail');
                }
                let queryTwo = 'delete from pet_images where parcel_id = ? and image_id = ?';
                let deleteResultTwo = await connection.query(queryTwo, [changeId, removePet]);
            }
        }
        console.log('delete pet success');


        data.pet = [];
        // 기존 분양글에 있었던 pet_images
        let petQuery = 'select image_id, image from pet_images where parcel_id = ?';
        let originalPet = await connection.query(petQuery, changeId);

        if (originalPet && originalPet.length > 0) {
            for (let pet of originalPet) {
                data.pet.push({ 'image_id': pet.image_id, 'image': pet.image });
            }
        }


        // 새로 추가할 펫 이미지가 있다면
        if (petRecord && petRecord.length > 0) {

            for (let pet of petRecord) {
                // 모든 펫이미지 썸네일 만들어 주기 
                let thumbnailFileName = 'thumbnail_' + pet.image_key;
                let thumbnailPath = 'thumbnail/' + thumbnailFileName;

                try {
                    let thumbnail = await easyimage.rescrop({
                        name: thumbnailFileName,
                        src: pet.image,
                        dst: thumbnailPath,
                        width: 300, height: 400
                    });

                    let petThumbnail = await DogList.uploadToS3(thumbnailFileName, thumbnailPath);
                    pet.thumbnail = petThumbnail;
                    pet.thumbnail_key = thumbnailFileName;
                    console.log('new pet thumbnail success');
                } catch (err) {
                    console.log('new pet thumbnail fail :', pet.image);
                    pet.thumbnail = pet.image;
                    pet.thumbnail_key = thumbnailFileName;
                }

                let query3 = 'insert into pet_images set ?';
                let newPet = await connection.query(query3, pet);
                pet.image_id = newPet.insertId;
                data.pet.push({ 'image_id': pet.image_id, 'image': pet.image });
                console.log('new pet image upload success');
            }
        }

        // 대표 썸네일 만들기 
        //let parcelId = parcelRecord.parcel_id;
        let query = 'select thumbnail from pet_images where image_id = ( select min(image_id) from pet_images where parcel_id = ? )';
        let thumbnailURL = await connection.query(query, changeId);
        parcelRecord.pet_thumbnail = thumbnailURL.thumbnail;
        console.log('thumbnail update success');

        // 분양글 항목 업데이트
        let query5 = 'UPDATE parcel SET ? WHERE parcel_id = ?';
        let parcelOutput = await connection.query(query5, [parcelRecord, changeId]);

        for (let item in parcelRecord) {
            data[item] = parcelRecord[item];
        }

        console.log('parcel update success');

        // username 반환 
        let user_query = 'select username FROM users where user_id = ?';
        let users = await connection.query(user_query, userId);
        if (users && users.length > 0) {
            data.username = users[0].username;
        }

        // 삭제할 부모견 사진 아이디가 있다면
        if (removeParent && removeParent.length > 0) {
            // 삭제할 부모견 이미지 아이디가 여러 개면 
            if (removeParent instanceof Array) {
                for (let item of removeParent) {
                    // s3 삭제를 위해, url
                    let query6 = 'select image_key from parent_pet_images where parcel_id = ? and image_id = ?';
                    let parentImage = await connection.query(query6, [changeId, item]);

                    try {
                        // s3 삭제
                        await DogList.deleteInS3(parentImage[0].image_key);
                        console.log('parent image s3 array delete success');
                        // 부모견 이미지 삭제
                    } catch (err) {
                        console.log('error : parent image array s3 delete fail', parentImage[0].image_key);
                    }
                    let query7 = 'delete from parent_pet_images where parcel_id = ? and image_id = ?';
                    let deleteParent = await connection.query(query7, [changeId, item]);
                }
            } else {
                // s3 삭제를 위해, url
                let querySix = 'select image_key from parent_pet_images where parcel_id = ? and image_id = ?';
                let parentImage = await connection.query(query6, [changeId, removeParent]);

                try {
                    // s3 삭제
                    await DogList.deleteInS3(parentImage[0].image_key);
                    console.log('parent image s3 delete success');

                    let query7 = 'delete from parent_pet_images where parcel_id = ? and image_id = ?';
                    let deleteParent = await connection.query(query7, [changeId, removeParent]);
                    // 부모견 이미지 삭제
                } catch (err) {
                    console.log('error : parent image s3 delete fail', parentImage[0].image_key);
                }
                let query7 = 'delete from parent_pet_images where parcel_id = ? and image_id = ?';
                let deleteParent = await connection.query(query7, [changeId, removeParent]);
            }
        }
        console.log('delete parent success');

        data.parent = [];

        // 기존의 부모견 사진이 있다면
        let parentQuery = 'select image_id, image from parent_pet_images where parcel_id = ? ';
        let originalParent = await connection.query(parentQuery, changeId);

        if (originalParent && originalParent.length > 0) {
            for (let parent of originalParent) {
                data.parent.push({ 'image_id': parent.image_id, 'image': parent.image });
            }
        }

        // 새로운 부모견 사진이 있다면
        if (parentRecord && parentRecord.length > 0) {

            for (let parent of parentRecord) {
                let query8 = 'insert into parent_pet_images set ?';
                let newParent = await connection.query(query8, parent);
                parent.image_id = newParent.insertId;
                data.parent.push({ 'image_id': parent.image_id, 'image': parent.image });
            }
        }

        console.log('new parent success');
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
                console.log('error: lineage s3 delete error', url[url.length - 1]);
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
        let query4 = 'DELETE FROM parcel WHERE parcel_id = ?';
        let deleteRecord = await connection.query(query4, id);
        console.log('delete success');

        return deleteRecord;
    } catch (err) {
        console.log(err);
        throw err;
    } finally {
        pool.releaseConnection(connection);
    }
};


DogList.getWhere = function (qs) { //검색조회에 필요한 쿼리 만드는 함수
    let where = '', param_array = [];
    for (let i in qs) {
        if (i == 'page') continue;
        else if (qs[i]) {
            console.log(qs[i]);
            param_array.push(qs[i]);
            where += ' and p.' + i + ' = ? ';
        }

    }
    return { where: where, param_array: param_array };
};


DogList.getLists = async function (qs) { //전체목록 조회하기
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

DogList.getEmergencyLists = async function () { //메인화면 가로에 들어갈 분양 가장 시급한 글 6개 조회
    try {
        var connection = await pool.getConnection();
        let query = `select p.parcel_id, p.title, p.pet_thumbnail, u.username, 
           (select 1 from favorites as f where p.parcel_id=f.parcel_id and f.user_id = ?) 
           as favorite from parcel as p, users as u where u.user_id = p.user_id and p.is_parceled = 0 order by p.parcel_id limit 6`;
        let data = await connection.query(query, 2); //전체 목록 쿼리 때리기
        return data;
    } catch (err) { throw err; }
    finally { pool.releaseConnection(connection); }
};
     
     
DogList.getMyList = async function(user_id){
	let query = 'select parcel_id, title, pet_thumbnail from parcel where user_id = ? order by parcel_id desc';
	try{
		var connection = await pool.getConnection();
		let data = await connection.query(query, user_id);
		return data;
		
	}
	catch(err){
		throw err;
	}
	finally{
		pool.releaseConnection(connection);
	}

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

DogList.completeParcel = async function (parcelID) { //분양완료 or 완료 취소하기
    try {
      var connection = await pool.getConnection();
      let query = 'select is_parceled from parcel where parcel_id = ?';
      let is_parceled = await connection.query(query, parcelID);
      if(is_parceled.length==0) return 0;
      else {
        let query2 = 'update parcel set is_parceled = ? where parcel_id = ?';
        let result;
        if(is_parceled[0].is_parceled==0) result = await connection.query(query2, [1, parcelID]);
        else result = await connection.query(query2, [0, parcelID]);
      }
    }
    finally {
        pool.releaseConnection(connection);
    }
};

DogList.reportParcel = async function (record) {
    let data;
    let connection;
    try {
        connection = await pool.getConnection();
        let query1 = 'insert into report set ? ';
        let report = await connection.query(query1, record);

        data = report.report_id;
        return data;

    } catch (err) {
        console.log(err);
        throw err;

    } finally {
        pool.releaseConnection(connection);

    }
}

module.exports = DogList;
