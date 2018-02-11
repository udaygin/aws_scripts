/**
Author : Uday G
Git Id : udaygin
Description : You can use this to auto update your aws security group to allow ssh
              only from your public ip that is provided by your isp. this helps in
              reducing the number of IPs that can connect to your aws instance.
*/
'use strict';
var AWS = require('aws-sdk');
var chalk = require('chalk');
var http = require('http');
var rp = require('request-promise');
// Create EC2 service object
var config = require("./config");
AWS.config.update({region: config.aws_region});
var ec2 = new AWS.EC2({apiVersion: '2016-11-15'});

//util sync methods
function getIpPermissionObjectFor(ip){
  return {
      "FromPort": config.modsgip.port,
      "IpProtocol": "tcp",
      "IpRanges": [{
              "CidrIp": ip+"/32",
              "Description": "Allow "+config.modsgip.service_name+" from "+ip
      }],
      "ToPort": config.modsgip.port
  };
}

function transformSgDataForRevokeAccess(params){
  var result = JSON.parse(JSON.stringify(params));
  delete result.OwnerId;
  delete result.Description
  delete result.IpPermissionsEgress
  delete result.VpcId
  delete result.Tags
  delete result.IpPermissions[0].PrefixListIds
  delete result.IpPermissions[0].UserIdGroupPairs
  delete result.IpPermissions[0].Ipv6Ranges
  return result;
}

function transformSgDataForAuthorizeAccess(params,machineIp){
  var result = JSON.parse(JSON.stringify(params));
  delete result.OwnerId;
  delete result.Description
  delete result.IpPermissionsEgress
  delete result.VpcId
  delete result.Tags
  result.IpPermissions[0] = getIpPermissionObjectFor(machineIp);
  return result;
}

//async methods
var getMachineIp = function() {
  var options = {
    uri: 'http://v4.ifconfig.co/json',
    json: true // Automatically parses the JSON string in the response
  };
  return rp(options);
}

var getSecurityGroups =  function() {
  var params = {
    GroupIds: [config.modsgip.securityGroupId]
  };
  return ec2.describeSecurityGroups(params).promise();
}

var removeExistingIpsInSg = function(securityGroup){
  var params = transformSgDataForRevokeAccess(securityGroup);
  return ec2.revokeSecurityGroupIngress(params).promise();
}

var authorizeIp = function(securityGroup,machineIp){
  var params = transformSgDataForAuthorizeAccess(securityGroup,machineIp);
  return ec2.authorizeSecurityGroupIngress(params).promise();
}

var modifySgForIpBasedOnExistingState = function(args){
  if(args.ipInSgState === 'match_found'){
    console.log(chalk.yellow('This machine\'s IP is already authorized in the security group.'))
  }else if(args.ipInSgState === 'mismatch'){
    return removeExistingIpsInSg(args.securityGroup)
    .then(authorizeIp(args.securityGroup,args.machineIp))
    .then(function(data){ console.log(chalk.yellow("Ip updated in to Security group! ")); })
    .catch((error) => {
        console.log(error,'Promise error');
      });
  }else if(args.ipInSgState === 'no_rules'){
    return authorizeIp(args.securityGroup,args.machineIp)
    .then(function(data){ console.log(chalk.yellow("Ip added to security group!")); })
    .catch((error) => {
        console.log(error,'Promise error');
      });
  }
  return;
}

function searchForIpMatchInSgRules([getMachineIpRespnose, securityGroupData]){
  var machineIp = getMachineIpRespnose.ip;
  console.log("This machine\'s public IP : "+chalk.blue(machineIp));
  var securityGroup = securityGroupData.SecurityGroups[0];
  var ipInSgState = "";
  if (securityGroup.IpPermissions.length > 0) {
      if(securityGroup.IpPermissions.length == 1
        && securityGroup.IpPermissions[0].IpRanges.length == 1
         && securityGroup.IpPermissions[0].IpRanges[0].CidrIp == machineIp+"/32"){
           ipInSgState= "match_found";
         }else{
            ipInSgState = "mismatch";
         }
    }else{
           ipInSgState = "no_rules";
    }
  console.log("Check if "+chalk.blue(machineIp)+" allowed in security group("+config.modsgip.securityGroupId+") :: "+ ((ipInSgState === "match_found")? chalk.green(ipInSgState) : chalk.red(ipInSgState)));
  return {"machineIp":machineIp,"ipInSgState":ipInSgState,"securityGroup":securityGroup};
}
// async methods -- done
console.log("============================== "+chalk.cyan.bold("Start")+" ===================================")
console.log("Fetching Security Group details from aws ...")
Promise.all([getMachineIp(), getSecurityGroups()])
  .then(searchForIpMatchInSgRules)
  .then(modifySgForIpBasedOnExistingState)
  .then(function(){ console.log("============================== "+chalk.cyan.bold("Done")+" ===================================")})
  .catch((error) => {
      console.log(error,'Promise error');
    });
//thats all folks!
