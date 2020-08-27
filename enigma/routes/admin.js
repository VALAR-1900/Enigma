var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');  
var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://localhost:27017/mydb";
var crypto=require('crypto');

//MongoDb Connection
MongoClient.connect(url, function(err, db) {

  if (err) throw err;
  var dbo = db.db("ENIGMA");

  router.get('/', async function(req,res,next){
    console.log(req.session.admin_loginstate);
    if(req.session.admin_loginstate == 1)
    {
      res.render('',{layout: 'admin_dashboard'})
    }
    else
    {
      res.render('',{layout: 'admin'})
    }
  })

  router.post('/', function(req,res,next){
    if(req.body.username == 'enigma_hoga' && req.body.password == 'ThisisforEnigma2020')
    {
      req.session.admin_loginstate=1;
      console.log(req.session.admin_loginstate); 
      res.render('',{layout: 'admin_dashboard'})
    }
    else
    {
      res.render('',{layout: 'admin'})
    }
  })

  router.post('/logout', function(req,res,next){
    req.session.admin_loginstate= undefined;
    res.redirect('/admin');
  })

  router.post('/get_player', function(req,res,next){
      req.session.fetch_player=req.body.username_player;
      dbo.collection('user_data').findOne({_id:req.session.fetch_player},function(error,result){
          if(err)
            throw err
          
            if(result == null)
            {
              res.render('',{layout: 'admin_dashboard', player_name: 'Record not found'});
            }
            else
            {
              res.render('',{layout: 'admin_dashboard', player_name: result._id,data: result.data});
            }
            console.log(result);
      })
  })
  router.post('/delete_player', function(req,res,next){
      if(req.session.fetch_player != undefined)
      {
        dbo.collection('user_data').deleteOne({_id:req.session.fetch_player});
        dbo.collection('main_data').deleteOne({_id:req.session.fetch_player});
        res.render('',{layout: 'admin_dashboard', player_name: 'Record Deleted'});
        console.log('Record Deleted');
      }
      else
      {
        res.render('',{layout: 'admin_dashboard', player_name: 'PLease enter an username first'});
      }
  })

})

module.exports = router;
