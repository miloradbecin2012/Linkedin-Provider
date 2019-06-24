var express = require('express')
  , passport = require('passport')
  , LinkedinStrategy = require('./lib').Strategy;

// API Access link for creating client ID and secret:
// https://www.linkedin.com/secure/developer
var LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || "78gnstio4vh7yu";
var LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || "5SPI285k7rTf0h3K";
var CALLBACK_URL = process.env.CALLBACK_URL || 'http://localhost:8080/auth/linkedin/callback';
// var CALLBACK_URL = process.env.CALLBACK_URL || 'https://linkedin-provider.herokuapp.com/auth/linkedin/callback';

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Linkedin profile is
//   serialized and deserialized.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});


// Use the LinkedinStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, and Linkedin
//   profile), and invoke a callback with a user object.
passport.use(new LinkedinStrategy({
    clientID:     LINKEDIN_CLIENT_ID,
    clientSecret: LINKEDIN_CLIENT_SECRET,
    callbackURL:  CALLBACK_URL,
    scope:        ['r_liteprofile', 'r_emailaddress'],
    passReqToCallback: true
  },
  function(req, accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
    req.session.accessToken = accessToken;
    process.nextTick(function () {
      // To keep the example simple, the user's Linkedin profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the Linkedin account with a user record in your database,
      // and return that user instead.
      return done(null, profile);
    });
  }
));




var app = express();

// configure Express
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.logger());
app.use(express.cookieParser());
app.use(express.urlencoded());
app.use(express.json());
app.use(express.session({ secret: 'keyboard cat' }));
// Initialize Passport!  Also use passport.session() middleware, to support
// persistent login sessions (recommended).
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);
app.use(express.static(__dirname + '/public'));

const jwt = require('jsonwebtoken');
const config = require('./config');
const tokenList = {};

app.get('/', function(req, res){
  console.log('req', req.response);
  var tokenInfo = null;
  if (req.user != undefined && req.user) {
    const user = {
      "email": req.user.emails[0].value,
      "name": req.user.displayName
    };
    tokenInfo = getToken(user);
  }
  res.render('index', { user: req.user, tokenInfo: tokenInfo });
});

app.get('/account', ensureAuthenticated, function(req, res){
  res.render('account', { user: req.user });
});

// GET /auth/linkedin
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Linkedin authentication will involve
//   redirecting the user to linkedin.com.  After authorization, Linkedin
//   will redirect the user back to this application at /auth/linkedin/callback
app.get('/auth/linkedin',
  passport.authenticate('linkedin', { state: 'SOME STATE' }),
  function(req, res){
    // The request will be redirected to Linkedin for authentication, so this
    // function will not be called.
  });

// GET /auth/linkedin/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/linkedin/callback',
  passport.authenticate('linkedin', { failureRedirect: '/login' }),
  function(req, res) {
//  ### generate token, refresh_token manually based on profile info
    const user = {
      "email": req.user.emails[0].value,
      "name": req.user.displayName
    };
    // const token = jwt.sign(user, config.secret, { expiresIn: config.tokenLife})
    // const refreshToken = jwt.sign(user, config.refreshTokenSecret, { expiresIn: config.refreshTokenLife})
    // const response = {
    //     "status": "Logged in",
    //     "token": token,
    //     "refreshToken": refreshToken,
    // }
    // tokenList[refreshToken] = response;
    // res.status(200).json(response);
    res.redirect('/');
});

app.use(require('./tokenChecker'));

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

app.post('/token', (req, res) => {
  // refresh the damn token
  const postData = req.body
  // if refresh token exists
  if((postData.refreshToken) && (postData.refreshToken in tokenList)) {
      console.log('postData===>', postData)
      const user = {
          "email": postData.email,
          "name": postData.name
      }
      const token = jwt.sign(user, config.secret, { expiresIn: config.tokenLife})
      const response = {
          "token": token,
      }
      // update the token in the list
      tokenList[postData.refreshToken].token = token
      res.status(200).json(response);        
  } else {
      res.status(404).send('Invalid request')
  }
})

var http = require('http');

http.createServer(app).listen(8080);


// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login');
}

function getToken(user) {
  const token = jwt.sign(user, config.secret, { expiresIn: config.tokenLife})
  const refreshToken = jwt.sign(user, config.refreshTokenSecret, { expiresIn: config.refreshTokenLife})
  const response = {
      "status": "Logged in",
      "token": token,
      "refreshToken": refreshToken,
  }
  tokenList[refreshToken] = response;

  return response;
}
