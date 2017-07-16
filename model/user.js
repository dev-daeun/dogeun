const Sequelize = require('sequelize');
const pool = require('../config/db_pool');
const User = require('../config/ORM').User;
const AWS = require('../config/AWS');
const bcrypt = require('bcrypt-node');
const bcrypt2 = require('bcrypt');
const salt = bcrypt.genSaltSync(20);
var _id;
class Account{
}

Account.setUserId = (user_id) => {
    _id = user_id;
}

Account.getUserId = () => {
    return _id;
}

Account.signup = async(email, password, checking_password) => {
    try{
        let dupEmail = await User.count({ 
            where: { email: email } 
        });
        if(dupEmail>0) return 'dupEmail';
        else if(password!==checking_password) return 'wrongPW';
        else {
            let hashed_pw = bcrypt.hashSync(password);
            let ret = await User.create({
                email: email,
                password: hashed_pw
            });
            return ret.dataValues.insertId;
        }
    }
    catch(err){
        console.log(err);
        throw err;   
    }
};


Account.login = async(email, password) => {
    try {
            let emailExist = await User.count({
                where: { email: email }
            }); //이메일 있는지 확인

            if(emailExist===0) return 'noneEmail';
            else{
                let info = await User.findOne({
                    where: {email: email},
                    attributes: ['user_id','password']
                }); //비번 맞는지 확인
                let pwCorrect = bcrypt2.compareSync(password, info.dataValues.password);
                if(pwCorrect) return info.dataValues.user_id;
                else return 'wrongPW';     
            }
    }
    catch(err) {
        console.log(err);
        throw err;
    }
};


module.exports = Account;
