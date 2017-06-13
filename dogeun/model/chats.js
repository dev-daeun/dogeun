const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ObjectId = mongoose.Shcema.Types.ObjectId;

const MessageSchema = new Schema({
    sender: String,
    receiver: String,
    sent_time: String,
    content: String,
    is_read: Boolean,
    room_id: ObjectId
});

const Message = mongoose.model('Message', MessageSchema);


const RoomSchema = new Schema({
    created_time: String,
    participants: [Number],
    remained_paritipants : [Number],
    messages : [MessageSchema]
});


const Room = mongoose.model('Room',RoomSchema);


module.exports.Message = Message;
module.exports.Room = Room;
