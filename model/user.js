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

function compareHash(info, hash){
    return new Promise((fulfill, reject) => {
       bcrypt.compare(info, hash, (err, result)=>{
            if(err) reject(err);
            else return result;
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


User.login = async(email, password) => {
    try {
            let emailExist = await User.count({
                where: { email: req.body.email }
            }); //이메일 있는지 확인

            if(emailExist===0) return 'noneEmail';
            else{
                let info = await User.findOne({
                    where: {email: req.body.email},
                    attributes: ['id','password']
                }); //비번 맞는지 확인
                let pwCorrect = await bcrypt.compareHash(req.body.password, info.dataValues.password);
                if(!pwCorrect) return 'wrongPW';
                else return info.dataValues.id; 
                
            }
    }
    catch(err) {
        console.log(err);
    }
};


module.exports = User;
