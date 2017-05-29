// 1. pool.getConnection
// 2. connection.beginTransaction
// 3. connection.query & connection.query & conncetion.commit all the same time

var pool = require('./db_pool');
class Parcels {
}


Parcels.postParcels = async function (record1, record2, record3) {
    let connection;
    try {
        connection = await pool.getConnection();

        await connection.beginTransaction();

        let query1 = 'insert into parcel set ? ';
        let parcel_output = await connection.query(query1, record1); //분양글 저장 -> 분양글 id가 parcel_id에 저장
        let parcel_id_out = parcel_output.insertId;

        for (let i in record2) {
            record2[i].parcel_id = parcel_id_out;
        }

        for (let i in record3) {
            record3[i].parcel_id = parcel_id_out;
        }

        let query2 = 'insert into parent_pet_images set ? ';
        await connection.query(query2, record2);

        let query3 = 'INSERT INTO pet_images set ? ';
        let complete = await connection.query(query3, record3);


        //commit
        await connection.commit();

        return complete;


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

Parcels.updateParcels = async function (id, record1, record2, record3) {
    let connection;
    try {
        connection = await pool.getConnection();

        await connection.beginTransaction();

        let query1 = 'UPDATE parcel SET ? WHERE parcel_id = ? ';
        let parcel_output = await connection.query(query1, record1, id);
        console.log(id);

        // let query2 = 'UPDATE parent_pet_images SET ? WHERE parcel_id = ?';
        // let pa_output = await connection.query(query2, record2, id);

        // let query3 = 'UPDATE pet_images SET ? WHERE parcel_id = ? ';
        // let complete = await conncetion.query(query3, record3, id);

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

        let query = 'DELETE FROM parcels WHERE parcel = ?';
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