const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const doglists = require('./routes/doglists');
const profiles = require('./routes/profiles');
const favorites = require('./routes/favorites');
const signout = require('./routes/signout');
const morgan = require('morgan');
const login = require('./routes/login');
const alarms = require('./routes/alarms');

var secretKey = require('./config/secretKey');
var app = express();
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
app.use( (req, res, next) => {req.user= {}, next();}); //인증


// app.use((req, res, next) => {
//   let user_token = req.headers.user_token;
//   if(!user_token) res.status(401).send({message: 'unauth'});
//   else if(user_token!=21) res.status(401).send({messsage: 'wrong token'});
//   else req.user = user_token;
//   next();
// }); //인증


app.use('/doglists', doglists);
app.use('/profiles', profiles);
app.use('/favorites', favorites);
app.use('/login', login);
app.use('/signout',signout);
app.use('/alarms',alarms);

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
});

module.exports = app;
