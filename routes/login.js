const express = require('express');
const router = express.Router();

const pool = require('../config/db_pool.js');
const passport = require('passport');
const KakaoStratey = require('passport-kakao').Strategy;
const secret_config = require('../config/federation');

const jwt = require('jsonwebtoken');

/* 로그인 성공시 사용자 정보를 Session에 저장한다. */
passport.serializeUser(function(user,done){
    console.log('serialize user',user);
    done(null, user);
});

/* 인증 후, 페이지 접근시 마다 사용자 정보를 Session에서 읽어옴. */
passport.deserializeUser(function(user, done){
    console.log('deserailize user',user);
    done(null,user);
});

/* 로그인 유저 판단 로직 */
const isAuthenticated = function(req,res,next){
    if(req.isAuthenticated())
        return next();
    res.redirect('/login');
};


/**
 * 1. 중복성 검사
 * 2. 신규 유저
 *  2.1 신규 유저 가입 시키기
 * 3. 올드 유저
 *  3.1 바로 로그인 처리
 */

async function loginByThirdparty(info, done) {
    console.log('process : ' + info.auth_type);
    let connection;
    try {
        connection = await pool.getConnection();
        let duplicated_query = 'select * from users where user_id = ? ';
        let users = await connection.query(duplicated_query, info.auth_id);

        // 신규 유저 가입  
        if (users.length == 0) {
            console.log('new User');
            let thrdparty_signup = 'insert into users set user_id = ?, username = ?, profile_image = ?, profile_thumbnail = ? ';
            let newUsers = await connection.query(thrdparty_signup, [info.auth_id, info.auth_name, info.auth_profile_image, info.auth_thumbnail_image]);

            done(null, {
                'user_id': info.auth_id,
                'username': info.auth_name
            });

        } else {
            console.log('Old User');
            done(null, {
                'user_id': users[0].user_id,
                'username': users[0].username
            });
        }
    } catch (err) {
        console.log('login error'+err);
        throw err;
    } finally {
        pool.releaseConnection(connection);
    }

};

passport.use(new KakaoStratey({
    clientID: secret_config.federation.kakao.client_id,
    callbackURL: secret_config.federation.kakao.callback_url
},
function(accessToken, refreshToken, profile, done){
    let _profile = profile._json;
    console.log(profile);
    loginByThirdparty({
        'auth_type' : 'kakao',
        'auth_id': _profile.id,
        'auth_name': _profile.properties.nickname,
        'auth_profile_image' : _profile.properties.profile_image,
        'auth_thumbnail_image' : _profile.properties.thumbnail_image
    }, done);
}
));

router.get('/auth/login/kakao',
    passport.authenticate('kakao')
);

router.get('/auth/login/kakao/callback',
    passport.authenticate('kakao',{
        successRedirect : 'http://localhost:3000',
        failureRedirect : '/'
}));

router.get('/',function(req,res){
    res.sendFile(__dirname+'/login.html');
});

router.post('/', async function(req, res){
    try {
            let option = {
                algorithm: 'HS256',
                expiresIn: 60 * 60 * 365
            };
            let payload = {
                user_id: req.body.kakao_id 
            };
            let token = jwt.sign(payload, req.app.get('secret-key'), option);
            console.log('token',token);
            res.status(201).send({ user_token : token });
    }
    catch(err) {
        console.log(err);
        res.status(500).send({message: err });
    }
   
});

module.exports = router;