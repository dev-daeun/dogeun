const Sequelize = require('sequelize');
const sequelize = new Sequelize(
  'dogeun', // 데이터베이스 이름
  'dogeun', // 유저 명
  'dogeun1234', // 비밀번호
  {
    'host': 'dogeun.cbgyq49zepbs.ap-northeast-2.rds.amazonaws.com', // 데이터베이스 호스트
    'port': 3306,
    'dialect': 'mysql' // 사용할 데이터베이스 종류
  }
);

const user = sequelize.define('users', { //users 테이블 모델
  user_id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true
  },
  gender: {
    type: Sequelize.INTEGER,
    allowNull: true
  }, 
  lifestyle: {
    type: Sequelize.INTEGER, //users 테이블 모델
    allowNull: false
  },
  region: {
    type: Sequelize.STRING,
    allowNull: false
  },
  other_pets: {
    type: Sequelize.INTEGER, //users 테이블 모델
    allowNull: false
  },
  family_size: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  profile_thumbnail: {
    type: Sequelize.TEXT,
    allowNull: true
  },
  profile_image: {
    type: Sequelize.TEXT,
    allowNull: true
  }
 }); //users 테이블 모델

module.exports = user;