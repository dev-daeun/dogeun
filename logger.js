var winston = require('winston');
var moment = require('moment');
require('winston-daily-rotate-file');
var transport = new winston.transports.DailyRotateFile({
    filename: 'Logs/rest-logs.log',
    datePattern: 'yy-MM-dd.',
    prepend: true,
    localTime: true,
    timestamp: () => {
        return moment().format('YYYY-MM-DD hh:mm:ss')
      },
    level: process.env.ENV === 'development' ? 'debug' : 'info'
});
  
var logger = new (winston.Logger)({
    transports: [
      transport
    ]
});
 
 module.exports = logger;