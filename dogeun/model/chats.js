const mongoose = require('mongoose');
const user = require('../config/ORM');
mongoose.Promise = global.Promise;
const db = mongoose.connection;
db.on('error', console.error);
db.once('open', async function(){
    // CONNECTED TO MONGODB SERVER
    console.log("Connected to mongod server");
});
const url = 'mongodb://localhost:27017/dogeun';
mongoose.connect(url);
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const MessageSchema = new Schema({ //메세지 스키마
    sender_id: Number,
    sender_name: String,
    receiver_id: Number,
    receiver_name: String,
    sent_time: String,
    content: String,
    is_read: Boolean,
    room_id: ObjectId
});
const RoomSchema = new Schema({
    created_time: String,
    chatters: [Number],  //채팅방 참여자 user_id
    remained_chatters: [Number], //채팅방에 남아있는 참여자 user_id 
    messages: [MessageSchema] //메세지 담는 배열
});
const Message = mongoose.model('Message', MessageSchema);
const Room = mongoose.model('Room', RoomSchema);
class Chats{}

Chats.getUnread = async function(room_id){
    //TODO: is_read가 false인 메세지들의 갯수를 리턴

};

Chats.getRooms = async function(id){
    try {
        let rooms = await Room.find(  //채팅목록 조회
            { remained_chatters: id },
            { messages: 1, _id: 1 }
        ); //결과 : 해당 사용자가 참여중인 채팅방의 모든 메세지 내역
        
        let images = []; //메세지를 보낸 sender들의 프로필 썸네일 url을 담을 배열
        for(let i = 0; i< rooms.length; i++){
            let recent = rooms[i].messages.length-1;
            let profile = await user.findOne({
                attributes: ['profile_thumbnail'],
                where: { user_id: rooms[i].messages[recent].sender_id }}); 
                //채팅방 별 가장 최근에 도착한 메세지를 보낸 사람의 id로 보낸 사람 프로필 썸네일 가져오기
            images.push(profile.dataValues.profile_thumbnail);
        }
        return { rooms: rooms, images: images };
    }
    catch(err) {
        console.log(err);
        throw err;
    }
  
};

Chats.deleteRoom = async function(user_id, room_id){
    try {
         let deleted = await Room.update(
            { _id: room_id },
            { $pull: { remained_chatters: user_id } }
         );
        return deleted;
    }
    catch(err) {
        console.log(err);
        throw err;
    }
  
}
module.exports = Chats;