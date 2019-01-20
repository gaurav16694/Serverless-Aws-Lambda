const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const express = require('express');
const app = express();
const AWS = require('aws-sdk');
const uuid = require('node-uuid');

const { SocialMapTABLE, ScoreTABLE ,IS_OFFLINE} = process.env;
const dynamoDb = IS_OFFLINE === 'true' ?
  new AWS.DynamoDB.DocumentClient({
    region: 'localhost',
    endpoint: 'http://localhost:8000',
  }):
  new AWS.DynamoDB.DocumentClient();
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/',(req,res)=>{
  res.send('<h2>Dummy App </h2>');
});

//main api for getting score
app.get('/scores', async (req, res) => {
  const GameId = req.query.GameId;
  const SocialId = req.query.SocialId;
  if(!GameId)
   return  res.json({'message':'please provide a game id'});
 if(!SocialId)
   return  res.json({'message':'please provid  social id'});

  var SocialIds = {};
  var index = 0;
  SocialId.forEach(function(value) {
      index++;
      var socialkey = ":socialvalue"+index;
      SocialIds[socialkey.toString()] = value;
  });
  const params = {
    TableName: SocialMapTABLE,
    ProjectionExpression:'UserId',
    FilterExpression:"GameId = :GameId AND SocialId IN ("+Object.keys(SocialIds).toString()+ ")",
    ExpressionAttributeValues: Object.assign(SocialIds, {':GameId':GameId}) ,
  };

  var data;
  await new Promise((resolve, reject) => {
    dynamoDb.scan(params, (error, result) => {
    if (error) {
      res.status(400).json(error);
      reject();
    }
     data  = result.Items;
     resolve();
   });
  })
  var userIds = {};
  var index1 = 0;
  data.forEach(function(value) {
      index1++;
      var Userkey = ":UserIdIvalue"+index1;
      userIds[Userkey.toString()] = `${GameId}x${value.UserId}`;
  });
  var  params1 = {
    TableName: ScoreTABLE,
   // ProjectionExpression:'Score',
    FilterExpression:"GameIdxUserId IN ("+Object.keys(userIds).toString()+ ")",
    ExpressionAttributeValues: userIds  ,
  };
  var score;
  await new Promise((resolve,reject)=>{
    dynamoDb.scan(params1, (error, result) => {
    if (error) {
      res.status(400).json(error);
      reject();
    }
    score= result.Items;
    resolve();

   });
  });
 
    var output={};
    output['score']=[];
    var index2 = 0;
    score.forEach(function(value){
      data= {
        "LevelId":value.Level,
        "GameId": GameId,
        "ScoreValue":value.Score,
        "UserId":value.UserId
      };
      output['score'].push(data);
    });
     return res.json(output);
  
});

//api for getting all social maps
app.get('/get_maps', (req, res) => {
  const params = {
    TableName: SocialMapTABLE,
  };
  dynamoDb.scan(params, (error, result) => {
    if (error) {
      res.status(400).json({ error: 'error getting'});
    }

    const { Items: map } = result;

    res.json({ map });
  })
});
//api for getting all scores

app.get('/get_scores', (req, res) => {
  const params = {
    TableName: ScoreTABLE,
  };
  dynamoDb.scan(params, (error, result) => {
    if (error) {
      res.status(400).json({ error: 'error getting'});
    }

    const { Items: map } = result;

    res.json({ map });
  })
});

//api for inserting social mapping
app.post('/social_map', (req, res) => {
  const GameId = req.body.GameId;
  const SocialId = req.body.SocialId;
  const UserId = req.body.UserId;

  const params = {
    TableName: SocialMapTABLE,
    Item: {GameId:GameId,SocialId:SocialId,UserId:UserId},
  };
  console.log(params);

  dynamoDb.put(params, (error) => {
    if (error) {
      console.log('error inserting: ', error);
      res.status(400).json({ error: 'error inserting' });
      
    }
    else
    {
      res.json(params);
    }
    ;
  });
});

//api for inserting score
app.post('/score', (req, res) => {
  const GameId = req.body.GameId;
  const Score = req.body.Score;
  const UserId = req.body.UserId;
  const Level = req.body.Level;

  var GameIdxUserId = `${GameId}x${UserId}`;

  const params = {
    TableName: ScoreTABLE,
    Item: {GameIdxUserId:GameIdxUserId,Score:Score,UserId:UserId,Level:Level},
  };
  dynamoDb.put(params, (error) => {
    if (error) {
      console.log('Error inserting: ', error);
      res.status(400).json({ error: 'error inserting' });
    }
    else
    {
      res.json(params);
    }
    ;
  });


});

module.exports.handler = serverless(app);