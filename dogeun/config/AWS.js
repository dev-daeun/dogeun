const multer = require('multer');
const multerS3 = require('multer-s3');
const aws = require('aws-sdk');
aws.config.loadFromPath('./config/aws_config.json');
const s3 = new aws.S3();
class AWS {}

AWS.getUpload = function(){
  return multer({
    storage: multerS3({
      s3: s3,
      bucket: 'yeonsudogndogn',
      acl: 'public-read',
      key: function(req, file, cb){
        cb(null, Date.now()+'.'+file.originalname.split('.').pop());
      }
    })
  }); 
};
     
AWS.loadAccess = function (){
  aws.config.loadFromPath('./config/aws_config.json');
};

AWS.getS3 = function(){
  return s3;
} 



module.exports = AWS;
