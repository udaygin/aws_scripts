'use strict';
var AWS = require('aws-sdk');
var fws = require('fixed-width-string');
var chalk = require('chalk');
var util = require('util');
var config = require("./config");
AWS.config.update({region: config.aws_region});
// uncomment below line if you are using a readonly profile for this command and update that profile name 
// var credentials = new AWS.SharedIniFileCredentials({profile: 'ec2-readonly'});
// AWS.config.credentials = credentials;
var ec2 = new AWS.EC2({apiVersion: 'latest'});
var param = {};

var request = ec2.describeInstances(param);
request.on('success', function(response) {
    console.log("-----------------------------------------------------------------------------")
    console.log(
      fws(chalk.green("Instance Name "),28)
      +" | "+fws(chalk.green("State"),13)
      +" | "+ fws(chalk.green(" Private Ip"),13)
      +" | "+fws(chalk.green("Public Ip"),13)
  );
    console.log("-----------------------------------------------------------------------------")
// console.log(response.data.Reservations.length);
response.data.Reservations.forEach(function(reservation){
  reservation.Instances.forEach(function(instance){
    var name = "NA";
    instance.Tags.forEach(function(tag){
      if( tag.Key === 'Name' ) name = tag.Value ;
    });

// console.log(fixedWidthString(chalk.green('hello') + ' ' + chalk.red('world'), 8));
    console.log(
      fws(name,28) +" | "
      + ((instance.State.Name === 'stopped')? fws(chalk.gray(instance.State.Name),13) : fws(chalk.yellow(instance.State.Name),13))+" | "
      + fws(instance.PrivateIpAddress,13) +" | "
      + fws(instance.PublicIpAddress,13)
    );
  });
});
console.log("-----------------------------------------------------------------------------")
  }).
  on('error', function(response) {
    console.log("Error!");
  }).
send();
