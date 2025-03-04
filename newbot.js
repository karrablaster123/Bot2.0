const {token, guildID, queueChannelID, logChannelID, completedQueueChannelID, adminRoleID} = require('./config.json');
const {Client, Intents, MessageActionRow, MessageButton, MessageEmbed} = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const {EventEmitter} = require('events');
const { parse } = require('path');


const myEventEmitter = new EventEmitter();
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS] });

var queue = [];
var queueChannel, guild, queueMessage, canPingAmateur = true,
penaltyList = [], registerList = [], logChannel, queue =[], queueEmoji,
queueExist = false, queueEmbed, queueData,
lastPingAmateur = 0, totalQueue = 10, timedRemoval = new Map();


var startUp = false;


client.login(token);

client.once('ready', () => {
  console.log("Ready!");

  botSetup(client);

});

async function botSetup(bot){
  console.log("Setting up bot...");
  guild = bot.guilds.cache.get(guildID);
  console.log(bot.guilds.cache)

  try{
    await guild.fetch(true);
    await guild.roles.fetch(true);

  }
  catch(error){
    console.log(error)
    console.error("UNABLE TO FETCH DATA!");
    bot.destroy();
    process.exit(1);
  }

  queueChannel = guild.channels.cache.get(queueChannelID);
  logChannel = guild.channels.cache.get(logChannelID);
  queueEmoji = "👍";



  if(!queueChannel){
    console.error("NO AMATEUR QUEUE CHANNEL FOUND! STOPPING!");
    bot.destroy();
    process.exit(1);

  }


  let guildCommandManager = guild.commands;


  await client.application.commands.set([]);
  await guildCommandManager.set([]);

  console.log("Creating commands...");
  await guildCommandManager.create({
    name: 'pingqueue',
    description: 'Ping Queue',
  }).catch(console.error);
  console.log("Creating commands...2");
  await guildCommandManager.create({
    name: 'remove',
    description: 'Removes a user from queue',
    options: [{
      type: 'USER',
      name: 'user',
      description: 'User for removal',
      required: true,
    }],
  }).catch(console.error);
  console.log("Creating commands...3");
  await guildCommandManager.create({
    name: 'qa',
    description: 'Sends the current amateur queue list',
  }).catch(console.error);
  console.log("Creating commands...4");
  await guildCommandManager.create({
    name: 'kys',
    description: 'kms ',
  }).catch(console.error);

  console.log("Getting Completed Queue channel data and deleting.");
  let completedQueueChannel = guild.channels.cache.get(completedQueueChannelID);
  await completedQueueChannel.messages.fetch();
  if(completedQueueChannel.messages.cache.size > 10){
    //await completedQueueChannel.send("1v1 mid me desire are u afraid?");
    completedQueueChannel.bulkDelete(completedQueueChannel.messages.cache.size).catch(console.error);
  }
  console.log("Getting Amateur Queue channel data.");
  await queueChannel.messages.fetch();

  myEventEmitter.emit('queueStart');


}

client.on('interactionCreate', async interaction => {
  if(interaction.guild.id != parseInt(guildID, 10)){
    return;
  }

  if(interaction.isButton()){
    if(interaction.customId == 'JoinAmateur'){
      await interaction.deferReply({ephemeral: true});
      myEventEmitter.emit('queueJoin', interaction.user, interaction);
    }

    else if(interaction.customId == 'LeaveAmateur'){
      await interaction.deferReply({ephemeral: true});
      myEventEmitter.emit('queueLeave', interaction.user, interaction);
    }
  }

  else if(interaction.isCommand()){

    await interaction.deferReply({ephemeral: true});
    processCommands(interaction);


  }

  else{
    return;
  }

});

process.once('SIGTERM', async () => {

	console.info('SIGTERM signal received.');

	await queueMessage.delete();
  //await logChannel.send('The bot is shutting down.');
  await guild.commands.set([]);
  await queueChannel.send('The bot has shut down. Please contact joe for a restart!');

	client.destroy();
	console.info('Shutdown Completed!');
	process.exit(0);



});


myEventEmitter.on('queueJoin', async (user, interaction) =>{

  if(queue.some(u => u.id == user.id)) {
    await interaction.editReply({ content: 'You are already in Queue', ephemeral: true });
    return;
  }
  else {
    await interaction.editReply({ content: 'You are now in the Queue', ephemeral: true });
    queue.push(user);
    timedRemoval.set(user.id, setTimeout(() => {myEventEmitter.emit('queueLeave', user, false)}, 7200000));
    queueEmbed.setDescription(queue.join('\r\n').toString());
    queueEmbed.setTitle('Current Queue: ' + queue.length + '/' + totalQueue);
    queueMessage.edit({embeds: [queueEmbed], components: [queueData]});
  }

  if(queue.length == totalQueue){
    queueExist = false;
    timedRemoval.forEach((value) => {
      clearTimeout(value);
    })
    await queueMessage.delete();
    myEventEmitter.emit('queueStart');
    
    
  }

});

myEventEmitter.on('queueLeave', async (user, interaction) =>{
  if(queue.some(u => u.id == user.id)){
    queue.splice(queue.indexOf(user), 1);
    queueEmbed.setDescription(queue.join('\r\n').toString());
    queueEmbed.setTitle('Current Queue: ' + queue.length + '/' + totalQueue);
    queueMessage.edit({embeds: [queueEmbed], components: [queueData]});

    clearTimeout(timedRemoval.get(user.id));

    if(!interaction){
      await user.send('You have been removed from the Queue as a precautionary measure').catch(console.error);
      await logMessage(user.toString() + ' removed');
      return;
    }

    if(interaction.isButton()){
      await interaction.editReply({ content: 'You have left the Queue', ephemeral: true });
    }
    else if(interaction.isCommand()){
      await logMessage(user.toString() + " was removed by " + interaction.user.username);
      await interaction.editReply({content:'The user was removed'});
    }
  }
  else{

    if(!interaction){
      console.log("That user has already left the queue, or the queue has completed");
      await logMessage(user.toString() + ' couldn\'t be removed from Queue');
      return;
    }

    if(interaction.isButton()){
      await interaction.editReply({ content: 'You weren\'t in the Queue', ephemeral: true });
    }
    else if(interaction.isCommand()){
      await interaction.editReply({content:'That user doesn\'t exist in the queue'});
    }


    return;
  }
});

myEventEmitter.on('queueStart', async () => {
  console.log("Starting Queue");
  if(queueExist){
    console.log("Queue already exists!");

  }
  else {

    queueExist = true;
    canPingAmateur = true;
    queueData = new MessageActionRow()
    .addComponents(
      [new MessageButton()
        .setCustomId('JoinAmateur')
        .setLabel('Join')
        .setStyle('PRIMARY')
        .setEmoji(queueEmoji),
        new MessageButton()
        .setCustomId('LeaveAmateur')
        .setLabel('Leave')
        .setStyle('DANGER')

      ]
    );

    queueEmbed = new MessageEmbed()
      .setColor('#ADD8E6')
      .setTitle('Current Queue')
      .setDescription(' ');
    console.log("Clearing Queue Channel");
    queueChannel.bulkDelete(queueChannel.messages.cache.size).catch(console.error);

    if(queue.length == totalQueue){
      await queuePopped();

      queue = [];
    }
    else{
        queue = [];
    }


    console.log("Sending Queue Message");
    queueMessage = await queueChannel.send({embeds: [queueEmbed], components: [queueData]});


    if(!startUp){
      console.log("Setup Complete!");
      startUp = true;
    }




  }
});

function processCommands(cI){


  if(cI.commandName == 'qa'){
    //console.log(cI);

    if(queue.length > 0 && queueExist){

      cI.editReply({content: queue.join('\r\n').toString()});
    }
    else{
      cI.editReply({content: 'Queue is empty or is not active'});
    }
  }

  else if(cI.commandName == 'remove'){


    if(cI.member._roles.includes(adminRoleID)){
      myEventEmitter.emit('queueLeave', cI.options.getUser('user'), cI);



    }
    else{
      cI.editReply({content: 'You need to be a mod or admin to run this command.'});



    }
  }
  else if(cI.commandName == 'pingqueue'){
    cI.editReply({content: 'This does not currently work.'});;

  }

  else if (cI.commandName == 'kys'){
    if (cI.member._roles.includes(adminRoleID)){
      death(cI)
      
    }
    else{
      cI.editReply({content: 'No I don\'t think so!'});
    }
  }

  //return reply;
}

async function death(cI){
  await cI.editReply({content: 'kbye!'});
  console.log("Death comes for us all.");
  await queueMessage.delete();
  //await logChannel.send('The bot is shutting down.');
  await guild.commands.set([]);
  await queueChannel.send('The bot has shut down. Please contact joe for a restart!');

	client.destroy();
	console.info('Shutdown Completed!');
	process.exit(0);
}

async function pingAmateur(cI){

  let amateurPingRole = guild.roles.cache.get('701027603653328968');
  pingString = amateurPingRole.toString() + ' +' + (10 - queue.length) + ' Go to ' + queueChannel.toString() + ' to join';

  if(!queueExist){
    await cI.editReply({content: 'No Queue exists'});


    return;
  }

  let timeSinceLastPing = Date.now() - lastPingAmateur;

  if(timeSinceLastPing > 600000){
    canPingAmateur = true;
  }

  if(cI.member._roles.includes('681176329554886714') || cI.member._roles.includes('696355198083399730'))
  {
    await cI.followUp({content: 'Pinging!'});
    await cI.channel.send(pingString);
    return;
  }
  else if(!canPingAmateur){
    let timeRemaining = (600000 - timeSinceLastPing)/1000;
    await cI.editReply({content: 'You cannot ping for another ' + Math.round(timeRemaining) + ' seconds.'});
  }
  else if(queue.some(u => u.id == cI.user.id)){
    await cI.followUp({content: 'Pinging'});
    await cI.channel.send(pingString);
    lastPingAmateur = Date.now();
    canPingAmateur = false;
    return;
  }
  else{
    await cI.editReply({content: 'You are not in Queue and therefore cannot ping'});
    return;
  }

}



async function queuePopped(){
  let completedQueueChannel = guild.channels.cache.get(completedQueueChannelID);
  //let lobbyMaker = [];
  /*
  await guild.members.fetch();
  for (u of queue){
    let member = guild.members.cache.find(m => m.user.id == u.id);
    if(member.roles.cache.some(r => r.id == parseInt(adminRoleID, 10))){
      lobbyMaker.push(member.user);
    }

  } 
  */

  completedQueueChannel.send('Queue popped! \n' + queue.join('\r\n').toString());
  /*
  if(lobbyMaker.length > 0){
    completedQueueChannel.send('Queue popped! \n' + queue.join('\r\n').toString());
  }
  else{

    let adminRole = await guild.roles.cache.get(adminRoleID);
    
    //completedQueueChannel.send('Queue popped! \n' + queue.join('\r\n').toString() + '\nLobby Makers:\n' + adminRole.toString());
  }*/
}

async function logMessage(msg) {
  if (!logChannel){
    return;
  }

  await logChannel.send(msg);
}
