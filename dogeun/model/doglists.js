const pool = require('../config/db_pool');
const aws = require('../config/AWS');
const upload = aws.getUpload();
class DogList {}

DogList.postParcels = async function (parcelRecord, parentRecord, petRecord) {
    let connection;
    try {
        connection = await pool.getConnection();

        await connection.beginTransaction();

        let query1 = 'INSERT INTO parcel SET ? ';
        let parcelOutput = await connection.query(query1, parcelRecord); //분양글 저장 -> 분양글 id가 parcel_id에 저장
        let outputId = parcelOutput.insertId;
        parcelRecord.parcel_id = outputId;
        
        for (let parent of parent_record) {
            parent.parcel_id = outputId;
            let query2 = 'INSERT INTO parent_pet_images SET ? ';
            await connection.query(query2, parent);

        }

        for (let pet of pet_record) {
            pet.parcel_id = outputId;
            let query3 = 'INSERT INTO pet_images SET ? ';
            await connection.query(query3, pet);
        }

        //commit
        await connection.commit();

        return parcelOutput;

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

DogList.updateParcels = async function (id, parcel_record) {
    let connection;
    try {
        connection = await pool.getConnection();

        await connection.beginTransaction();

        let query1 = 'UPDATE parcel SET ? WHERE parcel_id = ?';
        let parcel_output = await connection.query(query1,[parcel_record, id]);
        console.log(parcel_output);

        // let query2 = 'UPDATE parent_pet_images SET ? WHERE parcel_id = ?';
        // let pa_output = await connection.query(query2, parent_record, id);

        // let query3 = 'UPDATE pet_images SET ? WHERE parcel_id = ? ';
        // let complete = await conncetion.query(query3, pet_record, id);

        await conncetion.commit();

        return parcel_output;
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





DogList.deleteParcles = async function (id) {
    let connection;
    try {
        connection = await pool.getConnection();

        let query = 'DELETE FROM parcel WHERE parcel_id = ?';
        let result = await connection.query(query, id);

        return result;
    } catch (err) {
        console.log(err);
        throw err;
    } finally {
        pool.releaseConnection(connection);
    }
};

DogList.getWhere = function(qs){
    let where = '', param_array=[];
    for(let i in qs){
      if(i=='page') continue;
      param_array.push(parseInt(qs[i]));
      where += ' and p.'+i+ ' = ? ';
    }
    return {where: where, param_array: param_array};
}


 DogList.getLists = async function(qs){
     try { 
           var connection = await pool.getConnection();
           let query = `select p.parcel_id, p.title, p.pet_thumbnail, u.username, 
           (select 1 from favorites as f where p.parcel_id=f.parcel_id and f.user_id = ?) 
           as favorite from parcel as p, users as u where u.user_id = p.user_id`;
           let data;
           if(Object.keys(qs).length>1) { //검색한 경우 쿼리스트링 길이는 1보다 길다.
              let where = this.getWhere(qs).where; //검색어 쿼리스트링으로 조건절 만들어서 가져오기
              let param_array = this.getWhere(qs).param_array; //placeholder에 들어갈 배열 가져오기
              param_array.unshift(1); //placeholder에 들어갈 user_id 앞에다 추가(가라로 추가함)
              data = await connection.query(query+where+' order by parcel_id desc;', param_array); //검색어로 쿼리 때리기. 
           }  //user_id는 현재 사용자 id. 토큰이냐 세션이냐 미정.
           else  data = await connection.query(query, 1); //전체 목록 쿼리 때리기   
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

 DogList.getEmergencyLists = async function(){
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
     
     
 DogList.getOneList = async function(parcelID){
    try {
      var connection = await pool.getConnection();
      let query1 = 'select image_id, image from pet_images where parcel_id = ?';
      let petImages = await connection.query(query1, parcelID);

      let query2 = 'select image_id, image from parent_pet_images where parcel_id = ?'
      let parentPetImages =  await connection.query(query2, parcelID);

      let query3 = 'select * from parcel where parcel_id = ?';
      let parcel = await connection.query(query3, parcelID);

      let query4 = 'select username from users where user_id = ?';
      let username = await connection.query(query4, parcel[0].user_id);
      
      let query5 = 'select count(*) from favorites where parcel_id = ?'
      let favor = await connection.query(query5, parcelID);

      let query6 = 'select kennel, corona, DHPPL from vaccination where parcel_id = ?';
      let vac = await connection.query(query6, parcelID);

      parcel[0].username = username[0].username;
      parcel[0].parent_pet_images = parentPetImages;
      parcel[0].pet_images = petImages;
      parcel[0].favorite_number = favor[0]["count(*)"];
      parcel[0].vaccination = vac[0];
      return parcel[0];

    }
    catch(err) {
      throw err;
    }
    finally {
      pool.releaseConnection(connection);
    }
  }

DogList.completeParcel = async function(parcelID){
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