// 1. pool.getConnection
// 2. connection.beginTransaction
// 3. connection.query & connection.query & conncetion.commit all the same time

var pool = require('./db_pool');
class Parcels {
}

Parcels.searchImage = async function (id,kinds) {
    let connection;
    let result;
    try {
        connection = await pool.getConnection();
        if(kinds == 'pet'){
        let query1 = 'SELECT parcel_id, image, image_id FROM pet_images WHERE parcel_id =?';
        result = await connection.query(query1, id);
    }
    else if(kinds == 'parent'){
        let query2 = 'SELECT parcel_id, image, image_id FROM parent_pet_images WHERE parcel_id = ?';
        result = await connection.query(query2,id);
    }
    else if(kinds == 'parcel'){
        let query3 = 'SELECT pet_thumbnail,lineage FROM parcel WHERE parcel_id = ?';
        result = await connection.query(query3,id);
    }
   

        await connection.commit();
        
        return result;

    } catch (err) {
        console.log(err);
        throw err;
    } finally {
        pool.releaseConnection(connection);
    }


}


Parcels.postParcels = async function (parcel_record, parent_record, pet_record) {
    let connection;
    try {
        connection = await pool.getConnection();

        await connection.beginTransaction();

        let query1 = 'INSERT INTO parcel SET ? ';
        let parcel_output = await connection.query(query1, parcel_record); //분양글 저장 -> 분양글 id가 parcel_id에 저장
        let parcel_id_out = parcel_output.insertId;

  
       
        for (let parent of parent_record) {
            parent.parcel_id = parcel_id_out;
            let query2 = 'INSERT INTO parent_pet_images SET ? ';
            await connection.query(query2, parent);
            
        }

        for (let pet of pet_record) {
            pet.parcel_id = parcel_id_out;
            let query3 = 'INSERT INTO pet_images SET ? ';
            await connection.query(query3, pet);
        }


        //commit
        await connection.commit();

        return parcel_output;


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

Parcels.updateParcels = async function (id, parcel_record, parent_record, pet_record) {
    let connection;
    try {
        connection = await pool.getConnection();

        await connection.beginTransaction();

        let query1 = 'UPDATE parcel SET ? WHERE parcel_id = ? ';
        let parcel_output = await connection.query(query1, parcel_record, id);
        console.log(id);

        // let query2 = 'UPDATE parent_pet_images SET ? WHERE parcel_id = ?';
        // let pa_output = await connection.query(query2, parent_record, id);

        // let query3 = 'UPDATE pet_images SET ? WHERE parcel_id = ? ';
        // let complete = await conncetion.query(query3, pet_record, id);

        await conncetion.commit();

        return complete;
    } catch (err) {
        try {
            await connection.rollback();
            console.log(err);
        } catch (err) {
            console.log(err);
        }
        throw err;
    }finally{
        pool.releaseConnection();
    }
};



Parcels.deleteParcles = async function (id) {
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

module.exports = Parcels;