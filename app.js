const express = require('express');
const path = require('path');
const User = require('./config/ORM').User;
const favicon = require('serve-favicon');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const doglists = require('./routes/doglists');
const profiles = require('./routes/profiles');
const favorites = require('./routes/favorites');
const signout = require('./routes/signout');
const morgan = require('morgan');
const login = require('./routes/login');
const signup = require('./routes/signup');
const chats = require('./routes/chats');
const alarms = require('./routes/alarms');
var app = express();


var secretKey = require('./config/secretKey');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('secret-key', secretKey.secretKey);
// uncomment after placing your favicon in /public
// app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json({limit: '100mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
//이메일 주소 정규표현
app.set('emailFormed', (address) => {
  var regex=/^([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/;
  if(!regex.test(address)){
    return false;
  }
  else return true;
});

//비번 정규표현
app.set('pwFormed', (pw) => {
  //영문, 숫자, 특수문자를 모두 포함하는 6~16개의 문자들
  var regex = /^(?=.*[a-zA-Z])(?=.*[!@#$%^*+=-])(?=.*[0-9]).{6,16}$/;
  if(!regex.test(pw)){
    return false;
  }
  if (pw.length < 6 || pw.length > 16) {
  return false;
 }
  else return true;
});


app.use('/doglists', doglists);
app.use('/profiles', profiles);
app.use('/favorites', favorites);
app.use('/login', login);
app.use('/signout',signout);
app.use('/signup', signup);
app.use('/alarms',alarms);
app.use('/chats', chats);
// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
const logger = require('./logger');
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  logger.error(err.status||500 + " " + err.message);
  res.status(err.status || 500);
  res.json({message: err.message});
  console.log(err.message);
});

module.exports = app;
