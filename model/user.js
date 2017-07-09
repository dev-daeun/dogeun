const Sequelize = require('sequelize');
const pool = require('../config/db_pool');
const Sign = require('../config/ORM').Sign;
const AWS = require('../config/AWS');
const bcrypt = require('bcrypt-node');
const salt = bcrypt.genSaltSync(20)
class User{}

function hashAnything(info){
    return new Promise((fulfill, reject) => {
        bcrypt.hash(info, salt, null, (err, data) => {
            if(err) reject(err);
            else return data;
        });
    });
}

User.signup = async(email, password, checking_password) => {
    try{
        let dupEmail = await Sign.count({ 
            where: { email: email } 
        });
        if(dupEmail>0) return 'dupEmail';
        else if(password!==checking_password) return 'wrongPW';
        else {
            let hashed_email = await hashAnything(email);
            let hashed_pw = await hashAnything(password);
            await Sign.create({
                email: hashed_email,
                password: hashed_pw
            });
            return 'success';
        }
    }
    catch(err){
        console.log(err);
        throw err;   
    }
};


module.exports = User;
