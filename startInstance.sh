#!/bin/bash

instance_id=$1
echo "instance id = $instance_id"
#TODO : figure out why below command line parameter is empty
alias_from_ssh_config=$2
if [ !$alias_from_ssh_config ]; then
  alias_from_ssh_config="aws0"
fi

echo "alias_from_ssh_config = $alias_from_ssh_config"
old_ip=$(ssh -G $alias_from_ssh_config | grep -oE "\b([0-9]{1,3}\.){3}[0-9]{1,3}\b")
echo "old ip from ~/.ssh/config = $old_ip"

echo "starting $instance_id..."
aws ec2 start-instances --instance-ids $instance_id
aws ec2 wait instance-running --instance-ids $instance_id
echo "started."

public_ip=$(aws ec2 describe-instances   --query "Reservations[*].Instances[*].PublicIpAddress" --output=text --instance-ids $instance_id)

if [ "$old_ip" == "$public_ip" ]; then
  echo "IP upto date. not updating in ~/.ssh/config "
else
  echo "trying to update old ip $old_ip in ~/.ssh/config file with new ip $public_ip"
  sed -i "s/$old_ip/$public_ip/g" ~/.ssh/config
fi
# Probe SSH connection until it's avalable
X_READY=''
while [ ! $X_READY ]; do
    echo "- Waiting for ready status"
    set +e
    OUT=$(ssh -o ConnectTimeout=1 -o StrictHostKeyChecking=no -o BatchMode=yes ec2-user@$public_ip 2>&1 | grep 'Permission denied' )
    [[ $? = 0 ]] && X_READY='ready'
    set -e
    sleep 10
done
