const pool = require('../config/db_pool');
const aws = require('../config/AWS');
const upload = aws.getUpload();

class Favorites {}

Favorites.getFavorites = async function(){
    try {
        var connection = await pool.getConnection();
        let query = 'select '
    }
    catch {
        
    }
    finally {

    }
}

Favorites.setFavorites = async function(){

}