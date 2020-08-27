var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');  
const questions = require("../Question Data/questions");
const answer=require("../Question Data/answer");
var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://localhost:27017/mydb";
var crypto=require('crypto');

//Hashing Function
function hash(string) {
  return crypto.createHash('md5').update(string).digest('hex');
 }

//Mongo-Connection
MongoClient.connect(url, function(err, db) {

  if (err) throw err;
  var dbo = db.db("ENIGMA");

//Static Page Code
router.get('/', function(req, res, next) {
  res.render('', {layout: 'layout_static'});
});

//Sign Up Page Display
router.get('/signup', function(req, res, next) {
    res.render('', {layout: 'register'});
});

//Sign Up Functionality
function create_account(req)
{
  return new Promise(function(resolve,reject){

      dbo.collection("main_data").createIndex( { "email" : 1}, { unique : true } );
      var account={
        email: req.body.email,
        _id:req.body.username,
        first_name:req.body.first_name,
        last_name:req.body.last_name,
        password:hash(req.body.password),
        level:1,
        last_write: Date.now()
      }
      dbo.collection('main_data').insertOne(account,function(err,result){
        if(err)
        {
          if(err.name == 'MongoError' && err.code==11000)
          {
            resolve(0);
          }
        }
        else
        {
          resolve(1);
        }
      });
  })
}
router.post('/signup', async function(req, res, next) {
  var status= await create_account(req);
  if(status == 0)
  {
    res.render('',{func:'popup()',text:'Duplicate Email Or Username', layout: 'register'});
  }
  else
  {
    res.render('', {func:'register_successful()',layout: 'layout_static'});
  }

});

//Signin Code
router.get('/signin', function(req, res, next) {
  if(req.session.email == undefined)
  {
    res.render('', {layout: 'signin'});
  }
  else
  {
    res.redirect('/play');
  }
});

function check(email,password)
{
  return new Promise(function(resolve,reject){

      dbo.collection('main_data').findOne({email:email},function(err,result){
       
        if(err) throw err;
        if(result ==  null)
        {
            resolve(-1);
        }
        else
        {
          if(result.password == hash(password))
          {
            resolve(1);
          }

          else resolve(0);
        }
        
      });
      })  
}

function get_level(email,req)
{
  return new Promise(function(resolve,reject){
        dbo.collection('main_data').findOne({email:email},function(err,result){
          if(err) throw err;

          req.session.username=result._id;
          resolve(result.level);
          console.log("Level:",result.level);
        });
    })
}

router.post('/signin',async function(req,res,next)
{
  var func=await check(req.body.email,req.body.password);
  if(func ==1)
  { 
    req.session.email = req.body.email;
    req.session.level=await get_level(req.body.email,req);
    console.log(req.session.username);
    req.session.save();
    console.log(req.session.level);

    res.redirect('/play');
  }
  else if(func == 0)
  {
    res.render('', {func:'wrong_password()',layout: 'signin'});
  }
  else
  {
    res.redirect('/signup');
  }
});

//Play Code
function user_data_check(req)
{
  return new Promise (function(resolve,reject){

    dbo.collection('user_data').findOne({_id:req.session.username},function(error,result){
      console.log('Result (User_Data):',result);
      if(err)
      {
        throw err;
      }
      if(result == null)
      {
        var data=new Array(50);

        var user_data={
          _id: req.session.username,
          data: data,
        }

        dbo.collection('user_data').insertOne(user_data,function(err,result_inside){
          if(err)
            throw err;
          console.log("DOCUMENT INSERTED", result_inside);
          resolve(1);
        });

      }
      else
        resolve(0);
    })

  })
}
router.get('/play', async function(req, res, next) {
  if(req.session.email == undefined)
  {
    res.redirect('/signin');
  }
  else
  {
    var temp= await user_data_check(req);
    console.log('CURRENT LEVEL',req.session.level);
    let currentQuestion = questions[req.session.level-1];
    res.render('index', currentQuestion);
  }
});

function update_level(email, level)
{
  var myquery = {email:email};
  var newvalues={$set :{level:level,last_write: Date.now()} }
  return dbo.collection('main_data').updateOne(myquery, newvalues, function(err, res) {
    if (err) throw err;
    console.log("1 document updated");
  });
}

function update_userdata(ans,q_no,req)
{
  return new Promise(function(resolve,reject){
    dbo.collection('user_data').findOne({_id:req.session.username},function(error,result){
    
      if (err)
        throw err;
      if(result==null)
      {
        resolve(0);
      }
      else
      {
        var data=result.data
        var tobe={
          answer: ans,
          number: q_no
        }
        data.unshift(tobe);
        if(answer.length > 50)
        {
         data.pop();
        }
        var myquery = {_id:result._id};
        var newvalues={$set :{data: data} }
        dbo.collection('user_data').updateOne(myquery, newvalues, function(err, res) {
          if (err) throw err;
          console.log("User_Data Record file updated");
          resolve(1);
        });
      }
    })
  })
}
router.post('/send_data',async function (req, res) { 
  if(req.session.email == undefined)
  {
    res.redirect('/signin');
  }
  else
  {
    var ans=req.body.answer;
    let currentQuestion = questions[req.session.level-1];
    var temp= await update_userdata(ans,currentQuestion.q_no,req);
    if(temp ==1)
    {
      console.log(ans,answer[req.session.level-1]);
      if(ans == answer[req.session.level-1])
      {
        req.session.level++;
        await update_level(req.session.email, req.session.level);
        res.render('index', {...questions[req.session.level-1],func:1});
      }
      else
      { 
        res.render('index', {...currentQuestion,func:0});
      }
      console.log(req.session.level);
    }
    else
    {
      req.session.email=undefined;
      res.redirect('/signin');
    }
  }
 
}) 

//Leaderboard Code
function get_rank(email)
{
  return new Promise(function(resolve,reject){
    leaderboard_id=[];
    leaderboard_level=[];
    itr=0;
  
    dbo.collection('main_data').find().sort({level:-1,last_write:1}).toArray(function(err, result) {
      if (err) 
      {
        throw err;
      }
      var userrank=0;
      while(itr<result.length )
      {
        if(itr<20)
        {
          leaderboard_id.push(result[itr]._id);
          leaderboard_level.push(result[itr].level);
        }
        if(email == result[itr].email)
        {
          userrank=itr+1;
        }
        if(itr >= Math.min(20,result.length)-1 && userrank!=0)
        {
          resolve(userrank);
          return;
        }
        itr++;
      }
  
    });
  })
}

function get_username(email)
{
  return new Promise(function(resolve,reject){
    dbo.collection('main_data').findOne({email:email},function(err,result){
      if(err) throw err;
      resolve(result._id);
      console.log("Username:",result._id);
    });
    })
}

router.get('/leaderboard',async function(req,res,next){
  if(req.session.email == undefined)
  {
    res.redirect('/signin');
  }
  else
  {
    req.session.level=await get_level(req.session.email,req);
    const rank =await get_rank(req.session.email);
    const uname=await get_username(req.session.email);
    console.log("rank is :",rank);
    console.log("THE LEADERBOARD DATA:", leaderboard_id,leaderboard_level);
    res.render('',{layout: 'leaderboard', Rank:rank, User_Id: uname, My_Level:req.session.level, userid_1: leaderboard_id[0], userid_2: leaderboard_id[1], userid_3: leaderboard_id[2], userid_4: leaderboard_id[3], userid_5: leaderboard_id[4], userid_6: leaderboard_id[5], userid_7: leaderboard_id[6], userid_8: leaderboard_id[7], userid_9: leaderboard_id[8], userid_10: leaderboard_id[9], userid_11: leaderboard_id[10], userid_12: leaderboard_id[11], userid_13: leaderboard_id[12], userid_14: leaderboard_id[13], userid_15: leaderboard_id[14], userid_16: leaderboard_id[15], userid_17: leaderboard_id[16], userid_18: leaderboard_id[17], userid_19: leaderboard_id[18], userid_20: leaderboard_id[19], level_1: leaderboard_level[0], level_2:leaderboard_level[1], level_3:leaderboard_level[2], level_4:leaderboard_level[3], level_5:leaderboard_level[4], level_6:leaderboard_level[5], level_7:leaderboard_level[6], level_8:leaderboard_level[7], level_9:leaderboard_level[8], level_10:leaderboard_level[9], level_11:leaderboard_level[10], level_12:leaderboard_level[11], level_13:leaderboard_level[12], level_14:leaderboard_level[13], level_15:leaderboard_level[14], level_16:leaderboard_level[15], level_17:leaderboard_level[16], level_18:leaderboard_level[17], level_19:leaderboard_level[18], level_20:leaderboard_level[19] });
  }
})

});
module.exports = router;