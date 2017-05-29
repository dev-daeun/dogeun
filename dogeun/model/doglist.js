const pool = require('../config/db_pool');
const aws = require('../config/AWS');
const upload = aws.getUpload();
class DogList {
}

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
           let query = 'select p.parcel_id, p.title, p.pet_thumbnail, u.username, (select 1 from favorites as f where p.parcel_id=f.parcel_id and f.user_id = ?) as favorite from parcel as p, users as u where u.user_id = p.user_id';
           let data;
           if(Object.keys(qs).length>1) { //검색한 경우 쿼리스트링 길이는 1보다 길다.
              let where = this.getWhere(qs).where; //검색어 쿼리스트링으로 조건절 만들어서 가져오기
              let param_array = this.getWhere(qs).param_array; //placeholder에 들어갈 배열 가져오기
              data = await connection.query(query+where+' order by parcel_id desc;', [2,param_array[0],param_array[1]]); //검색어로 쿼리 때리기. 
           }  //user_id는 현재 사용자 id. 토큰이냐 세션이냐 미정.
           else data = await connection.query(query, 2); //전체 목록 쿼리 때리기
           let start = Math.min(data.length-1, qs.page * 10);
           let end = Math.min(data.length-1, start + 9);
           let array = [];
           for(let i = start; i<=end; i++)array.push(data[i]);
           return { 
               total: data.length,
               results: array,
               paging: { 
                 page: parseInt(qs.page),
                 start: start,
                 end: end,
                 count: end-start+1
               }
           };
     } catch(err){ throw err; }
       finally { pool.releaseConnection(connection); }
};
     


module.exports = DogList;