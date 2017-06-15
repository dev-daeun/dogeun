const mongoose = require('mongoose');
const User = require('../config/ORM');
const moment = require('moment');
mongoose.Promise = global.Promise;
const db = mongoose.connection;
db.on('error', console.error);
db.once('open', async function(){
    console.log("Connected to mongod server");
});
const url = 'mongodb://localhost:27017/dogeun';
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
    room_id: ObjectId
});




MessageSchema.methods.getUnreadCount = async function(room_id, user_id){
    try {
        //is_read가 false인 메세지들의 갯수를 리턴
        let count = await Message.find({ room_id: room_id, is_read: false, receiver_id: user_id }).count(); 
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


MessageSchema.methods.saveMessage = async function(s_id, r_id, con, room_id){
    try {
        let sender, s_name, receiver, r_name;
        sender = await User.findOne({
            attributes: ['username'],
            where: { user_id: s_id }
        }); //보낸 사람 이름 user 테이블에서 가져오기
        s_name = sender.dataValues.username;
        receiver = await User.findOne({
            attributes: ['username'],
            where: { user_id: r_id }
        }); //받은 사람 이름 user 테이블에서 가져오기
        r_name = receiver.dataValues.username;
        let new_msg  = new Message({ //Message 모델로 메세지 도큐먼트 생성
            sender_id: s_id,
            sender_name: s_name,
            receiver_id: r_id,
            receiver_name: r_name,
            sent_time: moment(new Date()).format('YY-MM-DD h:mm:ss a'),
            content: con,
            is_read: false,
            room_id: ObjectId(room_id)
        });

        let insertNew = await new_msg.save(); //Message 컬렉션에 message 추가
        return insertNew;
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

RoomSchema.methods.creatRoom = async function createRoom(creator_id, participant_id){
    try {
          let new_room  = new Room({ //Room 모델로 채팅방 객체 생성
            created_time: moment(new Date()).format('YY-MM-DD h:mm:ss a'),
            chatters: [creator_id, participant_id],
            remained_chatters: [creator_id, participant_id],
            messages: []
          });
          let result = await new_room.save(); //save()는 생성된 객체 그대로 리턴
          console.log(result);
          return result;
    }
    catch(err) {
        console.log(err);
        throw err;
    }
};


RoomSchema.methods.addMessage = async function addMessage(new_msg){
    //TODO: Message.saveMessage먼저 호출해야.(message _id 필요함)
    let ret = await Room.update( //Room 컬렉션에 message 추가
            { _id: room_id },
            { $push: { messages: new_msg }}
        );
    return ret;
};


RoomSchema.methods.getRooms = async function getRooms(id){ //사용자 id
    try {
        let rooms = await Room.find(  //채팅목록 조회
            { remained_chatters: id },
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
                room_id: rooms[i]._id+"",
                sent_time: msg.sent_time,
                sender_name: msg.sender_name,
                content: msg.content,
                profile_thumbnail: profile.dataValues.profile_thumbnail,
                receiver_name: msg.receiver_name //TODO: 안드에서는 불필요(지워야)
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
        // let edited_msg = await Message.find( //아직 읽지 않은 메세지들의 _id를 먼저 가져옴.
        //    { is_read : false, receiver_id: user_id, room_id: room_id },
        //    { _id: 1 }         
        // ); // [{_id: ...},{_id: ...}] 형태
        
        // for(let i = 0; i<edited_msg.length; i++) edited_msg[i] = edited_msg[i]._id;
        // await Message.update( //방에 입장하면 읽지 않았던 메세지들을 읽은 것으로 변경한다.
        //    { is_read : false, receiver_id: user_id, room_id: room_id },
        //    { is_read: true } 
        // );

        // let result = await Room.update(
        //     { 
        //         _id: room_id, 
        //         messages: { $elemMatch: { receiver_id: user_id, is_read: false }} 
        //     },
        //     { 
        //         messages : { $where: "receiver_id==user_id", is_read :true } 
        //     });

   
        let room = await Room.findOne(
            { _id: room_id },
            { messages: 1 }
        );
        let array = [];
        for(let i = 0; i<room.messages.length; i++){
           let msg = room.messages[i];
           let profile = await User.findOne({
                attributes: ['profile_thumbnail'],
                where: { user_id: msg.sender_id }
           });
           array.push({
               sender_id: msg.sender_id,
               sender_name: msg.sender_name,
               sender_profile: profile.dataValues.profile_thumbnail,
               content: msg.content
           });
        }
        return array;
    }
    catch(err) {
        console.log(err);
        throw err;
    }
};

RoomSchema.methods.deleteRoom = async function deleteRoom(user_id, room_id){
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
  
};

const Room = mongoose.model('Room', RoomSchema); 
const Message = mongoose.model('Message', MessageSchema);
module.exports.Room = Room;
module.exports.Message = Message;