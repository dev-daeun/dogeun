var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var jwt = require('jsonwebtoken');
/* router */
var doglists = require('./routes/doglists');
var profiles = require('./routes/profiles');
var favorites = require('./routes/favorites');
var login = require('./routes/login');
var secretKey = require('./config/secretKey');

var app = express();

var passport = require('passport'),
  KakaoStrategy = require('passport-kakao');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('secret-key', secretKey.secretKey);

// uncomment after placing your favicon in /public
// app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static('apidoc'));
// app.use( (req, res, next) => {req.user= {}, next();});

app.use(passport.initialize());

app.use('/login', login);

app.use(tokenVerifier);
function tokenVerifier(req,res,next){
  const token = req.headers['user_token'];
  console.log(token);

  if(token){
    jwt.verify(token, secretKey.secretKey, (err,decoded)=>{
      if(decoded){req.user = decoded;}
      console.log('verfiy',decoded);
      next();
    });
  }
  else{
    req.user = null;
    next();
  }
}


app.use('/doglists', doglists);
app.use('/profiles', profiles);
app.use('/favorites', favorites);




// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});


// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});


module.exports = app;
