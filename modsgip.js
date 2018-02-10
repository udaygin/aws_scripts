/**
Author : Uday G
Git Id : udaygin
Warning : this script is a work in progress. this works but has not been tested enough and also a bit ugly code.
Description : You can use this to auto update your aws security group to allow ssh
              only from your public ip that is provided by your isp. this helps in
              reducing the number of IPs that can connect to your aws instance.
*/
'use strict';

var config = {
  port : 22 ,
  service : "ssh",
  securityGroupId : "sg-000000"
}

// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
// Set the region
AWS.config.update({region: 'us-east-1'});
var http = require('http');
// Create EC2 service object
var ec2 = new AWS.EC2({apiVersion: '2016-11-15'});
var machineIp = "";
var params = {
  GroupIds: [config.securityGroupId]
};
var options = {
  host: 'v4.ifconfig.co',
  port: 80,
  path: '/json',
  method: 'GET'
};

function getIpPermission(ip){
  return {
      "FromPort": config.port,
      "IpProtocol": "tcp",
      "IpRanges": [
          {
              "CidrIp": ip+"/32",
              "Description": "Allow "+config.service+" from "+ip
          }
      ],
      "ToPort": config.port
  };
}

console.log("Fetching this machine (SSH client) IP");
http.request(options, function(res) {
  res.on('data', function (chunk) {
    // console.log(chunk);
    machineIp = JSON.parse(chunk.toString()).ip;
    console.log('machineIp = ' + machineIp);
    if(!machineIp)
      return;

    console.log( "Retrieve security group details")
    ec2.describeSecurityGroups(params, function(err, data) {
       if (err) { console.log("Error", err); } else {
          let params = data.SecurityGroups[0];

          console.log("Success. Retrieved : \n Name : " + params.GroupName
          + "\n Description : "+ params.Description + "\n"
          + ((params.IpPermissions.length > 0)? "CidrIp : "+params.IpPermissions[0].IpRanges[0].CidrIp : "" ));

          delete params.OwnerId;
          delete params.Description;
          delete params.IpPermissionsEgress;
          delete params.VpcId;
          delete params.Tags;
          console.log("Checking if there are existing rules...")
          if (params.IpPermissions.length > 0) {
              console.log("Yes! Checking to see if "+ machineIp+"/32 is already present in security group");
              if(params.IpPermissions.length == 1
                && params.IpPermissions[0].IpRanges.length == 1
                 && params.IpPermissions[0].IpRanges[0].CidrIp == machineIp+"/32"){
                   console.log("Yes it is! Not changing any thing. ")
                 }else{
              console.log(`Nope! Removing ${params.IpPermissions.length} ingress rules`);
              delete params.IpPermissions[0].PrefixListIds;
              delete params.IpPermissions[0].UserIdGroupPairs;
              delete params.IpPermissions[0].Ipv6Ranges;

              ec2.revokeSecurityGroupIngress(params, (err) => {
                if (err) {
                  console.log("Error", err);
                }else{
                    console.log("Revoke done!!! appending a new one to allow "+machineIp+"/32");
                    params.IpPermissions[0] = getIpPermission(machineIp);
                    ec2.authorizeSecurityGroupIngress(params, (err, data) => {
                      if (err) { console.log("Error", err); }else{
                        console.log('authorize for ' + machineIp + ' done');
                      }
                    });
                  }
                }); // --------end revokeSecurityGroupIngress()
              }
        } else {
          console.log('No ingress rules found. appending a new one to allow '+machineIp+"/32");
          params.IpPermissions[0] = getIpPermission(machineIp);
          ec2.authorizeSecurityGroupIngress(params, (err, data) => {
            if (err) { console.log("Error", err); }else{
              console.log('authorize for ' + machineIp + ' done');
            }
          });
        }
       }
    });
});
}).end();
