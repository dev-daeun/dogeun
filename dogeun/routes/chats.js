const express = require('express');
const router = express.Router();
const Chats = require('../model/chats');
const AWS = require('../config/AWS');
AWS.loadAccess();
const upload = AWS.getUpload();

router.get('/:user_id', async (req, res) => {
    try{
        let data = await Chats.getRooms(req.params.user_id);
        let room = data.rooms;
        let sender_image = data.images;
        let array = [];
        for(let i = 0; i< room.length; i++){
            let recent = room[i].messages.length-1; //채팅방 별 가장 최근에 도착한 메세지의 인덱스 = recent
            array.push({
                room_id: room[i]._id, //채팅방 _id
                sent_time: room[i].messages[recent].sent_time, //메세지가 도착한 시간
                content: room[i].messages[recent].content, //메세지 내용
                sender_name: room[i].messages[recent].sender_name, //메세지 보낸 사람 이름
                sender_id: room[i].messages[recent].sender_id, //메세지 보낸 사람 id
                sender_profile: sender_image[i] //메세지 보낸 사람 프로필 썸네일url
            });
        }
        res.status(200).send(array);
    }
    catch(err){
        res.status(500).send({message: err});
    }
});


router.put('/', async (req, res) => {
    try {
        let user_id = req.body.user_id;
        let room_id = req.body.room_id;
        let result = await Chats.deleteRoom(user_id, room_id);
        res.status(200).send({message: 'success'});
    }
    catch(err) {
        res.status(500).send({message: err});
    }

});
module.exports = router;