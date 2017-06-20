const mongoose = require('mongoose');
const User = require('../config/ORM').User;
const moment = require('moment');
mongoose.Promise = global.Promise;
const db = mongoose.connection;
db.on('error', console.error);
db.once('open', async function(){
    console.log("Connected to mongod server");
});
const url = require('../config/mongo_url');
mongoose.connect(url);
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

/*--------------------------  Message Schema  -----------------------------*/

const MessageSchema = new Schema({
    sender_id: Number,
    sender_name: String,
    receiver_id: Number,
    receiver_name: String,
    sent_time: String,
    content: String,
    is_read: Boolean,
    room_id: ObjectId,
    created_time: String
});

MessageSchema.methods.getUnreadCount = async function getUnreadCount(room_id, user_id){
    try {
        //is_read가 false인 메세지들의 갯수를 리턴
        let count = await Message.find({room_id: room_id, receiver_id: user_id, is_read: false}).count(); 
        return count;
    }
    catch(err){
        console.log(err);
        throw err;
    }
};
MessageSchema.methods.getUnread = async function(room_id){
    try {
            //is_read가 false인 메세지들을 리턴
        let messages = await Message.find({ room_id: room_id, is_read: false }); 
        return messages;
    }
    catch(err) {
        console.log(err);
        throw err;
    }
};
MessageSchema.methods.setRead = async function(room_id){
    try {
        let result = await Message.update({ room_id: room_id }, { is_read: true });
        return result;
    }
    catch(err) {
        console.log(err);
        throw err;
    }
};

MessageSchema.methods.getUserInfo = async function getUserInfo(user_id){
    let info = await User.findOne({
        attributes: ['user_id', 'profile_thumbnail', 'username'],
        where: {user_id :user_id }
    });
    let obj = {
        sender_id: info.dataValues.user_id,
        sender_thumbnail: info.dataValues.profile_thumbnail,
        sender_name: info.dataValues.username      
    };
    return obj;
};

MessageSchema.methods.saveMessage = async function(content, user_id, room_id){
    try {
        let sender = await User.findOne({
            attributes: ['username'],
            where: { user_id: user_id }
        }); //보낸 사람 이름 user 테이블에서 가져오기

        let room = await Room.findOne(
            { _id: room_id },
            { messages: 1, chatters: 1 }
        );
        let participant_id = (room.chatters[0]==user_id) ? room.chatters[1] : room.chatters[0];

        let receiver =  await User.findOne({
            attributes: ['username'],
            where: { user_id: participant_id }
        }); //받은 사람 이름 user 테이블에서 가져오기

        let new_msg = await Message.create({ //Message컬랙션에 새로 전송된 메세지 insert
            sender_id: user_id,
            sender_name: sender.dataValues.username,
            receiver_id: participant_id,
            receiver_name: receiver.dataValues.username,
            sent_time: moment(new Date()).format('MM-DD h:mm:ss a'),
            content: content,
            is_read: false,
            room_id: room_id
        });

        return new_msg;
    }
    catch(err) {
        console.log(err);
        throw err;
    }
};



/*-------------------------   Room Schema   -------------------------------*/

const RoomSchema = new Schema({
    created_time: String,
    chatters: [Number],  //채팅방 참여자 user_id
    remained_chatters: [Number], //채팅방에 남아있는 참여자 user_id 
    messages: [MessageSchema] //메세지 담는 배열
});

RoomSchema.methods.findRoom = async function findRoom(user_id, participant_id){
    let exists = await Room.findOne(
        { chatters: { $all: [user_id, participant_id] } },
        { _id: 1 }
    );
    if(exists==null) return -1;
    else return exists._id.toString();
};
 
RoomSchema.methods.beforeRemove = async function beforeRemove(user_id, room_id){
    let exists = await Room.count(
        { remained_chatters: user_id, _id: room_id }
    );
    return exists;
};

RoomSchema.methods.createRoom = async function createRoom(creator_id, participant_id){
    try {
          let new_room  = Room.create({ //Room 모델로 채팅방 객체 생성
            created_time: moment(new Date()).format('YY-MM-DD h:mm:ss a'),
            chatters: [creator_id, participant_id],
            remained_chatters: [creator_id, participant_id],
            messages: []
          });
          return new_room._id.toString();
    }
    catch(err) {
        console.log(err);
        throw err;
    }
};


RoomSchema.methods.addMessage = async function addMessage(new_msg){
    let ret = await Room.update( //Room 콜랙션에 새로 전송된 메세지 insert.
            { _id: new_msg.room_id },
            { $push: { messages: new_msg }}
        );
    return ret;
};


RoomSchema.methods.getRooms = async function getRooms(id){ //사용자 id
    try {
        let rooms = await Room.find(  //채팅목록 조회
            { remained_chatters: id, 'messages.0': { $exists: true } }, //메세지 내역길이가 1이상인 room만 추출.
            { messages: 1, _id: 1 }
        ); //결과 : 해당 사용자가 참여중인 채팅방의 모든 메세지 내역
        
        let recent_array = []; 
        for(let i = 0; i< rooms.length; i++){
            let recent = rooms[i].messages.length-1;
            let msg = rooms[i].messages[recent];
            let profile = await User.findOne({
                attributes: ['profile_thumbnail'],
                where: { user_id: msg.sender_id }}); 
                //채팅방 별 가장 최근에 도착한 메세지를 보낸 사람의 id로 보낸 사람 프로필 썸네일 가져오기
            let recent_msg = {
                room_id: rooms[i]._id.toString(),
                sent_time: msg.sent_time,
                sender_name: msg.sender_name,
                sender_thumbnail: profile.dataValues.profile_thumbnail,
                content: msg.content
            };       
            recent_array.push(recent_msg);
        }
        return recent_array;
    }
    catch(err) {
        console.log(err);
        throw err;
    }
  
};

RoomSchema.methods.enterRoom = async function enterRoom(room_id, user_id){
    try {
        /* Message 컬렉션에서 안읽었던 메세지 모두 읽음처리 */
        let updateMessage = await Message.updateMany(
            { room_id: room_id, is_read: false, receiver_id: user_id },
            { $set: { is_read: true } } 
        ); 

        /* Room 컬렉션에서 안읽었던 메세지 모두 읽음처리 */
        let updateRoom = await Room.update(
            { _id: room_id, "messages.receiver_id": user_id },
            { $set: { "messages.$.is_read": true }}
        );

        /* 채팅방 내에 메세지 내역 find */
        let room = await Room.findOne(
            { _id: room_id },
            { messages: 1, chatters: 1 }
        );
        let array = [];
        let the_other = (room.chatters[0]==user_id) ? room.chatters[1] : room.chatters[0];
        let obj = { participant_id: the_other, user_id: user_id }; //현재 사용자가 대화중인 상대방의 id 

        for(let i = 0; i<room.messages.length; i++){
           let msg = room.messages[i];
           let profile = await User.findOne({
                attributes: ['profile_thumbnail', 'username'],
                where: { user_id: msg.sender_id }
           });
           let element = {
               sender_id: msg.sender_id,
               sender_thumbnail: profile.dataValues.profile_thumbnail,
               sender_name: profile.dataValues.username,
               content: msg.content
           };
           if(msg.sender_id==user_id) element.side = 'right';
           else element.side = 'left';
           array.push(element);
        }
        obj.messages = array;
        return obj;
    }
    catch(err) {
        console.log(err);
        throw err;
    }
};

RoomSchema.methods.deleteRoom = async function deleteRoom(user_id, room_id){
    try {
        await Room.update(
            { _id: room_id },
            { $pull: { remained_chatters: user_id } }
         );
    }
    catch(err) {
        console.log(err);
        throw err;
    }
  
};
const Room = mongoose.model('Room', RoomSchema); 
const Message = mongoose.model('Message', MessageSchema);

module.exports.Room = Room;
module.exports.Message = Message;
