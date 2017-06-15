const pool = require('../config/db_pool');
const aws = require('../config/AWS');
const upload = aws.getUpload();
const jwt = require('jsonwebtoken');
class Favor {}

Favor.getFavorites = async function(token_id){
    try {
        var connection = await pool.getConnection();
        let parcel_ids = await connection.query('select parcel_id from favorites where user_id = ? order by createdAt desc', token_id); //분양글 id 가져오기
        let parcels = [];
        let query = `select parcel_id, title, pet_thumbnail, username from parcel, users 
                     where users.user_id = parcel.user_id and parcel_id = ?`;
        for(let element of parcel_ids){
            let data = await connection.query(query, element.parcel_id); //가져온 분양글 id로 select
            data[0].favorite = 1; //찜 아이콘 나타내기 위한 favorite 키 추가
            parcels.push(data[0]); //배열에 하나씩 추가하기
        }
        return parcels;
    }
    catch(err) {
        console.log(err);
        throw err;
    }
    finally {
        pool.releaseConnection(connection);
    }
}

Favor.setFavorites = async function(parcel_id, user_id){
    try{
        var connection = await pool.getConnection();
        let query = 'select count(*) from favorites where parcel_id = ? and user_id = ?';
        let count = await connection.query(query, [parcel_id, user_id]);
        let result, query2;
        if(count[0]["count(*)"]>0) {
            query2 = 'delete from favorites where parcel_id = ? and user_id = ?'
            result = await connection.query(query2, [parcel_id, user_id]);
        }
        else {
            query2 = 'insert into favorites set ?';
            result = await connection.query(query2, {parcel_id: parcel_id, user_id: user_id});
        }
        return result;
    }
    catch(err){
        console.log(err);
        throw err;
    }
    finally{
        pool.releaseConnection(connection);
    }
};

module.exports = Favor;

