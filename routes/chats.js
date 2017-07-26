const Message = require('../model/chats').Message;
const Room = require('../model/chats').Room;
const User = require('../model/user');
const express = require('express');
const router = express.Router();
const aws = require('../config/AWS');
aws.loadAccess();
const auth = require('./auth');
const room = new Room();
const message = new Message(); 

router.get('/', auth, async (req, res, next) => {
      try {
        let roomlist = await room.getRooms(req.user); //현재 사용자id로 사용자가 참여중인 채팅목록 가져오기
        for(let i of roomlist){
          let messageCount = await message.getUnreadCount(i.room_id, req.user);
          i.unread_count = messageCount;
        }
        User.setUserId(req.user);
        console.log('roomlist : ', roomlist);
        res.status(200).send(roomlist);
      }catch(err){
        console.log(err);
        next();
      }
});


module.exports = router;