'use strict';

const User = require('../models/user');
const Business = require('../models/business');
const Appointment = require('../models/appointment');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const validator = require('validator');
const passwordRecovery = require('./passwordRecovery');

//logging user list
// Appointment.find({}, (err, user) => {
//   if (err) throw err;
// });
// User.find({}, (err, users) => {
//   if (err) throw err;
//   users.forEach((user) => {
//   });
// });
//User.deleteMany({}, function (err) {});
//Appointment.deleteMany({}, function (err) {});
// Business.deleteOne({ 'local.username': 'test' }, (err) => {});
// Business.deleteOne({ 'local.username': 'test1' }, (err) => {});
// User.find({}, (err, users) => {
//   if (err) throw err;
//   users.forEach((user) => {
//   });
// });

module.exports = (app, passport) => {

  /* GET login page. */
  app.get('/', (req, res) => {
    res.render('login');
  });

  /* POST login */
  app.post('/login', (req, res, next) => {
    passport.authenticate('local-login', (err, user, info) => {
      if (err) return next(err); 
      if (!user) return res.json({ success: false, message: info });
      req.logIn(user, (err) => {
        if (err) return next(err);
        return res.json({ success: true });
      });
    })(req, res, next);
  });

  /* GET sign up page */
  app.get('/signup', (req, res) => {
    res.render('signup');
  });

  /* POST(ajax) sign up */
  app.post('/signup', isEmailValid, isPasswordValid, (req, res, next) => {
    passport.authenticate('local-signup', (err, user, info) => {
      if (err) return next(err);
      if (!user) return res.json({ success: false, message: info });
      req.logIn(user, (err) => {
        if (err) return next(err);
        return res.json({ success: true });
      });
    })(req, res, next);
  });

  /* GET password recovery page */
  app.get('/forgot', (req, res) => {
    res.render('forgot', {
      message: req.flash('info') 
    });
  });

  /* POST password recovery */
  app.post('/forgot', isEmailValid, async (req, res, next) => {
    try {
      const result = await passwordRecovery(req);
      res.json(result);
    } catch(err) {
      next(err);
    }
  });

  /* GET password reset page */
  app.get('/reset/:token', async (req, res, next) => {
    try {
      throw new Error('Test error');
      const user = await User.findOne({ 'local.resetPasswordToken': req.params.token });
      if (!user) {
        req.flash('info', 'Password reset token is invalid.');
        res.redirect('/forgot');
      } else if (user.local.resetPasswordExpires < Date.now()) {
        req.flash('info', 'Password reset token is expired.');
        res.redirect('/forgot');
      } else { 
        res.render('reset');
      }
    } catch(err) {
      next(err);
    }
  });

//  app.get('/reset/:token', (req, res) => {
//    User.findOne({ 'local.resetPasswordToken': req.params.token }, (err, user) => {
//      if (!user) {
//        req.flash('info', 'Password reset token is invalid.');
//        res.redirect('/forgot');
//      } else if (user.local.resetPasswordExpires < Date.now()) {
//        req.flash('info', 'Password reset token is expired.')
//        res.redirect('/forgot');
//      } else {
//        res.render('reset', {
//          user: req.user,
//          token: req.params.token,
//          message: req.flash('info')
//        });
//      }
//    });
//  });
  /* POST Password reset */
  app.post('/reset/:token', (req, res) => {
    User.findOne({ 'local.resetPasswordToken': req.params.token }, (err, user) => {
      if (err) throw err;
      if (!user) {
        req.flash('info', 'Password reset token is invalid.');
        res.render('reset', {
          user: req.user,
          message: req.flash('info')
        });
      } else if (user.local.resetPasswordExpires < Date.now()) {
        req.flash('info', 'Password reset token is expired.')
        res.render('reset', {
          user: req.user,
          message: req.flash('info')
        });
      } else {
        user.local.password = user.generateHash(req.body.password);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        user.save((err, update) => {
          if (err) throw err;
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.EMAIL,
              pass: process.env.EMAIL_PASS,
            }
          });
          const mailOptions = {
            from: process.env.EMAIL,
            to: user.local.email,
            subject: 'Your password has been changed',
            text: 'Hello,\n\n' +
            'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
          };

          transporter.sendMail(mailOptions, (error, info) => {
            if (err) console.log(err); 
            else {
              req.flash('info', 'Success! Your password has been changed.');
              res.render('login', {
                message: req.flash('info')
              });
            }
          });
        });
      }
    });
  });


  /* GET business/client home page */
  app.get('/home', isLoggedIn, (req, res) => {
    if (req.user.kind === 'Business') {
      Appointment.find({ business: req.user.id }).populate({ path: 'user', select: 'firstname lastname' }).exec((err, appointments) => {
        if (err) throw err;
        res.render('business-home', {
          appointments: appointments,
        });
      });
    } else {
      User.findById(req.user.id).populate({ path: 'contacts', select: 'local.email' }).exec((err, user) => {
        Appointment.find({ user: req.user.id }).populate({ path: 'business', select: 'firstname lastname' }).exec((err, appointments) => {
          if (err) throw err;
          res.render('client-home', {
            contacts: req.user.contacts,
            appointments: appointments,
            contacts: user.contacts,
          });
        });
      });
    }
  });

  /* POST business/client home page */
  app.post('/home/cancel', isLoggedIn, (req, res) => { 
    Appointment.findById(req.body.appointmentId, 'canceled', (err, appointment) => {
      if (err) throw err;
      appointment.canceled = true;
      appointment.save((err, update) => {
        if (err) return handleError(err);
        res.send('This appointment has been calceled');
      });

    });
  });

  /* GET business schedule page */
  app.get('/schedule', isLoggedIn, isBusiness, (req, res) => {
    res.render('business-schedule', {
      workdays: req.user.workdays,
      workhours: req.user.workhours,
      holidays: req.user.holidays,
    });
  });

  /* GET(ajax) business schedule workdays */
  app.post('/schedule/update', isLoggedIn, isBusiness, (req, res) => {
    if (req.user.kind === 'Business') {
      Business.findById(req.user.id, 'workdays workhours holidays', (err, business) => {
        const updatedDays = JSON.parse(req.body.days);
        const updatedTime = JSON.parse(req.body.time);
        const updatedHolidays = JSON.parse(req.body.holidays);
        if (updatedDays.length > 0) {
          business.workdays.forEach((day) => {
            updatedDays.forEach((updatedDay) => {
              if (day.dayNum === updatedDay.dayNum) {
                day.isAvailable = updatedDay.isAvailable;
              }
            });
          });
        }
        if (updatedTime.length > 0) {
          business.workhours.forEach((hour) => {
            updatedTime.forEach((updatedTime) => {
              if (hour.time === updatedTime.time) {
                hour.isAvailable = updatedTime.isAvailable;
              }
            });
          });
        }
        if (updatedHolidays.length > 0) {
          business.holidays.forEach((holiday) => {
            updatedHolidays.forEach((updatedHoliday) => {
              if (holiday.date === updatedHoliday.date) {
                holiday.isAvailable = updatedHoliday.isAvailable;
              }
            });
          });
        }
        business.markModified('workdays');
        business.markModified('workhours');
        business.markModified('holidays');
        business.save((err, update) => {
          if (err) return handleError(err);
          res.send('Your schedule has been updated');
        });
      });
      //res.send(req.body);
    }
  });

  /* GET business/client profile page */
  app.get('/profile', isLoggedIn, (req, res) => {
    if (req.user.kind === 'Business') {
      res.render('business-profile', {
        firstname: req.user.firstname,
        lastname: req.user.lastname,
      });
    } else {
      res.render('client-profile', {
        firstname: req.user.firstname,
        lastname: req.user.lastname,
        contacts: req.user.contacts,
      });
    }
  });

  /* POST(ajax) business/client profile*/
  app.post('/profile/update', isLoggedIn, (req, res) => {
    User.findById(req.user.id, 'firstname lastname', (err, user) => {
      if (err) throw err;
      user.firstname = req.body.firstname;
      user.lastname = req.body.lastname;
      user.save((err, update) => {
        if (err) return handleError(err);
        res.send('Profile has been updated');
      });
    });
    //res.send(req.body);
  });

  /* GET client contact search page*/
  app.get('/search', isLoggedIn, isClient, (req, res) => {
    res.render('client-search', {
      contacts: req.user.contacts,
    });
  });

  /* GET(ajax) client find request*/
  app.get('/search/:pattern', isLoggedIn, isClient, (req, res) => {
    const pattern = new RegExp(req.params.pattern, "gi");
    Business.find({ 'local.username': pattern }, '_id local.username', (err, usernames) => {
      if (err) throw err;
      res.json({
        results: usernames,
        contacts: req.user.contacts,
      });
    });
    //res.send(req.body);
  });

  /* POST(ajax) client add contact page*/
  app.post('/search/add', isLoggedIn, isClient, (req, res) => {
    User.findById(req.user.id, 'contacts', (err, user) => {
      if (!user.contacts.includes(req.body.id)) {
        user.contacts.push(req.body.id);
      }
      user.save((err, update) => {
        if (err) return handleError(err);
        res.send('Contact has been added');
      });
    });
  });

  /* POST(ajax) client remove contact request*/
  app.post('/search/remove', isLoggedIn, isClient, (req, res) => {
    User.findById(req.user.id, 'contacts', (err, user) => {
      if (err) throw err;
      let i = user.contacts.indexOf(req.body.id);
      user.contacts.splice(i, 1);
      user.save((err, update) => {
        if (err) return handleError(err);
        res.send('Contact has been removed');
      });
    });
    //res.send(req.body);
  });
  /* GET client book page (no contacts) */
  app.get('/book/nocontacts', isLoggedIn, isClient, (req, res) => {
    res.render('client-booking-nocontacts', {
      contacts: req.user.contacts,
      message: 'You don\'t have contacts to make an appointment.',
    });
  });

  /* GET client book page */
  app.get('/book/:id', isLoggedIn, isClient, (req, res) => {
    Business.findById(req.params.id).populate('appointments').exec((err, business) => { 
      if (err) throw err;
      User.findById(req.user.id).populate({ path: 'contacts', select: 'local.username' }).exec((err, user) => {
        if (err) throw err;
        let date = new Date()
        date.setSeconds(0);
        date.setMilliseconds(0);
        res.render('client-booking', {
          contacts: user.contacts,
          chosenContact: business.local.username,
          workhours: business.workhours,
          days: business.createMonth(),
          dateObj: date,
        });
      });
    });
  });

  /* POST(ajax) client book nextmonth request */
  app.post('/book/:id/month', isLoggedIn, isClient, (req, res) => {
    Business.findById(req.params.id, (err, business) => {
      let date = new Date(req.body.dateISO);
      let month = date.getMonth();
      let year = date.getFullYear();
      if (req.body.month == 'next') {
        if (month + 1 > 11) {
          month = 0;
          year++;
        } else {
          month++;
        }
      }
      if (req.body.month == 'prev') {
        if (year > new Date().getFullYear()) {
          if (month - 1 < 0) {
            month = 11;
            year--;
          } else {
            month--;
          }
        } else if (year === new Date().getFullYear() && month - 1 >= new Date().getMonth()) {
          month--;
        }
      }
      date.setFullYear(year);
      date.setMonth(month);
      res.json({ 
        days: business.createMonth(date),
        dateISO: date.toISOString(),
      });
    });
  });

  /* POST(ajax) client book another day request */
  app.post('/book/:id/day', isLoggedIn, isClient, (req, res) => {
    Business.findById(req.params.id).populate('appointments').exec((err, business) => {
      if (err) throw err;
      let date = new Date(req.body.dateISO);
      date.setDate(parseInt(req.body.day));
      res.json({ 
        hours: business.createDay(date),
        dateISO: date.toISOString(),
      });
    });
  });

  /* POST(ajax) client book request */
  app.post('/book/:id/book', isLoggedIn, isClient, (req, res) => {
    User.findById(req.user.id, 'appointments', (err, user) => {
      if (err) throw err;
      Business.findById(req.params.id, '_id appointments', (err, business) => {
        if (err) throw err;
        let newAppnt = new Appointment();
        newAppnt.user = req.user.id;
        newAppnt.business = business._id;
        newAppnt.date = req.body.date;
        newAppnt.reason = req.body.reason;
        newAppnt.canceled = false;
        newAppnt.timeMMM = new Date(req.body.date).getTime();
        newAppnt.save((err, appointment) => {
          if (err) throw err;
          user.appointments.push(appointment._id);
          user.save((err, result) => {
            if (err) throw err;
            business.appointments.push(appointment._id);
            business.save((err, result) => {
              if (err) throw err;
              res.send(`Your appointment is scheduled on ${new Date(appointment.date).toLocaleDateString()}
                at ${new Date(appointment.date).toLocaleTimeString().substring(0,8)}`);
            });
          });
        });
      });
    });
    //res.send(req.body);    
  });

  /* GET client contacts page */
  app.get('/contacts', isLoggedIn, isClient, (req, res) => {
    User.findById(req.user._id, 'contacts').populate({ path: 'contacts', select: 'local.username' }).exec((err, user) => {
      res.render('client-contacts', {
        contacts: user.contacts,
      });
    });
  })

  /* POST delete account*/
  app.get('/delete', isLoggedIn, (req, res) => {
    User.findByIdAndRemove(req.user._id, (err) => { 
      if (err) throw err;
      res.redirect('/');
    });
  });

  /* GET Log Out */
  app.get('/logout', isLoggedIn, (req, res) => {
    req.logout();
    res.redirect('/');
  });

  /* Error page */
  app.get('/error/:code', (req, res) => {
      res.render('error', {
        code: req.params.code, 
      });
  });
  /* 404 page */
  app.get('*', function(req, res) {
    res.statusCode = 404;
    res.render('404');
  });

  function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    res.redirect('/');
  }
  function isBusiness(req, res, next) {
    if (req.user.kind === 'Business') {
      return next();
    }
    res.redirect('/');
  }
  function isClient(req, res, next) {
    if (req.user.kind !== 'Business') {
      return next();
    }
    res.redirect('/');
  }
  function isEmailValid(req, res, next) {
    if (typeof req.body.email === 'string' && validator.isEmail(req.body.email)) {
      return next();
    }
    res.json({ 
      success: false,
      message: 'The entered email is not valid'
    });
  }
  function isPasswordValid(req, res, next) {
    if (req.body.password !== req.body.confirm) {
      res.json({ 
        success: false,
        message: 'The entered passwords do not match.'
      });
    } else if (!(/^[a-zA-Z0-9@#$]+$/).test(req.body.password)) {
      res.json({ 
        success: false,
        message: 'The entered password must contain only a-zA-Z0-9@#$ characters'
      });
    } else if (req.body.password.length < 6) {
      res.json({ 
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    } else if (req.body.password.length > 20) {
      res.json({ 
        success: false,
        message: 'Password must be less than 20 characters long'
      });
    } else {
      return next();
    }
  }
}
