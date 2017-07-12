const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  jwt.verify(req.headers.user_token, req.app.get('secret-key'), (err, decoded) => {
    if(err) res.status(400).send({message: err.name + " : " + err.message});
    else {
        console.log('decoded : ', decoded);
        req.user = decoded.user_id;
        next();
    }
  }); 
};