var fs = require('fs');

var Q = require('q');
var React = require('react');

var AppDispatcher = require('../client/dispatchers/app_dispatcher.js');
var ApplicationView = require('../client/components/application_view.jsx');
var errors = require('./errors');
var ImageActions = require('../client/actions/image_actions.js');
var ImageDb = require('./databases/image_db.js');
var ImageStore = require('../client/stores/image_store.js');
var UrlActions = require('../client/actions/url_actions.js');
var UrlStore = require('../client/stores/url_store.js');

var mimeTypes = {
  jpg: 'image/jpeg',
  gif: 'image/gif',
  png: 'image/png'
};

module.exports = function(app, db) {
  function createDispatcher() {
    var dispatcher = new AppDispatcher();
    dispatcher.register(new ImageStore(ImageDb(db)));
    dispatcher.register(new UrlStore());
    return dispatcher;
  }

  app.get('/', function(req, res) {
    var dispatcher = createDispatcher();

    var promise = dispatcher.dispatch(UrlActions.setUrlFromRequest(req.url));
    promise.then(function(state) {
      var html =  React.renderComponentToString(ApplicationView({preloadData: state, dispatcher: dispatcher}));
      res.render('index', {app: html, preloadData: state});
      dispatcher.destroy();
    });
  });

  app.get('/image/:img', function(req, res) {
    var dispatcher = createDispatcher();

    var promise = dispatcher.dispatch(UrlActions.setUrlFromRequest(req.url)).then(function() {
      return dispatcher.dispatch(ImageActions.loadImage(req.params.img));
    });

    promise.then(function(state) {
      var html =  React.renderComponentToString(ApplicationView({preloadData: state, dispatcher: dispatcher}));
      res.render('index', {app: html, preloadData: state});
      dispatcher.destroy();
    });
  });

  app.get(/^\/i\/(\w+)(-t)?.(jpg|jpeg|gif|png)/, function(req, res) {
    Q.nfcall(db.hgetall.bind(db), 'img:' + req.params[0]).then(function(reply) {
      if (!reply) {
        errors.notFound(res);
      } else {
        var fname = req.params[1] ? req.params[0] + '_thumb' : req.params[0];
        res.header('Content-Type', mimeTypes[reply.type]);
        fs.createReadStream(app.get('uploadDir') + '/' + fname).pipe(res);
      }
    }, function(reason) {
      console.error('Error in web/i');
      console.error(reason);
      errors.genericError(res);
    });
  });
};
