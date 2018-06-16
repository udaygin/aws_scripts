#!/bin/bash
#shuts down current machine if there are no active ssh sessions for configured duration
#run every 1 min
# * * * * *  /home/ec2-user/shutdownIfSshIdle.sh
#allowed invactive time in minutes before shutdown
inactive_max=5


COUNTER_FILE=/tmp/inactive_counter
LOG_FILE=/tmp/cron_log
current_date=$(date)
echo "=================== Ssh Idle check : $current_date ========================" >> $LOG_FILE
#read counter file if it exists or boot strap it with 0
if [ -f $COUNTER_FILE ]; then
  counter=`cat $COUNTER_FILE`
  if [ $counter = "" ]; then
      echo "counter=$counter is empty or invalid. setting it to zero" >> $LOG_FILE
      counter="0"
  fi
else
  echo "0" >$COUNTER_FILE
  counter="0"
fi
echo "counter = $counter" >> $LOG_FILE

ssh_sessions=$(netstat -an | grep ":22[^\n]*ESTABLISHED" | wc -l)
echo "ssh_sessions = $ssh_sessions" >> $LOG_FILE

#if there are any active sessions , update counter to 0 ane exit
if [ $ssh_sessions -gt "0" ]; then
  echo "0" >$COUNTER_FILE
  echo "Reset the counter to 0 and exit...!" >> $LOG_FILE
  echo "----------------------- Done : $current_date ---------------------------" >> $LOG_FILE
else
  counter=`expr $counter + 1`
  echo "increment counter.. it is now $counter" >> $LOG_FILE

  if [ $counter -gt $inactive_max ]; then
    echo " time to shutdown. update counter to 0 and write it back to file" >> $LOG_FILE

    counter="0"
    echo $counter >$COUNTER_FILE
    echo "----------------------- Done : $current_date ---------------------------" >> $LOG_FILE
    #time to shutdown
    echo "Shutting down..." >> $LOG_FILE
    sudo shutdown -h now
  else
    echo "write counter $counter back to file and exit" >> $LOG_FILE
    echo $counter >$COUNTER_FILE
    echo "----------------------- Done : $current_date ---------------------------" >> $LOG_FILE
  fi

fi
