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
class Model{}  
 Model.users =  sequelize.define('users', { //users 테이블 모델
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

 Model.parcels = sequelize.define('parcels', { //분양글 테이블 모델
    parcel_id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    spiece: {
      type: Sequelize.STRING,
      allowNull: false
    },
    gender: {
      type: Sequelize.STRING,
      allowNull: false
    },    
    age: {
      type: Sequelize.STRING,
      allowNull: false
    },
    region1: {
      type: Sequelize.STRING,  //분양글 테이블 모델
      allowNull: false
    },
    region2: {
      type: Sequelize.STRING,
      allowNull: false
    },
    price: {
      type: Sequelize.STRING,
      allowNull: false
    },
    size: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    introduction: {
      type: Sequelize.TEXT,
      allowNull: false
    },
    condition: {
      type: Sequelize.TEXT,
      allowNull: false
    },
    fur: {
      type: Sequelize.INTEGER, //분양글 테이블 모델
      allowNull: true
    },
    lineage: {
      type: Sequelize.STRING,
      allowNull: true
    },
    pet_thumbnail: {
      type: Sequelize.STRING,
      allowNull: false
    },
    title: {
      type: Sequelize.TEXT,
      allowNull: false
    },
    is_parceled: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    kennel: {
      type: Sequelize.INTEGER,
      allowNull: true
    },
    corona: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    DHPPL: {                //분양글 테이블 모델
      type: Sequelize.INTEGER,
      allowNull: true
    }
 });

 Model.favorites = sequelize.define('favorites', { //관심등록글 테이블 모델
    id: {
      type: Sequelize.INTEGER,  
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    parcel_id: {
      type: Sequelize.INTEGER,
      allowNull: false
    }
 });

Model.parcels.belongsTo( Model.users, { foreignKey: 'user_id', targetKey: 'user_id' });
Model.favorites.belongsTo( Model.users, { foreignKey: 'user_id', targetKey: 'user_id'});
Model.favorites.belongsTo( Model.parcels, { foreignKey: 'parcel_id', targetKey: 'parcel_id'});

module.exports = Model; 
